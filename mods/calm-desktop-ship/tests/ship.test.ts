import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { estimateTokens, hasFailedChecks, isNightHour, seaForFill } from '../hooks/weather'

const HOME = '/Users/milanstankovic/work/firstmate'
const STATE = `${HOME}/state`
const STOCK = 'stand-in band'
const IN_HOME = { [`${HOME}/bin/fm-crew-state.sh`]: '' }
const CALM_ON = { ...IN_HOME, [`${HOME}/config/calm`]: 'on\n' }

type Run = (argv: readonly string[], env?: Record<string, string>) => string | undefined

const world = (
  on: On,
  files: Record<string, string>,
  root = HOME,
  variables: Record<string, string> = { CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: '1' },
  run?: Run,
) => {
  const calls: string[] = []

  mock.env(on, variables)
  on('session.root', () => ({ value: root }))
  on('fs.exists', (_, e) => ({ value: e.path in files }))
  on('fs.stat', (_, e) => {
    if (e.path !== STATE || root !== HOME) return { deny: 'ENOENT' }

    return { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false } }
  })
  on('fs.read', (_, e) => {
    const body = files[e.path]

    return body === undefined ? { deny: 'ENOENT' } : { value: body }
  })
  on('fs.write', () => {
    calls.push('fs.write')

    return { value: undefined }
  })
  on('process.run', (_, e) => {
    const stdout = run?.(e.argv, e.init?.env)

    if (stdout !== undefined) {
      return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }

    if (run === undefined) calls.push('process.run')

    return { deny: 'read only' }
  })
  on('ui.open', () => {
    calls.push('ui.open')

    return { value: { isPlaced: true } }
  })
  on('ui.render', { component: 'Spinner' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return Text({ children: STOCK })
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return Text({ children: STOCK })
  })

  return calls
}

const mountSpinner = async ($: Engine, mode: 'thinking' | 'tool-use') => {
  return $.ui.mount({
    plugin: 'calm-desktop-ship',
    surface: 'desktop',
    component: 'Spinner',
    requestId: 'main',
    props: { word: 'Running a command', message: null, suffix: '…', mode },
  })
}

const mountBand = async (
  $: Engine,
  isWorking = false,
  surface: 'terminal' | 'desktop' = 'desktop',
) => {
  return $.ui.mount({
    plugin: 'calm-desktop-ship',
    surface,
    component: 'AbovePrompt',
    requestId: 'above-prompt',
    props: { hasSurvey: false, isWorking, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 12 }, view: {} },
  })
}

const expectStock = async ($: Engine, surface: 'terminal' | 'desktop') => {
  const ui = await mountBand($, true, surface)

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
}

test('a running turn on desktop with Calm on draws an interactive Svg, read only', async ($, on) => {
  const calls = world(on, CALM_ON)
  const ui = await mountBand($, true)
  const svg = await ui.find({ type: 'Svg' })
  const source = String(svg?.props.source)

  expect(svg?.props.isInteractive).toBe(true)
  expect(svg?.props.width).toBe(4096)
  expect(svg?.props.height).toBe(46)
  expect(source).not.toMatch(/viewBox/)
  expect(String(svg?.props.alt)).toMatch(/pirate ship/)
  expect(source.length).toBeLessThan(131072)
  expect(source).toMatch(/<animateTransform [^>]*repeatCount="indefinite"/)
  expect(source).toMatch(/<animateTransform [^>]*type="rotate"[^>]*calcMode="spline"/)
  expect(source).toMatch(/<animate attributeName="d" [^>]*dur="60s"/)
  expect(source).not.toMatch(/<script|\son\w+=/)
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  expect(calls).toEqual([])
  await ui.unmount()
})

test('the ship stays up in the band while a tool runs, and the row draws none', async ($, on) => {
  world(on, CALM_ON)

  for (const mode of ['thinking', 'tool-use'] as const) {
    const row = await mountSpinner($, mode)

    expect(await row.find({ type: 'Svg' })).toBeUndefined()
    expect(await row.find({ type: 'Text', text: STOCK })).toBeDefined()
    await row.unmount()
  }

  await expectBandShip($, true, true)
})

const startJob = ($: Engine, command = 'sleep 20') =>
  $.tool.call({ tool: 'Bash', command, run_in_background: true })

const finishJob = ($: Engine, id: string) =>
  $.prompt.submit({
    text: `<task-notification>\n<task-id>${id}</task-id>\n<status>completed</status>\n</task-notification>`,
    origin: { kind: 'task-notification' },
  })

const withJobs = (on: On) => {
  world(on, CALM_ON)
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({
    result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'job-1' },
  }))
}

const expectBandShip = async ($: Engine, isDrawn: boolean, isWorking = false) => {
  const ui = await mountBand($, isWorking)
  const svg = await ui.find({ type: 'Svg' })

  expect(svg !== undefined).toBe(isDrawn)
  await ui.unmount()
}

test('the band stays empty with no background job', async ($, on) => {
  withJobs(on)
  await expectBandShip($, false)
})

test('the band draws the ship until the job finishes', async ($, on) => {
  withJobs(on)
  await startJob($)
  await expectBandShip($, true)
  await finishJob($, 'job-1')
  await expectBandShip($, false)
})

test('a running turn with a background job keeps the one ship in the band', async ($, on) => {
  withJobs(on)
  await startJob($)
  await expectBandShip($, true, true)
  await finishJob($, 'job-1')
  await expectBandShip($, true, true)
  await expectBandShip($, false)
})

test('terminal passes through', async ($, on) => {
  world(on, CALM_ON)
  await expectStock($, 'terminal')
})

test('Calm off passes through', async ($, on) => {
  world(on, { ...IN_HOME, [`${HOME}/config/calm`]: 'off\n' })
  await expectStock($, 'desktop')
})

test('a home with no Calm preference passes through', async ($, on) => {
  world(on, IN_HOME)
  await expectStock($, 'desktop')
})

test('outside a firstmate home passes through', async ($, on) => {
  world(on, { '/some/other/project/config/calm': 'on\n' }, '/some/other/project')
  await expectStock($, 'desktop')
})

test('function hooks not enabled passes through', async ($, on) => {
  world(on, CALM_ON, HOME, {})
  await expectStock($, 'desktop')
})

const DAY = new Date(2026, 9, 31, 12).getTime()
const NIGHT = new Date(2026, 9, 31, 20).getTime()
const FIVE_MINUTES = 5 * 60_000
const KRAKEN_COLOR = '#8a3f9e'
const LANTERN_FLAME = '#ffb02e'
const NIGHT_WATER = '#2c3a86'

const failing = (failed: number) => `summary: "10 passed, ${failed} failed, 0 skipped, ${10 + failed} total"`
const PR_1 = `${STATE}/one.meta`
const PR_2 = `${STATE}/two.meta`
const PR_FILES = {
  [PR_1]: 'id=one\npr=https://github.com/o/r/pull/11\n',
  [PR_2]: 'id=two\npr=https://git.example.com/o/r/pull/22\n',
  [`${STATE}/gitlab.meta`]: 'pr=https://gitlab.com/o/r/-/merge_requests/3\n',
  [`${STATE}/none.meta`]: 'id=none\n',
  [`${STATE}/skip.status`]: 'pr=https://github.com/o/r/pull/99\n',
}

type Weather = {
  percent?: number
  checks: Record<string, string | undefined>
  surfaces: readonly ('terminal' | 'desktop')[]
}

const atSea = async (
  $: Engine,
  on: On,
  now: number,
  weather: Partial<Weather> = {},
  files: Record<string, string> = {},
  toolResult?: Record<string, unknown>,
) => {
  const clock = mock.clock(on, { now })
  const state: Weather = { checks: {}, surfaces: ['desktop'], ...weather }
  const all = { ...CALM_ON, ...files }
  const argv: { command: readonly string[]; host?: string }[] = []

  if (toolResult !== undefined) on('tool.call', () => ({ result: toolResult }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: state.surfaces }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 100, ...(state.percent === undefined ? {} : { percent: state.percent }) },
      rateLimits: [],
      cost: { usd: 0 },
    },
  }))
  on('fs.list', () => ({
    value: Object.keys(all)
      .filter(path => path.startsWith(`${STATE}/`))
      .map(path => ({ name: path.slice(STATE.length + 1), kind: 'file' as const, size: 0, mtimeMs: 0, isLink: false })),
  }))
  const calls = world(on, all, HOME, { CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: '1' }, (command, env) => {
    argv.push({ command, host: env?.GH_HOST })

    return state.checks[command[3] ?? '']
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.settle()

  return { clock, state, argv, calls }
}

const drawnShip = async ($: Engine, isWorking = true) => {
  const ui = await mountBand($, isWorking)
  const svg = await ui.find({ type: 'Svg' })
  const stock = await ui.find({ type: 'Text', text: STOCK })

  await ui.unmount()

  expect(stock).toBeDefined()

  return { alt: String(svg?.props.alt), source: String(svg?.props.source) }
}

const lineOf = async ($: Engine, text: string | RegExp) => {
  const ui = await mountBand($, true)
  const line = await ui.find({ type: 'Text', text })

  await ui.unmount()

  return line
}

test('the sea thresholds are 60 and 80 percent, and the watch runs 20:00 to 06:00', () => {
  expect([0, 59, 60, 79, 80, 100].map(seaForFill)).toEqual(['calm', 'calm', 'rough', 'rough', 'heavy', 'heavy'])
  expect([5, 6, 19, 20, 23, 0].map(isNightHour)).toEqual([true, false, false, true, true, true])
})

test('the context fill sets the sea, and the band keeps what is beneath it', async ($, on) => {
  const { clock, state } = await atSea($, on, DAY, { percent: 10 })
  const calmShip = await drawnShip($)

  expect(calmShip.alt).toMatch(/a calm sea/)
  expect(calmShip.source).toMatch(/under 60 percent/)

  state.percent = 60
  await clock.advance(60_000)
  expect((await drawnShip($)).alt).toMatch(/a rough sea/)

  state.percent = 85
  await clock.advance(60_000)
  expect((await drawnShip($)).alt).toMatch(/a heavy sea/)
})

test('a failing check on a recorded GitHub PR brings a storm until it passes', async ($, on) => {
  const { clock, state, argv, calls } = await atSea(
    $,
    on,
    DAY,
    { percent: 10, checks: { '11': failing(0), '22': failing(2) } },
    PR_FILES,
  )
  const storm = await drawnShip($)

  expect(storm.alt).toMatch(/a storm/)
  expect(storm.source).toMatch(/failing check/)
  expect(argv).toEqual([
    { command: ['gh-axi', 'pr', 'checks', '11', '--repo', 'o/r'], host: 'github.com' },
    { command: ['gh-axi', 'pr', 'checks', '22', '--repo', 'o/r'], host: 'git.example.com' },
  ])
  expect(calls).toEqual([])

  state.checks = { '11': failing(0), '22': failing(0) }
  await clock.advance(FIVE_MINUTES)
  expect((await drawnShip($)).alt).toMatch(/a calm sea/)
})

test('a failed read keeps the last answer, and a red PR outranks it', async ($, on) => {
  const { clock, state } = await atSea($, on, DAY, { checks: { '11': failing(1), '22': failing(0) } }, PR_FILES)

  state.checks = { '22': failing(0) }
  await clock.advance(FIVE_MINUTES)
  expect((await drawnShip($)).alt).toMatch(/a storm/)

  state.checks = { '11': failing(0), '22': failing(0) }
  await clock.advance(FIVE_MINUTES)
  expect((await drawnShip($)).alt).toMatch(/a calm sea/)

  state.checks = { '22': failing(3) }
  await clock.advance(FIVE_MINUTES)
  expect((await drawnShip($)).alt).toMatch(/a storm/)
})

test('a session with no desktop surface spends no calls on GitHub', async ($, on) => {
  const { argv } = await atSea($, on, DAY, { surfaces: ['terminal'], checks: { '11': failing(1) } }, PR_FILES)

  expect(argv).toEqual([])
})

test('a repo with the marker files at another path runs no process', async ($, on) => {
  const other = '/some/other/repo'
  const argv: (readonly string[])[] = []
  const clock = mock.clock(on, { now: DAY })

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 100 }, rateLimits: [], cost: { usd: 0 } } }))
  on('fs.list', () => ({ value: [{ name: 'evil.meta', kind: 'file' as const, size: 0, mtimeMs: 0, isLink: false }] }))
  world(
    on,
    { [`${other}/bin/fm-crew-state.sh`]: '', [`${other}/config/calm`]: 'on\n', [`${other}/state/evil.meta`]: 'pr=https://github.com/o/r/pull/1\n' },
    other,
    { CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: '1' },
    command => {
      argv.push(command)

      return undefined
    },
  )

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.settle()
  await clock.advance(FIVE_MINUTES)
  expect(argv).toEqual([])
})

test('a checks reply with no summary reads as unknown', () => {
  expect(hasFailedChecks(failing(0))).toBe(false)
  expect(hasFailedChecks(failing(1))).toBe(true)
  expect(hasFailedChecks('error: nope')).toBeUndefined()
})

const bigResult = { stdout: 'x'.repeat(48_000), stderr: '', interrupted: false }

test('one huge result grips the ship for 30 seconds and names the command', async ($, on) => {
  const { clock } = await atSea($, on, DAY, {}, {}, bigResult)

  await $.tool.call({ tool: 'Bash', command: 'npm test\n  --all' })

  expect((await drawnShip($)).source).toContain(KRAKEN_COLOR)
  expect(await lineOf($, 'Kraken: npm test   --all ate about 12k tokens')).toBeDefined()

  await clock.advance(29_000)
  expect((await drawnShip($)).source).toContain(KRAKEN_COLOR)

  await clock.advance(1_000)
  expect((await drawnShip($)).source).not.toContain(KRAKEN_COLOR)
  expect(await lineOf($, /Kraken/)).toBeUndefined()
})

test('a second huge result restarts the 30 seconds', async ($, on) => {
  const { clock } = await atSea($, on, DAY, {}, {}, bigResult)

  await $.tool.call({ tool: 'Bash', command: 'first' })
  await clock.advance(20_000)
  await $.tool.call({ tool: 'Read', file_path: '/a/file' })
  await clock.advance(10_000)

  expect(await lineOf($, /^Kraken: Read \/a\/file ate/)).toBeDefined()

  await clock.advance(20_000)
  expect(await lineOf($, /Kraken/)).toBeUndefined()
})

test('a subagent result leaves the ship alone', async ($, on) => {
  await atSea($, on, DAY, {}, {}, bigResult)

  await $.tool.call({ tool: 'Bash', command: 'deep', agentId: 'sub' } as never)
  expect((await drawnShip($)).source).not.toContain(KRAKEN_COLOR)
})

test('a small result leaves the ship alone', async ($, on) => {
  await atSea($, on, DAY, {}, {}, { stdout: 'ok', stderr: '', interrupted: false })

  await $.tool.call({ tool: 'Bash', command: 'true' })
  expect((await drawnShip($)).source).not.toContain(KRAKEN_COLOR)
})

test('the size estimate counts a persisted output and leaves out image bytes', () => {
  expect(estimateTokens({ stdout: 'x'.repeat(400) })).toBeLessThan(200)
  expect(estimateTokens({ stdout: 'x', persistedOutputSize: 80_000 })).toBe(20_000)
  expect(estimateTokens({ type: 'image', file: { base64: 'x'.repeat(80_000) } })).toBeLessThan(100)
})

test('night brings a dark sea, a lantern and the line, and day takes them away', async ($, on) => {
  const { clock } = await atSea($, on, NIGHT - 60_000)
  const line = 'Idi spavaj, kapetane'

  expect((await drawnShip($)).source).not.toContain(LANTERN_FLAME)
  expect(await lineOf($, line)).toBeUndefined()

  await clock.advance(60_000)

  const night = await drawnShip($)

  expect(night.source).toContain(LANTERN_FLAME)
  expect(night.source).toContain(NIGHT_WATER)
  expect(night.alt).toMatch(/lantern lit/)
  expect(await lineOf($, line)).toBeDefined()

  await clock.set(new Date(2026, 10, 1, 6).getTime())
  expect((await drawnShip($)).source).not.toContain(LANTERN_FLAME)
  expect(await lineOf($, line)).toBeUndefined()
})

const expectPopover = async ($: Engine, key: string, hint: RegExp) => {
  const ui = await mountBand($, true)
  const box = await ui.find({ type: 'Box', key })

  expect(box?.children.at(-1)).toMatchObject({
    props: { position: 'absolute', display: 'none' },
    hover: { display: 'flex' },
  })
  expect(await ui.find({ type: 'Text', text: hint })).toBeDefined()
  await ui.unmount()
}

test('the two lines hover popovers with no script, and the drawing carries titles', async ($, on) => {
  await atSea($, on, NIGHT, {}, {}, bigResult)
  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  const { source } = await drawnShip($)

  await expectPopover($, 'night-watch', /night watch runs from 20:00 to 06:00/)
  await expectPopover($, 'kraken', /Kraken names the tool call/)
  expect(source).toMatch(/^<svg [^>]*>\n<title>This ship shows the session/)
  expect(source).toMatch(/<title>This lantern is the night watch/)
  expect(source).toMatch(/<title>The Kraken grips the ship/)
  expect(source).not.toMatch(/<script|\son\w+=/)
})
