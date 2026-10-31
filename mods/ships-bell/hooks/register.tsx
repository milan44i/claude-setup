import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptOrigin, Register, TurnCompleteInput } from 'claude-code'

import type { Decisions } from '../types'

const BELL = { asset: 'sounds/bell.wav' }
const NO_OP_REPLY = 'Captain, shipshape.'
const CAPTAIN_ORIGINS: readonly PromptOrigin['kind'][] = ['composer', 'bridge', 'slack-ping', 'channel']
const CAPTAIN_DECISION = /^ {2}([^,]+),.*,captain$/gm

const decisions = atom({ plugin: 'ships-bell', key: 'decisions' } as const, null as Decisions)
const captainAsked = atom({ plugin: 'ships-bell', key: 'captainAsked' } as const, false as boolean)

// fs.exists comes first because a rejected stat is an error in the debug log
const isHome = async ($: EngineInterface, root: string) => {
  if (!(await $.fs.exists(`${root}/bin/fm-crew-state.sh`))) return false

  const state = await $.fs.stat(`${root}/state`).catch(() => undefined)

  return state?.kind === 'dir'
}

const readDecisions = async ($: EngineInterface, root: string) => {
  const listed = await $.process
    .run([`${root}/bin/fm-tasks-axi.sh`, 'list', '--state', 'held', '--fields', 'hold_kind'])
    .catch(() => undefined)

  if (listed?.exitCode !== 0) return undefined

  return [...listed.stdout.matchAll(CAPTAIN_DECISION)].map(row => row[1])
}

const takeNewDecision = async ($: EngineInterface, root: string) => {
  const current = await readDecisions($, root)

  if (current === undefined) return false

  const seen = await read($, decisions)

  await update($, decisions, () => current)

  return seen !== null && current.some(id => !seen.includes(id))
}

const hasReply = (e: TurnCompleteInput, wasAsked: boolean) => {
  const answer = e.answer.trim()

  if (e.isAborted) return false
  if (!wasAsked) return answer !== '' && answer !== NO_OP_REPLY

  return answer !== '' || e.reason !== 'answer'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const root = await $.session.root()

    if ((await read($, decisions)) === null && (await isHome($, root))) {
      await takeNewDecision($, root)
    }

    return started
  })

  // A supervision rewake can start a turn with no prompt.submit, so only a captain's origin sets this
  on('prompt.submit', async ($, e, next) => {
    if (CAPTAIN_ORIGINS.includes(e.origin.kind)) await update($, captainAsked, () => true)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const ended = await next(e)

    if (e.agentId !== undefined) return ended

    const wasAsked = await read($, captainAsked)

    await update($, captainAsked, () => false)

    const root = await $.session.root()

    if (!(await isHome($, root))) return ended

    const hasNewDecision = await takeNewDecision($, root)

    if (hasNewDecision || hasReply(e, wasAsked)) await $.audio.play(BELL)

    return ended
  })
}
