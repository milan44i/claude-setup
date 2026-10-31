export const CANNON = 'sounds/cannon.wav'
export const HORN = 'sounds/horn.wav'
export const ALARM = 'sounds/alarm.wav'

type Step = { words: string; before: string; after: string }

const LANDINGS: readonly { sound: string; run: RegExp; shows: RegExp; denies?: RegExp }[] = [
  {
    sound: CANNON,
    run: /^(?:\S*\/)?fm-merge-local\.sh(?:\s|$)/,
    shows: /^merged \S+ into local /m,
  },
  {
    sound: CANNON,
    run: /^(?:\S*\/)?fm-pr-merge\.sh(?:\s|$)/,
    shows: /^verified: \S+ is merged /m,
    denies: /^verified: \S+ is queued /m,
  },
  {
    sound: CANNON,
    run: /^(?:\S*\/)?gh(?:-axi)?(?:@\S+)?\s+pr\s+merge(?:\s|$)/,
    shows: /^merged:\s*$/m,
    denies: /^\s*state: merged\s*$/m,
  },
  {
    sound: HORN,
    run: /^(?:\S*\/)?wrangler(?:@\S+)?\s+(?:pages\s+)?deploy(?:\s|$)/,
    shows: /Deployment complete!|Current Version ID:/,
  },
]

const NOT_A_LANDING = /\s(?:--help|-h|--dry-run|--auto|--disable-auto)(?:\s|$)/
const LAUNCHER =
  /^(?:\w+=\S*|npx|-y|--yes|pnpm|yarn|exec|dlx|bunx|timeout\s+\S+|if|then|else|do|while|until|\{)\s+/
const OPERATOR = /^(?:&&|\|\||\|&|\||;|&|\n|\$\(|`)/
const CHECKS = /^(?:\S*\/)?gh(?:-axi)?(?:@\S+)?\s+pr\s+checks(?:\s|$)/
const WAKE_DRAIN = /^(?:\S*\/)?fm-wake-drain\.sh(?:\s|$)/
const FAILED_CHECK = /^\s*\S.*,fail"?\s*$|\bsummary: .*\b[1-9]\d* failed\b|\tfail\t/m
const REPORTED_FAILURE = /\bpr-health: \S+ has failing (?:required )?checks .*/g

const stripLaunchers = (words: string): string => {
  const trimmed = words.trim()
  const stripped = trimmed.replace(LAUNCHER, '')

  return stripped === trimmed ? trimmed : stripLaunchers(stripped)
}

const closingQuote = (command: string, opening: number) => {
  for (let at = opening + 1; at < command.length; at++) {
    if (command[at] === command[opening]) return at
    if (command[at] === '\\' && command[opening] === '"') at++
  }

  return command.length
}

const isRedirect = (command: string, at: number) =>
  command[at] === '&' && (command[at - 1] === '>' || command[at + 1] === '>')

export const parseSteps = (command: string) => {
  const steps: Step[] = []
  let words = ''
  let before = ''

  const endStep = (operator: string) => {
    if (operator !== '\n' || words.trim() !== '') {
      steps.push({ words: stripLaunchers(words), before, after: operator })
      before = operator
    }
    words = ''
  }

  for (let at = 0; at < command.length; at++) {
    const char = command[at]

    if (char === '\\') {
      at++
    } else if (char === "'" || char === '"') {
      at = closingQuote(command, at)
    } else if (char === '#' && /\s/.test(command[at - 1] ?? ' ')) {
      const lineEnd = command.indexOf('\n', at)

      at = (lineEnd === -1 ? command.length : lineEnd) - 1
    } else if (char === '(' || char === ')') {
      words += ' '
    } else {
      const operator = isRedirect(command, at) ? null : OPERATOR.exec(command.slice(at))

      if (operator === null) {
        words += char
      } else {
        endStep(operator[0])
        at += operator[0].length - 1
      }
    }
  }
  endStep('')

  return steps
}

// A shell's exit status speaks for a step only when nothing after it can replace that status
const exitProves = (step: Step, rest: readonly Step[]) =>
  !['||', '$(', '`'].includes(step.before) &&
  rest.every(({ after }) => after === '' || after === '&&')

export const landingSounds = (steps: readonly Step[], output: string) => {
  const landed = LANDINGS.filter(
    ({ run, shows, denies }) =>
      denies?.test(output) !== true &&
      steps.some(
        (step, index) =>
          run.test(step.words) &&
          !NOT_A_LANDING.test(step.words) &&
          (shows.test(output) || exitProves(step, steps.slice(index))),
      ),
  )

  return [...new Set(landed.map(landing => landing.sound))]
}

export const checksShowFailure = (steps: readonly Step[], output: string) =>
  steps.some(step => CHECKS.test(step.words)) && FAILED_CHECK.test(output)

export const reportedFailures = (steps: readonly Step[], output: string) =>
  steps.some(step => WAKE_DRAIN.test(step.words))
    ? [...output.matchAll(REPORTED_FAILURE)].map(report => report[0])
    : []
