import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

const HOME = '/fake/home'
const PAUSAL = `${HOME}/work/potpis/posao/pausal`
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

type Answer = { exitCode: number; stdout: string } | 'throw'

const world = (on: On, prs: Answer, invoices: Answer) => {
  const calls = { runs: [] as { argv: readonly string[]; cwd?: string }[], opens: [] as string[], writes: 0 }

  mock.env(on, { HOME })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', (_, e) => {
    calls.opens.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('fs.write', () => {
    calls.writes += 1

    return { value: undefined }
  })
  on('process.run', (_, e) => {
    calls.runs.push({ argv: e.argv, cwd: e.init?.cwd })
    const answer = e.argv[0] === 'gh-axi' ? prs : invoices

    if (answer === 'throw') return { deny: 'cannot start' }

    return { value: { ...answer, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  return calls
}

const FIFTEEN_PRS = { exitCode: 0, stdout: '15\n' }
const TWO_INVOICES = { exitCode: 0, stdout: '[{"id":3},{"id":4}]\n' }

const open = async ($: Engine, clock: MockClock) => {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const opened = await $.command.run({
    command: 'wanted',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  await clock.settle()

  return opened
}

const mountPane = (
  $: Engine,
  surface: (typeof SURFACES)[number] = 'desktop',
) =>
  $.ui.mount({
    plugin: 'wanted-poster',
    surface,
    component: 'Pane',
    requestId: 'wanted-poster',
    props: {
      title: 'Wanted',
      isFocused: false,
      bodyColumns: 60,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  })

const posterSource = async ($: Engine) => {
  const ui = await mountPane($)
  const svg = await ui.find({ type: 'Svg' })
  await ui.unmount()

  return { source: String(svg?.props.source), alt: String(svg?.props.alt) }
}

test('/wanted opens the pane and reads both sources, read only', async ($, on) => {
  const clock = mock.clock(on)
  const calls = world(on, FIFTEEN_PRS, TWO_INVOICES)
  const opened = await open($, clock)

  expect(opened.text).toBe('Wanted poster opened.')
  expect(calls.opens).toEqual(['wanted-poster'])
  expect(calls.writes).toBe(0)
  expect(calls.runs).toEqual([
    {
      argv: ['gh-axi', 'api', '/search/issues?q=author:milan44i+is:pr+is:merged&per_page=1', '--jq', '.total_count'],
      cwd: undefined,
    },
    {
      argv: ['npm', 'run', '-s', 'pausal', '--', 'docs', 'list', '--type', 'invoice', '--status', 'paid'],
      cwd: PAUSAL,
    },
  ])
})

test('the bounty pays a fixed sum per merged PR and per paid invoice', async ($, on) => {
  const clock = mock.clock(on)
  world(on, FIFTEEN_PRS, TWO_INVOICES)
  await open($, clock)
  const { source, alt } = await posterSource($)

  expect(source).toMatch(/>115,000,000</)
  expect(source).toMatch(/>BERRIES</)
  expect(source).toMatch(/>15 merged PRs</)
  expect(source).toMatch(/>2 paid invoices</)
  expect(alt).toMatch(/bounty 115,000,000 berries/)
})

test('the poster carries the words the captain asked for and no script', async ($, on) => {
  const clock = mock.clock(on)
  world(on, FIFTEEN_PRS, TWO_INVOICES)
  await open($, clock)
  const { source, alt } = await posterSource($)

  for (const words of ['WANTED', 'DEAD OR ALIVE', 'MILAN']) expect(source).toContain(`>${words}<`)
  expect(alt).toMatch(/straw hat silhouette/)
  expect(source.length).toBeLessThan(131072)
  expect(source).not.toMatch(/<script|\son\w+=|<image|href=/)
})

test('a failed PR read is said on the poster and the invoices still count', async ($, on) => {
  const clock = mock.clock(on)
  world(on, { exitCode: 1, stdout: '' }, TWO_INVOICES)
  await open($, clock)
  const { source } = await posterSource($)

  expect(source).toMatch(/>100,000,000</)
  expect(source).toMatch(/>PRs could not be read, not counted</)
  expect(source).toMatch(/>2 paid invoices</)
})

test('a failed invoice read is said on the poster and the PRs still count', async ($, on) => {
  const clock = mock.clock(on)
  world(on, FIFTEEN_PRS, 'throw')
  await open($, clock)
  const { source } = await posterSource($)

  expect(source).toMatch(/>15,000,000</)
  expect(source).toMatch(/>Invoices could not be read, not counted</)
  expect(source).toMatch(/>15 merged PRs</)
})

test('output that is not a count or a list reads as a failure, not as zero', async ($, on) => {
  const clock = mock.clock(on)
  world(on, { exitCode: 0, stdout: '' }, { exitCode: 0, stdout: 'login page' })
  await open($, clock)
  const { source } = await posterSource($)

  expect(source).toMatch(/>PRs could not be read, not counted</)
  expect(source).toMatch(/>Invoices could not be read, not counted</)
})

test('one PR and one invoice read in the singular', async ($, on) => {
  const clock = mock.clock(on)
  world(on, { exitCode: 0, stdout: '1\n' }, { exitCode: 0, stdout: '[{"id":3}]\n' })
  await open($, clock)
  const { source } = await posterSource($)

  expect(source).toMatch(/>1 merged PR</)
  expect(source).toMatch(/>1 paid invoice</)
})

test('before the first read the poster says it is counting', async ($, on) => {
  world(on, FIFTEEN_PRS, TWO_INVOICES)
  const { source } = await posterSource($)

  expect(source).toMatch(/>\?\?\?</)
  expect(source).toMatch(/>Counting the bounty\.\.\.</)
})

test('the terminal draws the same poster in text, every other surface as a drawing', async ($, on) => {
  const clock = mock.clock(on)
  world(on, FIFTEEN_PRS, 'throw')
  await open($, clock)

  for (const surface of SURFACES) {
    const ui = await mountPane($, surface)
    const svg = await ui.find({ type: 'Svg' })

    expect(svg !== undefined).toBe(surface !== 'terminal')

    if (surface === 'terminal') {
      for (const words of ['WANTED', 'DEAD OR ALIVE', 'MILAN', '15,000,000 BERRIES', '15 merged PRs', 'Invoices could not be read, not counted']) {
        expect((await ui.find({ type: 'Text', text: words }))?.text).toBe(words)
      }
    }

    await ui.unmount()
  }
})

const note = async ($: Engine, surface: (typeof SURFACES)[number] = 'desktop') => {
  const ui = await mountPane($, surface)
  const drawn = await ui.drawn()
  const children = drawn.type === 'Box' ? (drawn.children ?? []) : []
  const text = await ui.find({ type: 'Text', text: /^This mod/ })
  await ui.unmount()

  return { heading: children[0], card: children.at(-1), text: text?.text }
}

test('hovering the heading reveals the note over the poster with no reflow, on every surface', async ($, on) => {
  const clock = mock.clock(on)
  world(on, FIFTEEN_PRS, TWO_INVOICES)
  await open($, clock)

  for (const surface of SURFACES) {
    const { heading, card, text } = await note($, surface)

    expect(card).toMatchObject({
      props: { display: 'none', position: 'absolute' },
      hover: { scope: 'wanted-note', display: 'flex' },
    })
    expect(heading).toMatchObject({ hover: { scope: 'wanted-note' } })
    expect(text).toBe('This mod draws your bounty from merged PRs and paid invoices, now 115,000,000 berries.')
  }
})

test('the note says what could not be read, and while it is still counting', async ($, on) => {
  const clock = mock.clock(on)
  world(on, { exitCode: 1, stdout: '' }, TWO_INVOICES)

  expect((await note($)).text).toBe('This mod draws your bounty from merged PRs and paid invoices, and it is still counting.')

  await open($, clock)

  expect((await note($)).text).toBe('This mod draws your bounty from merged PRs and paid invoices, now 100,000,000 berries without the PRs it could not read.')
})
