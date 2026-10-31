import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

const HOME = '/Users/milanstankovic/work/firstmate'
const SCRIPT = `${HOME}/bin/fm-tasks-axi.sh`
const HOLD = `${HOME}/bin/fm-captain-hold.sh`
const STOCK = 'stock band'
const MINUTE = 60_000
const SURFACES = ['terminal', 'desktop'] as const
const LAST_OF_OCTOBER = new Date(2026, 9, 31, 12).getTime()

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

const DATED = `count: 5
tasks[5]{id,state,kind,repo,title,hold_kind,hold_reason,hold_until}:
  undated,queued,task,"-",Undated,captain,"Pick","-"
  tomorrow,queued,task,"-",Tomorrow,captain,"Pick",2026-11-01
  due-today,queued,task,"-",Today,captain,"Pick",2026-10-31
  overdue,in_flight,ship,repo,Overdue,captain,"Pick",2026-10-30
  closed,done,task,"-",Closed,captain,"Pick","-"
`

const RECORD = 'task:\n  id: pick-one\n  title: "Pick one, or the other"\n  links: none\n'
const REPORT_PATH = 'data/pick-origin/report.md'
const ANSWERED = { isAnswered: true, text: 'Odluka je jednostavna.', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as const
const USAGE = ANSWERED.usage

type Answer = { exitCode: number; stdout: string; stderr?: string } | 'throw'
type PaneOpen = { id: string; title?: string }
type ModelAnswer =
  | { isAnswered: true; text: string; usage: typeof USAGE }
  | { isAnswered: false; reason: 'empty-reply' | 'aborted'; usage: typeof USAGE }
  | { isAnswered: false; reason: 'api-error'; status: number; error: 'rate_limit'; usage: typeof USAGE }
  | 'throw'

const world = (
  on: On,
  answers: { held: Answer; show?: Answer; hold?: Answer; model?: ModelAnswer | Promise<ModelAnswer> },
  session = { root: HOME },
) => {
  const calls = {
    argv: [] as (readonly string[])[],
    holds: [] as (readonly string[])[],
    shows: [] as (readonly string[])[],
    writes: 0,
    prompts: [] as string[],
    opens: [] as PaneOpen[],
    toasts: [] as string[],
    models: [] as { model: string; prompt: string; system?: string }[],
    reads: [] as string[],
  }
  const reply = (answer: Answer) =>
    answer === 'throw'
      ? { deny: 'cannot start' }
      : { value: { stderr: '', ...answer, isStdoutTruncated: false, isStderrTruncated: false } }

  on('session.root', () => ({ value: session.root }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.write', () => {
    calls.writes += 1

    return { value: undefined }
  })
  on('process.run', (_, e) => {
    if (e.argv[0] === HOLD) {
      calls.holds.push(e.argv)

      return reply(answers.hold ?? { exitCode: 0, stdout: '' })
    }

    if (e.argv[1] === 'show') {
      calls.shows.push(e.argv)

      return reply(answers.show ?? { exitCode: 0, stdout: RECORD })
    }

    calls.argv.push(e.argv)

    return reply(answers.held)
  })
  on('fs.read', (_, e) => {
    calls.reads.push(e.path)

    return e.path === `${HOME}/${REPORT_PATH}` ? { value: 'What the report found.' } : { deny: 'ENOENT' }
  })
  on('model.complete', async (_, e) => {
    calls.models.push({ model: e.model, prompt: e.prompt, system: e.system })

    const answer = await (answers.model ?? ANSWERED)

    return answer === 'throw' ? { deny: 'blocked model' } : { value: answer }
  })
  on('ui.toast', (_, e) => {
    calls.toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.open', (_, e) => {
    calls.opens.push({ id: e.id, title: e.title })

    return { value: { isPlaced: true } }
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

const clockAt = (on: On, now = LAST_OF_OCTOBER, entries: Readonly<Record<string, unknown>> = {}) => {
  mock.store(on, entries)

  return mock.clock(on, { now })
}

const start = async ($: Engine, clock: MockClock) => {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.settle()
}

const mountBand = ($: Engine, surface: 'terminal' | 'desktop', hasSurvey = false) =>
  $.ui.mount({
    plugin: 'decisions-band',
    surface,
    component: 'AbovePrompt',
    requestId: 'above-prompt',
    props: { hasSurvey, isWorking: false, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 12 }, view: {} },
  })

const mountPane = ($: Engine, surface: 'terminal' | 'desktop') =>
  $.ui.mount({
    plugin: 'decisions-band',
    surface,
    component: 'Pane',
    requestId: 'decisions',
    props: { title: 'Decisions', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
  })

test('a home reads the backlog through its own script, read only, with every date gate', async ($, on) => {
  const clock = clockAt(on)
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } })

  await start($, clock)
  expect(calls.argv).toEqual([
    [SCRIPT, 'list', '--limit', '1000', '--fields', 'hold_kind,hold_reason,hold_until'],
  ])
  expect(calls.writes).toBe(0)
})

test('collapsed shows one line and counts only what waits on the captain', async ($, on) => {
  const clock = clockAt(on)
  world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)

  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)

    expect((await ui.find({ type: 'Button', key: 'open' }))?.props.label).toBe('2 decisions waiting')
    expect(await ui.find({ type: 'Text', text: /Pick one/ })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'decide-pick-one' })).toBeUndefined()
    await ui.unmount()
  }
})

test('hovering the band draws one hidden sentence out of the flow', async ($, on) => {
  const clock = clockAt(on)
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

test('pressing the row opens the panel and the band stays one row', async ($, on) => {
  const clock = clockAt(on)
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)

  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)

    calls.opens.length = 0
    await ui.press({ key: 'open' })
    expect(calls.opens).toEqual([{ id: 'decisions', title: 'Decisions' }])
    expect((await ui.find({ type: 'Button', key: 'open' }))?.props.label).toBe('2 decisions waiting')
    expect(await ui.find({ type: 'Text', text: /Pick one/ })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'decide-pick-one' })).toBeUndefined()
    await ui.unmount()
  }

  expect(calls.prompts).toEqual([])
  expect(calls.writes).toBe(0)
  expect(calls.argv.length).toBe(1)
})

test('nothing opens the panel unasked', async ($, on) => {
  const clock = clockAt(on)
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } })

  await start($, clock)
  await clock.advance(MINUTE)
  expect(calls.opens).toEqual([])
})

test('the panel lists each decision with Decide, postpone and x', async ($, on) => {
  const clock = clockAt(on)
  world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)

  for (const surface of SURFACES) {
    const ui = await mountPane($, surface)

    expect((await ui.find({ type: 'Text', text: 'Pick one, or the other' }))?.text).toBe('Pick one, or the other')
    expect(await ui.find({ type: 'Text', text: 'Captain 2026-10-31: decide, and soon' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'A title cut short' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Second\nline' })).toBeDefined()
    expect((await ui.find({ type: 'Button', key: 'decide-pick-one' }))?.props.label).toBe('Decide')
    expect((await ui.find({ type: 'Button', key: 'postpone-pick-one' }))?.props.label).toBe('↑')
    expect((await ui.find({ type: 'Button', key: 'hide-pick-one' }))?.props.label).toBe('×')
    expect(await ui.find({ type: 'Button', key: 'decide-long-title' })).toBeDefined()

    for (const left of ['on-someone', 'a-reminder', 'not-yet', 'ops-wait']) {
      expect(await ui.find({ type: 'Button', key: `decide-${left}` })).toBeUndefined()
    }

    await ui.unmount()
  }
})

test('a future date hides a row, its date or a later one shows it, and a closed row never shows', async ($, on) => {
  const clock = clockAt(on)
  world(on, { held: { exitCode: 0, stdout: DATED } })
  await start($, clock)
  const ui = await mountPane($, 'desktop')
  const band = await mountBand($, 'desktop')

  for (const shown of ['undated', 'due-today', 'overdue']) {
    expect(await ui.find({ type: 'Button', key: `decide-${shown}` })).toBeDefined()
  }

  expect(await ui.find({ type: 'Button', key: 'decide-tomorrow' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'decide-closed' })).toBeUndefined()
  expect((await band.find({ type: 'Button', key: 'open' }))?.props.label).toBe('3 decisions waiting')
  await ui.unmount()
  await band.unmount()
})

test('a postponed row comes back when its date arrives', async ($, on) => {
  const clock = clockAt(on, new Date(2026, 9, 31, 23, 59, 30).getTime())
  world(on, { held: { exitCode: 0, stdout: DATED } })
  await start($, clock)
  const ui = await mountPane($, 'desktop')

  expect(await ui.find({ type: 'Button', key: 'decide-tomorrow' })).toBeUndefined()
  await clock.advance(MINUTE)
  expect(await ui.find({ type: 'Button', key: 'decide-tomorrow' })).toBeDefined()
  await ui.unmount()
})

test('x hides the row and the band count, touching no task', async ($, on) => {
  const clock = clockAt(on)
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } })

  await start($, clock)
  const ui = await mountPane($, 'desktop')
  const band = await mountBand($, 'desktop')

  await ui.press({ key: 'hide-pick-one' })
  expect(await ui.find({ type: 'Button', key: 'decide-pick-one' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'decide-long-title' })).toBeDefined()
  expect((await band.find({ type: 'Button', key: 'open' }))?.props.label).toBe('1 decision waiting')
  expect(calls.holds).toEqual([])
  expect(calls.argv.length).toBe(1)
  expect(calls.writes).toBe(0)

  await clock.advance(MINUTE)
  expect(await ui.find({ type: 'Button', key: 'decide-pick-one' })).toBeUndefined()
  await ui.unmount()
  await band.unmount()
})

test('a row hidden in an earlier session stays hidden', async ($, on) => {
  const clock = clockAt(on, LAST_OF_OCTOBER, { 'pick-one': true })
  world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)
  const ui = await mountPane($, 'desktop')

  expect(await ui.find({ type: 'Button', key: 'decide-pick-one' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'decide-long-title' })).toBeDefined()
  await ui.unmount()
})

test('postpone re-holds with the reason given back and tomorrow, across a month end', async ($, on) => {
  const clock = clockAt(on)
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } })

  await start($, clock)
  const ui = await mountPane($, 'desktop')

  await ui.press({ key: 'postpone-long-title' })
  expect(calls.holds).toEqual([[HOLD, 'hold', 'long-title', '--reason', 'Second\nline', '--until', '2026-11-01']])
  expect(await ui.find({ type: 'Button', key: 'decide-long-title' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'decide-pick-one' })).toBeDefined()
  expect(calls.toasts).toEqual([])
  await ui.unmount()
})

test('a refused postpone keeps the row and says why', async ($, on) => {
  const clock = clockAt(on)
  const calls = world(on, {
    held: { exitCode: 0, stdout: HELD },
    hold: { exitCode: 1, stdout: '', stderr: 'fm-captain-hold: task pick-one is already closed\n' },
  })

  await start($, clock)
  const ui = await mountPane($, 'desktop')

  await ui.press({ key: 'postpone-pick-one' })
  expect(await ui.find({ type: 'Button', key: 'decide-pick-one' })).toBeDefined()
  expect(calls.toasts).toEqual(['Could not postpone pick-one: fm-captain-hold: task pick-one is already closed'])
  await ui.unmount()
})

test('Decide shows a loading line at once, then the explanation, and starts no turn', async ($, on) => {
  const clock = clockAt(on)
  let answer: (result: ModelAnswer) => void = () => undefined
  const calls = world(on, {
    held: { exitCode: 0, stdout: HELD },
    model: new Promise<ModelAnswer>(resolve => {
      answer = resolve
    }),
  })

  await start($, clock)
  const ui = await mountPane($, 'desktop')

  await ui.press({ key: 'decide-pick-one' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Explaining...' })).toBeDefined()
  expect(calls.models.length).toBe(1)

  await ui.press({ key: 'decide-pick-one' })
  await clock.settle()
  expect(calls.models.length).toBe(1)

  answer(ANSWERED)
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Explaining...' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Odluka je jednostavna.' })).toBeDefined()
  expect(calls.prompts).toEqual([])
  expect(calls.writes).toBe(0)
  await ui.unmount()
})

test('Decide asks sonnet in Serbian with the title, reason and record', async ($, on) => {
  const clock = clockAt(on)
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } })

  await start($, clock)
  const ui = await mountPane($, 'desktop')

  await ui.press({ key: 'decide-pick-one' })
  await clock.settle()

  const [asked] = calls.models

  expect(calls.shows).toEqual([[SCRIPT, 'show', 'pick-one', '--full']])
  expect(asked?.model).toBe('sonnet')
  expect(asked?.system).toMatch(/Serbian/)
  expect(asked?.system).toMatch(/what happens under each answer and what you recommend/)
  expect(asked?.prompt).toContain('Title: Pick one, or the other')
  expect(asked?.prompt).toContain('Hold reason: Captain 2026-10-31: decide, and soon')
  expect(asked?.prompt).toContain(RECORD)
  expect(asked?.prompt).not.toContain('Report the record names')
  expect(calls.reads).toEqual([])
  await ui.unmount()
})

test('Decide passes the report the record names, and goes on when it cannot be read', async ($, on) => {
  const clock = clockAt(on)
  const answers = {
    held: { exitCode: 0, stdout: HELD },
    show: { exitCode: 0, stdout: `${RECORD}  links: "report:${REPORT_PATH}"\n` },
  }
  const calls = world(on, answers)

  await start($, clock)
  const ui = await mountPane($, 'desktop')

  await ui.press({ key: 'decide-pick-one' })
  await clock.settle()
  expect(calls.reads).toEqual([`${HOME}/${REPORT_PATH}`])
  expect(calls.models[0]?.prompt).toContain('What the report found.')

  answers.show = { exitCode: 0, stdout: `${RECORD}  body: "see data/gone-task/report.md"\n` }
  await ui.press({ key: 'decide-long-title' })
  await clock.settle()
  expect(calls.reads[1]).toBe(`${HOME}/data/gone-task/report.md`)
  expect(calls.models[1]?.prompt).not.toContain('Report the record names')
  await ui.unmount()
})

test('a failed call shows its reason under the row and a new press tries again', async ($, on) => {
  const clock = clockAt(on)
  const answers: { held: Answer; model: ModelAnswer } = {
    held: { exitCode: 0, stdout: HELD },
    model: { isAnswered: false, reason: 'api-error', status: 429, error: 'rate_limit', usage: USAGE },
  }

  world(on, answers)
  await start($, clock)
  const ui = await mountPane($, 'desktop')

  await ui.press({ key: 'decide-pick-one' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Could not explain: api-error 429 rate_limit' })).toBeDefined()

  answers.model = { isAnswered: false, reason: 'aborted', usage: USAGE }
  await ui.press({ key: 'decide-pick-one' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Could not explain: aborted' })).toBeDefined()

  answers.model = 'throw'
  await ui.press({ key: 'decide-pick-one' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: /^Could not explain: .*blocked model/ })).toBeDefined()

  answers.model = ANSWERED
  await ui.press({ key: 'decide-pick-one' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Odluka je jednostavna.' })).toBeDefined()
  await ui.unmount()
})

test('a record that cannot be read shows why and makes no call', async ($, on) => {
  const clock = clockAt(on)
  const calls = world(on, {
    held: { exitCode: 0, stdout: HELD },
    show: { exitCode: 2, stdout: '', stderr: 'code: NOT_FOUND\n' },
  })

  await start($, clock)
  const ui = await mountPane($, 'desktop')

  await ui.press({ key: 'decide-pick-one' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Could not read pick-one: code: NOT_FOUND' })).toBeDefined()
  expect(calls.models).toEqual([])
  await ui.unmount()
})

test('an explanation leaves with its row', async ($, on) => {
  const clock = clockAt(on)
  world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)
  const ui = await mountPane($, 'desktop')

  await ui.press({ key: 'decide-pick-one' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Odluka je jednostavna.' })).toBeDefined()

  await ui.press({ key: 'postpone-pick-one' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Odluka je jednostavna.' })).toBeUndefined()
  await ui.unmount()
})

test('the timer rereads the panel from the same list', async ($, on) => {
  const clock = clockAt(on)
  const answers: { held: Answer } = { held: { exitCode: 0, stdout: HELD } }
  const calls = world(on, answers)

  await start($, clock)
  const ui = await mountPane($, 'desktop')

  expect(await ui.find({ type: 'Button', key: 'decide-pick-one' })).toBeDefined()

  answers.held = { exitCode: 0, stdout: 'count: 0\ntasks: 0 held tasks\n' }
  await clock.advance(MINUTE)
  expect(calls.argv.length).toBe(2)
  expect(await ui.find({ type: 'Button', key: 'decide-pick-one' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'No decisions waiting.' })).toBeDefined()
  await ui.unmount()
})

test('a reread of the same list writes nothing, a changed one writes once', async ($, on) => {
  const clock = clockAt(on)
  const answers: { held: Answer } = { held: { exitCode: 0, stdout: HELD } }
  let sets = 0

  world(on, answers)
  on('state.set', { plugin: 'decisions-band' }, (_, e, next) => {
    sets += 1

    return next(e)
  })

  await start($, clock)
  expect(sets).toBe(1)

  await clock.advance(MINUTE)
  expect(sets).toBe(1)

  answers.held = { exitCode: 0, stdout: 'count: 0\n' }
  await clock.advance(MINUTE)
  expect(sets).toBe(2)
})

test('the timer rereads about every 60 seconds and the band follows', async ($, on) => {
  const clock = clockAt(on)
  const answers: { held: Answer } = { held: { exitCode: 0, stdout: 'count: 0\ntasks: 0 held tasks\n' } }
  const calls = world(on, answers)

  await start($, clock)
  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Button', key: 'open' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()

  answers.held = { exitCode: 0, stdout: HELD }
  await clock.advance(MINUTE)
  expect(calls.argv.length).toBe(2)
  expect((await ui.find({ type: 'Button', key: 'open' }))?.props.label).toBe('2 decisions waiting')
  await ui.unmount()
})

test('one decision reads in the singular', async ($, on) => {
  const clock = clockAt(on)
  const one = 'tasks[1]{id,state,kind,repo,title,hold_kind,hold_reason}:\n  a,queued,task,"-",A,captain,Pick\n'

  world(on, { held: { exitCode: 0, stdout: one } })
  await start($, clock)
  const ui = await mountBand($, 'desktop')

  expect((await ui.find({ type: 'Button', key: 'open' }))?.props.label).toBe('1 decision waiting')
  await ui.unmount()
})

test('control characters never reach the panel', async ($, on) => {
  const clock = clockAt(on)
  const raw = 'tasks[1]{id,state,kind,repo,title,hold_kind,hold_reason}:\n  a,queued,task,"-","\\u001b[31mRed",captain,"One\\u0007\\nTwo\\u009b"\n'

  world(on, {
    held: { exitCode: 0, stdout: raw },
    model: { isAnswered: true, text: '\u001b[31mCrveno', usage: USAGE },
  })
  await start($, clock)
  const ui = await mountPane($, 'terminal')

  expect(await ui.find({ type: 'Text', text: '[31mRed' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'One\nTwo' })).toBeDefined()

  await ui.press({ key: 'decide-a' })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: '[31mCrveno' })).toBeDefined()
  await ui.unmount()
})

test('a failed read keeps the last list and the timer running', async ($, on) => {
  const clock = clockAt(on)
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

  expect(await ui.find({ type: 'Button', key: 'open' })).toBeUndefined()
  await ui.unmount()
})

test('a survey keeps the band', async ($, on) => {
  const clock = clockAt(on)
  world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)
  const ui = await mountBand($, 'desktop', true)

  expect(await ui.find({ type: 'Button', key: 'open' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

test('outside a firstmate home nothing runs and the band passes through', async ($, on) => {
  const clock = clockAt(on)
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } }, { root: '/some/other/project' })

  await start($, clock)
  expect(calls.argv).toEqual([])

  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

test('a repo with every marker file at another path runs nothing and passes through', async ($, on) => {
  const clock = clockAt(on)
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

  expect(await ui.find({ type: 'Button', key: 'open' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

test('a session moved out of the home stops reading and passes through', async ($, on) => {
  const clock = clockAt(on)
  const session = { root: HOME }
  const calls = world(on, { held: { exitCode: 0, stdout: HELD } }, session)

  await start($, clock)
  expect(calls.argv.length).toBe(1)

  session.root = '/some/other/project'
  await clock.advance(MINUTE)
  expect(calls.argv.length).toBe(1)

  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Button', key: 'open' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()

  const pane = await mountPane($, 'desktop')

  expect(await pane.find({ type: 'Button', key: 'decide-pick-one' })).toBeUndefined()
  await pane.unmount()
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
  const clock = clockAt(on)
  world(on, { held: { exitCode: 0, stdout: HELD } })
  await start($, clock)
  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'open' }))?.props.label).toBe('2 decisions waiting')
  await ui.unmount()
})
