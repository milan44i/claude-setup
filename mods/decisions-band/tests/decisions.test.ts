import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

const HOME = '/Users/milanstankovic/work/firstmate'
const SCRIPT = `${HOME}/bin/fm-tasks-axi.sh`
const STOCK = 'stock band'
const MINUTE = 60_000
const SURFACES = ['terminal', 'desktop'] as const

const HELD = `count: 6
tasks[6]{id,state,kind,repo,title,hold_kind,hold_reason}:
  pick-one,queued,task,"-","Pick one, or the other",captain,"Captain 2026-10-31: decide, and soon"
  long-title,in_flight,ship,repo,"A title cut short\\n... (truncated, 116 chars total - use show long-title --full to see complete text)",captain,"Second\\nline"
  on-someone,queued,task,"-",Reply due,captain,"Waiting for the accountant"
  a-reminder,queued,task,"-",Send it later,captain,Reminder for Friday
  not-yet,queued,task,"-",Later,future,starts when ready
  ops-wait,queued,task,"-",Later,other,"Pick soon"
help[1]:
  - Run \`tasks-axi show <id>\` for full notes on a task
`

type Answer = { exitCode: number; stdout: string } | 'throw'

const world = (on: On, answers: { held: Answer }, session = { root: HOME }) => {
  const calls = { argv: [] as (readonly string[])[], writes: 0, prompts: [] as string[] }

  on('session.root', () => ({ value: session.root }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.write', () => {
    calls.writes += 1

    return { value: undefined }
  })
  on('process.run', (_, e) => {
    calls.argv.push(e.argv)

    if (answers.held === 'throw') return { deny: 'cannot start' }

    return { value: { ...answers.held, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('prompt.submit', (_, e) => {
    calls.prompts.push(e.text)

    return { text: e.text }
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

const mountBand = ($: Engine, surface: 'terminal' | 'desktop', hasSurvey = false, offset = 0) =>
  $.ui.mount({
    plugin: 'decisions-band',
    surface,
    component: 'AbovePrompt',
    requestId: 'above-prompt',
    props: { hasSurvey, isWorking: false, maxRows: 12, bodyColumns: 80, scroll: { offset, bodyRows: 12 }, view: {} },
  })

test('a home reads the held list through its own script, read only', async ($, on) => {
  const clock = mock.clock(on)
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } })

  await start($, clock)
  expect(calls.argv).toEqual([
    [SCRIPT, 'list', '--state', 'held', '--limit', '1000', '--fields', 'hold_kind,hold_reason'],
  ])
  expect(calls.writes).toBe(0)
})

test('collapsed shows one line and counts only what waits on the captain', async ($, on) => {
  const clock = mock.clock(on)
  world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)

  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)

    expect((await ui.find({ type: 'Button', key: 'toggle' }))?.props.label).toBe('2 decisions waiting')
    expect(await ui.find({ type: 'Text', text: /Pick one/ })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'decide-pick-one' })).toBeUndefined()
    await ui.unmount()
  }
})

test('hovering the band draws one hidden sentence out of the flow', async ($, on) => {
  const clock = mock.clock(on)
  world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)

  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)
    const boxes = await ui.findAll({ type: 'Box' })

    expect(boxes.map(box => box.props)).toContainEqual({ position: 'absolute', top: 0, right: 0, display: 'none' })
    expect(boxes.some(box => box.key === 'band')).toBe(true)
    expect(await ui.find({ type: 'Text', text: 'Lists the decisions waiting on you, click to open them.' })).toBeDefined()
    await ui.unmount()
  }
})

test('expanded lists each decision with one Decide button', async ($, on) => {
  const clock = mock.clock(on)
  world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)

  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)

    await ui.press({ key: 'toggle' })
    expect((await ui.find({ type: 'Text', text: 'Pick one, or the other' }))?.text).toBe('Pick one, or the other')
    expect(await ui.find({ type: 'Text', text: 'Captain 2026-10-31: decide, and soon' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'A title cut short' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Second\nline' })).toBeDefined()
    expect((await ui.find({ type: 'Button', key: 'decide-pick-one' }))?.props.label).toBe('Decide')
    expect(await ui.find({ type: 'Button', key: 'decide-long-title' })).toBeDefined()

    for (const left of ['on-someone', 'a-reminder', 'not-yet', 'ops-wait']) {
      expect(await ui.find({ type: 'Button', key: `decide-${left}` })).toBeUndefined()
    }

    await ui.press({ key: 'toggle' })
    expect(await ui.find({ type: 'Button', key: 'decide-pick-one' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the close x shows only while open, follows the scrolled window and only closes the list', async ($, on) => {
  const clock = mock.clock(on)
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)

  for (const surface of SURFACES) {
    const collapsed = await mountBand($, surface)

    expect(await collapsed.find({ type: 'Button', key: 'close' })).toBeUndefined()
    await collapsed.press({ key: 'toggle' })
    await collapsed.unmount()

    const scrolled = await mountBand($, surface, false, 14)
    const boxes = await scrolled.findAll({ type: 'Box' })

    expect(boxes.map(box => box.props)).toContainEqual({ position: 'absolute', top: 14, right: 0 })
    expect((await scrolled.find({ type: 'Button', key: 'close' }))?.props.label).toBe('Close decisions')

    await scrolled.press({ key: 'close' })
    expect(await scrolled.find({ type: 'Button', key: 'close' })).toBeUndefined()
    expect(await scrolled.find({ type: 'Button', key: 'decide-pick-one' })).toBeUndefined()
    expect((await scrolled.find({ type: 'Button', key: 'toggle' }))?.props.label).toBe('2 decisions waiting')
    await scrolled.unmount()
  }

  expect(calls.prompts).toEqual([])
  expect(calls.writes).toBe(0)
  expect(calls.argv.length).toBe(1)
})

test('Decide submits the prompt and writes nothing', async ($, on) => {
  const clock = mock.clock(on)
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } })

  await start($, clock)
  const ui = await mountBand($, 'desktop')

  await ui.press({ key: 'toggle' })
  await ui.press({ key: 'decide-long-title' })
  expect(calls.prompts).toEqual([
    'Explain the decision on long-title in plain words, what happens under each answer and what you recommend, then ask me for it.',
  ])
  expect(calls.writes).toBe(0)
  expect(calls.argv.length).toBe(1)
  await ui.unmount()
})

test('the timer rereads about every 60 seconds and the band follows', async ($, on) => {
  const clock = mock.clock(on)
  const answers: { held: Answer } = { held: { exitCode: 0, stdout: 'count: 0\ntasks: 0 held tasks\n' } }
  const calls = world(on, answers)

  await start($, clock)
  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Button', key: 'toggle' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()

  answers.held = { exitCode: 0, stdout: HELD }
  await clock.advance(MINUTE)
  expect(calls.argv.length).toBe(2)
  expect((await ui.find({ type: 'Button', key: 'toggle' }))?.props.label).toBe('2 decisions waiting')
  await ui.unmount()
})

test('one decision reads in the singular', async ($, on) => {
  const clock = mock.clock(on)
  const one = 'tasks[1]{id,state,kind,repo,title,hold_kind,hold_reason}:\n  a,queued,task,"-",A,captain,Pick\n'

  world(on, { held: { exitCode: 0, stdout: one } })
  await start($, clock)
  const ui = await mountBand($, 'desktop')

  expect((await ui.find({ type: 'Button', key: 'toggle' }))?.props.label).toBe('1 decision waiting')
  await ui.unmount()
})

test('control characters never reach the band', async ($, on) => {
  const clock = mock.clock(on)
  const raw = 'tasks[1]{id,state,kind,repo,title,hold_kind,hold_reason}:\n  a,queued,task,"-","\\u001b[31mRed",captain,"One\\u0007\\nTwo\\u009b"\n'

  world(on, { held: { exitCode: 0, stdout: raw } })
  await start($, clock)
  const ui = await mountBand($, 'terminal')

  await ui.press({ key: 'toggle' })
  expect(await ui.find({ type: 'Text', text: '[31mRed' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'One\nTwo' })).toBeDefined()
  await ui.unmount()
})

test('a failed read keeps the last list and the timer running', async ($, on) => {
  const clock = mock.clock(on)
  const answers: { held: Answer } = { held: { exitCode: 0, stdout: HELD } }
  const calls = world(on, answers)

  await start($, clock)
  answers.held = { exitCode: 2, stdout: '' }
  await clock.advance(MINUTE)
  answers.held = 'throw'
  await clock.advance(MINUTE)
  answers.held = { exitCode: 0, stdout: 'count: 0\n' }
  await clock.advance(MINUTE)
  expect(calls.argv.length).toBe(4)

  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Button', key: 'toggle' })).toBeUndefined()
  await ui.unmount()
})

test('a survey keeps the band', async ($, on) => {
  const clock = mock.clock(on)
  world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)
  const ui = await mountBand($, 'desktop', true)

  expect(await ui.find({ type: 'Button', key: 'toggle' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

test('outside a firstmate home nothing runs and the band passes through', async ($, on) => {
  const clock = mock.clock(on)
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } }, { root: '/some/other/project' })

  await start($, clock)
  expect(calls.argv).toEqual([])

  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

test('a repo with every marker file at another path runs nothing and passes through', async ($, on) => {
  const clock = mock.clock(on)
  const repo = `${HOME}-copy`
  const markers = [`${repo}/bin/fm-crew-state.sh`, `${repo}/bin/fm-tasks-axi.sh`]
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } }, { root: repo })

  on('fs.exists', (_, e) => ({ value: markers.includes(e.path) }))
  on('fs.stat', (_, e) => {
    if (e.path !== `${repo}/state`) return { deny: 'ENOENT' }

    return { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false } }
  })

  await start($, clock)
  await clock.advance(MINUTE)
  expect(calls.argv).toEqual([])

  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Button', key: 'toggle' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

test('a session moved out of the home stops reading and passes through', async ($, on) => {
  const clock = mock.clock(on)
  const session = { root: HOME }
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } }, session)

  await start($, clock)
  expect(calls.argv.length).toBe(1)

  session.root = '/some/other/project'
  await clock.advance(MINUTE)
  expect(calls.argv.length).toBe(1)

  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Button', key: 'toggle' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

const SHIP = {
  name: 'ship-stand-in',
  // Answers without next, as calm-desktop-ship's AbovePrompt hook does while its boat is up
  register(on: On) {
    on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
      if (e.surface !== 'desktop') return next(e)

      const { Svg } = $.ui.resolve(e)

      return Svg({ source: '<svg xmlns="http://www.w3.org/2000/svg"/>', alt: 'ship', width: 20, height: 20 })
    })
  },
}

test('with the ship in the band both draw', { plugins: [SHIP] }, async ($, on) => {
  const clock = mock.clock(on)
  world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)
  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'toggle' }))?.props.label).toBe('2 decisions waiting')
  await ui.unmount()
})
