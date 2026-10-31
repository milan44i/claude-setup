import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

import { columnsFor, drawChart, labelLines } from '../hooks/chart'
import { plot } from '../hooks/records'

const HOME = '/fake/home'
const PANE = 'treasure-map'
const MAX_SVG = 131072
const RUN_MAP = {
  command: 'map',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
} as const

type Answer = { exitCode: number; stdout: string } | 'throw'
type Answers = Partial<Record<'requests' | 'pipeline' | 'clients' | 'documents', Answer>>

const ok = (value: unknown): Answer => ({ exitCode: 0, stdout: JSON.stringify(value) })

const FULL: Answers = {
  requests: ok([
    {
      results: [
        { name: 'Fresh Request', demo: 0, paid: 0 },
        { name: 'Harbor <Inn> & Co', demo: 1, paid: 0 },
        { name: 'TEST 2', demo: 0, paid: 0 },
        { name: 'test', demo: 0, paid: 0 },
        { name: 'Twice Seen', demo: 0, paid: 0 },
      ],
    },
  ]),
  pipeline: ok([{ name: 'Twice Seen', hasDemo: true }]),
  clients: ok([
    { name: 'Paid Harbor', paid: [{ currency: 'EUR', amount: 30000 }], telefon: '+38160000000' },
    { name: 'Unpaid Client', paid: [] },
  ]),
  documents: ok([
    { type: 'proforma', status: 'sent', client_name: 'Open Offer' },
    { type: 'proforma', status: 'sent', client_name: 'Paid Harbor' },
    { type: 'invoice', status: 'paid', client_name: 'Invoiced Inc' },
    { type: 'proforma', status: 'cancelled', client_name: 'Dropped Offer' },
    { type: 'invoice', status: 'draft', client_name: 'Draft Invoice' },
  ]),
}

const sourceOf = (argv: readonly string[]) => {
  if (argv.includes('d1')) return 'requests'
  if (argv[0] === 'node') return 'pipeline'

  return argv.includes('clients') ? 'clients' : 'documents'
}

const world = (on: On, answers: Answers) => {
  const calls = {
    runs: [] as { argv: readonly string[]; cwd: string | undefined }[],
    opens: 0,
    writes: 0,
    registered: [] as string[],
  }

  on('env.get', () => ({ value: HOME }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => {
    calls.registered.push(e.name)

    return { value: { command: e.name } }
  })
  on('ui.open', () => {
    calls.opens += 1

    return { value: { isPlaced: true } }
  })
  on('fs.write', () => {
    calls.writes += 1

    return { value: undefined }
  })
  on('process.run', (_, e) => {
    calls.runs.push({ argv: e.argv, cwd: e.init?.cwd })

    const answer = answers[sourceOf(e.argv)] ?? { exitCode: 1, stdout: '' }

    if (answer === 'throw') return { deny: 'cannot start' }

    return { value: { ...answer, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  return calls
}

const openMap = async ($: Engine, clock: MockClock) => {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(RUN_MAP)
  await clock.settle()
}

const mountPane = (
  $: Engine,
  surface: 'terminal' | 'desktop' | 'vscode' | 'mobile',
  bodyColumns = 66,
) =>
  $.ui.mount({
    plugin: 'treasure-map',
    component: 'Pane',
    requestId: PANE,
    surface,
    props: {
      title: 'Treasure map',
      isFocused: false,
      bodyColumns,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  })

const chartOf = async (ui: Awaited<ReturnType<typeof mountPane>>) => {
  const svg = await ui.find({ type: 'Svg' })

  return svg?.props as { source: string; alt: string } | undefined
}

test('/map opens the pane, and opening it reads every source without writing', async ($, on) => {
  const calls = world(on, FULL)
  const clock = mock.clock(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(calls.registered).toEqual(['map'])
  expect(calls.runs.length).toBe(0)

  const { text } = await $.command.run(RUN_MAP)

  expect(text).toBe('Treasure map opened.')
  expect(calls.opens).toBe(1)

  await clock.settle()

  const ui = await mountPane($, 'desktop')

  expect(calls.runs.map(({ cwd }) => cwd)).toEqual([
    `${HOME}/work/potpis/studio`,
    `${HOME}/work/potpis/alati/potpis-prodaja`,
    `${HOME}/work/potpis/posao/pausal`,
    `${HOME}/work/potpis/posao/pausal`,
  ])
  expect(calls.writes).toBe(0)

  const [requests, , clients, documents] = calls.runs
  const sql = requests?.argv.at(-1) ?? ''

  expect(sql.startsWith('SELECT')).toBe(true)
  expect(/\b(UPDATE|INSERT|DELETE|DROP|ALTER)\b/.test(sql)).toBe(false)
  expect(requests?.argv.slice(0, 7)).toEqual([
    'npx',
    'wrangler',
    'd1',
    'execute',
    'potpis-studio-db',
    '--remote',
    '--json',
  ])
  expect(clients?.argv.slice(-3)).toEqual(['clients', 'list', '--archived'])
  expect(documents?.argv.slice(-2)).toEqual(['docs', 'list'])

  await ui.unmount()
})

test('each lead is one island at its furthest stage, and a paid client has a red X', async ($, on) => {
  world(on, FULL)
  await openMap($, mock.clock(on))

  const ui = await mountPane($, 'desktop')


  const chart = await chartOf(ui)

  expect(chart?.alt).toBe(
    'Sea chart of the Potpis sales pipeline. Leads 1, Demo sent 2, Offer 1, Paid 2.',
  )
  expect(chart?.source.match(/stroke="#b3261e"/g)?.length).toBe(2)
  expect(chart?.source.includes('Twice Seen')).toBe(true)
  expect(chart?.source.includes('TEST')).toBe(false)
  expect(chart?.source.includes('Unpaid Client')).toBe(false)
  expect(chart?.source.includes('Dropped Offer')).toBe(false)
  expect(chart?.source.includes('Draft Invoice')).toBe(false)
  expect(chart?.source.includes('+38160000000')).toBe(false)
  expect(chart?.source.includes('<Inn>')).toBe(false)
  expect(chart?.source.includes('&#60;Inn&#62;')).toBe(true)

  await ui.unmount()
})

test('a source that fails is named, and the others still draw', async ($, on) => {
  world(on, { ...FULL, clients: 'throw', documents: { exitCode: 1, stdout: 'nope' } })
  await openMap($, mock.clock(on))

  const ui = await mountPane($, 'desktop')


  const note = await ui.find({ type: 'Text', text: /Not read/ })

  expect(note?.text).toBe('Not read: paušal clients, paušal documents. Open /map again to retry.')
  expect((await chartOf(ui))?.alt).toBe(
    'Sea chart of the Potpis sales pipeline. Leads 1, Demo sent 2, Offer 0, Paid 0.',
  )

  await ui.unmount()
})

test('output that is no JSON counts as a failed source', async ($, on) => {
  world(on, { ...FULL, requests: { exitCode: 0, stdout: 'not json' } })
  await openMap($, mock.clock(on))

  const ui = await mountPane($, 'desktop')

  expect((await ui.find({ type: 'Text', text: /Not read/ }))?.text).toContain('site requests')

  await ui.unmount()
})

test('the heading reveals a popover on hover that says what the chart means now', async ($, on) => {
  world(on, FULL)
  await openMap($, mock.clock(on))

  const ui = await mountPane($, 'desktop')


  const sentence = await ui.find({ type: 'Text', text: /shows Potpis sales/ })

  expect(sentence?.text).toBe(
    'Treasure map shows Potpis sales as islands, and right now it has 1 lead, 2 demos sent, 1 offer out and 2 paid clients marked with a red X.',
  )

  const drawn = JSON.stringify(await ui.drawn())
  const heading = '"props":{"key":"heading"},"hover":{"scope":"treasure-map-heading"}'
  const popover = '"display":"none"'
  const reveal = '"hover":{"scope":"treasure-map-heading","display":"flex"}'

  expect(drawn).toContain(heading)
  expect(drawn).toContain(reveal)
  expect(drawn).toContain('"position":"absolute"')
  expect(drawn.indexOf('"type":"Svg"')).toBeLessThan(drawn.indexOf(popover))

  await ui.unmount()
})

test('the terminal has no Svg, so it lists the same islands as text', async ($, on) => {
  world(on, FULL)
  await openMap($, mock.clock(on))

  const ui = await mountPane($, 'terminal')

  expect((await ui.find({ type: 'Text', text: /Paid Harbor/ }))?.text).toBe('X Paid Harbor')
  expect((await ui.find({ type: 'Text', text: /Fresh Request/ }))?.text).toBe('  Fresh Request')
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()

  await ui.unmount()
})

test('fifty islands fit the Svg limit, in a layout with no overlap and short labels', () => {
  const stages = ['lead', 'demo', 'offer', 'paid'] as const
  const islands = Array.from({ length: 50 }, (_, index) => ({
    name: `Dugacko Ime Biznisa Sa Mnogo Reci Broj ${index}`,
    stage: stages[index % 4] ?? 'lead',
  }))
  const { source, height, width } = drawChart(islands, columnsFor(66))
  const xAndY = [...source.matchAll(/<text x="(\d+(?:\.\d+)?)" y="(\d+)" text-anchor="middle" font-size="13"/g)].map(
    ([, x, y]) => `${x},${y}`,
  )

  expect(source.length).toBeLessThan(MAX_SVG / 2)
  expect(xAndY.length).toBe(50)
  expect(new Set(xAndY).size).toBe(50)
  expect(width).toBe(564)
  expect(height).toBeGreaterThan(1200)
  expect(columnsFor(20)).toBe(2)
  expect(columnsFor(200)).toBe(5)
})

test('a label stays within two short lines', () => {
  expect(labelLines('Twice Seen')).toEqual(['Twice Seen'])
  expect(labelLines('Omladinski fudbalski klub Zlatna Luka')).toEqual([
    'Omladinski fudbalski',
    'klub Zlatna Luka',
  ])

  for (const line of labelLines('Prvi Drugi Treci Cetvrti Peti Sesti Sedmi Osmi Deveti Deseti')) {
    expect(line.length).toBeLessThan(22)
  }

  expect(labelLines('Supercalifragilisticexpialidocious').join('').endsWith('…')).toBe(true)
})

test('plot keeps one island per business across spelling, furthest stage first', () => {
  expect(
    plot([
      { name: 'Šišanje\u0007  Kod Mike', stage: 'demo' },
      { name: 'sisanje kod mike', stage: 'lead' },
      { name: 'SISANJE KOD MIKE', stage: 'paid' },
      { name: '', stage: 'lead' },
      { name: 'Test 3', stage: 'lead' },
      { name: 'Test Auto', stage: 'lead' },
    ]),
  ).toEqual([
    { name: 'Šišanje Kod Mike', stage: 'paid' },
    { name: 'Test Auto', stage: 'lead' },
  ])
})
