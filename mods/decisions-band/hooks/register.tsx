import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Choice, Decision, Explanation, Queue, Quick, QuickAnswer } from '../types'
import {
  batchPrompt,
  blockedText,
  CONTINUE_HELP,
  CONTINUE_LABEL,
  CONTINUE_SENT_LABEL,
  continuePrompt,
  executeLabel,
  EXPLAIN_SYSTEM,
  explainPrompt,
  fitsOneRow,
  HIDE_HELP,
  localDate,
  optionLabel,
  paragraphsOf,
  parseDecisions,
  parseExplanation,
  parseQueue,
  parseQuick,
  POSTPONE_HELP,
  printable,
  queueLine,
  QUICK_SYSTEM,
  quickHelp,
  reportNamedIn,
  rowText,
  waitingLabel,
} from './decisions'

// A marker-file check here would run a script from any repo that carries those files
const HOME = '/Users/milanstankovic/work/firstmate'
const QUEUE = `${HOME}/data/decisions-queue.jsonl`
const LOG = `${HOME}/data/decisions-log.jsonl`
const REFRESH_MS = 60_000
const EXPLAIN_MS = 120_000
const EXPLAIN_TOKENS = 2048
// A task id cannot hold a colon, so these keys never read as a hidden row
const QUICK_KEY = 'quick:'
const EXPLAINER = 'Lists the decisions waiting on you, click to open them.'
const LOADING = 'Explaining...'
const PANE = 'decisions'
const EMPTY_QUEUE: Queue = { marks: {}, damaged: [] }
const TITLE = 'Decisions'

const decisions = atom({ plugin: 'decisions-band', key: 'decisions' } as const, [] as readonly Decision[])
const explained = atom(
  { plugin: 'decisions-band', key: 'explained' } as const,
  {} as Readonly<Record<string, Explanation>>,
)
// What the queue file says, reread after each press and on the timer, so a move by firstmate shows up
const queue = atom({ plugin: 'decisions-band', key: 'queue' } as const, EMPTY_QUEUE)
// The queue a batch went out with, so a changed queue offers the button again
const sent = atom({ plugin: 'decisions-band', key: 'sent' } as const, '')
// The explanation each id went to chat with, so a new one offers the button again
const continued = atom({ plugin: 'decisions-band', key: 'continued' } as const, {} as Readonly<Record<string, string>>)
// The desktop Pane reveals on :hover alone, so keyboard focus reaches a popover only through ui.focus
const focused = atom({ plugin: 'decisions-band', key: 'focused' } as const, '')
// Not in $.state, because a reload drops the running call and a kept id would block its row for good
const asking = new Set<string>()
// The answer drawn for each row, with the row text it was written for
const quickAnswers = atom(
  { plugin: 'decisions-band', key: 'quickAnswers' } as const,
  {} as Readonly<Record<string, QuickAnswer>>,
)
// The row text last asked about, so a failed reply is not paid for again on every refresh
const quickAsked = new Map<string, string>()

const isHome = async ($: EngineInterface) => (await $.session.root()) === HOME

const rereadQueue = async ($: EngineInterface) => {
  const found = parseQueue((await $.fs.exists(QUEUE)) ? await $.fs.read(QUEUE) : '')

  if (JSON.stringify(found) !== JSON.stringify(await read($, queue))) await update($, queue, () => found)

  return found
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

  if ((await $.ui.panes()).some(({ id }) => id === PANE)) void prepareQuick($)
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

const decisionPrompt = async ($: EngineInterface, decision: Decision) => {
  const record = await $.process.run([`${HOME}/bin/fm-tasks-axi.sh`, 'show', decision.id, '--full'])

  if (record.exitCode !== 0) return { failure: record.stderr }

  const named = reportNamedIn(record.stdout)
  const report = named === undefined ? undefined : await $.fs.read(`${HOME}/${named}`).catch(() => undefined)

  return { prompt: explainPrompt(decision, record.stdout, report) }
}

const explanationOf = async ($: EngineInterface, decision: Decision): Promise<Explanation> => {
  const { failure, prompt } = await decisionPrompt($, decision)

  if (prompt === undefined) return { text: `Could not read ${decision.id}: ${failure}`, options: [] }

  const answer = await $.model.complete({
    model: 'sonnet',
    system: EXPLAIN_SYSTEM,
    prompt,
    timeoutMs: EXPLAIN_MS,
    maxTokens: EXPLAIN_TOKENS,
  })

  if (answer.isAnswered) return parseExplanation(answer.text)

  return {
    text: `Could not explain: ${answer.reason}${answer.reason === 'api-error' ? ` ${answer.status} ${answer.error}` : ''}`,
    options: [],
  }
}

const quickOf = async ($: EngineInterface, decision: Decision, text: string): Promise<Quick | null | undefined> => {
  const key = `${QUICK_KEY}${decision.id}`
  const stored = (await $.store.get(key)) as { text?: unknown; reply?: unknown } | undefined

  if (stored?.text === text && typeof stored.reply === 'string') {
    const cached = parseQuick(stored.reply)

    if (cached !== undefined) return cached
  }

  const { prompt } = await decisionPrompt($, decision)

  if (prompt === undefined) return undefined

  const answer = await $.model.complete({
    model: 'sonnet',
    system: QUICK_SYSTEM,
    prompt,
    timeoutMs: EXPLAIN_MS,
    maxTokens: EXPLAIN_TOKENS,
  })

  if (!answer.isAnswered) return undefined

  const quick = parseQuick(answer.text)

  if (quick !== undefined) await $.store.set(key, { text, reply: answer.text })

  return quick
}

// One row at a time, because a burst that hits a rate limit leaves rows without buttons until the next session
const prepareQuick = async ($: EngineInterface) => {
  for (const decision of await read($, decisions)) {
    const text = rowText(decision)

    if (quickAsked.get(decision.id) === text) continue

    quickAsked.set(decision.id, text)

    const quick = await quickOf($, decision, text).catch(() => undefined)

    if (quick !== undefined) await update($, quickAnswers, shown => ({ ...shown, [decision.id]: { text, quick } }))
  }
}

const openPanel = async ($: EngineInterface) => {
  await $.ui.open({ id: PANE, title: TITLE })
  void prepareQuick($)
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
const choose = async ($: EngineInterface, decision: Decision, option: Choice) => {
  const { exitCode, stderr } = await $.process.run(['tee', '-a', QUEUE], {
    stdin: queueLine(decision, option, await $.clock.now()),
  })

  if (exitCode === 0) await rereadQueue($)
  else $.ui.toast(`Could not record ${decision.id}: ${printable(stderr).trim()}`)
}

const execute = async ($: EngineInterface, drawn: string) => {
  const found = await rereadQueue($)
  const batch = JSON.stringify(found)

  // A line the captain has not been shown yet needs its own look and a new press
  if (batch !== drawn) {
    $.ui.toast('The queue changed, check it and press again.')

    return
  }

  if (found.damaged.length > 0) return

  let isNew = false

  await update($, sent, last => {
    isNew = last !== batch

    return batch
  })

  if (!isNew) return

  // Not awaited, because submit waits for the session to go idle and the press would wait with it
  void $.prompt.submit({ text: batchPrompt(QUEUE, LOG, found.marks) }).catch(async (error: unknown) => {
    await update($, sent, () => '')
    $.ui.toast(`Could not send the batch: ${String(error)}`)
  })
}

const continueInChat = async ($: EngineInterface, decision: Decision, explanation: string) => {
  let isNew = false

  await update($, continued, shown => {
    isNew = shown[decision.id] !== explanation

    return { ...shown, [decision.id]: explanation }
  })

  if (!isNew) return

  void $.prompt.submit({ text: continuePrompt(decision, explanation) }).catch(async (error: unknown) => {
    await update($, continued, ({ [decision.id]: _, ...rest }) => rest)
    $.ui.toast(`Could not open the chat: ${String(error)}`)
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
            onPress={() => openPanel($)}
          />
          <Box position="absolute" top={0} right={0} display="none" hover={{ display: 'flex' }}>
            <Text dimColor>{EXPLAINER}</Text>
          </Box>
        </Box>
        {beneath}
      </Box>
    )
  })

  on('ui.focus', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    // Before next, because a press that follows at once must clear this write, not be overwritten by it
    await update($, focused, () => e.element ?? '')

    return next(e)
  })

  // ui.focus reports a click like a Tab and the ring stays on the pressed button, so only a press can end that reveal
  on('ui.press', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    await update($, focused, () => '')

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const atHome = await isHome($)
    const waiting = atHome ? await read($, decisions) : []
    const current = atHome ? await read($, queue) : EMPTY_QUEUE
    const queued = current.marks
    const count = Object.keys(queued).length
    const isSent = (await read($, sent)) === JSON.stringify(current)
    const shown = await read($, explained)
    const focusedKey = await read($, focused)
    const inChat = await read($, continued)
    const answers = await read($, quickAnswers)
    const { Box, Button, Text } = $.ui.resolve(e)

    // Spans the button row and opens below it, so it stays clear of the title and description above
    const help = (key: string, text: string, lead?: string) => (
      <Box
        flexDirection="column"
        position="absolute"
        top={2}
        left={0}
        right={0}
        {...(focusedKey === key ? { display: 'flex' } : { display: 'none', hover: { scope: key, display: 'flex' } })}
        backgroundColor="userMessageBackground"
        borderStyle="round"
      >
        {lead !== undefined && <Text bold>{lead}</Text>}
        <Text>{text}</Text>
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1}>
        {current.damaged.length > 0 && <Text color="error">{blockedText(current.damaged)}</Text>}
        {current.damaged.length === 0 && count > 0 && (
          <Button key="execute" variant="primary" label={executeLabel(count, isSent)} onPress={() => execute($, JSON.stringify(current))} />
        )}
        {Object.entries(queued)
          .filter(([id]) => !waiting.some(decision => decision.id === id))
          .map(([id, { title, choice, consequence }]) => (
            <Box key={`queued-${id}`} flexDirection="column" borderStyle="round" borderDimColor>
              <Text bold>{title}</Text>
              <Text dimColor>{`Nema otvorenog reda: ${id}`}</Text>
              <Text>{`Izabrano: ${choice}`}</Text>
              <Text dimColor>{consequence}</Text>
            </Box>
          ))}
        {waiting.length === 0 && <Text dimColor>No decisions waiting.</Text>}
        {waiting.map(decision => {
          const explanation = shown[decision.id]
          const mark = queued[decision.id]
          const reason = <Text dimColor>{decision.reason}</Text>
          const postponeKey = `postpone-${decision.id}`
          const hideKey = `hide-${decision.id}`
          const answer = answers[decision.id]
          // Row text compared here too, so a changed row loses its buttons before a new label is written
          const quick = answer?.text === rowText(decision) ? answer.quick : null
          const quickButtons: readonly (readonly [string, string, Choice])[] =
            quick === null
              ? []
              : [
                  ['Da', `yes-${decision.id}`, quick.yes],
                  ['Ne', `no-${decision.id}`, quick.no],
                ]

          return (
            <Box key={decision.id} flexDirection="column" borderStyle="round" borderDimColor>
              <Text bold>{decision.title}</Text>
              {fitsOneRow(decision.reason, e.props.bodyColumns) ? (
                reason
              ) : (
                <Box key={`reason-${decision.id}`} flexDirection="column" flexShrink={0} height={2} overflow="hidden">
                  {reason}
                </Box>
              )}
              <Box gap={1} paddingTop={1}>
                <Button key={`decide-${decision.id}`} label="Decide" onPress={() => void decide($, decision)} />
                {quickButtons.map(([label, key, choice]) => (
                  <Button
                    key={key}
                    label={optionLabel(label, mark?.choice === choice.label)}
                    hover={{ scope: key, bold: true }}
                    onPress={() => choose($, decision, choice)}
                  />
                ))}
                <Button
                  key={postponeKey}
                  label="↑"
                  hover={{ scope: postponeKey, bold: true }}
                  onPress={() => postpone($, decision)}
                />
                <Button
                  key={hideKey}
                  label="×"
                  hover={{ scope: hideKey, bold: true }}
                  onPress={() => hide($, decision.id)}
                />
                {quickButtons.map(([, key, choice]) => help(key, quickHelp(choice), choice.label))}
                {help(postponeKey, POSTPONE_HELP)}
                {help(hideKey, HIDE_HELP)}
              </Box>
              {explanation !== undefined && (
                <Box key={`open-${decision.id}`} flexDirection="column" gap={2} paddingTop={1}>
                  <Box
                    key={`explanation-${decision.id}`}
                    flexDirection="column"
                    gap={1}
                    padding={1}
                    backgroundColor="userMessageBackground"
                  >
                    {paragraphsOf(explanation.text).map(paragraph => (
                      <Text>{paragraph}</Text>
                    ))}
                  </Box>
                  {explanation.options.length > 0 && (
                    <Box key={`options-${decision.id}`} flexDirection="column" gap={1}>
                      {explanation.options.map((option, at) => {
                        const isChosen = mark?.choice === option.label

                        return (
                          <Box
                            key={`${decision.id}-${at}`}
                            flexDirection="column"
                            alignItems="flex-start"
                            gap={1}
                            borderStyle="round"
                            {...(isChosen
                              ? { borderColor: 'success' }
                              : option.isRecommended
                                ? { borderColor: 'suggestion' }
                                : { borderDimColor: true })}
                          >
                            {option.isRecommended && (
                              <Text size="caption" color="suggestion">
                                Preporuka
                              </Text>
                            )}
                            <Button
                              key={`option-${decision.id}-${at}`}
                              {...(option.isRecommended ? { variant: 'primary' as const } : {})}
                              label={optionLabel(option.label, isChosen)}
                              onPress={() => choose($, decision, option)}
                            />
                            <Text dimColor size="footnote">
                              {option.consequence}
                            </Text>
                          </Box>
                        )
                      })}
                    </Box>
                  )}
                  {explanation.text !== LOADING && (
                    <Box key={`chat-${decision.id}`} flexDirection="column" alignItems="flex-start" gap={1}>
                      <Button
                        key={`continue-${decision.id}`}
                        label={inChat[decision.id] === explanation.text ? CONTINUE_SENT_LABEL : CONTINUE_LABEL}
                        onPress={() => continueInChat($, decision, explanation.text)}
                      />
                      <Text dimColor size="footnote">
                        {CONTINUE_HELP}
                      </Text>
                    </Box>
                  )}
                </Box>
              )}
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
