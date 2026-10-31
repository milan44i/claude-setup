import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Decision } from '../types'
import { decidePrompt, parseDecisions, waitingLabel } from './decisions'

const REFRESH_MS = 60_000

const decisions = atom({ plugin: 'decisions-band', key: 'decisions' } as const, [] as readonly Decision[])
const isOpen = atom({ plugin: 'decisions-band', key: 'isOpen' } as const, false)

const isHome = async ($: EngineInterface, root: string) => {
  if (!(await $.fs.exists(`${root}/bin/fm-crew-state.sh`))) return false

  const state = await $.fs.stat(`${root}/state`).catch(() => undefined)

  return state?.kind === 'dir'
}

const refresh = async ($: EngineInterface, script: string) => {
  const { exitCode, stdout } = await $.process.run([
    script,
    'list',
    '--state',
    'held',
    '--limit',
    '1000',
    '--fields',
    'hold_kind,hold_reason',
  ])

  if (exitCode === 0) await update($, decisions, () => parseDecisions(stdout))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const root = await $.session.root()

    if (await isHome($, root)) {
      const script = `${root}/bin/fm-tasks-axi.sh`
      // A failed read keeps the last list, and a rejection here would end the interval
      const tick = () => refresh($, script).catch(() => undefined)

      void tick()
      $.clock.every(REFRESH_MS, tick)
    }

    return started
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const waiting = await read($, decisions)

    if (e.props.hasSurvey || waiting.length === 0) return next(e)

    const beneath = await next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const rows = (await read($, isOpen)) ? waiting : []

    return (
      <Box flexDirection="column">
        <Button
          key="toggle"
          plain
          label={waitingLabel(waiting.length)}
          onPress={() => update($, isOpen, open => !open)}
        />
        {rows.map(({ id, title, reason }) => (
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
        {beneath}
      </Box>
    )
  })
}
