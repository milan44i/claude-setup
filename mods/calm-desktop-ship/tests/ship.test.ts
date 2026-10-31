import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const HOME = '/fake/home'
const STATE = `${HOME}/state`
const STOCK = 'stock spinner'
const IN_HOME = { [`${HOME}/bin/fm-crew-state.sh`]: '' }
const CALM_ON = { ...IN_HOME, [`${HOME}/config/calm`]: 'on\n' }

const world = (
  on: On,
  files: Record<string, string>,
  root = HOME,
  variables: Record<string, string> = { CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: '1' },
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
  on('process.run', () => {
    calls.push('process.run')

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
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeUndefined()
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
