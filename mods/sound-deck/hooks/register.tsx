import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ReportedFailures } from '../types'

import { ALARM, checksShowFailure, landingSounds, parseSteps, reportedFailures } from './deck'

const reported = atom({ plugin: 'sound-deck', key: 'reportedFailures' } as const, [] as ReportedFailures)

// fs.exists comes first because a rejected stat is an error in the debug log
const isHome = async ($: EngineInterface, root: string) => {
  if (!(await $.fs.exists(`${root}/bin/fm-crew-state.sh`))) return false

  const state = await $.fs.stat(`${root}/state`).catch(() => undefined)

  return state?.kind === 'dir'
}

const takeNewReports = async ($: EngineInterface, reports: readonly string[]) => {
  const seen = await read($, reported)
  const fresh = reports.filter(report => !seen.includes(report))

  if (fresh.length > 0) await update($, reported, () => [...seen, ...fresh])

  return fresh.length > 0
}

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)

    if (e.agentId !== undefined || ran.deny !== undefined) return ran

    const hasFailed = ran.isError === true

    if (!hasFailed && (ran.result.backgroundTaskId !== undefined || ran.result.interrupted)) return ran

    const steps = parseSteps(e.command)
    const output = ran.text ?? ''
    const landings = hasFailed ? [] : landingSounds(steps, output)
    const reports = reportedFailures(steps, output)
    const showsFailure = checksShowFailure(steps, output)

    if (landings.length === 0 && reports.length === 0 && !showsFailure) return ran
    if (!(await isHome($, await $.session.root()))) return ran

    const isNewReport = await takeNewReports($, reports)
    const sounds = showsFailure || isNewReport ? [...landings, ALARM] : landings

    await Promise.all(sounds.map(asset => $.audio.play({ asset })))

    return ran
  })
}
