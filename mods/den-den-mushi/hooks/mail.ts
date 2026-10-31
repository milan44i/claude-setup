export type Message = {
  id: string
  sender?: string
  internalDate?: string
  labelIds?: readonly string[]
}

export type Thread = {
  id: string
  messageCount?: number
  messages?: readonly Message[]
}

type ContactRow = {
  Ime?: string | null
  Email?: string | null
  emails?: readonly (readonly string[])[] | null
}

type ClientRow = {
  name?: string | null
  email?: string | null
}

const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/g
const SEPARATORS = /[,;\s]+/
const BRACKETED = /<([^<>]+)>/

const addressOf = (sender: string) => (BRACKETED.exec(sender)?.[1] ?? sender).trim().toLowerCase()

// kontakti.json keeps one or more addresses in Email, and each row of emails is [address, note]
export const parseContacts = (kontakti: string, clients: string) => {
  const contacts = new Map<string, string>()
  const add = (name: string | null | undefined, addresses: string | null | undefined) => {
    for (const address of (addresses ?? '').split(SEPARATORS)) {
      if (address !== '') contacts.set(address.toLowerCase(), (name ?? '').replace(CONTROLS, ''))
    }
  }

  for (const { Ime, Email, emails } of JSON.parse(kontakti) as ContactRow[]) {
    add(Ime, Email)
    for (const [address] of emails ?? []) add(Ime, address)
  }

  for (const { name, email } of JSON.parse(clients) as ClientRow[]) add(name, email)

  return contacts
}

export const needsRead = ({ messageCount = 0, messages = [] }: Thread, seen: ReadonlySet<string>) =>
  messages.length < messageCount || messages.some(({ id }) => !seen.has(id))

export const isInbound = ({ internalDate, labelIds = [] }: Message, since: number) =>
  labelIds.includes('INBOX') && Number(internalDate) >= since

export const senderNames = (messages: readonly Message[], contacts: ReadonlyMap<string, string>) => {
  const names = messages.flatMap(({ sender = '' }) => {
    const address = addressOf(sender)
    const name = contacts.get(address)

    return name === undefined ? [] : [name === '' ? address : name]
  })

  return [...new Set(names)]
}

export const ringLabel = (names: readonly string[]) => `puru puru: ${names.join(', ')}`
