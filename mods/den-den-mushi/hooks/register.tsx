import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptOrigin, Register } from 'claude-code'

import type { Ringing } from '../types'
import { isInbound, needsRead, parseContacts, ringLabel, senderNames } from './mail'
import type { Message, Thread } from './mail'
import { SNAIL_ALT, SNAIL_HEIGHT, SNAIL_MEANING, SNAIL_SVG, SNAIL_WIDTH } from './snail'

// A marker-file check here would run a script from any repo that carries those files
const HOME = '/Users/milanstankovic/work/firstmate'
const KONTAKTI = '/Users/milanstankovic/work/potpis/alati/sajt-analiza/input/kontakti.json'
const PAUSAL = '/Users/milanstankovic/work/potpis/posao/pausal'
const GMAIL = 'claude.ai Gmail'
const POLL_MS = 5 * 60_000
const WINDOW_DAYS = 7
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60_000
const INBOUND_QUERY = `in:inbox newer_than:${WINDOW_DAYS}d`
const SEEN = 'seen'
const SEEN_LIMIT = 5000
const RING = { asset: 'sounds/ring.wav' }
const SNAIL = {
  source: SNAIL_SVG,
  alt: SNAIL_ALT,
  width: SNAIL_WIDTH,
  height: SNAIL_HEIGHT,
  isInteractive: true,
}
const CAPTAIN_ORIGINS: readonly PromptOrigin['kind'][] = ['composer', 'bridge', 'slack-ping', 'channel']

const ringing = atom({ plugin: 'den-den-mushi', key: 'ringing' } as const, [] as Ringing)

// Metadata views only, so a mail body never reaches this mod
const callGmail = async <T,>($: EngineInterface, tool: string, args: Record<string, unknown>) => {
  const { content, isError } = await $.mcp.call(GMAIL, tool, args)

  if (isError) throw new Error(`${tool} failed`)

  return JSON.parse(content.flatMap(block => (block.type === 'text' ? [String(block.text)] : [])).join('')) as T
}

const searchInbox = async ($: EngineInterface) => {
  const threads: Thread[] = []
  let pageToken: string | undefined

  do {
    const page = await callGmail<{ threads?: Thread[]; nextPageToken?: string }>($, 'search_threads', {
      query: INBOUND_QUERY,
      pageSize: 50,
      view: 'THREAD_VIEW_METADATA_ONLY',
      ...(pageToken === undefined ? {} : { pageToken }),
    })

    threads.push(...(page.threads ?? []))
    pageToken = page.nextPageToken
  } while (pageToken !== undefined && pageToken !== '')

  return threads
}

const readThread = async ($: EngineInterface, { id }: Thread) => {
  const { messages = [] } = await callGmail<{ messages?: Message[] }>($, 'get_thread', {
    threadId: id,
    messageFormat: 'METADATA_ONLY',
  })

  return messages
}

const loadContacts = async ($: EngineInterface) => {
  const kontakti = await $.fs.read(KONTAKTI)
  const clients = await $.process.run(['npm', 'run', '-s', 'pausal', '--', 'clients', 'list'], {
    cwd: PAUSAL,
    timeoutMs: 60_000,
  })

  if (clients.exitCode !== 0) throw new Error('clients list failed')

  return parseContacts(kontakti, clients.stdout)
}

const poll = async ($: EngineInterface) => {
  const stored = (await $.store.get(SEEN)) as string[] | undefined
  const seen = new Set(stored)
  const threads = await searchInbox($)
  const pending = threads.filter(thread => needsRead(thread, seen))
  const messages = (await Promise.all(pending.map(thread => readThread($, thread)))).flat()
  const fresh = messages.filter(({ id }) => !seen.has(id))

  if (stored !== undefined && fresh.length === 0) return

  const since = (await $.clock.now()) - WINDOW_MS
  // The first poll only records what is already there, so old mail does not ring
  const inbound = stored === undefined ? [] : fresh.filter(message => isInbound(message, since))
  const names = inbound.length === 0 ? [] : senderNames(inbound, await loadContacts($))

  await $.store.set(SEEN, [...fresh.map(({ id }) => id), ...(stored ?? [])].slice(0, SEEN_LIMIT))

  if (names.length === 0) return

  await update($, ringing, shown => [...new Set([...shown, ...names])])
  await $.audio.play(RING)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    if ((await $.session.root()) === HOME) {
      // A failed poll records nothing and the next one retries, and a rejection here would end the interval
      const tick = () => poll($).catch(() => undefined)

      void tick()
      $.clock.every(POLL_MS, tick)
    }

    return started
  })

  // A supervision rewake submits a prompt too, so only a captain's origin clears the ring
  on('prompt.submit', async ($, e, next) => {
    if (CAPTAIN_ORIGINS.includes(e.origin.kind)) await update($, ringing, () => [])

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const names = await read($, ringing)

    if (e.props.hasSurvey || names.length === 0) return next(e)

    const beneath = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const snail = e.surface === 'desktop' ? $.ui.resolve(e).Svg(SNAIL) : null

    return (
      <Box flexDirection="column">
        <Box key="ring" gap={1} alignItems="center">
          {snail}
          <Text bold>{ringLabel(names)}</Text>
          <Box position="absolute" top={0} right={0} display="none" hover={{ display: 'flex' }}>
            <Text>{SNAIL_MEANING}</Text>
          </Box>
        </Box>
        {beneath}
      </Box>
    )
  })
}
