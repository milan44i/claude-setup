import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Island, Survey } from '../types'
import { columnsFor, drawChart, stageCounts, STAGES } from './chart'
import { plot, SOURCES } from './records'

const PANE = 'treasure-map'
const TITLE = 'Treasure map'
const HEADING_SCOPE = 'treasure-map-heading'
const READ_TIMEOUT_MS = 90_000
const STILL_READING = 'Treasure map shows Potpis sales as islands, and it is still reading the records.'

const survey = atom({ plugin: 'treasure-map', key: 'survey' } as const, null as Survey | null)

const counted = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

const meaning = (islands: readonly Island[]) => {
  const { lead, demo, offer, paid } = stageCounts(islands)

  return `Treasure map shows Potpis sales as islands, and right now it has ${counted(lead, 'lead', 'leads')}, ${counted(demo, 'demo', 'demos')} sent, ${counted(offer, 'offer', 'offers')} out and ${counted(paid, 'paid client', 'paid clients')} marked with a red X.`
}

const readSource = async ($: EngineInterface, home: string, source: (typeof SOURCES)[number]) => {
  const { exitCode, stdout } = await $.process.run(source.argv, {
    cwd: `${home}/${source.cwd}`,
    timeoutMs: READ_TIMEOUT_MS,
  })

  return exitCode === 0 ? source.parse(stdout) : undefined
}

const refresh = async ($: EngineInterface) => {
  const home = await $.env.get('HOME')
  const results = await Promise.all(
    SOURCES.map(source => readSource($, home ?? '', source).catch(() => undefined)),
  )

  await update($, survey, () => ({
    islands: plot(results.flatMap(islands => islands ?? [])),
    missing: SOURCES.filter((_, index) => results[index] === undefined).map(({ label }) => label),
  }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'map',
      description: 'Open the Potpis sales pipeline as a sea chart',
    })

    return next(e)
  })

  on('command.run', { command: 'map' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Treasure map opened.' }
  })

  on('ui.open', { id: PANE }, async ($, e, next) => {
    void refresh($).catch(() => undefined)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const shown = await read($, survey)
    const islands = shown?.islands ?? []
    const { Box, Text } = $.ui.resolve(e)
    const heading = (
      <Box key="heading" hover={{ scope: HEADING_SCOPE }}>
        <Text bold>{TITLE}</Text>
      </Box>
    )
    const popover = (
      <Box
        position="absolute"
        top={1}
        left={0}
        right={0}
        display="none"
        borderStyle="round"
        paddingX={1}
        hover={{ scope: HEADING_SCOPE, display: 'flex' }}
      >
        <Text>{shown === null ? STILL_READING : meaning(islands)}</Text>
      </Box>
    )
    const missing =
      shown !== null && shown.missing.length > 0 ? (
        <Text dimColor>Not read: {shown.missing.join(', ')}. Open /map again to retry.</Text>
      ) : null
    let body = <Text dimColor>Reading the Potpis records.</Text>

    if (shown !== null && e.surface === 'terminal') {
      body = (
        <Box flexDirection="column">
          {STAGES.map(({ stage, title }) => {
            const here = islands.filter(island => island.stage === stage)

            return (
              <Box flexDirection="column">
                <Text bold>
                  {title} ({here.length})
                </Text>
                {here.map(({ name }) => (
                  <Text>
                    {stage === 'paid' ? 'X ' : '  '}
                    {name}
                  </Text>
                ))}
              </Box>
            )
          })}
        </Box>
      )
    } else if (shown !== null && e.surface !== 'terminal') {
      const { Svg } = $.ui.resolve(e)

      body = <Svg {...drawChart(islands, columnsFor(e.props.bodyColumns))} />
    }

    return (
      <Box flexDirection="column">
        {heading}
        {missing}
        {body}
        {popover}
      </Box>
    )
  })
}
