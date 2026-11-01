import type { SeaState } from '../types'

const ROUGH_PERCENT = 60
const HEAVY_PERCENT = 80
const NIGHT_FROM_HOUR = 20
const NIGHT_UNTIL_HOUR = 6
const KRAKEN_TOKENS = 10_000
const CHARS_PER_TOKEN = 4
const COMMAND_CHARS = 60

const META_PR = /^pr=(\S+)$/m
const GITHUB_PR = /^https:\/\/([\w.-]+)\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)$/
const FAILED_CHECKS = /^summary: "[^"]*\b(\d+) failed/m
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]+/g

export type RecordedPr = { host: string; repo: string; number: string }

export const seaForFill = (percent: number): SeaState => {
  if (percent >= HEAVY_PERCENT) return 'heavy'

  return percent >= ROUGH_PERCENT ? 'rough' : 'calm'
}

export const isNightHour = (hour: number) => hour >= NIGHT_FROM_HOUR || hour < NIGHT_UNTIL_HOUR

export const parseRecordedPr = (meta: string): RecordedPr | undefined => {
  const github = GITHUB_PR.exec(META_PR.exec(meta)?.[1] ?? '')

  if (github === null) return undefined

  const [, host = '', repo = '', number = ''] = github

  return { host, repo, number }
}

export const hasFailedChecks = (stdout: string) => {
  const failed = FAILED_CHECKS.exec(stdout)

  return failed === null ? undefined : Number(failed[1]) > 0
}

// A failed read says nothing, so it keeps the last answer unless another PR is already red
export const isStormy = (readings: readonly (boolean | undefined)[], last: boolean) => {
  if (readings.includes(true)) return true

  return readings.includes(undefined) ? last : false
}

// Bash keeps an output past its inline limit on disk and hands back a preview and its full size.
// base64 is an image's bytes, which the model is not charged for by length
export const estimateTokens = (result: unknown) => {
  const text = JSON.stringify(result, (key, value) => (key === 'base64' ? undefined : value)) ?? ''
  const { persistedOutputSize = 0 } = (result ?? {}) as { persistedOutputSize?: number }

  return Math.ceil(Math.max(text.length, persistedOutputSize) / CHARS_PER_TOKEN)
}

export const isKrakenSized = (tokens: number) => tokens > KRAKEN_TOKENS

export const krakenLine = (command: string, tokens: number) => {
  const flat = command.replace(CONTROLS, ' ').trim()
  const shown = flat.length > COMMAND_CHARS ? `${flat.slice(0, COMMAND_CHARS)}…` : flat

  return `Kraken: ${shown} ate about ${Math.round(tokens / 1000)}k tokens`
}
