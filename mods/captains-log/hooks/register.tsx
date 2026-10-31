import type { EngineInterface, Register } from 'claude-code'

import {
  CALM_SEAS,
  closedInArchive,
  closedInBacklog,
  isCalm,
  lines,
  logPrompt,
  MERGED_LINE,
  mergedPath,
  parseDay,
  parseMerged,
  projectNames,
  SYSTEM,
} from './log'
import type { Day, Facts } from './log'

// An exact path, because a marker check would run a script from any repo that carries the markers
const HOME = '/Users/milanstankovic/work/firstmate'
const MODEL = 'claude-sonnet-5-5'

const isHome = async ($: EngineInterface) => (await $.session.root()) === HOME

const output = async ($: EngineInterface, argv: readonly string[], source: string) => {
  const { exitCode, stdout } = await $.process.run(argv)

  if (exitCode !== 0) throw new Error(`could not read ${source}`)

  return stdout
}

const commitsIn = async ($: EngineInterface, name: string, { date, offset }: Day) => {
  const project = `${HOME}/projects/${name}`
  const author = await $.process.run(['git', '-C', project, 'config', 'user.email'])

  if (author.exitCode !== 0) return []

  const log = await $.process.run([
    'git',
    '-C',
    project,
    'log',
    'HEAD',
    `--since=${date}T00:00:00${offset}`,
    `--author=${author.stdout.trim()}`,
    '--no-merges',
    '--format=%s',
  ])

  return log.exitCode === 0 ? lines(log.stdout).map(subject => `${name}: ${subject}`) : []
}

const gather = async ($: EngineInterface, day: Day): Promise<Facts> => {
  const [backlog, archive, merged, registry] = await Promise.all([
    output(
      $,
      [`${HOME}/bin/fm-tasks-axi.sh`, 'list', '--state', 'done', '--limit', '1000', '--fields', 'closed'],
      'the closed tasks',
    ),
    $.fs.read(`${HOME}/data/done-archive.md`),
    output($, ['gh-axi', 'api', mergedPath(day), '--full', '--jq', MERGED_LINE], 'the merged pull requests'),
    $.fs.read(`${HOME}/data/projects.md`),
  ])
  const commits = await Promise.all(projectNames(registry).map(name => commitsIn($, name, day)))

  return {
    tasks: [...closedInBacklog(backlog, day.date), ...closedInArchive(archive, day.date)],
    prs: parseMerged(merged),
    commits: commits.flat(),
  }
}

const compose = async ($: EngineInterface, facts: Facts) => {
  if (isCalm(facts)) return CALM_SEAS

  const reply = await $.model.complete({ model: MODEL, system: SYSTEM, prompt: logPrompt(facts) })

  if (!reply.isAnswered) throw new Error(`the model did not answer (${reply.reason})`)

  return reply.text.trim()
}

const writeEntry = async ($: EngineInterface) => {
  const day = parseDay((await output($, ['date', '+%F%z'], 'the date')).trim())
  const entry = await compose($, await gather($, day))

  await $.fs.write(`${HOME}/data/captains-log/${day.date}.md`, `${entry}\n`)

  return entry
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    if (await isHome($)) {
      await $.command.register({
        name: 'dnevnik',
        description: "Write today's shipped work as a captain's log entry",
      })
    }

    return started
  })

  on('command.run', { command: 'dnevnik' }, async $ => {
    if (!(await isHome($))) return { text: '/dnevnik only runs in the firstmate home.' }

    try {
      return { text: await writeEntry($) }
    } catch (error) {
      return { text: `Log not written: ${error instanceof Error ? error.message : String(error)}` }
    }
  })
}
