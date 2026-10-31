import type { Engine, On } from 'claude-code/testing'
import { expect, test } from 'claude-code/testing'

const HOME = '/Users/milanstankovic/work/firstmate'
const DAY = '2026-10-31'
const ENTRY_PATH = `${HOME}/data/captains-log/${DAY}.md`
const CALM = 'Mirno more, danas ništa nije isporučeno.'

const BACKLOG = `count: 3
tasks[3]{id,state,kind,repo,title,closed}:
  bell,done,ship,claude-setup,"Bell mod, rings",${DAY}
  long,done,ship,"-","A title cut short\\n... (truncated, 116 chars total - use show long --full to see complete text)",${DAY}
  old,done,ship,funnel,Yesterday's work,2026-10-30
help[1]:
  - Run \`tasks-axi show <id>\` for full notes on a task
`
const EMPTY_BACKLOG = `count: 0
tasks: 0 done tasks in this backlog
`
const ARCHIVE = `## Archived ${DAY}
- [x] wa-land - Land the WhatsApp change (repo: potpis-prodaja) (kind: ship) (done ${DAY})
  mode=local-only
- [x] plain - Plain task (kind: scout) (done ${DAY}) (hold: later)
- [x] older - Older task (repo: funnel) (done 2026-10-12)
`
const REGISTRY = `# Projects

- claude-setup [local-only] - tooling
- gone [local-only] - no clone
`
const MERGED = `api_response:
  body: "milan44i/claude-setup: Make the ship float\\nmilan44i/pausal: Fix the key id"
  truncated: false
`
const NO_MERGED = `api_response:
  body: ""
  truncated: false
`

type Run = { exitCode: number; stdout: string }

type Answers = Partial<Record<'backlog' | 'gh' | 'log', Run>> & { archive?: string; isSilent?: boolean }

const world = (on: On, answers: Answers = {}, root = HOME) => {
  const calls = {
    argv: [] as (readonly string[])[],
    writes: [] as { path: string; text: string }[],
    models: [] as { model: string; prompt: string; system?: string }[],
  }
  const ok = (stdout: string): Run => ({ exitCode: 0, stdout })

  on('session.root', () => ({ value: root }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', (_, e) => {
    if (e.path === `${HOME}/data/done-archive.md`) return { value: answers.archive ?? ARCHIVE }
    if (e.path === `${HOME}/data/projects.md`) return { value: REGISTRY }

    return { deny: 'ENOENT' }
  })
  on('fs.write', (_, e) => {
    calls.writes.push({ path: e.path, text: e.text })

    return { value: undefined }
  })
  on('process.run', (_, e) => {
    calls.argv.push(e.argv)

    const [program, , project, verb] = e.argv
    const answer = (): Run => {
      if (program === 'date') return ok(`${DAY}+0100\n`)
      if (program === `${HOME}/bin/fm-tasks-axi.sh`) return answers.backlog ?? ok(BACKLOG)
      if (program === 'gh-axi') return answers.gh ?? ok(MERGED)
      if (project?.endsWith('/gone')) return { exitCode: 128, stdout: '' }
      if (verb === 'config') return ok('me@example.com\n')

      return answers.log ?? ok('Add the bell\nFix the band\n')
    }

    return { value: { ...answer(), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('model.complete', (_, e) => {
    calls.models.push({ model: e.model, prompt: e.prompt, system: e.system })

    const usage = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

    if (answers.isSilent === true) {
      return { value: { isAnswered: false as const, reason: 'empty-reply' as const, usage } }
    }

    return { value: { isAnswered: true as const, text: ' Kapetane, brod je plovio. ', usage } }
  })

  return calls
}

const quiet = {
  backlog: { exitCode: 0, stdout: EMPTY_BACKLOG },
  archive: '',
  gh: { exitCode: 0, stdout: NO_MERGED },
  log: { exitCode: 0, stdout: '' },
}

const dnevnik = ($: Engine) => $.command.run({ command: 'dnevnik' })

test('the facts reach the model and its entry is replied and written', async ($, on) => {
  const calls = world(on)

  const { text } = await dnevnik($)

  expect(text).toBe('Kapetane, brod je plovio.')
  expect(calls.writes).toEqual([{ path: ENTRY_PATH, text: 'Kapetane, brod je plovio.\n' }])
  expect(calls.models).toHaveLength(1)

  const [call] = calls.models

  expect(call?.model).toBe('claude-sonnet-5-5')
  expect(call?.system).toContain('Serbian')
  expect(call?.prompt).toBe(`Closed tasks:
- claude-setup: Bell mod, rings
- A title cut short
- potpis-prodaja: Land the WhatsApp change
- Plain task

Merged pull requests:
- milan44i/claude-setup: Make the ship float
- milan44i/pausal: Fix the key id

Commits:
- claude-setup: Add the bell
- claude-setup: Fix the band`)
})

test('a quiet day writes one calm line with no model call', async ($, on) => {
  const calls = world(on, quiet)

  const { text } = await dnevnik($)

  expect(text).toBe(CALM)
  expect(calls.writes).toEqual([{ path: ENTRY_PATH, text: `${CALM}\n` }])
  expect(calls.models).toHaveLength(0)
})

test('each source is read with today in its own terms', async ($, on) => {
  const calls = world(on)

  await dnevnik($)

  expect(calls.argv).toContainEqual([
    `${HOME}/bin/fm-tasks-axi.sh`,
    'list',
    '--state',
    'done',
    '--limit',
    '1000',
    '--fields',
    'closed',
  ])
  expect(calls.argv).toContainEqual([
    'git',
    '-C',
    `${HOME}/projects/claude-setup`,
    'log',
    'HEAD',
    `--since=${DAY}T00:00:00+01:00`,
    '--author=me@example.com',
    '--no-merges',
    '--format=%s',
  ])

  const gh = calls.argv.find(argv => argv[0] === 'gh-axi')

  expect(decodeURIComponent(gh?.[2] ?? '')).toBe(
    `search/issues?q=author:milan44i is:pr is:merged merged:${DAY}T00:00:00+01:00..${DAY}T23:59:59+01:00&per_page=100`,
  )
})

test('a failed source writes nothing rather than claiming calm seas', async ($, on) => {
  const calls = world(on, { gh: { exitCode: 1, stdout: '' } })

  const { text } = await dnevnik($)

  expect(text).toBe('Log not written: could not read the merged pull requests')
  expect(calls.writes).toHaveLength(0)
  expect(calls.models).toHaveLength(0)
})

test('a model that does not answer writes nothing', async ($, on) => {
  const calls = world(on, { isSilent: true })

  const { text } = await dnevnik($)

  expect(text).toBe('Log not written: the model did not answer (empty-reply)')
  expect(calls.writes).toHaveLength(0)
})

test('another root runs nothing and writes nothing', async ($, on) => {
  const calls = world(on, {}, '/some/repo/with/the/same/markers')

  const { text } = await dnevnik($)

  expect(text).toBe('/dnevnik only runs in the firstmate home.')
  expect(calls.argv).toHaveLength(0)
  expect(calls.writes).toHaveLength(0)
  expect(calls.models).toHaveLength(0)
})

test('the command is offered in the firstmate home and nowhere else', async ($, on) => {
  const registered: string[] = []
  let root = HOME

  on('session.root', () => ({ value: root }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => {
    registered.push(e.name)

    return { value: undefined }
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(registered).toEqual(['dnevnik'])

  root = '/some/repo'
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(registered).toEqual(['dnevnik'])
})
