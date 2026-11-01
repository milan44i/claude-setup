import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Jobs, Kraken, SeaState } from '../types'
import { SHIP_HEIGHT, SHIP_WIDTH, shipAlt, shipSvg } from './ship'
import {
  estimateTokens,
  hasFailedChecks,
  isKrakenSized,
  isNightHour,
  isStormy,
  krakenLine,
  parseRecordedPr,
  seaForFill,
} from './weather'
import type { RecordedPr } from './weather'

// A marker-file check here would run gh-axi on PRs named by any repo that carries those files
const FIRSTMATE_HOME = '/Users/milanstankovic/work/firstmate'
const WEATHER_MS = 60_000
const CHECKS_MS = 5 * 60_000
const KRAKEN_MS = 30_000
const KRAKEN_HINT = 'The Kraken names the tool call whose one result passed about 10k tokens of context.'

const jobs = atom({ plugin: 'calm-desktop-ship', key: 'jobs' } as const, [] as Jobs)
const fill = atom({ plugin: 'calm-desktop-ship', key: 'fill' } as const, 'calm' as SeaState)
const hasRedChecks = atom({ plugin: 'calm-desktop-ship', key: 'hasRedChecks' } as const, false as boolean)
const isNight = atom({ plugin: 'calm-desktop-ship', key: 'isNight' } as const, false as boolean)
const kraken = atom({ plugin: 'calm-desktop-ship', key: 'kraken' } as const, null as Kraken)

// A monitor's event carries its task id too, and only a finished task's notification has a status
const FINISHED_JOB = /<task-id>([^<]+)<\/task-id>[\s\S]*?<status>/

const addJob = ($: EngineInterface, id: string) => update($, jobs, ids => [...ids, id])

const removeJob = ($: EngineInterface, id: string) =>
  update($, jobs, ids => ids.filter(job => job !== id))

// fs.exists comes first because a rejected stat is an error in the debug log, once per drawing
const isHome = async ($: EngineInterface, root: string) => {
  if (!(await $.fs.exists(`${root}/bin/fm-crew-state.sh`))) return false

  const state = await $.fs.stat(`${root}/state`).catch(() => undefined)

  return state?.kind === 'dir'
}

const isCalmOn = async ($: EngineInterface) => {
  if ((await $.env.get('CLAUDE_CODE_ENABLE_FUNCTION_HOOKS')) !== '1') return false

  const root = await $.session.root()
  const preference = `${root}/config/calm`

  return (
    (await isHome($, root)) &&
    (await $.fs.exists(preference)) &&
    (await $.fs.read(preference)).trim() === 'on'
  )
}

const readWeather = async ($: EngineInterface) => {
  const [usage, now] = await Promise.all([$.session.usage(), $.clock.now()])

  await update($, fill, () => seaForFill(usage.context.percent ?? 0))
  await update($, isNight, () => isNightHour(new Date(now).getHours()))
}

const readRecordedPrs = async ($: EngineInterface) => {
  const state = `${FIRSTMATE_HOME}/state`
  const metas = (await $.fs.list(state)).filter(({ name }) => name.endsWith('.meta'))
  const bodies = await Promise.all(metas.map(({ name }) => $.fs.read(`${state}/${name}`)))

  return bodies.map(parseRecordedPr).filter(pr => pr !== undefined)
}

const readChecks = async ($: EngineInterface, { host, repo, number }: RecordedPr) => {
  const checks = await $.process
    .run(['gh-axi', 'pr', 'checks', number, '--repo', repo], { env: { GH_HOST: host } })
    .catch(() => undefined)

  return checks === undefined ? undefined : hasFailedChecks(checks.stdout)
}

// Only a drawn ship can use the answer, so a session with none spends no calls on GitHub
const pollChecks = async ($: EngineInterface) => {
  if ((await $.session.root()) !== FIRSTMATE_HOME) return
  if (!(await $.session.surfaces()).includes('desktop') || !(await isCalmOn($))) return

  const prs = await readRecordedPrs($)
  const readings = await Promise.all(prs.map(pr => readChecks($, pr)))

  await update($, hasRedChecks, last => isStormy(readings, last))
}

const callName = (e: { tool: string; command?: unknown; file_path?: unknown }) => {
  if (typeof e.command === 'string') return e.command

  return typeof e.file_path === 'string' ? `${e.tool} ${e.file_path}` : e.tool
}

// A Text line has no CSS to end it, so the timer clears the state; the tentacle sinks by SMIL
const seize = async ($: EngineInterface, id: string, line: string) => {
  await update($, kraken, () => ({ id, line }))
  $.clock.after(KRAKEN_MS, () => {
    void update($, kraken, held => (held?.id === id ? null : held))
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    // A reload cancels the timer that would have cleared it
    await update($, kraken, () => null)

    if (await isHome($, await $.session.root())) {
      // A failed read keeps the last answer, and a rejection here would end the interval
      const weatherTick = () => readWeather($).catch(() => undefined)
      const checksTick = () => pollChecks($).catch(() => undefined)

      void weatherTick()
      void checksTick()
      $.clock.every(WEATHER_MS, weatherTick)
      $.clock.every(CHECKS_MS, checksTick)
    }

    return started
  })

  // The band, not the Spinner row: the app keeps its own row while a tool runs and clamps a Spinner frame to one line
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.hasSurvey) return next(e)
    if (!e.props.isWorking && (await read($, jobs)).length === 0) return next(e)
    if (!(await isCalmOn($))) return next(e)

    const beneath = await next(e)
    const { Box, Svg, Text } = $.ui.resolve(e)
    const hinted = (key: string, line: string, hint: string) => (
      <Box key={key}>
        <Text dimColor>{line}</Text>
        <Box position="absolute" top={0} right={0} display="none" hover={{ display: 'flex' }}>
          <Text dimColor>{hint}</Text>
        </Box>
      </Box>
    )
    const seized = await read($, kraken)
    const scene = {
      sea: (await read($, hasRedChecks)) ? ('storm' as const) : await read($, fill),
      isNight: await read($, isNight),
      hasKraken: seized !== null,
    }

    return (
      <Box flexDirection="column">
        <Svg
          source={shipSvg(scene)}
          alt={shipAlt(scene)}
          width={SHIP_WIDTH}
          height={SHIP_HEIGHT}
          isInteractive
        />
        {seized === null ? null : hinted('kraken', seized.line, KRAKEN_HINT)}
        {beneath}
      </Box>
    )
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)

    if (e.agentId === undefined && ran.deny === undefined) {
      const tokens = estimateTokens(ran.result)

      if (isKrakenSized(tokens)) await seize($, e.tool_use_id, krakenLine(callName(e), tokens))
    }

    return ran
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)

    if (
      e.agentId === undefined &&
      ran.deny === undefined &&
      ran.isError !== true &&
      ran.result.backgroundTaskId !== undefined &&
      ran.result.backgroundEndsWithFinalResponse !== true
    ) {
      await addJob($, ran.result.backgroundTaskId)
    }

    return ran
  })

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const ran = await next(e)

    if (
      e.agentId === undefined &&
      ran.deny === undefined &&
      ran.isError !== true &&
      'status' in ran.result
    ) {
      const { result } = ran

      if (result.status === 'async_launched') await addJob($, result.agentId)
      if (result.status === 'remote_launched') await addJob($, result.taskId)
    }

    return ran
  })

  on('tool.call', { tool: 'Workflow' }, async ($, e, next) => {
    const ran = await next(e)

    if (e.agentId === undefined && ran.deny === undefined && ran.isError !== true) {
      await addJob($, ran.result.taskId)
    }

    return ran
  })

  // A persistent monitor runs until the session ends, so it would pin the boat with nothing working
  on('tool.call', { tool: 'Monitor' }, async ($, e, next) => {
    const ran = await next(e)

    if (
      e.agentId === undefined &&
      ran.deny === undefined &&
      ran.isError !== true &&
      ran.result.persistent !== true
    ) {
      await addJob($, ran.result.taskId)
    }

    return ran
  })

  on('tool.call', { tool: 'TaskStop' }, async ($, e, next) => {
    const ran = await next(e)

    if (ran.deny === undefined && ran.isError !== true) await removeJob($, ran.result.task_id)

    return ran
  })

  on('prompt.submit', async ($, e, next) => {
    const finished = e.origin.kind === 'task-notification' ? FINISHED_JOB.exec(e.text) : null

    if (finished !== null) await removeJob($, finished[1])

    return next(e)
  })
}
