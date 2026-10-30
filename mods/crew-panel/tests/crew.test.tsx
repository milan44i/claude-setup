import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'

const HOME = '/fake/home'
const STATE = `${HOME}/state`
const PANE = {
  plugin: 'crew-panel',
  component: 'Pane',
  requestId: 'crew-panel',
  props: {
    title: 'Crew',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const META = (project: string, extra = '') =>
  `worktree=/fake/wt\nproject=/fake/projects/${project}\nkind=ship\n${extra}`

const SAMPLE: Record<string, string> = {
  [`${HOME}/bin/fm-crew-state.sh`]: '',
  [`${STATE}/alpha.meta`]: META('proj-a'),
  [`${STATE}/alpha.status`]: 'working [at=1]: building the thing\n',
  [`${STATE}/beta.meta`]: META('proj-b', 'pr=https://example.com/pull/7\n'),
  [`${STATE}/beta.status`]:
    'working [at=1]: started\nneeds-decision [at=2]: pick a name\nworking [at=3]: meanwhile\n',
  [`${STATE}/gamma.meta`]: META('proj-c'),
  [`${STATE}/gamma.status`]: 'working: started\ndone: abc123 on main\n',
  [`${STATE}/delta.meta`]: META('proj-d'),
  [`${STATE}/delta.status`]:
    'blocked [key=net]: no network\nresolved [key=net]: network back\n',
  [`${STATE}/epsilon.meta`]: META('proj-e'),
  [`${STATE}/epsilon.status`]: 'paused: waiting on a run\nplain prose: ignored\n',
  [`${STATE}/zeta.meta`]: META('proj-f'),
  [`${STATE}/eta.meta`]: META('proj-g'),
  [`${STATE}/eta.status`]: 'needs-decision: which one\ndone: answered anyway\n',
  [`${STATE}/.hidden.meta`]: META('proj-h'),
  [`${STATE}/alpha.turn`]: 'not a meta',
}

const world = (on: On, files: Record<string, string>, root = HOME) => {
  const calls: string[] = []
  const record = (name: string) => calls.push(name)

  on('session.root', () => ({ value: root }))
  on('fs.exists', (_, e) => ({ value: e.path in files }))
  on('fs.stat', (_, e) => {
    if (e.path !== STATE || root !== HOME) return { deny: 'ENOENT' }

    return { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false } }
  })
  on('fs.list', () => ({
    value: Object.keys(files)
      .filter(path => path.startsWith(`${STATE}/`))
      .map(path => ({
        name: path.slice(STATE.length + 1),
        kind: 'file' as const,
        size: 0,
        mtimeMs: 0,
        isLink: false,
      })),
  }))
  on('fs.read', (_, e) => {
    const body = files[e.path]

    return body === undefined ? { deny: 'ENOENT' } : { value: body }
  })
  on('fs.write', () => {
    record('fs.write')

    return { value: undefined }
  })
  on('process.run', () => {
    record('process.run')

    return { deny: 'read only' }
  })
  on('command.register', () => {
    record('command.register')

    return { value: { command: 'crew' } }
  })
  on('ui.open', () => {
    record('ui.open')

    return { value: { isPlaced: true } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: '' }))

  return calls
}

const start = ($: Engine, surface: 'terminal' | 'desktop') =>
  $.session.start({ cwd: HOME, surface, isInteractive: true })

const text = async (ui: Pick<Mounted, 'find'>, words: RegExp) =>
  (await ui.find({ type: 'Text', text: words }))?.text

test('a row shows name, project, state, last line and PR, on both surfaces', async ($, on) => {
  mock.clock(on)
  world(on, SAMPLE)
  await start($, 'desktop')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await text(ui, /^alpha/)).toBe('alpha proj-a working')
    expect(await text(ui, /building/)).toBe('building the thing')
    expect(await text(ui, /^beta/)).toBe('beta proj-b parked')
    expect(await text(ui, /pick a name/)).toBe('pick a name')
    expect(await ui.find({ type: 'Link' })).toBeDefined()
    expect(await text(ui, /hidden/)).toBeUndefined()
    await ui.unmount()
  }
})

test('the status log folds to the current state', async ($, on) => {
  mock.clock(on)
  world(on, SAMPLE)
  await start($, 'terminal')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await text(ui, /^gamma/)).toBe('gamma proj-c done')
  expect(await text(ui, /^delta/)).toBe('delta proj-d working')
  expect(await text(ui, /^epsilon/)).toBe('epsilon proj-e paused')
  expect(await text(ui, /^zeta/)).toBe('zeta proj-f unknown')
  expect(await text(ui, /^eta/)).toBe('eta proj-g done')
  await ui.unmount()
})

test('waiting on a person comes first', async ($, on) => {
  mock.clock(on)
  world(on, SAMPLE)
  await start($, 'terminal')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const drawn = (await ui.findAll({ type: 'Text' })).map(found => found.text)
  const place = (words: string) => drawn.findIndex(one => one?.startsWith(words))

  expect(place('Waiting on a person')).toBe(0)
  expect(place('beta')).toBeLessThan(place('In progress'))
  expect(place('In progress')).toBeLessThan(place('alpha'))
  expect(place('alpha')).toBeLessThan(place('Done'))
  expect(place('Done')).toBeLessThan(place('gamma'))
  await ui.unmount()
})

test('it refreshes every 15 seconds', async ($, on) => {
  const clock = mock.clock(on)
  const files = { ...SAMPLE }
  world(on, files)
  await start($, 'terminal')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  files[`${STATE}/alpha.status`] = 'blocked: stuck now\n'
  await clock.advance(14_000)
  expect(await text(ui, /^alpha/)).toBe('alpha proj-a working')
  await clock.advance(1_000)
  expect(await text(ui, /^alpha/)).toBe('alpha proj-a blocked')
  await ui.unmount()
})

test('no workers shows the empty message', async ($, on) => {
  mock.clock(on)
  world(on, { [`${HOME}/bin/fm-crew-state.sh`]: '' })
  await start($, 'desktop')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect(await text(ui, /No workers/)).toBe('No workers.')
  await ui.unmount()
})

test('a firstmate home opens the pane and /crew reopens it, read only', async ($, on) => {
  mock.clock(on)
  const calls = world(on, SAMPLE)
  await start($, 'terminal')

  expect(calls).toEqual(['command.register', 'ui.open'])
  const answer = await $.command.run({
    command: 'crew',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 80 },
  })
  expect(answer).toEqual({ text: 'Crew pane opened.' })
  expect(calls).toEqual(['command.register', 'ui.open', 'ui.open'])
})

test('any other session gets no pane, no command, no timer', async ($, on) => {
  const clock = mock.clock(on)
  const calls = world(on, {}, '/some/other/project')
  await start($, 'terminal')
  await clock.advance(60_000)

  expect(calls).toEqual([])
})
