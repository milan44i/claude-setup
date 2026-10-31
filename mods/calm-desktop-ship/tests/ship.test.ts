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

  return calls
}

const mountSpinner = async ($: Engine, surface: 'terminal' | 'desktop') => {
  return $.ui.mount({
    plugin: 'calm-desktop-ship',
    surface,
    component: 'Spinner',
    requestId: 'agent-main',
    props: { word: 'Working', message: null, suffix: '…', mode: 'thinking' },
  })
}

const expectStock = async ($: Engine, surface: 'terminal' | 'desktop') => {
  const ui = await mountSpinner($, surface)

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
}

test('desktop with Calm on draws an interactive Svg, read only', async ($, on) => {
  const calls = world(on, CALM_ON)
  const ui = await mountSpinner($, 'desktop')
  const svg = await ui.find({ type: 'Svg' })
  const source = String(svg?.props.source)

  expect(svg?.props.isInteractive).toBe(true)
  expect(svg?.props.width).toBe(4096)
  expect(svg?.props.height).toBe(20)
  expect(source).not.toMatch(/viewBox/)
  expect(String(svg?.props.alt)).toMatch(/sailboat/)
  expect(source.length).toBeLessThan(131072)
  expect(source).toMatch(/<animateTransform [^>]*repeatCount="indefinite"/)
  expect(source).toMatch(/<animateTransform [^>]*type="rotate"[^>]*calcMode="spline"/)
  expect(source).not.toMatch(/<script|\son\w+=/)
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeUndefined()
  expect(calls).toEqual([])
  await ui.unmount()
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
