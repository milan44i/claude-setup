import type { ModelCompleteResult, On, RenderSurface, TurnCompleteInput } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const STOCK = 'stock band'
const LINE = 'The parrot summed the reply up.'
const USAGE = {
  input_tokens: 1,
  output_tokens: 1,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}
const ANSWERED = { isAnswered: true, text: LINE, usage: USAGE } as ModelCompleteResult
const SURFACES = ['terminal', 'desktop'] as const

const reply = (count: number) => Array.from({ length: count }, () => 'word').join(' ')
const LONG = reply(121)

type Answer = ModelCompleteResult | 'refused' | Promise<ModelCompleteResult>

const world = (on: On, answer: Answer = ANSWERED, surfaces: readonly RenderSurface[] = ['terminal']) => {
  const calls: { model: string; prompt: string; system?: string }[] = []

  on('session.surfaces', () => ({ value: surfaces }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('model.complete', async (_, e) => {
    calls.push(e)

    if (answer === 'refused') return { deny: 'blocked model' }

    return { value: await answer }
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return Text({ children: STOCK })
  })

  return calls
}

const endTurn = ($: Engine, answer: string, overrides: Partial<TurnCompleteInput> = {}) =>
  $.turn.complete({
    answer,
    durationMs: 1,
    isAborted: false,
    turnId: 'turn',
    reason: 'answer',
    ...overrides,
  } as TurnCompleteInput)

const submit = ($: Engine) =>
  $.prompt.submit({ text: 'next', wait: false, origin: { kind: 'composer' } })

const mountBand = (
  $: Engine,
  surface: 'terminal' | 'desktop' = 'terminal',
  { hasSurvey = false, agentId }: { hasSurvey?: boolean; agentId?: string } = {},
) =>
  $.ui.mount({
    plugin: 'parrot',
    surface,
    component: 'AbovePrompt',
    requestId: 'above-prompt',
    props: {
      hasSurvey,
      isWorking: false,
      maxRows: 12,
      bodyColumns: 80,
      scroll: { offset: 0, bodyRows: 12 },
      view: agentId === undefined ? {} : { agentId },
    },
  })

const shownText = async ($: Engine, options?: Parameters<typeof mountBand>[2]) => {
  const ui = await mountBand($, 'terminal', options)
  const found = await ui.find({ type: 'Text', text: /🦜/ })

  await ui.unmount()

  return found?.text
}

test('a long reply asks the named model and squawks on every surface, above the band beneath', async ($, on) => {
  const clock = mock.clock(on)
  const calls = world(on)

  await endTurn($, LONG)
  await clock.settle()

  expect(calls).toHaveLength(1)
  expect(calls[0]?.model).toBe('claude-haiku-5-5')
  expect(calls[0]?.prompt).toContain(LONG)
  expect(calls[0]?.system).toContain('at most 10 words')
  expect(calls[0]?.system).toContain('in the language the reply is written in')

  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)

    expect((await ui.find({ type: 'Text', text: /🦜/ }))?.text).toBe(`🦜 ${LINE}`)
    expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
    await ui.unmount()
  }
})

test('hovering the squawk draws one hidden sentence out of the flow', async ($, on) => {
  const clock = mock.clock(on)
  world(on)

  await endTurn($, LONG)
  await clock.settle()

  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)
    const boxes = await ui.findAll({ type: 'Box' })

    expect(boxes.map(box => box.props)).toContainEqual({ position: 'absolute', top: 0, right: 0, display: 'none' })
    expect(boxes.some(box => box.key === 'parrot')).toBe(true)
    expect(await ui.find({ type: 'Text', text: 'Parrot sums up the last long reply in one line, gone at your next prompt.' })).toBeDefined()
    await ui.unmount()
  }
})

test('a reply of 120 words makes no call, and 121 words makes one', async ($, on) => {
  const clock = mock.clock(on)
  const calls = world(on)

  await endTurn($, reply(120))
  await clock.settle()
  expect(calls).toHaveLength(0)
  expect(await shownText($)).toBeUndefined()

  await endTurn($, reply(121))
  await clock.settle()
  expect(calls).toHaveLength(1)
})

test('a subagent turn makes no call and shows nothing', async ($, on) => {
  const clock = mock.clock(on)
  const calls = world(on)

  await endTurn($, LONG, { agentId: 'agent-1' })
  await clock.settle()

  expect(calls).toHaveLength(0)
  expect(await shownText($)).toBeUndefined()
})

test('a turn that did not end in an answer makes no call', async ($, on) => {
  const clock = mock.clock(on)
  const calls = world(on)

  await endTurn($, LONG, { reason: 'aborted', isAborted: true })
  await endTurn($, LONG, { reason: 'error' })
  await clock.settle()

  expect(calls).toHaveLength(0)
})

test('a session with no surface makes no call', async ($, on) => {
  const clock = mock.clock(on)
  const calls = world(on, ANSWERED, [])

  await endTurn($, LONG)
  await clock.settle()

  expect(calls).toHaveLength(0)
})

const FAILURES: readonly [string, Answer][] = [
  ['an API error', { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: USAGE } as ModelCompleteResult],
  ['an empty reply', { isAnswered: false, reason: 'empty-reply', usage: USAGE } as ModelCompleteResult],
  ['a refused request', 'refused'],
]

for (const [name, answer] of FAILURES) {
  test(`${name} shows nothing and raises no error`, async ($, on) => {
    const clock = mock.clock(on)
    const calls = world(on, answer)

    await endTurn($, LONG)
    await clock.settle()

    expect(calls).toHaveLength(1)
    expect(await shownText($)).toBeUndefined()
  })
}

test('the next prompt clears the squawk', async ($, on) => {
  const clock = mock.clock(on)
  world(on)

  await endTurn($, LONG)
  await clock.settle()
  expect(await shownText($)).toBe(`🦜 ${LINE}`)

  await submit($)
  expect(await shownText($)).toBeUndefined()
})

test('an answer that lands after the next prompt shows nothing', async ($, on) => {
  const clock = mock.clock(on)
  let land = (_: ModelCompleteResult) => {}
  const late = new Promise<ModelCompleteResult>(resolve => {
    land = resolve
  })

  world(on, late)

  await endTurn($, LONG)
  await submit($)
  land(ANSWERED)
  await clock.settle()

  expect(await shownText($)).toBeUndefined()
})

test('the model answer is held to one printable line of 15 words', async ($, on) => {
  const clock = mock.clock(on)
  const text = `  ${reply(20)}\u001b[31m\nsecond line\n`

  world(on, { isAnswered: true, text, usage: USAGE } as ModelCompleteResult)

  await endTurn($, LONG)
  await clock.settle()

  expect(await shownText($)).toBe(`🦜 ${reply(15)}`)
})

test('a blank model answer shows nothing', async ($, on) => {
  const clock = mock.clock(on)
  world(on, { isAnswered: true, text: ' \n ', usage: USAGE } as ModelCompleteResult)

  await endTurn($, LONG)
  await clock.settle()

  expect(await shownText($)).toBeUndefined()
})

test('a survey or an agent transcript gets only the band beneath', async ($, on) => {
  const clock = mock.clock(on)
  world(on)

  await endTurn($, LONG)
  await clock.settle()

  for (const options of [{ hasSurvey: true }, { agentId: 'agent-1' }]) {
    const ui = await mountBand($, 'terminal', options)

    expect(await ui.find({ type: 'Text', text: /🦜/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
    await ui.unmount()
  }
})
