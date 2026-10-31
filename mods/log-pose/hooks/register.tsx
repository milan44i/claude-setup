import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Deadline } from '../types'
import { COMPASS_ALT, COMPASS_GLYPH, COMPASS_SIZE, COMPASS_SVG, POPOVER, POPOVER_TEXT } from './compass'
import { daysLeftLabel, localDay, nextDeadline, parseObligations, parseTasks, popoverText } from './deadlines'

const HOME = '/Users/milanstankovic/work/firstmate'
const PAUSAL = '/Users/milanstankovic/work/potpis/posao/pausal'
const REFRESH_MS = 3_600_000

const COMPASS = {
  source: COMPASS_SVG,
  alt: COMPASS_ALT,
  width: COMPASS_SIZE,
  height: COMPASS_SIZE,
  isInteractive: true,
}

const obligations = atom({ plugin: 'log-pose', key: 'obligations' } as const, [] as readonly Deadline[])
const tasks = atom({ plugin: 'log-pose', key: 'tasks' } as const, [] as readonly Deadline[])

const readObligations = async ($: EngineInterface) => {
  const { exitCode, stdout } = await $.process.run(['npm', 'run', '-s', 'pausal', '--', 'obligations', 'list'], {
    cwd: PAUSAL,
  })

  if (exitCode === 0) await update($, obligations, () => parseObligations(stdout))
}

const readTasks = async ($: EngineInterface) => {
  const { exitCode, stdout } = await $.process.run([
    `${HOME}/bin/fm-tasks-axi.sh`,
    'list',
    '--limit',
    '1000',
    '--fields',
    'hold_reason,hold_until',
  ])

  if (exitCode === 0) await update($, tasks, () => parseTasks(stdout))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    if ((await $.session.root()) === HOME) {
      // A failed read keeps that source's last list, and a rejection here would end the interval
      const tick = () =>
        Promise.all([readObligations($).catch(() => undefined), readTasks($).catch(() => undefined)])

      void tick()
      $.clock.every(REFRESH_MS, tick)
    }

    return started
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const today = localDay(await $.clock.now())
    const deadline = nextDeadline([...(await read($, obligations)), ...(await read($, tasks))], today)

    if (deadline === undefined) return next(e)

    const beneath = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const compass = e.surface === 'desktop' ? $.ui.resolve(e).Svg(COMPASS) : <Text>{COMPASS_GLYPH}</Text>

    // The band clips anything above its top row, so the popover covers this row
    return (
      <Box flexDirection="column">
        <Box key="deadline" gap={1}>
          {compass}
          <Box flexShrink={1}>
            <Text wrap="truncate-end">{deadline.name}</Text>
          </Box>
          <Box flexShrink={0}>
            <Text dimColor>{daysLeftLabel(today, deadline.due)}</Text>
          </Box>
          <Box {...POPOVER}>
            <Text color={POPOVER_TEXT} wrap="truncate-end">{popoverText(deadline.due)}</Text>
          </Box>
        </Box>
        {beneath}
      </Box>
    )
  })
}
