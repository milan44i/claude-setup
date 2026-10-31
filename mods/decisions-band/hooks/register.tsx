import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Decision } from '../types'
import { decidePrompt, parseDecisions, waitingLabel } from './decisions'

// A marker-file check here would run a script from any repo that carries those files
const HOME = '/Users/milanstankovic/work/firstmate'
const REFRESH_MS = 60_000
const EXPLAINER = 'Lists the decisions waiting on you, click to open them.'
const PANE = 'decisions'
const TITLE = 'Decisions'

const decisions = atom({ plugin: 'decisions-band', key: 'decisions' } as const, [] as readonly Decision[])

const isHome = async ($: EngineInterface) => (await $.session.root()) === HOME

const refresh = async ($: EngineInterface) => {
  if (!(await isHome($))) return

  const { exitCode, stdout } = await $.process.run([
    `${HOME}/bin/fm-tasks-axi.sh`,
    'list',
    '--state',
    'held',
    '--limit',
    '1000',
    '--fields',
    'hold_kind,hold_reason',
  ])

  if (exitCode !== 0) return

  const found = parseDecisions(stdout)

  // A rewrite of the same list redraws the panel under a scroll in progress
  if (JSON.stringify(found) !== JSON.stringify(await read($, decisions))) await update($, decisions, () => found)
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
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {waiting.length === 0 && <Text dimColor>No decisions waiting.</Text>}
        {waiting.map(({ id, title, reason }) => (
          <Box key={id} gap={1}>
            <Box flexDirection="column" flexGrow={1} flexShrink={1}>
              <Text bold>{title}</Text>
              <Text dimColor>{reason}</Text>
            </Box>
            <Button
              key={`decide-${id}`}
              label="Decide"
              onPress={() => $.prompt.submit({ text: decidePrompt(id) })}
            />
          </Box>
        ))}
      </Box>
    )
  })
}
