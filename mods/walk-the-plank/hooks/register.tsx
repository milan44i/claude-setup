import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Walking } from '../types'
import { directoryChange, draftsOf, resolvePath } from './drafts'
import { plankAlt, plankSvg, SCENE_HEIGHT, SCENE_WIDTH, shortened } from './plank'
import { parseShell } from './shell'
import { denial, findSlop } from './slop'

const walking = atom({ plugin: 'walk-the-plank', key: 'walking' } as const, null as Walking)

const MAX_DRAFT_BYTES = 1_048_576

// tool.call runs ahead of the permission prompt, and the denial quotes what it reads, so a file
// the session may not Read stays unread. The check and the read share the resolved path so a link
// cannot aim one elsewhere, and a device or a FIFO would hang the read
const readDraftFile = async ($: EngineInterface, path: string) => {
  const stat = await $.fs.stat(path, { resolve: true }).catch(() => undefined)
  const real = stat?.realPath

  if (real === undefined || stat?.kind !== 'file' || stat.size > MAX_DRAFT_BYTES) return ''

  const { decision } = await $.tool.check({ tool: 'Read', input: { file_path: real } })

  return decision === 'allow' ? $.fs.read(real).catch(() => '') : ''
}

const flaggedDrafts = async ($: EngineInterface, command: string) => {
  const commands = parseShell(command)
  const drafts = commands.flatMap(draftsOf)

  if (drafts.length === 0) return undefined

  const home = await $.env.get('HOME')
  const flagged = []
  let cwd = await $.session.cwd()

  for (const parsed of commands) {
    const change = directoryChange(parsed)

    if (change !== undefined) cwd = resolvePath(change, cwd, home)

    for (const { label, text, files, dir } of draftsOf(parsed)) {
      const base = dir === undefined ? cwd : resolvePath(dir, cwd, home)
      const contents = await Promise.all(
        files.map(file => readDraftFile($, resolvePath(file, base, home))),
      )
      const findings = [text, ...contents].flatMap(findSlop)

      if (findings.length > 0) flagged.push({ label, findings })
    }
  }

  return flagged
}

export const register: Register = on => {
  // No .catch, so a bug in this parser lets the command run instead of blocking every Bash call
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const flagged = await flaggedDrafts($, e.command)

    if (flagged === undefined) return next(e)

    const sentence = flagged[0]?.findings[0]?.sentence

    if (sentence === undefined) {
      await update($, walking, () => null)

      return next(e)
    }

    await update($, walking, () => sentence)
    $.ui.toast(`Walked the plank: ${shortened(sentence)}`)

    return { deny: denial(flagged) }
  })

  on('turn.complete', async ($, e, next) => {
    await update($, walking, () => null)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const sentence = await read($, walking)

    if (e.surface !== 'desktop' || e.props.hasSurvey || sentence === null) return next(e)

    const beneath = await next(e)
    const { Box, Svg } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Svg
          source={plankSvg(sentence)}
          alt={plankAlt(sentence)}
          width={SCENE_WIDTH}
          height={SCENE_HEIGHT}
          isInteractive
        />
        {beneath}
      </Box>
    )
  })
}
