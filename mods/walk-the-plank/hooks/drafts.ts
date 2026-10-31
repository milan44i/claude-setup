import type { Command, Word } from './shell'

export type Label = 'Commit message' | 'PR title' | 'PR body'
export type Draft = { label: Label; text: string; files: string[]; dir?: string }

type Flag = { label: Label; isFile: boolean }
type FlagSet = { long: Record<string, Flag>; short: Record<string, Flag>; clustered: string }

const LEADING = new Set(['then', 'do', 'else', 'elif', 'if', 'while', 'until', '!', '{', 'time', 'command', 'exec'])
const ASSIGNMENT = /^\w+=/
const RUNNERS = new Set(['npx', 'bunx'])
const GIT_VALUE_FLAGS = new Set(['-c', '--git-dir', '--work-tree', '--namespace'])
const GH_VALUE_FLAGS = new Set(['-R', '--repo', '--hostname'])
const PR_WRITES = new Set(['create', 'edit'])

const COMMIT_MESSAGE: Flag = { label: 'Commit message', isFile: false }
const COMMIT_FILE: Flag = { label: 'Commit message', isFile: true }
const COMMIT_FLAGS: FlagSet = {
  long: { '--message': COMMIT_MESSAGE, '--file': COMMIT_FILE },
  short: { m: COMMIT_MESSAGE, F: COMMIT_FILE },
  clustered: 'aqsvnzepi',
}

const PR_TITLE: Flag = { label: 'PR title', isFile: false }
const PR_BODY: Flag = { label: 'PR body', isFile: false }
const PR_BODY_FILE: Flag = { label: 'PR body', isFile: true }
const PR_FLAGS: FlagSet = {
  long: { '--title': PR_TITLE, '--body': PR_BODY, '--body-file': PR_BODY_FILE },
  short: { t: PR_TITLE, b: PR_BODY, F: PR_BODY_FILE },
  clustered: '',
}

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

const withoutVersion = (name: string) => name.replace(/(?<=.)@.*$/, '')

const program = (words: readonly Word[]) => {
  let start = 0

  while (LEADING.has(words[start]?.text ?? '') || ASSIGNMENT.test(words[start]?.text ?? '')) start += 1

  if (!RUNNERS.has(baseName(words[start]?.text ?? ''))) return words.slice(start)

  start += 1

  while (words[start]?.text.startsWith('-')) start += 1

  return words.slice(start)
}

const toDraft = (flag: Flag, value: Word, stdin: string | undefined): Draft => {
  if (!flag.isFile) return { label: flag.label, text: value.text, files: value.files }
  if (value.text === '-') return { label: flag.label, text: stdin ?? '', files: [] }

  return { label: flag.label, text: '', files: [value.text, ...value.files] }
}

const flagDrafts = (words: readonly Word[], flags: FlagSet, stdin: string | undefined) => {
  const drafts: Draft[] = []
  const shortFlag = new RegExp(`^-[${flags.clustered}]*([${Object.keys(flags.short).join('')}])(.*)$`, 's')

  for (let index = 0; index < words.length; index += 1) {
    const { text, files } = words[index] as Word

    if (text === '--') break

    const equals = text.indexOf('=')
    const name = equals === -1 ? text : text.slice(0, equals)
    const long = text.startsWith('--') ? flags.long[name] : undefined
    const short = long === undefined && !text.startsWith('--') ? shortFlag.exec(text) : null
    const flag = long ?? (short === null ? undefined : flags.short[short[1] as string])

    if (flag !== undefined) {
      const hasValue = long === undefined ? short?.[2] !== '' : equals !== -1
      const attached = long === undefined ? short?.[2] : text.slice(equals + 1)
      const value = hasValue ? { text: attached ?? '', files } : words[(index += 1)]

      if (value !== undefined) drafts.push(toDraft(flag, value, stdin))
    }
  }

  return drafts
}

const gitDrafts = (words: readonly Word[], stdin: string | undefined) => {
  let index = 0
  let dir: string | undefined

  while (words[index]?.text.startsWith('-')) {
    const flag = words[index]?.text as string

    if (flag === '-C') dir = words[index + 1]?.text

    index += flag === '-C' || GIT_VALUE_FLAGS.has(flag) ? 2 : 1
  }

  if (words[index]?.text !== 'commit') return []

  return flagDrafts(words.slice(index + 1), COMMIT_FLAGS, stdin).map(draft => ({ ...draft, dir }))
}

const ghDrafts = (words: readonly Word[], stdin: string | undefined) => {
  let index = 0

  while (words[index]?.text.startsWith('-')) {
    index += GH_VALUE_FLAGS.has(words[index]?.text as string) ? 2 : 1
  }

  if (words[index]?.text !== 'pr' || !PR_WRITES.has(words[index + 1]?.text ?? '')) return []

  return flagDrafts(words.slice(index + 2), PR_FLAGS, stdin)
}

export const draftsOf = ({ words, stdin }: Command): Draft[] => {
  const [name, ...rest] = program(words)
  const tool = withoutVersion(baseName(name?.text ?? ''))

  if (tool === 'git') return gitDrafts(rest, stdin)
  if (tool === 'gh' || tool === 'gh-axi') return ghDrafts(rest, stdin)

  return []
}

export const directoryChange = ({ words }: Command) =>
  words[0]?.text === 'cd' ? words[1]?.text : undefined

export const resolvePath = (path: string, dir: string, home: string | undefined) => {
  if (path.startsWith('/')) return path
  if (path.startsWith('~/') && home !== undefined) return `${home}${path.slice(1)}`

  return `${dir}/${path}`
}
