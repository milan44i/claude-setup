import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLANK_TITLE = 'Walk the plank stopped a commit or PR text with a dash or AI slop, and Claude has to rewrite this sentence.'
const CWD = '/fake/repo'
const STOCK = 'stock band'
const EM = '—'
const EN = '–'

const TURN_END = { turnId: 't', answer: '', durationMs: 0, isAborted: false, reason: 'answer' as const, stopReason: 'end_turn' }

const world = (on: On, files: Record<string, string> = {}) => {
  const calls = { ran: [] as string[], toasts: [] as string[], reads: [] as string[], writes: 0 }

  mock.env(on, { HOME: '/fake/home' })
  on('session.cwd', () => ({ value: CWD }))
  on('fs.read', (_, e) => {
    calls.reads.push(e.path)

    const body = files[e.path]

    return body === undefined ? { deny: 'ENOENT' } : { value: body }
  })
  on('fs.write', () => {
    calls.writes += 1

    return { value: undefined }
  })
  on('ui.toast', (_, e) => {
    calls.toasts.push(e.text)

    return { value: undefined }
  })
  on('tool.call', { tool: 'Bash' }, (_, e) => {
    calls.ran.push(e.command)

    return { result: { stdout: '', stderr: '', interrupted: false } }
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return Text({ children: STOCK })
  })

  return calls
}

const bash = async ($: Engine, command: string) => {
  const { deny } = await $.tool.call({ tool: 'Bash', command })

  return deny
}

const expectStopped = async ($: Engine, command: string, ...parts: string[]) => {
  const deny = await bash($, command)

  expect(deny).toBeDefined()
  for (const part of parts) expect(deny).toContain(part)
}

const mountBand = ($: Engine, surface: 'terminal' | 'desktop' = 'desktop', hasSurvey = false) =>
  $.ui.mount({
    plugin: 'walk-the-plank',
    surface,
    component: 'AbovePrompt',
    requestId: 'above-prompt',
    props: { hasSurvey, isWorking: true, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 12 }, view: {} },
  })

test('an em dash stops a commit and the denial names the sentence and the fix', async ($, on) => {
  const calls = world(on)

  await expectStopped(
    $,
    `git commit -m "Fix the parser ${EM} it crashes. The second sentence is fine."`,
    `Commit message: "Fix the parser ${EM} it crashes."`,
    'It has an em dash. End the sentence there or use a comma.',
  )
  expect(calls.ran).toEqual([])
})

test('an en dash and a spaced hyphen stop a commit', async ($, on) => {
  const calls = world(on)

  await expectStopped($, `git commit -m "Pages 3${EN}4 changed"`, 'It has an en dash.')
  await expectStopped($, `git commit -m "Fix it - really"`, 'It uses a hyphen as a dash.')
  expect(calls.ran).toEqual([])
})

test('every word and phrase on the two unslop lists stops a commit', async ($, on) => {
  const calls = world(on)
  const samples = [
    'Additionally',
    'crucial',
    'delve',
    'delves',
    'enduring',
    'enhance',
    'enhanced',
    'fostering',
    'garner',
    'interplay',
    'intricate',
    'the landscape',
    'in crucial',
    'pivotal',
    'showcase',
    'showcasing',
    'tapestry',
    'testament',
    'underscoring',
    'underscore the risk',
    'vibrant',
    'I hope this helps',
    'Let me know if',
    'Of course',
    'Certainly',
    'Found the smoking gun',
  ]

  for (const sample of samples) await expectStopped($, `git commit -m "A ${sample} line"`)
  expect(calls.ran).toEqual([])
})

test('false positives pass', async ($, on) => {
  const calls = world(on)
  const clean = [
    `git commit -m "Add well-known long-lived state-of-the-art flags"`,
    `git commit -m "Pass --body and -F through" --no-verify`,
    `git commit -m "Use \\\`a ${EM} b\\\` and \\\`crucial\\\` in code"`,
    `git commit -m 'Use \`a - b\` here'`,
    `git commit -m "- first item\n  - nested item"`,
    `git commit -m "Lay out in landscape mode"`,
    `git commit -m "Rotate in landscape"`,
    `git commit -m "Replace the underscore in names with underscores"`,
    `git commit -m 'Add table\n\n| a | - | b |'`,
    `git commit -m 'Show it\n\n    a ${EM} b'`,
    `git commit -m 'Show it\n\n\`\`\`\na ${EM} crucial\n\`\`\`\n\nDone.'`,
    `git commit -m 'Done\n\nCo-Authored-By: Pivotal Bot - crucial <bot@example.com>'`,
    `gh pr create --title "Plain" --body 'Done.\n\n🤖 Generated with [Vibrant Tool](https://example.com) ${EM} now'`,
    `git log --grep "a ${EM} b"`,
    `echo "git commit -m 'a ${EM} b'"`,
    `gh pr view 12 --body "crucial"`,
    `gh issue create --title "crucial" --body "a ${EM} b"`,
    `gh pr comment 12 --body "crucial"`,
    `git commit --amend --no-edit`,
    `git commit -c HEAD`,
    `git add . && git commit -m "Fix it" 2>&1 | tail -5 # ${EM} crucial`,
    `sed -i 's/a ${EM} b/c/' notes.md`,
  ]

  for (const command of clean) expect(await bash($, command)).toBeUndefined()
  expect(calls.ran).toEqual(clean)
  expect(calls.toasts).toEqual([])
})

test('every commit form is read', async ($, on) => {
  world(on)
  const body = `a ${EM} b`
  const forms = [
    `git commit -m "${body}"`,
    `git commit -m '${body}'`,
    `git commit -am "${body}"`,
    `git commit -m"${body}"`,
    `git commit --message="${body}"`,
    `git commit --message "${body}"`,
    `git commit -m "Fine" -m "${body}"`,
    `git -C /other/repo commit -m "${body}"`,
    `git -c user.name=x commit -m "${body}"`,
    `GIT_AUTHOR_NAME=x git commit -m "${body}"`,
    `/usr/bin/git commit -m "${body}"`,
    `git add . && git commit -m "${body}"`,
    `(cd /other && git commit -m "${body}")`,
    `git commit -m "$(cat <<'EOF'\nDon't ${EM} stop (now)\n\nEOF\n)"`,
    `git commit -F - <<'EOF'\n${body}\nEOF\n`,
    `git commit -F - <<< "${body}"`,
    `git commit -m $'first\\n${body}'`,
    `if true; then git commit -m "${body}"; fi`,
    `x=$(git commit -m "${body}")`,
  ]

  for (const form of forms) await expectStopped($, form, 'Commit message:')
})

test('text after the heredoc still parses as commands', async ($, on) => {
  const calls = world(on)
  const command = `cat <<'EOF' > notes.md\na ${EM} b\nEOF\ngit status`

  expect(await bash($, command)).toBeUndefined()
  expect(calls.ran).toEqual([command])
  await expectStopped($, `cat <<'EOF' > notes.md\nfine\nEOF\ngit commit -m "a ${EM} b"`, 'Commit message:')
})

test('PR title and body stop in gh and gh-axi, create and edit', async ($, on) => {
  const calls = world(on)
  const prefixes = ['gh pr create', 'gh pr edit 12', 'gh-axi pr create', 'gh-axi pr edit 12', 'npx gh-axi pr create', 'npx -y gh-axi@1 pr edit 12', 'gh -R o/r pr create']

  for (const prefix of prefixes) {
    await expectStopped($, `${prefix} --title "a ${EM} b"`, 'PR title:')
    await expectStopped($, `${prefix} --title="crucial fix"`, 'PR title:', '"crucial" is AI vocabulary.')
    await expectStopped($, `${prefix} --title Plain --body "a ${EN} b"`, 'PR body:')
    await expectStopped($, `${prefix} --body="$(cat <<'EOF'\nIt's pivotal.\nEOF\n)"`, 'PR body:')
  }

  await expectStopped($, `gh pr create -t "a ${EM} b"`, 'PR title:')
  await expectStopped($, `gh pr create -b "a ${EM} b"`, 'PR body:')
  expect(calls.ran).toEqual([])
})

test('--body-file and -F read the file, relative to the right directory', async ($, on) => {
  const files = {
    [`${CWD}/body.md`]: `Good first.\n\nThis is ${EM} bad.\n`,
    '/abs/body.md': `This is ${EM} bad.`,
    '/fake/home/body.md': `This is ${EM} bad.`,
    '/other/msg.txt': 'An intricate message.',
    '/repo/msg.txt': 'A vibrant message.',
    [`${CWD}/ok.md`]: 'Plain and `a - b` fine.\n',
  }
  const calls = world(on, files)

  await expectStopped($, 'gh pr create --title Plain --body-file body.md', `PR body: "This is ${EM} bad."`)
  await expectStopped($, 'gh pr edit 3 -F /abs/body.md', 'PR body:')
  await expectStopped($, 'gh-axi pr create --title Plain --body-file=~/body.md', 'PR body:')
  await expectStopped($, 'gh pr create --body "$(cat body.md)"', 'PR body:')
  await expectStopped($, 'gh pr create --body="$(cat body.md)"', 'PR body:')
  await expectStopped($, 'git commit -F /abs/body.md', 'Commit message:')
  await expectStopped($, 'git commit --file=body.md', 'Commit message:')
  await expectStopped($, 'cd /other && git commit -F msg.txt', '"intricate"')
  await expectStopped($, 'git -C /repo commit -F msg.txt', '"vibrant"')
  expect(calls.ran).toEqual([])

  expect(await bash($, 'gh pr create --title Plain --body-file ok.md')).toBeUndefined()
  expect(await bash($, 'git commit -F missing.txt')).toBeUndefined()
  expect(calls.reads).toContain(`${CWD}/missing.txt`)
  expect(calls.writes).toBe(0)
})

test('a command with nothing to inspect reads no file', async ($, on) => {
  const calls = world(on)

  expect(await bash($, 'cat body.md && ls --file=x')).toBeUndefined()
  expect(calls.reads).toEqual([])
})

test('a stopped call toasts the sentence and the band walks it off on desktop', async ($, on) => {
  const calls = world(on)

  await bash($, `git commit -m "Fix <this> & ${EM} that"`)
  expect(calls.toasts).toEqual([`Walked the plank: Fix <this> & ${EM} that`])

  const ui = await mountBand($)
  const svg = await ui.find({ type: 'Svg' })

  expect(svg?.props.source).toContain(`Fix &lt;this&gt; &amp; ${EM} that`)
  expect(svg?.props.source).toContain('<animateTransform')
  expect(svg?.props.source).not.toContain('<script')
  expect(svg?.props.isInteractive).toBe(true)
  expect(svg?.props.alt).toContain('walks off a plank')
  expect(svg?.props.source).toContain(`<title>${PLANK_TITLE}</title>`)
  await ui.unmount()
})

test('a long sentence is cut in the drawing, whole in the denial', async ($, on) => {
  world(on)
  const long = `${'word '.repeat(30)}${EM} end`
  const deny = await bash($, `git commit -m "${long}"`)

  expect(deny).toContain(long)

  const ui = await mountBand($)
  const source = (await ui.find({ type: 'Svg' }))?.props.source as string

  expect(source).not.toContain(long)
  expect(source).toContain('...')
  await ui.unmount()
})

test('the band keeps what is beneath it', async ($, on) => {
  world(on)
  await bash($, `git commit -m "a ${EM} b"`)

  const ui = await mountBand($)

  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

test('the band stays out of the way', async ($, on) => {
  world(on)

  const idle = await mountBand($)

  expect(await idle.find({ type: 'Svg' })).toBeUndefined()
  expect(await idle.find({ type: 'Text', text: STOCK })).toBeDefined()
  await idle.unmount()

  await bash($, `git commit -m "a ${EM} b"`)

  for (const ui of [await mountBand($, 'terminal'), await mountBand($, 'desktop', true)]) {
    expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
    await ui.unmount()
  }
})

test('a clean retry clears the band and a new stop draws its own sentence', async ($, on) => {
  world(on)
  await bash($, `git commit -m "a ${EM} b"`)

  const ui = await mountBand($)

  expect((await ui.find({ type: 'Svg' }))?.props.source).toContain(`a ${EM} b`)
  await bash($, `git commit -m "c ${EM} d"`)
  expect((await ui.find({ type: 'Svg' }))?.props.source).toContain(`c ${EM} d`)

  await bash($, 'git status')
  expect(await ui.find({ type: 'Svg' })).toBeDefined()

  await bash($, 'git commit -m "Plain"')
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('the end of a turn clears the band', async ($, on) => {
  world(on)
  on('turn.complete', () => ({ text: '' }))
  await bash($, `git commit -m "a ${EM} b"`)

  const ui = await mountBand($)

  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  await $.turn.complete(TURN_END)
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
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
  world(on)
  await bash($, `git commit -m "a ${EM} b"`)

  const ui = await mountBand($)

  const alts = (await ui.findAll({ type: 'Svg' })).map(({ props }) => props.alt as string)

  expect(alts.length).toBe(2)
  expect(alts.some(alt => alt.includes('walks off a plank'))).toBe(true)
  expect(alts).toContain('ship')
  await ui.unmount()
})
