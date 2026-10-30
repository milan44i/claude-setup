import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CrewRow, CrewState } from '../types'
import { readStatus } from './status'

const PANE = 'crew-panel'
const TITLE = 'Crew'
const REFRESH_MS = 15_000
const GROUPS: { title: string; states: CrewState[] }[] = [
  { title: 'Waiting on a person', states: ['blocked', 'parked', 'failed'] },
  { title: 'In progress', states: ['working', 'paused', 'unknown'] },
  { title: 'Done', states: ['done'] },
]

const rows = atom({ plugin: 'crew-panel', key: 'rows' } as const, [])

const isHome = async ($: EngineInterface, root: string) => {
  const state = await $.fs.stat(`${root}/state`).catch(() => undefined)

  return (
    state?.kind === 'dir' && (await $.fs.exists(`${root}/bin/fm-crew-state.sh`))
  )
}

const metaValue = (meta: string, key: string) =>
  meta
    .split('\n')
    .findLast(line => line.startsWith(`${key}=`))
    ?.slice(key.length + 1)

const readRow = async (
  $: EngineInterface,
  state: string,
  id: string,
): Promise<CrewRow> => {
  const meta = await $.fs.read(`${state}/${id}.meta`).catch(() => '')
  const status = await $.fs.read(`${state}/${id}.status`).catch(() => '')

  return {
    id,
    project: metaValue(meta, 'project')?.split('/').filter(Boolean).at(-1) ?? '',
    pr: metaValue(meta, 'pr') || undefined,
    ...readStatus(status, metaValue(meta, 'kind') || 'ship'),
  }
}

const refresh = async ($: EngineInterface, root: string) => {
  const state = `${root}/state`
  const entries = await $.fs.list(state)
  const ids = entries
    .filter(
      entry =>
        entry.kind === 'file' &&
        entry.name.endsWith('.meta') &&
        !entry.name.startsWith('.'),
    )
    .map(entry => entry.name.slice(0, -'.meta'.length))
    .sort()
  const next = await Promise.all(ids.map(id => readRow($, state, id)))

  await update($, rows, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const root = await $.session.root()

    if (await isHome($, root)) {
      await refresh($, root)
      await $.command.register({
        name: 'crew',
        description: 'Show the workers of this firstmate home in a pane',
      })
      $.clock.every(REFRESH_MS, () => refresh($, root))
      void $.ui.open({ id: PANE, title: TITLE })
    }

    return next(e)
  })

  on('command.run', { command: 'crew' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Crew pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Link, Text } = $.ui.resolve(e)
    const list = await read($, rows)

    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>No workers.</Text>}
        {GROUPS.map(group => {
          const members = list.filter(row => group.states.includes(row.state))

          return (
            members.length > 0 && (
              <Box flexDirection="column" marginBottom={1}>
                <Text bold>{group.title}</Text>
                {members.map(row => (
                  <Box flexDirection="column">
                    <Text wrap="truncate-end">
                      {row.id} <Text dimColor>{row.project}</Text> {row.state}
                    </Text>
                    {row.line !== '' && (
                      <Text dimColor wrap="truncate-end">
                        {row.line}
                      </Text>
                    )}
                    {row.pr && <Link href={row.pr} />}
                  </Box>
                ))}
              </Box>
            )
          )
        })}
      </Box>
    )
  })
}
