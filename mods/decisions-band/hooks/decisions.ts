import type { Decision } from '../types'

const TABLE = /^tasks\[(\d+)\]\{([^}]*)\}:$/m
const FIELD = /(?:^|,)("(?:[^"\\]|\\.)*"|[^,]*)/g
// A long title arrives cut, with a note on its own line saying so
const CUT_NOTE = /\n.*$/s
const ELSEWHERE = ['Waiting for', 'Reminder']
const CONTROLS_BUT_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g

const printable = (text: string) => text.replace(CONTROLS_BUT_NEWLINE, '')

const fields = (row: string) =>
  [...row.trim().matchAll(FIELD)].map(([, field = '']) =>
    field.startsWith('"') ? (JSON.parse(field) as string) : field,
  )

export const parseDecisions = (stdout: string): Decision[] => {
  const table = TABLE.exec(stdout)

  if (table === null) return []

  const [header, count = '0', columns = ''] = table
  const names = columns.split(',')

  return stdout
    .slice(table.index + header.length + 1)
    .split('\n')
    .slice(0, Number(count))
    .map(row => {
      const values = fields(row)

      return Object.fromEntries(names.map((name, at) => [name, values[at] ?? '']))
    })
    .flatMap(({ id = '', title = '', hold_kind, hold_reason = '' }) =>
      hold_kind === 'captain' && !ELSEWHERE.some(start => hold_reason.startsWith(start))
        ? [{ id, title: printable(title.replace(CUT_NOTE, '')), reason: printable(hold_reason) }]
        : [],
    )
}

export const decidePrompt = (id: string) =>
  `Explain the decision on ${id} in plain words, what happens under each answer and what you recommend, then ask me for it.`

export const waitingLabel = (count: number) =>
  `${count} ${count === 1 ? 'decision' : 'decisions'} waiting`
