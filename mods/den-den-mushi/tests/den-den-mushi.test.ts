import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

import { parseContacts, ringLabel } from '../hooks/mail'
import type { Message, Thread } from '../hooks/mail'

const HOME = '/Users/milanstankovic/work/firstmate'
const KONTAKTI = '/Users/milanstankovic/work/potpis/alati/sajt-analiza/input/kontakti.json'
const PAUSAL = '/Users/milanstankovic/work/potpis/posao/pausal'
const POLL_MS = 5 * 60_000
const DAY_MS = 24 * 60 * 60_000
const NOW = Date.UTC(2026, 9, 31, 12)
const STOCK = 'stock band'
const SURFACES = ['terminal', 'desktop'] as const
const MEANING = /^Den Den Mushi is ringing/

const CONTACTS = JSON.stringify([
  { Ime: 'Pekara Primer', Email: 'Pekara@Example.com; prodaja@example.com', emails: null },
  { Ime: 'Salon Primer', Email: null, emails: [['salon@example.com', 'found on the site']] },
  { Ime: '', Email: 'bez-imena@example.com', emails: [] },
])
const CLIENTS = JSON.stringify([
  { name: 'Klijent Primer', email: 'klijent@example.com' },
  { name: 'Bez adrese', email: null },
])

type Inbox = { threads: Thread[]; hidden?: Record<string, Message[]>; fails?: boolean }

const inbound = (id: string, sender: string, age = 0): Message => ({
  id,
  sender,
  internalDate: String(NOW - age),
  labelIds: ['INBOX'],
})

const thread = (...messages: Message[]): Thread => ({
  id: `t-${messages[0]?.id}`,
  messageCount: messages.length,
  messages: messages.map(({ id, sender }) => ({ id, sender })),
})

const world = (
  on: On,
  inbox: Inbox,
  seen?: string[],
  root = HOME,
  clients = { exitCode: 0, stdout: CLIENTS },
) => {
  const calls = {
    seen,
    tools: [] as string[],
    args: [] as Record<string, unknown>[],
    rings: [] as unknown[],
    argv: [] as (readonly string[])[],
    cwd: [] as (string | undefined)[],
    reads: [] as string[],
  }

  on('session.root', () => ({ value: root }))
  on('store.get', () => ({ value: calls.seen }))
  on('store.set', (_, e) => {
    calls.seen = e.value as string[]

    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('mcp.call', (_, e) => {
    calls.tools.push(e.tool)
    calls.args.push(e.args)

    if (e.server !== 'claude.ai Gmail') return { deny: 'wrong server' }
    if (inbox.fails) return { value: { content: [{ type: 'text', text: 'nope' }], isError: true } }

    const threadId = String(e.args.threadId)
    const body =
      e.tool === 'search_threads'
        ? { threads: inbox.threads }
        : {
            messages:
              inbox.hidden?.[threadId] ??
              inbox.threads.find(({ id }) => id === threadId)?.messages,
          }

    return { value: { content: [{ type: 'text', text: JSON.stringify(body) }], isError: false } }
  })
  on('fs.read', (_, e) => {
    calls.reads.push(e.path)

    return e.path === KONTAKTI ? { value: CONTACTS } : { deny: 'ENOENT' }
  })
  on('process.run', (_, e) => {
    calls.argv.push(e.argv)
    calls.cwd.push(e.init?.cwd)

    return { value: { ...clients, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('audio.play', (_, e) => {
    calls.rings.push(e.clip)

    return { value: undefined }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return Text({ children: STOCK })
  })

  return calls
}

const start = async ($: Engine, clock: MockClock) => {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.settle()
}

const tick = async (clock: MockClock) => {
  await clock.advance(POLL_MS)
  await clock.settle()
}

const mountBand = ($: Engine, surface: 'terminal' | 'desktop', hasSurvey = false) =>
  $.ui.mount({
    plugin: 'den-den-mushi',
    surface,
    component: 'AbovePrompt',
    requestId: 'above-prompt',
    props: { hasSurvey, isWorking: false, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 12 }, view: {} },
  })

const clockAt = (on: On) => mock.clock(on, { now: NOW })

test('parseContacts reads every address form and lowercases it', () => {
  const contacts = parseContacts(CONTACTS, CLIENTS)

  expect(contacts.get('pekara@example.com')).toBe('Pekara Primer')
  expect(contacts.get('prodaja@example.com')).toBe('Pekara Primer')
  expect(contacts.get('salon@example.com')).toBe('Salon Primer')
  expect(contacts.get('klijent@example.com')).toBe('Klijent Primer')
  expect(ringLabel(['A', 'B'])).toBe('puru puru: A, B')
})

test('the first poll records the inbox and does not ring', async ($, on) => {
  const clock = clockAt(on)
  const calls = world(on, { threads: [thread(inbound('old', 'pekara@example.com'))] })

  await start($, clock)
  expect(calls.rings).toEqual([])
  expect(calls.seen).toEqual(['old'])
  expect(calls.argv).toEqual([])
})

test('a new mail from a contact rings once, through read-only metadata calls', async ($, on) => {
  const clock = clockAt(on)
  const inbox: Inbox = { threads: [] }
  const calls = world(on, inbox, [])

  await start($, clock)

  const message = inbound('new', 'Pekara <pekara@example.com>')

  inbox.threads = [thread(message)]
  inbox.hidden = { 't-new': [message] }
  await tick(clock)
  await tick(clock)

  expect(calls.rings).toEqual([{ asset: 'sounds/ring.wav' }])
  expect(calls.seen).toEqual(['new'])
  expect(calls.argv).toEqual([['npm', 'run', '-s', 'pausal', '--', 'clients', 'list']])
  expect(calls.cwd).toEqual([PAUSAL])
  expect([...new Set(calls.tools)]).toEqual(['search_threads', 'get_thread'])
  expect(calls.args[0]?.view).toBe('THREAD_VIEW_METADATA_ONLY')
  expect(calls.args.filter(({ threadId }) => threadId !== undefined)[0]?.messageFormat).toBe('METADATA_ONLY')

  const ui = await mountBand($, 'terminal')

  expect(await ui.find({ type: 'Text', text: 'puru puru: Pekara Primer' })).toBeDefined()
  await ui.unmount()
})

test('a stranger, an old mail and a sent copy do not ring', async ($, on) => {
  const clock = clockAt(on)
  const stranger = inbound('stranger', 'nepoznat@example.org')
  const old = inbound('old', 'pekara@example.com', 8 * DAY_MS)
  const sent: Message = { ...inbound('sent', 'klijent@example.com'), labelIds: ['SENT'] }
  const calls = world(on, {
    threads: [thread(stranger), { ...thread(old, sent), id: 'mixed' }],
    hidden: { 't-stranger': [stranger], mixed: [old, sent] },
  }, [])

  await start($, clock)
  expect(calls.rings).toEqual([])
  expect(calls.seen).toEqual(['stranger', 'old', 'sent'])
})

test('a long thread reads the messages the search left out', async ($, on) => {
  const clock = clockAt(on)
  const hidden = inbound('late', 'salon@example.com')
  const calls = world(on, {
    threads: [{ id: 'long', messageCount: 6, messages: [{ id: 'a', sender: 'salon@example.com' }] }],
    hidden: { long: [{ id: 'a' }, hidden] },
  }, ['a'])

  await start($, clock)
  expect(calls.rings).toHaveLength(1)

  const ui = await mountBand($, 'terminal')

  expect(await ui.find({ type: 'Text', text: 'puru puru: Salon Primer' })).toBeDefined()
  await ui.unmount()
})

test('a failed read records nothing and the next poll rings', async ($, on) => {
  const clock = clockAt(on)
  const message = inbound('new', 'klijent@example.com')
  const inbox: Inbox = { threads: [thread(message)], hidden: { 't-new': [message] }, fails: true }
  const calls = world(on, inbox, [])

  await start($, clock)
  expect(calls.rings).toEqual([])
  expect(calls.seen).toEqual([])

  inbox.fails = false
  await tick(clock)
  expect(calls.rings).toHaveLength(1)
})

test('a failed client list records nothing', async ($, on) => {
  const clock = clockAt(on)
  const message = inbound('new', 'klijent@example.com')
  const calls = world(on, { threads: [thread(message)], hidden: { 't-new': [message] } }, [], HOME, {
    exitCode: 1,
    stdout: '',
  })

  await start($, clock)
  expect(calls.rings).toEqual([])
  expect(calls.seen).toEqual([])
})

test('outside the exact home nothing is read', async ($, on) => {
  const clock = clockAt(on)
  const calls = world(on, { threads: [] }, undefined, `${HOME}-copy`)

  await start($, clock)
  await tick(clock)
  expect(calls.tools).toEqual([])
  expect(calls.reads).toEqual([])
  expect(calls.argv).toEqual([])
})

const ring = async ($: Engine, on: On, clock: MockClock) => {
  const message = inbound('new', 'klijent@example.com')
  const calls = world(on, { threads: [thread(message)], hidden: { 't-new': [message] } }, [])

  await start($, clock)

  return calls
}

test('the band keeps what lies beneath it and hides the meaning until hovered', async ($, on) => {
  await ring($, on, clockAt(on))

  for (const surface of SURFACES) {
    const ui = await mountBand($, surface)

    expect(await ui.find({ type: 'Text', text: 'puru puru: Klijent Primer' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()

    const row = await ui.find({ type: 'Box', key: 'ring' })
    const card = row?.children.find(child => (child as { type?: string }).type === 'Box') as
      | { props: Record<string, unknown>; hover: unknown }
      | undefined

    expect(card?.props.position).toBe('absolute')
    expect(card?.props.display).toBe('none')
    expect(card?.hover).toEqual({ display: 'flex' })
    expect(await ui.find({ type: 'Text', text: MEANING })).toBeDefined()
    await ui.unmount()
  }
})

test('the snail is drawn only where Svg exists, with a CSS wobble and no mail detail', async ($, on) => {
  await ring($, on, clockAt(on))

  const desktop = await mountBand($, 'desktop')
  const snail = await desktop.find({ type: 'Svg' })
  const source = String(snail?.props.source)

  expect(source).toContain('@keyframes wobble')
  expect(source).toContain('<title>Den Den Mushi is ringing')
  expect(source).not.toContain('<script')
  expect(snail?.props.isInteractive).toBe(true)
  await desktop.unmount()

  const terminal = await mountBand($, 'terminal')

  expect(await terminal.find({ type: 'Svg' })).toBeUndefined()
  await terminal.unmount()
})

test('a survey takes the band', async ($, on) => {
  await ring($, on, clockAt(on))

  const ui = await mountBand($, 'terminal', true)

  expect(await ui.find({ type: 'Text', text: /puru puru/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

test('only a captain prompt clears the ring', async ($, on) => {
  const clock = clockAt(on)

  await ring($, on, clock)

  const ui = await mountBand($, 'terminal')

  await $.prompt.submit({ text: 'rewake', wait: false, origin: { kind: 'task-notification' } })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: /puru puru/ })).toBeDefined()

  await $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } })
  await clock.settle()
  expect(await ui.find({ type: 'Text', text: /puru puru/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})

test('a quiet band draws only what lies beneath', async ($, on) => {
  const clock = clockAt(on)

  world(on, { threads: [] }, [])
  await start($, clock)

  const ui = await mountBand($, 'desktop')

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: STOCK })).toBeDefined()
  await ui.unmount()
})
