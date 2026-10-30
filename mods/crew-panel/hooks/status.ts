import type { CrewRow } from '../types'

type StatusEvent = { verb: string; key?: string; note: string }

const VERBS = new Set([
  'working',
  'needs-decision',
  'blocked',
  'done',
  'failed',
  'note',
  'paused',
  'resolved',
  'captain-held',
])

const parseLine = (raw: string): StatusEvent | undefined => {
  const line = raw.replace(/^([^:]*?)\s?\[at=[^\]]*\]/, '$1')
  const colon = line.indexOf(':')
  const head = colon < 0 ? line : line.slice(0, colon)
  const headKey = head.match(/\[key=([^\]]*)\]/)?.[1]
  if (colon < 0 && headKey === undefined) return undefined

  const verb = head
    .split('[')[0]!
    .replace(/\s+corr=[0-9A-Fa-f]+/g, '')
    .trim()
  if (!VERBS.has(verb)) return undefined

  const body = colon < 0 ? line : line.slice(colon + 1).trim()
  const bodyKey = headKey === undefined ? body.match(/^\[key=([^\]]*)\]\s*/) : null
  const key = headKey ?? bodyKey?.[1]
  const note = bodyKey ? body.slice(bodyKey[0].length) : body

  const isMalformed = key !== undefined && !/^[A-Za-z0-9._-]+$/.test(key)
  const isForgedReserved =
    key?.startsWith('pending-reply-') && !/^pending-reply-.*:/.test(note)

  return isMalformed || isForgedReserved
    ? { verb: 'note', note }
    : { verb, key, note }
}

// Mirrors the decision fold of fm-classify-lib.sh, which fm-crew-state.sh cannot
// be run for: its ship-done gate writes local_done_head into a local-only meta.
export const readStatus = (
  text: string,
  kind: string,
): Pick<CrewRow, 'state' | 'line'> => {
  const events = text.split('\n').flatMap(raw => parseLine(raw) ?? [])
  const open = new Map<string, StatusEvent>()

  for (const event of events) {
    const key = event.key ?? 'default'
    if (event.verb === 'done' || event.verb === 'failed') {
      if (kind === 'ship' || kind === 'scout') open.clear()
    } else if (event.verb === 'needs-decision' || event.verb === 'blocked') {
      open.delete(key)
      open.set(key, event)
    } else if (event.verb === 'resolved' || event.verb === 'captain-held') {
      open.delete(key)
    }
  }

  const decision = [...open.values()].at(-1)
  if (decision) {
    return {
      state: decision.verb === 'blocked' ? 'blocked' : 'parked',
      line: decision.note,
    }
  }

  const line = events.at(-1)?.note ?? ''
  const answered = new Set<string>()

  for (const event of events.toReversed()) {
    switch (event.verb) {
      case 'resolved':
        answered.add(event.key ?? 'default')
        break
      case 'note':
        break
      case 'captain-held':
        return { state: 'parked', line }
      case 'paused':
        return {
          state: event.key && answered.has(event.key) ? 'working' : 'paused',
          line,
        }
      case 'done':
        return { state: 'done', line }
      case 'failed':
        return { state: 'failed', line }
      default:
        return { state: 'working', line }
    }
  }

  return { state: 'unknown', line }
}
