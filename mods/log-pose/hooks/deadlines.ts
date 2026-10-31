import type { Deadline } from '../types'

const TABLE = /^tasks\[(\d+)\]\{([^}]*)\}:$/m
const FIELD = /(?:^|,)("(?:[^"\\]|\\.)*"|[^,]*)/g
// A long title arrives cut, with a note on its own line saying so
const CUT_NOTE = /\n.*$/s
// The dashes keep a dated id such as 2026-11-16-reel from reading as a deadline
const ISO_DAY = /(?<![\d-])\d{4}-\d{2}-\d{2}(?![\d-])/g
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/g
const DAY_MS = 86_400_000

const printable = (text: string) => text.replace(CONTROLS, '')

const dayNumber = (day: string) => {
  const [year = 0, month = 0, date = 0] = day.split('-').map(Number)

  return Date.UTC(year, month - 1, date) / DAY_MS
}

const isRealDay = (day: string) =>
  new Date(dayNumber(day) * DAY_MS).toISOString().startsWith(day)

const fields = (row: string) =>
  [...row.trim().matchAll(FIELD)].map(([, field = '']) =>
    field.startsWith('"') ? (JSON.parse(field) as string) : field,
  )

export const parseObligations = (stdout: string): Deadline[] =>
  (JSON.parse(stdout) as { name: string; due_date: string }[]).map(({ name, due_date }) => ({
    name: printable(name),
    due: due_date,
  }))

export const parseTasks = (stdout: string): Deadline[] => {
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
    .filter(({ state }) => state !== 'done')
    .flatMap(({ title = '', hold_until = '', hold_reason = '' }) => {
      const name = title.replace(CUT_NOTE, '')
      const days = [hold_until, name, hold_reason].flatMap(text => text.match(ISO_DAY) ?? [])

      return days.filter(isRealDay).map(due => ({ name: printable(name), due }))
    })
}

export const localDay = (ms: number) => {
  const now = new Date(ms)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')

  return `${now.getFullYear()}-${month}-${date}`
}

export const nextDeadline = (deadlines: readonly Deadline[], today: string) =>
  deadlines
    .filter(({ due }) => due >= today)
    .reduce<Deadline | undefined>(
      (next, deadline) => (next === undefined || deadline.due < next.due ? deadline : next),
      undefined,
    )

export const daysLeftLabel = (today: string, due: string) => {
  const days = dayNumber(due) - dayNumber(today)

  if (days === 0) return 'today'

  return days === 1 ? '1 day left' : `${days} days left`
}

export const popoverText = (due: string) =>
  `Log Pose points at your next paušal or backlog deadline, due ${due}.`
