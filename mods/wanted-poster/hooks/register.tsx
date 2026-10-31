import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Tally } from '../types'
import {
  INK,
  PAPER_LIGHT,
  parseCount,
  parseListLength,
  posterAlt,
  posterLines,
  posterNote,
  posterSvg,
} from './poster'

const PANE = 'wanted-poster'
const TITLE = 'Wanted'
const NOTE_SCOPE = 'wanted-note'

const tally = atom({ plugin: 'wanted-poster', key: 'tally' } as const, null as Tally | null)

const readOutput = async ($: EngineInterface, argv: string[], cwd?: string) => {
  const ran = await $.process.run(argv, { cwd }).catch(() => undefined)

  return ran?.exitCode === 0 ? ran.stdout : ''
}

const readMergedPrs = async ($: EngineInterface) =>
  parseCount(
    await readOutput($, [
      'gh-axi',
      'api',
      '/search/issues?q=author:milan44i+is:pr+is:merged&per_page=1',
      '--jq',
      '.total_count',
    ]),
  )

const readPaidInvoices = async ($: EngineInterface) => {
  const home = await $.env.get('HOME')

  return parseListLength(
    await readOutput(
      $,
      ['npm', 'run', '-s', 'pausal', '--', 'docs', 'list', '--type', 'invoice', '--status', 'paid'],
      `${home}/work/potpis/posao/pausal`,
    ),
  )
}

const refresh = async ($: EngineInterface) => {
  const [prs, invoices] = await Promise.all([readMergedPrs($), readPaidInvoices($)])

  await update($, tally, () => ({ prs, invoices }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'wanted',
      description: "Open the captain's wanted poster",
    })

    return next(e)
  })

  on('command.run', { command: 'wanted' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    void refresh($)

    return { text: 'Wanted poster opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const current = await read($, tally)
    const { Box, Text } = $.ui.resolve(e)
    let poster

    if (e.surface === 'terminal') {
      poster = (
        <Box flexDirection="column" alignItems="center" borderStyle="double">
          {posterLines(current).map(line => (
            <Text>{line}</Text>
          ))}
        </Box>
      )
    } else {
      const { Svg } = $.ui.resolve(e)

      poster = <Svg source={posterSvg(current)} alt={posterAlt(current)} />
    }

    return (
      <Box flexDirection="column">
        <Box key="wanted-heading" hover={{ scope: NOTE_SCOPE }}>
          <Text bold>Wanted poster</Text>
        </Box>
        {poster}
        {/* Last in the tree, since an absolute Box paints only over what comes before it */}
        <Box
          key="wanted-note"
          position="absolute"
          top={1}
          left={0}
          display="none"
          hover={{ scope: NOTE_SCOPE, display: 'flex' }}
          backgroundColor={PAPER_LIGHT}
          paddingX={1}
        >
          <Text color={INK}>{posterNote(current)}</Text>
        </Box>
      </Box>
    )
  })
}
