import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Running } from '../types'
import { hintFor, wordFor } from './words'

const running = atom({ plugin: 'pirate-spinner', key: 'running' } as const, [] as Running)

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
  on('session.start', async ($, e, next) => {
    // A reload ends the hooks that would have taken their tools back off the list
    await update($, running, () => [])

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    const id = e.tool_use_id

    await update($, running, tools => [...tools, { id, tool: e.tool }])

    try {
      return await next(e)
    } finally {
      await update($, running, tools => tools.filter(tool => tool.id !== id))
    }
  })

  // The desktop app keeps its own row while a tool runs, so its words go in the band beside the ship
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface === 'desktop') return next(e)

    const word = wordFor((await read($, running)).at(-1)?.tool)

    return next({ ...e, props: { ...e.props, word } })
  })

  // Calm's terminal sailboat takes the whole Spinner row, so there the band carries the words too
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !e.props.isWorking) return next(e)
    if (e.surface !== 'desktop' && !(await isCalmOn($))) return next(e)

    const beneath = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const tool = (await read($, running)).at(-1)?.tool

    return (
      <Box flexDirection="column">
        <Box key="pirate-word">
          <Text dimColor>{`${wordFor(tool)}…`}</Text>
          <Box position="absolute" top={0} right={0} display="none" hover={{ display: 'flex' }}>
            <Text dimColor>{hintFor(tool)}</Text>
          </Box>
        </Box>
        {beneath}
      </Box>
    )
  })
}
