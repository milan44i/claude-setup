import type { On, TurnCompleteInput } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const HOME = '/Users/milanstankovic/work/firstmate'
const NO_OP = 'Captain, shipshape.'
const HEADER = 'count: 2\ntasks[2]{id,state,kind,repo,title,hold_kind}:'
const FOOTER = 'help[1]:\n  - Run `tasks-axi show <id>` for full notes on a task\n'
const OLD_ROW = '  old-call,queued,task,claude-setup,"Old, long-standing call",captain'
const NEW_ROW = '  new-call,in_flight,ship,claude-setup,New call,captain'
const FUTURE_ROW = '  later,queued,captain,claude-setup,Starts later,future'

type Board = { rows: string[]; exitCode: number }

const board = (rows: string[] = [OLD_ROW]): Board => ({ rows, exitCode: 0 })

const world = (on: On, tasks: Board, root = HOME) => {
  const rings: unknown[] = []
  const commands: (readonly string[])[] = []

  on('session.root', () => ({ value: root }))
  on('process.run', (_, e) => {
    commands.push(e.argv)

    return {
      value: {
        exitCode: tasks.exitCode,
        stdout: tasks.exitCode === 0 ? [HEADER, ...tasks.rows, FOOTER].join('\n') : '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('audio.play', (_, e) => {
    rings.push(e.clip)

    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  return { rings, commands }
}

const startSession = ($: Engine) =>
  $.session.start({ cwd: HOME, surface: 'desktop', isInteractive: true })

const endTurn = ($: Engine, answer: string, overrides: Partial<TurnCompleteInput> = {}) =>
  $.turn.complete({
    answer,
    durationMs: 1,
    isAborted: false,
    turnId: 'turn',
    reason: 'answer',
    ...overrides,
  } as TurnCompleteInput)

const captainTurn = async ($: Engine, answer: string, overrides: Partial<TurnCompleteInput> = {}) => {
  await $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } })
  await endTurn($, answer, overrides)
}

const automatedTurn = async ($: Engine, answer: string) => {
  await $.prompt.submit({ text: 'done', wait: false, origin: { kind: 'task-notification' } })
  await endTurn($, answer)
}

test('a captain turn with an answer rings the bell asset once', async ($, on) => {
  const { rings } = world(on, board())

  await startSession($)
  await captainTurn($, 'The site is live.')

  expect(rings).toEqual([{ asset: 'sounds/bell.wav' }])
})

test('an automated turn with an outcome rings', async ($, on) => {
  const { rings } = world(on, board())

  await startSession($)
  await automatedTurn($, 'The worker finished and the PR is ready.')

  expect(rings.length).toBe(1)
})

test('a turn with no prompt event still rings on an outcome', async ($, on) => {
  const { rings } = world(on, board())

  await startSession($)
  await endTurn($, 'The worker needs your review.')

  expect(rings.length).toBe(1)
})

test('a captain turn answered with the no-op reply rings, it was asked for', async ($, on) => {
  const { rings } = world(on, board())

  await startSession($)
  await captainTurn($, NO_OP)

  expect(rings.length).toBe(1)
})

test('a captain turn that dies on an API error with no text rings', async ($, on) => {
  const { rings } = world(on, board())

  await startSession($)
  await captainTurn($, '', { reason: 'error' })

  expect(rings.length).toBe(1)
})

test('an automated no-op reply stays silent', async ($, on) => {
  const { rings } = world(on, board())

  await startSession($)
  await automatedTurn($, NO_OP)
  await automatedTurn($, `  ${NO_OP}\n`)

  expect(rings).toEqual([])
})

test('an automated empty turn stays silent', async ($, on) => {
  const { rings } = world(on, board())

  await startSession($)
  await automatedTurn($, '')
  await automatedTurn($, ' \n')

  expect(rings).toEqual([])
})

test('a rewake with no prompt event and a no-op reply stays silent', async ($, on) => {
  const { rings } = world(on, board())

  await startSession($)
  await endTurn($, NO_OP)
  await endTurn($, '')

  expect(rings).toEqual([])
})

test('a captain turn does not leak into the automated turn after it', async ($, on) => {
  const { rings } = world(on, board())

  await startSession($)
  await captainTurn($, 'Done.')
  await endTurn($, NO_OP)

  expect(rings.length).toBe(1)
})

test('a captain turn with nothing to read stays silent', async ($, on) => {
  const { rings } = world(on, board())

  await startSession($)
  await captainTurn($, '')

  expect(rings).toEqual([])
})

test('an interrupted turn stays silent', async ($, on) => {
  const { rings } = world(on, board())

  await startSession($)
  await captainTurn($, 'Half an ans', { reason: 'aborted', isAborted: true })

  expect(rings).toEqual([])
})

test('a subagent never rings and never reads the board', async ($, on) => {
  const tasks = board()
  const { rings, commands } = world(on, tasks)

  await startSession($)
  commands.length = 0
  tasks.rows = [OLD_ROW, NEW_ROW]
  await endTurn($, 'The subagent report.', { agentId: 'agent-1' })

  expect(rings).toEqual([])
  expect(commands).toEqual([])
})

test('a decision a subagent turn passed over rings at the next main turn', async ($, on) => {
  const tasks = board()
  const { rings } = world(on, tasks)

  await startSession($)
  tasks.rows = [OLD_ROW, NEW_ROW]
  await endTurn($, 'The subagent report.', { agentId: 'agent-1' })
  await endTurn($, NO_OP)

  expect(rings.length).toBe(1)
})

test('outside a firstmate home nothing rings and nothing runs', async ($, on) => {
  const { rings, commands } = world(on, board(), '/somewhere/else')

  await startSession($)
  await captainTurn($, 'A real answer.')

  expect(rings).toEqual([])
  expect(commands).toEqual([])
})

test('a repo with every marker file at another path rings nothing and runs nothing', async ($, on) => {
  const repo = `${HOME}-copy`
  const markers = [`${repo}/bin/fm-crew-state.sh`, `${repo}/bin/fm-tasks-axi.sh`]
  const { rings, commands } = world(on, board(), repo)

  on('fs.exists', (_, e) => ({ value: markers.includes(e.path) }))
  on('fs.stat', (_, e) => {
    if (e.path !== `${repo}/state`) return { deny: 'ENOENT' }

    return { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false } }
  })

  await startSession($)
  await captainTurn($, 'A real answer.')

  expect(rings).toEqual([])
  expect(commands).toEqual([])
})

test('a new captain row rings on an otherwise silent turn', async ($, on) => {
  const tasks = board()
  const { rings, commands } = world(on, tasks)

  await startSession($)
  tasks.rows = [OLD_ROW, NEW_ROW]
  await endTurn($, NO_OP)

  expect(rings.length).toBe(1)
  expect(commands[0]).toEqual([
    `${HOME}/bin/fm-tasks-axi.sh`,
    'list',
    '--state',
    'held',
    '--fields',
    'hold_kind',
  ])
})

test('a new row and an answer in one turn ring once', async ($, on) => {
  const tasks = board()
  const { rings } = world(on, tasks)

  await startSession($)
  tasks.rows = [OLD_ROW, NEW_ROW]
  await captainTurn($, 'Your call on the new PR.')

  expect(rings.length).toBe(1)
})

test('a row rings once, not on every turn after it', async ($, on) => {
  const tasks = board()
  const { rings } = world(on, tasks)

  await startSession($)
  tasks.rows = [OLD_ROW, NEW_ROW]
  await endTurn($, NO_OP)
  await endTurn($, NO_OP)

  expect(rings.length).toBe(1)
})

test('rows already open when the session starts stay silent', async ($, on) => {
  const { rings } = world(on, board([OLD_ROW, NEW_ROW]))

  await startSession($)
  await endTurn($, NO_OP)

  expect(rings).toEqual([])
})

test('a reload keeps the rows seen, so a row added before it still rings', async ($, on) => {
  const tasks = board()
  const { rings } = world(on, tasks)

  await startSession($)
  tasks.rows = [OLD_ROW, NEW_ROW]
  await startSession($)
  await endTurn($, NO_OP)

  expect(rings.length).toBe(1)
})

test('a resolved row stays silent, and rings when it opens again', async ($, on) => {
  const tasks = board([OLD_ROW, NEW_ROW])
  const { rings } = world(on, tasks)

  await startSession($)
  tasks.rows = [OLD_ROW]
  await endTurn($, NO_OP)
  expect(rings).toEqual([])

  tasks.rows = [OLD_ROW, NEW_ROW]
  await endTurn($, NO_OP)
  expect(rings.length).toBe(1)
})

test('a new row with another hold kind stays silent', async ($, on) => {
  const tasks = board()
  const { rings } = world(on, tasks)

  await startSession($)
  tasks.rows = [OLD_ROW, FUTURE_ROW]
  await endTurn($, NO_OP)

  expect(rings).toEqual([])
})

test('a failed read rings nothing and forgets no row', async ($, on) => {
  const tasks = board()
  const { rings } = world(on, tasks)

  await startSession($)
  tasks.exitCode = 2
  await endTurn($, NO_OP)
  expect(rings).toEqual([])

  tasks.exitCode = 0
  await endTurn($, NO_OP)
  expect(rings).toEqual([])
})

test('a failed first read leaves the baseline to the next read', async ($, on) => {
  const tasks = board()

  tasks.exitCode = 2

  const { rings } = world(on, tasks)

  await startSession($)
  tasks.exitCode = 0
  await endTurn($, NO_OP)

  expect(rings).toEqual([])
})
