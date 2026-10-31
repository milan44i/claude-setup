import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { wordFor } from '../hooks/words'

const HOME = '/fake/home'
const STOCK = 'stand-in band'
const STOCK_WORD = 'Sauteing'
const THINKING = 'Luffy is thinking about meat'
const READING = 'Robin is deciphering a poneglyph'

const world = (on: On, calm: 'on' | 'off' = 'off') => {
  const files: Record<string, string> = {
    [`${HOME}/bin/fm-crew-state.sh`]: '',
    [`${HOME}/config/calm`]: `${calm}\n`,
  }
  let finishTool = () => {}
  const gate = new Promise<void>(resolve => {
    finishTool = resolve
  })

  mock.env(on, { CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: '1' })
  on('session.root', () => ({ value: HOME }))
  on('fs.exists', (_, e) => ({ value: e.path in files }))
  on('fs.stat', () => ({ value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false } }))
  on('fs.read', (_, e) => ({ value: files[e.path] ?? '' }))
  on('tool.call', async () => {
    await gate

    return { result: { stdout: '', stderr: '', interrupted: false } }
  })
  on('ui.render', { component: 'Spinner' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return Text({ children: `${e.props.word} (${e.props.mode})` })
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return Text({ children: STOCK })
  })

  return { finishTool }
}

const mountBand = ($: Engine, surface: 'terminal' | 'desktop', isWorking = true) =>
  $.ui.mount({
    plugin: 'pirate-spinner',
    surface,
    component: 'AbovePrompt',
    requestId: 'above-prompt',
    props: { hasSurvey: false, isWorking, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 12 }, view: {} },
  })

const mountSpinner = ($: Engine, surface: 'terminal' | 'desktop' | 'vscode') =>
  $.ui.mount({
    plugin: 'pirate-spinner',
    surface,
    component: 'Spinner',
    requestId: 'main',
    props: { word: STOCK_WORD, message: null, suffix: '…', mode: 'tool-use' },
  })

test('each named tool has its own crewmate, an unnamed one a fallback, and none copies a quote', () => {
  expect(wordFor(undefined)).toBe(THINKING)
  expect(wordFor('Read')).toBe(READING)
  expect(wordFor('Edit')).toBe('Franky is welding the hull')
  expect(wordFor('WebSearch')).toBe('Nami is charting a course')
  expect(wordFor('Bash')).toBe('Chopper is mixing a remedy')
  expect(wordFor('mcp__x__y')).toBe('Chopper is mixing a remedy')
  expect(wordFor('toString')).toBe('Chopper is mixing a remedy')
})

test('the terminal row reads the running tool, then goes back to thinking', async ($, on) => {
  const { finishTool } = world(on)
  const clock = mock.clock(on)
  const ran = $.tool.call({ tool: 'Read', file_path: '/a' })

  await clock.settle()

  const during = await mountSpinner($, 'terminal')

  expect(await during.find({ type: 'Text', text: `${READING} (tool-use)` })).toBeDefined()
  await during.unmount()
  finishTool()
  await ran

  const after = await mountSpinner($, 'terminal')

  expect(await after.find({ type: 'Text', text: `${THINKING} (tool-use)` })).toBeDefined()
  await after.unmount()
})

test('vscode rewrites the row too, and a subagent tool leaves the words alone', async ($, on) => {
  const { finishTool } = world(on)
  const clock = mock.clock(on)
  const ran = $.tool.call({ tool: 'Read', file_path: '/a', agentId: 'sub' } as never)

  await clock.settle()

  const row = await mountSpinner($, 'vscode')

  expect(await row.find({ type: 'Text', text: `${THINKING} (tool-use)` })).toBeDefined()
  await row.unmount()
  finishTool()
  await ran
})

test('desktop leaves the app its row and draws the word in the band over what is beneath', async ($, on) => {
  const { finishTool } = world(on)
  const clock = mock.clock(on)
  const ran = $.tool.call({ tool: 'Bash', command: 'sleep 1' })

  await clock.settle()

  const row = await mountSpinner($, 'desktop')

  expect(await row.find({ type: 'Text', text: `${STOCK_WORD} (tool-use)` })).toBeDefined()
  await row.unmount()

  const band = await mountBand($, 'desktop')

  expect(await band.find({ type: 'Text', text: 'Chopper is mixing a remedy…' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: STOCK })).toBeDefined()
  await band.unmount()
  finishTool()
  await ran
})

test('hovering the word shows a popover with no script and no reflow', async ($, on) => {
  world(on)

  const band = await mountBand($, 'desktop')
  const hint = /pirate spinner .* means Claude is thinking/

  const word = await band.find({ type: 'Box', key: 'pirate-word' })

  expect(word?.children.at(-1)).toMatchObject({
    props: { position: 'absolute', display: 'none' },
    hover: { display: 'flex' },
  })
  expect(await band.find({ type: 'Text', text: hint })).toBeDefined()
  await band.unmount()
})

test('the terminal band carries the word only under Calm, whose boat takes the row', async ($, on) => {
  world(on, 'on')

  const band = await mountBand($, 'terminal')

  expect(await band.find({ type: 'Text', text: `${THINKING}…` })).toBeDefined()
  expect(await band.find({ type: 'Text', text: STOCK })).toBeDefined()
  await band.unmount()
})

test('the terminal band passes through with Calm off', async ($, on) => {
  world(on, 'off')

  const band = await mountBand($, 'terminal')

  expect(await band.find({ type: 'Text', text: `${THINKING}…` })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: STOCK })).toBeDefined()
  await band.unmount()
})

test('an idle band stays out of the way', async ($, on) => {
  world(on)

  const band = await mountBand($, 'desktop', false)

  expect(await band.find({ type: 'Text', text: `${THINKING}…` })).toBeUndefined()
  await band.unmount()
})
