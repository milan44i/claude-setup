import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

import { POPOVER } from '../hooks/compass'
import { daysLeftLabel, localDay, nextDeadline, parseObligations, parseTasks } from '../hooks/deadlines'

const HOME = '/Users/milanstankovic/work/firstmate'
const PAUSAL = '/Users/milanstankovic/work/potpis/posao/pausal'
const SCRIPT = `${HOME}/bin/fm-tasks-axi.sh`
const STOCK = 'stock band'
const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOON_NOV_1 = new Date(2026, 10, 1, 12).getTime()
const SURFACES = ['terminal', 'desktop'] as const

const TASKS = `count: 7 of 7 total
tasks[7]{id,state,kind,repo,title,hold_until,hold_reason}:
  held,queued,task,"-","Send the second payment","2026-11-15","Captain: by 2026-11-15"
  titled,in_flight,ship,repo,"Ship the thing by 2026-11-20\\n... (truncated, 116 chars total - use show titled --full to see complete text)","-","-"
  reasoned,queued,task,"-",Renew a certificate,"-","Captain 2026-10-01: renew by 2026-11-25, no later"
  dated-id,queued,task,"-",Send reel 2026-11-03-ril on time,"-","-"
  not-a-day,queued,task,"-",Check 2026-02-30 and 2026-13-01,"-","-"
  closed,done,task,"-",Finished by 2026-11-02,"-","-"
  undated,queued,task,"-",Whenever,"-",Later
help[1]:
  - Run \`tasks-axi show <id>\` for full notes on a task
`

const OBLIGATIONS = JSON.stringify([
  { id: 1, name: 'Old tax', due_date: '2026-10-15', kind: 'tax' },
  { id: 2, name: 'Monthly tax', due_date: '2026-11-16', kind: 'tax' },
])

type Answer = { exitCode: number; stdout: string } | 'throw'
type Answers = { obligations: Answer; tasks: Answer }
type Call = { argv: readonly string[]; cwd: string | undefined }

const OK = (stdout: string) => ({ exitCode: 0, stdout })

const world = (on: On, answers: Answers, root = HOME) => {
  const calls = { runs: [] as Call[], writes: 0 }

  on('session.root', () => ({ value: root }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.write', () => {
    calls.writes += 1

    return { value: undefined }
  })
  on('process.run', (_, e) => {
    calls.runs.push({ argv: e.argv, cwd: e.init?.cwd })

    const answer = e.argv[0] === 'npm' ? answers.obligations : answers.tasks

    if (answer === 'throw') return { deny: 'cannot start' }

    return { value: { ...answer, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return Text({ children: STOCK })
  })

  return calls
}

const start = async ($: Engine, clock: MockClock) => {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.settle()
}

const mountBand = ($: Engine, surface: 'terminal' | 'desktop', hasSurvey = false) =>
  $.ui.mount({
    plugin: 'log-pose',
    surface,
    component: 'AbovePrompt',
    requestId: 'above-prompt',
    props: { hasSurvey, isWorking: false, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 12 }, view: {} },
  })

const FULL = { obligations: OK(OBLIGATIONS), tasks: OK(TASKS) }

test('the exact home reads both sources, once each, and writes nothing', async ($, on) => {
  const clock = mock.clock(on, { now: NOON_NOV_1 })
  const calls = world(on, FULL)

  await start($, clock)
  expect(calls.runs).toHaveLength(2)
  expect(calls.runs).toContainEqual({
    argv: ['npm', 'run', '-s', 'pausal', '--', 'obligations', 'list'],
    cwd: PAUSAL,
  })
  expect(calls.runs).toContainEqual({
    argv: [SCRIPT, 'list', '--limit', '1000', '--fields', 'hold_reason,hold_until'],
    cwd: undefined,
  })
  expect(calls.writes).toBe(0)
})

for (const root of [`${HOME}/sub`, `${HOME}-copy`, '/other/repo']) {
  test(`the root ${root} runs nothing and draws only the stock band`, async ($, on) => {
    const clock = mock.clock(on, { now: NOON_NOV_1 })
    const calls = world(on, FULL, root)

    await start($, clock)
    await clock.advance(2 * HOUR)
    expect(calls.runs).toEqual([])

    const ui = await mountBand($, 'desktop')

    expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
    await ui.unmount()
  })
}

test('desktop draws the swinging compass, the name and the days left', async ($, on) => {
  const clock = mock.clock(on, { now: NOON_NOV_1 })

  world(on, FULL)
  await start($, clock)

  const ui = await mountBand($, 'desktop')
  const svg = await ui.find({ type: 'Svg' })
  const source = String(svg?.props.source)

  expect(svg?.props.isInteractive).toBe(true)
  expect(String(svg?.props.alt)).toMatch(/compass/)
  expect(source).toMatch(/@keyframes swing/)
  expect(source).toMatch(/infinite/)
  expect(source).not.toMatch(/<script|\son\w+=|href=/)
  expect(await ui.find({ type: 'Text', text: 'Send the second payment' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '14 days left' })).toBeDefined()
  await ui.unmount()
})

test('the terminal has no Svg, so it draws a still compass glyph', async ($, on) => {
  const clock = mock.clock(on, { now: NOON_NOV_1 })

  world(on, FULL)
  await start($, clock)

  const ui = await mountBand($, 'terminal')

  expect(await ui.find({ type: 'Text', text: '🧭' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '14 days left' })).toBeDefined()
  await ui.unmount()
})

test('the band keeps what the mods beneath it drew', async ($, on) => {
  const clock = mock.clock(on, { now: NOON_NOV_1 })

  world(on, FULL)
  await start($, clock)

  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)

    expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '14 days left' })).toBeDefined()
    await ui.unmount()
  }
})

test('hovering the row reveals one sentence over it, and nothing reflows', async ($, on) => {
  const clock = mock.clock(on, { now: NOON_NOV_1 })

  world(on, FULL)
  await start($, clock)

  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)
    const boxes = await ui.findAll({ type: 'Box' })
    const card = boxes.find(box => box.props.position === 'absolute')

    expect(await ui.find({ type: 'Box', key: 'deadline' })).toBeDefined()
    expect(card?.props.display).toBe('none')
    expect(card?.props.position).toBe('absolute')
    expect(
      await ui.find({ type: 'Text', text: 'Log Pose points at your next paušal or backlog deadline, due 2026-11-15.' }),
    ).toBeDefined()
    await ui.unmount()
  }
})

test('only the hover reveals the popover, and it stays out of the flow', () => {
  expect(POPOVER.display).toBe('none')
  expect(POPOVER.hover).toEqual({ display: 'flex' })
  expect(POPOVER.position).toBe('absolute')
})

test('a survey holds the band, and the compass yields', async ($, on) => {
  const clock = mock.clock(on, { now: NOON_NOV_1 })

  world(on, FULL)
  await start($, clock)

  const ui = await mountBand($, 'desktop', true)

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

test('no future deadline draws only the stock band', async ($, on) => {
  const clock = mock.clock(on, { now: new Date(2027, 0, 1, 12).getTime() })

  world(on, FULL)
  await start($, clock)

  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

test('an obligation sooner than any task wins', async ($, on) => {
  const clock = mock.clock(on, { now: new Date(2026, 10, 16, 9).getTime() })

  world(on, FULL)
  await start($, clock)

  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Text', text: 'Monthly tax' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'today' })).toBeDefined()
  await ui.unmount()
})

test('the days left count down, and the needle moves on after the date passes', async ($, on) => {
  const clock = mock.clock(on, { now: NOON_NOV_1 })

  world(on, FULL)
  await start($, clock)

  const ui = await mountBand($, 'desktop')

  await clock.advance(13 * DAY)
  expect(await ui.find({ type: 'Text', text: '1 day left' })).toBeDefined()
  await clock.advance(2 * DAY)
  expect(await ui.find({ type: 'Text', text: 'Monthly tax' })).toBeDefined()
  await ui.unmount()
})

test('each hour reads both sources again', async ($, on) => {
  const clock = mock.clock(on, { now: NOON_NOV_1 })
  const calls = world(on, FULL)

  await start($, clock)
  await clock.advance(HOUR)
  expect(calls.runs).toHaveLength(4)
  await clock.advance(HOUR)
  expect(calls.runs).toHaveLength(6)
})

test('a failed read keeps the last list', async ($, on) => {
  const clock = mock.clock(on, { now: new Date(2026, 10, 16, 9).getTime() })
  const answers: Answers = { obligations: OK(OBLIGATIONS), tasks: OK(TASKS) }

  world(on, answers)
  await start($, clock)

  const ui = await mountBand($, 'desktop')

  for (const broken of ['throw', { exitCode: 1, stdout: '' }, OK('not json'), OK('{"error":"down"}')] as const) {
    answers.obligations = broken
    await clock.advance(HOUR)
    expect(await ui.find({ type: 'Text', text: 'Monthly tax' })).toBeDefined()
  }

  await ui.unmount()
})

test('one failed source leaves the other source working', async ($, on) => {
  const clock = mock.clock(on, { now: NOON_NOV_1 })

  world(on, { obligations: 'throw', tasks: OK(TASKS) })
  await start($, clock)

  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Text', text: 'Send the second payment' })).toBeDefined()
  await ui.unmount()
})

test('parseTasks takes a day from the hold date, the title or the reason of an open task', () => {
  expect(parseTasks(TASKS)).toEqual([
    { name: 'Send the second payment', due: '2026-11-15' },
    { name: 'Send the second payment', due: '2026-11-15' },
    { name: 'Ship the thing by 2026-11-20', due: '2026-11-20' },
    { name: 'Renew a certificate', due: '2026-10-01' },
    { name: 'Renew a certificate', due: '2026-11-25' },
  ])
})

test('names lose their control characters', () => {
  const hostile = `tasks[1]{id,state,title,hold_until,hold_reason}:\n  a,queued,"Pay\\u001b[31m now 2026-11-02","-","-"\n`

  expect(parseTasks(hostile)[0]?.name).toBe('Pay[31m now 2026-11-02')
  expect(parseObligations(JSON.stringify([{ name: 'Tax\u0007', due_date: '2026-11-16' }]))).toEqual([
    { name: 'Tax', due: '2026-11-16' },
  ])
})

test('nextDeadline takes the earliest day from today on', () => {
  const list = [
    { name: 'past', due: '2026-10-31' },
    { name: 'later', due: '2026-11-20' },
    { name: 'soon', due: '2026-11-02' },
  ]

  expect(nextDeadline(list, '2026-11-01')?.name).toBe('soon')
  expect(nextDeadline(list, '2026-11-02')?.name).toBe('soon')
  expect(nextDeadline(list, '2026-11-21')).toBeUndefined()
})

test('the label counts whole calendar days across a month end', () => {
  expect(daysLeftLabel('2026-11-01', '2026-11-01')).toBe('today')
  expect(daysLeftLabel('2026-11-01', '2026-11-02')).toBe('1 day left')
  expect(daysLeftLabel('2026-10-31', '2026-11-15')).toBe('15 days left')
})

test('localDay reads the local calendar day', () => {
  expect(localDay(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05')
})
