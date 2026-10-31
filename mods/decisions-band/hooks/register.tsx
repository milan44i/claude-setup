import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Decision, Explanation, Mark, Option } from '../types'
import {
  batchPrompt,
  executeLabel,
  EXPLAIN_SYSTEM,
  explainPrompt,
  fitsOneRow,
  HIDE_HELP,
  localDate,
  optionLabel,
  parseDecisions,
  parseExplanation,
  parseQueue,
  POSTPONE_HELP,
  printable,
  queueLine,
  reportNamedIn,
  waitingLabel,
} from './decisions'

// A marker-file check here would run a script from any repo that carries those files
const HOME = '/Users/milanstankovic/work/firstmate'
const QUEUE = `${HOME}/data/decisions-queue.jsonl`
const LOG = `${HOME}/data/decisions-log.jsonl`
const REFRESH_MS = 60_000
const EXPLAIN_MS = 120_000
const EXPLAIN_TOKENS = 2048
const EXPLAINER = 'Lists the decisions waiting on you, click to open them.'
const LOADING = 'Explaining...'
const PANE = 'decisions'
const TITLE = 'Decisions'

const decisions = atom({ plugin: 'decisions-band', key: 'decisions' } as const, [] as readonly Decision[])
const explained = atom(
  { plugin: 'decisions-band', key: 'explained' } as const,
  {} as Readonly<Record<string, Explanation>>,
)
// What the queue file says, reread after each press and on the timer, so a move by firstmate shows up
const marks = atom({ plugin: 'decisions-band', key: 'marks' } as const, {} as Readonly<Record<string, Mark>>)
// The marks a batch went out with, so a changed queue offers the button again
const sent = atom({ plugin: 'decisions-band', key: 'sent' } as const, '')
// Not in $.state, because a reload drops the running call and a kept id would block its row for good
const asking = new Set<string>()

const isHome = async ($: EngineInterface) => (await $.session.root()) === HOME

const rereadQueue = async ($: EngineInterface) => {
  const found = parseQueue((await $.fs.exists(QUEUE)) ? await $.fs.read(QUEUE) : '')

  if (JSON.stringify(found) !== JSON.stringify(await read($, marks))) await update($, marks, () => found)
}

const refresh = async ($: EngineInterface) => {
  if (!(await isHome($))) return

  await rereadQueue($)

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
  await update($, explained, ({ [id]: _, ...rest }) => rest)
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

const explanationOf = async ($: EngineInterface, decision: Decision): Promise<Explanation> => {
  const record = await $.process.run([`${HOME}/bin/fm-tasks-axi.sh`, 'show', decision.id, '--full'])

  if (record.exitCode !== 0) return { text: `Could not read ${decision.id}: ${record.stderr}`, options: [] }

  const named = reportNamedIn(record.stdout)
  const report = named === undefined ? undefined : await $.fs.read(`${HOME}/${named}`).catch(() => undefined)
  const answer = await $.model.complete({
    model: 'sonnet',
    system: EXPLAIN_SYSTEM,
    prompt: explainPrompt(decision, record.stdout, report),
    timeoutMs: EXPLAIN_MS,
    maxTokens: EXPLAIN_TOKENS,
  })

  if (answer.isAnswered) return parseExplanation(answer.text)

  return {
    text: `Could not explain: ${answer.reason}${answer.reason === 'api-error' ? ` ${answer.status} ${answer.error}` : ''}`,
    options: [],
  }
}

const decide = async ($: EngineInterface, decision: Decision) => {
  if (asking.has(decision.id)) return

  asking.add(decision.id)

  const show = ({ text, options }: Explanation) =>
    update($, explained, shown => ({ ...shown, [decision.id]: { text: printable(text).trim(), options } }))

  await show({ text: LOADING, options: [] })
  await show(
    await explanationOf($, decision).catch((error: unknown) => ({
      text: `Could not explain: ${String(error)}`,
      options: [],
    })),
  )
  asking.delete(decision.id)
}

// tee -a, because a read and a whole-file write would lose a line another session or firstmate adds meanwhile
const choose = async ($: EngineInterface, decision: Decision, option: Option) => {
  const { exitCode, stderr } = await $.process.run(['tee', '-a', QUEUE], {
    stdin: queueLine(decision, option, await $.clock.now()),
  })

  if (exitCode === 0) await rereadQueue($)
  else $.ui.toast(`Could not record ${decision.id}: ${printable(stderr).trim()}`)
}

const execute = async ($: EngineInterface) => {
  const batch = JSON.stringify(await read($, marks))
  let isNew = false

  await update($, sent, last => {
    isNew = last !== batch

    return batch
  })

  if (!isNew) return

  // Not awaited, because submit waits for the session to go idle and the press would wait with it
  void $.prompt.submit({ text: batchPrompt(QUEUE, LOG) }).catch(async (error: unknown) => {
    await update($, sent, () => '')
    $.ui.toast(`Could not send the batch: ${String(error)}`)
  })
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
    const atHome = await isHome($)
    const waiting = atHome ? await read($, decisions) : []
    const queued = atHome ? await read($, marks) : {}
    const count = Object.keys(queued).length
    const isSent = (await read($, sent)) === JSON.stringify(queued)
    const shown = await read($, explained)
    const { Box, Button, Text } = $.ui.resolve(e)

    // A desktop lifts this absolute hidden Box into a card its keyed parent shows on hover and on keyboard focus
    const withHelp = (key: string, help: string, button: ReturnType<typeof Button>) => (
      <Box key={key}>
        {button}
        <Box position="absolute" bottom={1} left={0} display="none" hover={{ display: 'flex' }}>
          <Text>{help}</Text>
        </Box>
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1}>
        {count > 0 && (
          <Button key="execute" variant="primary" label={executeLabel(count, isSent)} onPress={() => execute($)} />
        )}
        {waiting.length === 0 && <Text dimColor>No decisions waiting.</Text>}
        {waiting.map(decision => {
          const explanation = shown[decision.id]
          const mark = queued[decision.id]
          const reason = <Text dimColor>{decision.reason}</Text>

          return (
            <Box key={decision.id} flexDirection="column" borderStyle="round" borderDimColor>
              <Text bold>{decision.title}</Text>
              {explanation !== undefined || fitsOneRow(decision.reason, e.props.bodyColumns) ? (
                reason
              ) : (
                <Box key={`reason-${decision.id}`} flexDirection="column" flexShrink={0} height={2} overflow="hidden">
                  {reason}
                </Box>
              )}
              <Box gap={1}>
                <Button key={`decide-${decision.id}`} label="Decide" onPress={() => void decide($, decision)} />
                {withHelp(
                  `postpone-help-${decision.id}`,
                  POSTPONE_HELP,
                  <Button key={`postpone-${decision.id}`} label="↑" onPress={() => postpone($, decision)} />,
                )}
                {withHelp(
                  `hide-help-${decision.id}`,
                  HIDE_HELP,
                  <Button key={`hide-${decision.id}`} label="×" onPress={() => hide($, decision.id)} />,
                )}
              </Box>
              {explanation !== undefined && <Text>{explanation.text}</Text>}
              {explanation?.options.map((option, at) => (
                <Box key={`${decision.id}-${at}`} flexDirection="column">
                  <Button
                    key={`option-${decision.id}-${at}`}
                    label={optionLabel(option, mark?.choice === option.label)}
                    onPress={() => choose($, decision, option)}
                  />
                  <Text dimColor>{option.consequence}</Text>
                </Box>
              ))}
              {mark !== undefined && !explanation?.options.some(({ label }) => label === mark.choice) && (
                <Box key={`mark-${decision.id}`} flexDirection="column">
                  <Text>{`Izabrano: ${mark.choice}`}</Text>
                  <Text dimColor>{mark.consequence}</Text>
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
