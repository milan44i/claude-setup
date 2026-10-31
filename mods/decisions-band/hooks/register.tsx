import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Decision } from '../types'
import {
  EXPLAIN_SYSTEM,
  explainPrompt,
  localDate,
  parseDecisions,
  printable,
  reportNamedIn,
  waitingLabel,
} from './decisions'

// A marker-file check here would run a script from any repo that carries those files
const HOME = '/Users/milanstankovic/work/firstmate'
const REFRESH_MS = 60_000
const EXPLAIN_MS = 120_000
const EXPLAINER = 'Lists the decisions waiting on you, click to open them.'
const LOADING = 'Explaining...'
const PANE = 'decisions'
const TITLE = 'Decisions'

const decisions = atom({ plugin: 'decisions-band', key: 'decisions' } as const, [] as readonly Decision[])
const explanations = atom(
  { plugin: 'decisions-band', key: 'explanations' } as const,
  {} as Readonly<Record<string, string>>,
)
// Not in $.state, because a reload drops the running call and a kept id would block its row for good
const asking = new Set<string>()

const isHome = async ($: EngineInterface) => (await $.session.root()) === HOME

const refresh = async ($: EngineInterface) => {
  if (!(await isHome($))) return

  // An expired date gate leaves the held state, so that state alone would never bring a row back
  const { exitCode, stdout } = await $.process.run([
    `${HOME}/bin/fm-tasks-axi.sh`,
    'list',
    '--limit',
    '1000',
    '--fields',
    'hold_kind,hold_reason,hold_until',
  ])

  if (exitCode !== 0) return

  const hidden = await $.store.keys()
  const found = parseDecisions(stdout, localDate(await $.clock.now())).filter(({ id }) => !hidden.includes(id))

  // A rewrite of the same list redraws the panel under a scroll in progress
  if (JSON.stringify(found) !== JSON.stringify(await read($, decisions))) await update($, decisions, () => found)
}

const drop = async ($: EngineInterface, id: string) => {
  await update($, decisions, rows => rows.filter(row => row.id !== id))
  await update($, explanations, ({ [id]: _, ...rest }) => rest)
}

const hide = async ($: EngineInterface, id: string) => {
  await $.store.set(id, true)
  await drop($, id)
}

const postpone = async ($: EngineInterface, { id, reason }: Decision) => {
  const { exitCode, stderr } = await $.process.run([
    `${HOME}/bin/fm-captain-hold.sh`,
    'hold',
    id,
    '--reason',
    reason,
    '--until',
    localDate(await $.clock.now(), 1),
  ])

  if (exitCode === 0) await drop($, id)
  else $.ui.toast(`Could not postpone ${id}: ${printable(stderr).trim()}`)
}

const explanationOf = async ($: EngineInterface, decision: Decision) => {
  const record = await $.process.run([`${HOME}/bin/fm-tasks-axi.sh`, 'show', decision.id, '--full'])

  if (record.exitCode !== 0) return `Could not read ${decision.id}: ${record.stderr}`

  const named = reportNamedIn(record.stdout)
  const report = named === undefined ? undefined : await $.fs.read(`${HOME}/${named}`).catch(() => undefined)
  const answer = await $.model.complete({
    model: 'sonnet',
    system: EXPLAIN_SYSTEM,
    prompt: explainPrompt(decision, record.stdout, report),
    timeoutMs: EXPLAIN_MS,
  })

  if (answer.isAnswered) return answer.text

  return `Could not explain: ${answer.reason}${answer.reason === 'api-error' ? ` ${answer.status} ${answer.error}` : ''}`
}

const decide = async ($: EngineInterface, decision: Decision) => {
  if (asking.has(decision.id)) return

  asking.add(decision.id)

  const show = (text: string) =>
    update($, explanations, shown => ({ ...shown, [decision.id]: printable(text).trim() }))

  await show(LOADING)
  await show(await explanationOf($, decision).catch((error: unknown) => `Could not explain: ${String(error)}`))
  asking.delete(decision.id)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    if (await isHome($)) {
      // A failed read keeps the last list, and a rejection here would end the interval
      const tick = () => refresh($).catch(() => undefined)

      void tick()
      $.clock.every(REFRESH_MS, tick)
    }

    return started
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const waiting = await read($, decisions)

    if (e.props.hasSurvey || waiting.length === 0 || !(await isHome($))) return next(e)

    const beneath = await next(e)
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box key="band" flexDirection="column">
          <Button
            key="open"
            plain
            label={waitingLabel(waiting.length)}
            onPress={() => $.ui.open({ id: PANE, title: TITLE })}
          />
          <Box position="absolute" top={0} right={0} display="none" hover={{ display: 'flex' }}>
            <Text dimColor>{EXPLAINER}</Text>
          </Box>
        </Box>
        {beneath}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const waiting = (await isHome($)) ? await read($, decisions) : []
    const shown = await read($, explanations)
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {waiting.length === 0 && <Text dimColor>No decisions waiting.</Text>}
        {waiting.map(decision => (
          <Box key={decision.id} flexDirection="column">
            <Box gap={1}>
              <Box flexDirection="column" flexGrow={1} flexShrink={1}>
                <Text bold>{decision.title}</Text>
                <Text dimColor>{decision.reason}</Text>
              </Box>
              <Button key={`decide-${decision.id}`} label="Decide" onPress={() => void decide($, decision)} />
              <Button key={`postpone-${decision.id}`} label="↑" onPress={() => postpone($, decision)} />
              <Button key={`hide-${decision.id}`} label="×" onPress={() => hide($, decision.id)} />
            </Box>
            {shown[decision.id] !== undefined && <Text>{shown[decision.id]}</Text>}
          </Box>
        ))}
      </Box>
    )
  })
}
