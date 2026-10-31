export type Word = { text: string; files: string[] }
export type Command = { words: Word[]; stdin?: string }

type Heredoc = { tag: string; stripsTabs: boolean; owner: Command }

const BLANK = /[ \t]/
const WORD_END = /[ \t\n;&|()<>]/
const REDIRECT_OPERATOR = /^[<>&|]+/
const DOUBLE_QUOTE_ESCAPABLE = '"\\$`'
const ANSI_ESCAPES: Record<string, string> = { n: '\n', t: '\t' }

export const parseShell = (source: string): Command[] => {
  const nested: Command[] = []
  let at = 0

  const substitution = (word: Word) => {
    at += 2
    const inner = commands(true)
    const [only] = inner

    if (inner.length === 1 && only?.words[0]?.text === 'cat') {
      word.text += only.stdin ?? ''
      word.files.push(...only.words.slice(1).map(({ text }) => text))
    } else {
      nested.push(...inner)
    }
  }

  const doubleQuoted = (word: Word) => {
    at += 1

    while (at < source.length && source[at] !== '"') {
      const next = source[at + 1] ?? ''

      if (source[at] === '\\' && next === '\n') {
        at += 2
      } else if (source[at] === '\\' && DOUBLE_QUOTE_ESCAPABLE.includes(next)) {
        word.text += next
        at += 2
      } else if (source.startsWith('$(', at)) {
        substitution(word)
      } else {
        word.text += source[at]
        at += 1
      }
    }

    at += 1
  }

  const singleQuoted = (word: Word) => {
    const end = source.indexOf("'", at + 1)
    const stop = end === -1 ? source.length : end

    word.text += source.slice(at + 1, stop)
    at = stop + 1
  }

  const ansiQuoted = (word: Word) => {
    at += 2

    while (at < source.length && source[at] !== "'") {
      if (source[at] === '\\') {
        const next = source[at + 1] ?? ''

        word.text += ANSI_ESCAPES[next] ?? next
        at += 2
      } else {
        word.text += source[at]
        at += 1
      }
    }

    at += 1
  }

  const readWord = (): Word => {
    const word: Word = { text: '', files: [] }

    while (at < source.length && !WORD_END.test(source[at] ?? '')) {
      if (source[at] === "'") {
        singleQuoted(word)
      } else if (source[at] === '"') {
        doubleQuoted(word)
      } else if (source.startsWith("$'", at)) {
        ansiQuoted(word)
      } else if (source.startsWith('$(', at)) {
        substitution(word)
      } else if (source[at] === '\\') {
        if (source[at + 1] !== '\n') word.text += source[at + 1] ?? ''
        at += 2
      } else {
        word.text += source[at]
        at += 1
      }
    }

    return word
  }

  const skipBlanks = () => {
    while (BLANK.test(source[at] ?? '')) at += 1
  }

  const readBodies = (pending: Heredoc[]) => {
    for (const { tag, stripsTabs, owner } of pending.splice(0)) {
      const lines: string[] = []

      while (at < source.length) {
        const end = source.indexOf('\n', at)
        const stop = end === -1 ? source.length : end
        const line = source.slice(at, stop)

        at = stop + 1

        if ((stripsTabs ? line.replace(/^\t+/, '') : line) === tag) break

        lines.push(line)
      }

      owner.stdin = lines.join('\n')
    }
  }

  const redirect = (command: Command, pending: Heredoc[]) => {
    if (source.startsWith('<<<', at)) {
      at += 3
      skipBlanks()
      command.stdin = readWord().text
    } else if (source.startsWith('<<', at)) {
      const stripsTabs = source[at + 2] === '-'

      at += stripsTabs ? 3 : 2
      skipBlanks()
      pending.push({ tag: readWord().text, stripsTabs, owner: command })
    } else {
      at += REDIRECT_OPERATOR.exec(source.slice(at))?.[0].length ?? 1
      skipBlanks()
      readWord()
    }
  }

  const commands = (isNested: boolean): Command[] => {
    const found: Command[] = []
    const pending: Heredoc[] = []
    let command: Command = { words: [] }

    const finish = () => {
      if (command.words.length > 0) found.push(command)
      command = { words: [] }
    }

    while (at < source.length) {
      const char = source[at] ?? ''

      if (BLANK.test(char)) {
        at += 1
      } else if (source.startsWith('\\\n', at)) {
        at += 2
      } else if (char === '\n') {
        at += 1
        readBodies(pending)
        finish()
      } else if (char === '#') {
        const end = source.indexOf('\n', at)

        at = end === -1 ? source.length : end
      } else if (char === ')') {
        at += 1
        finish()

        if (isNested) return found
      } else if (';&|('.includes(char)) {
        at += 1
        finish()
      } else if (char === '<' || char === '>') {
        redirect(command, pending)
      } else {
        command.words.push(readWord())
      }
    }

    finish()

    return found
  }

  const top = commands(false)

  return [...nested, ...top]
}
