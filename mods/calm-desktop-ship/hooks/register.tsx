import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Jobs } from '../types'
import { SHIP_ALT, SHIP_HEIGHT, SHIP_SVG, SHIP_WIDTH } from './ship'

const SHIP = {
  source: SHIP_SVG,
  alt: SHIP_ALT,
  width: SHIP_WIDTH,
  height: SHIP_HEIGHT,
  isInteractive: true,
}

const jobs = atom({ plugin: 'calm-desktop-ship', key: 'jobs' } as const, [] as Jobs)

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

export const register: Register = on => {
  // The band, not the Spinner row: the app keeps its own row while a tool runs and clamps a Spinner frame to one line
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.hasSurvey) return next(e)
    if (!e.props.isWorking && (await read($, jobs)).length === 0) return next(e)
    if (!(await isCalmOn($))) return next(e)

    const { Svg } = $.ui.resolve(e)

    return <Svg {...SHIP} />
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
