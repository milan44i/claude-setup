export type Finding = { sentence: string; problems: string[] }

const HIDDEN = '\u0001'
const FENCE = /^[ \t]*(`{3,}|~{3,}).*\n[\s\S]*?(?:^[ \t]*\1[`~]*[ \t]*$|(?![\s\S]))/gm
const INDENTED_CODE = /(?<=^[ \t]*\n)(?:(?: {4}|\t).*(?:\n|$))+/gm
const INLINE_CODE = /(`+)[^\n]*?\1/g
const ATTRIBUTION = /^[ \t]*(?:co-authored-by:|signed-off-by:|(?:🤖[ \t]*)?generated (?:with|by)\b).*$/gim

const SENTENCE_END = /[.!?]+(?:\s+|$)|\n+/g

const DASH_FIX = 'End the sentence there or use a comma.'

const AI_WORDS = /additionally|crucial(?:ly)?|delv(?:e|es|ed|ing)|enduring|enhanc(?:e|es|ed|ing)|fostering|garner(?:s|ed|ing)?|interplay|intricate(?:ly)?|(?<!\bin\s)landscape(?!\s+(?:mode|orientation|layout|view|format|photos?|images?|screen))|pivotal|showcas(?:e|es|ed|ing)|tapestry|testament|vibrant/
// The noun names the _ character, so only the verb's shape counts
const UNDERSCORE_VERB = /underscoring|underscor(?:e|es|ed)\s+(?:the|that|how|why|its|our|their|this|these|those)/
const CHATBOT_PHRASES = /i hope this helps|let me know if|of course|certainly|found the smoking gun/

const AI_WORD = new RegExp(`\\b(?:${AI_WORDS.source}|${UNDERSCORE_VERB.source})\\b`, 'gi')
const CHATBOT_PHRASE = new RegExp(`\\b(?:${CHATBOT_PHRASES.source})\\b`, 'gi')
// Neighbours keep out list bullets and the lone hyphen of an empty table cell
const HYPHEN_DASH = /(?<=[^\s|])[ \t]+-[ \t]+(?=[^\s|])/g

const hide = (text: string, pattern: RegExp) =>
  text.replace(pattern, match => match.replace(/[^\n]/g, HIDDEN))

const prose = (text: string) =>
  [FENCE, INDENTED_CODE, INLINE_CODE, ATTRIBUTION].reduce(hide, text)

const problemsIn = (sentence: string) => {
  const problems = new Set<string>()

  if (sentence.includes('—')) problems.add(`It has an em dash. ${DASH_FIX}`)
  if (sentence.includes('–')) problems.add(`It has an en dash. ${DASH_FIX}`)
  if (sentence.search(HYPHEN_DASH) !== -1) problems.add(`It uses a hyphen as a dash. ${DASH_FIX}`)

  for (const [word] of sentence.matchAll(AI_WORD)) {
    problems.add(`"${word}" is AI vocabulary. Replace it with a plain word.`)
  }

  for (const [phrase] of sentence.matchAll(CHATBOT_PHRASE)) {
    problems.add(`"${phrase}" is a chatbot phrase. Delete it.`)
  }

  return [...problems]
}

export const findSlop = (text: string): Finding[] => {
  const masked = prose(text)
  const ends = [...masked.matchAll(SENTENCE_END)].map(match => match.index + match[0].length)
  const findings: Finding[] = []
  let start = 0

  for (const end of [...ends, masked.length]) {
    const problems = problemsIn(masked.slice(start, end))

    if (problems.length > 0) findings.push({ sentence: text.slice(start, end).trim(), problems })

    start = end
  }

  return findings
}

export const denial = (flagged: readonly { label: string; findings: readonly Finding[] }[]) => {
  const sentences = flagged.flatMap(({ label, findings }) =>
    findings.map(({ sentence, problems }) =>
      [`${label}: "${sentence}"`, ...problems.map(problem => `  ${problem}`)].join('\n'),
    ),
  )

  return [
    'walk-the-plank stopped this command. Rewrite each sentence below and run the command again.',
    ...sentences,
    'Code in backticks or a code block is exempt, and so are attribution lines.',
  ].join('\n\n')
}
