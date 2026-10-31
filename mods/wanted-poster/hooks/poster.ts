import type { Tally } from '../types'

const BERRIES_PER_PR = 1_000_000
const BERRIES_PER_INVOICE = 50_000_000

export const INK = '#3a2413'
const FADED_INK = '#6b4a2b'
const WARNING = '#8f2318'
export const PAPER_LIGHT = '#f0dfb4'
const PAPER_DARK = '#d3b279'
const PAPER_EDGE = '#a9824c'
const STAIN = '#9c7a45'
const PORTRAIT = '#dcc08a'

const DISPLAY_FONT = "Impact, 'Haettenschweiler', 'Arial Narrow', sans-serif"
const SERIF_FONT = "Georgia, 'Times New Roman', serif"

// Only ever digits and these fixed words reach the markup, so nothing needs escaping
const PRS_UNREAD = 'PRs could not be read, not counted'
const INVOICES_UNREAD = 'Invoices could not be read, not counted'
const COUNTING = 'Counting the bounty...'

const WANTED = 'WANTED'
const DEAD_OR_ALIVE = 'DEAD OR ALIVE'
const NAME = 'MILAN'
const BERRIES = 'BERRIES'

const HAT_ROWS = [
  '     _____     ',
  '   /       \\   ',
  ' _|_________|_ ',
  '(_____________)',
]

export const parseCount = (stdout: string) => {
  const text = stdout.trim()

  return /^\d+$/.test(text) ? Number(text) : null
}

export const parseListLength = (stdout: string) => {
  try {
    const list: unknown = JSON.parse(stdout)

    return Array.isArray(list) ? list.length : null
  } catch {
    return null
  }
}

const bounty = ({ prs, invoices }: Tally) =>
  (prs ?? 0) * BERRIES_PER_PR + (invoices ?? 0) * BERRIES_PER_INVOICE

const grouped = (value: number) => String(value).replace(/\B(?=(\d{3})+$)/g, ',')

const bountyText = (tally: Tally | null) => (tally === null ? '???' : grouped(bounty(tally)))

const counted = (count: number, noun: string) => `${grouped(count)} ${noun}${count === 1 ? '' : 's'}`

const countRows = (tally: Tally | null) => {
  if (tally === null) return [COUNTING]

  return [
    tally.prs === null ? PRS_UNREAD : counted(tally.prs, 'merged PR'),
    tally.invoices === null ? INVOICES_UNREAD : counted(tally.invoices, 'paid invoice'),
  ]
}

export const posterLines = (tally: Tally | null) => [
  WANTED,
  DEAD_OR_ALIVE,
  '',
  ...HAT_ROWS,
  '',
  NAME,
  `${bountyText(tally)} ${BERRIES}`,
  ...countRows(tally),
]

export const posterAlt = (tally: Tally | null) =>
  `A parchment poster: ${WANTED}, ${DEAD_OR_ALIVE}, a straw hat silhouette in place of a portrait, ${NAME}, bounty ${bountyText(tally)} berries. ${countRows(tally).join('. ')}.`

const unread = ({ prs, invoices }: Tally) => {
  if (prs === null) return invoices === null ? ' without the PRs and invoices it could not read' : ' without the PRs it could not read'

  return invoices === null ? ' without the invoices it could not read' : ''
}

export const posterNote = (tally: Tally | null) => {
  const purpose = 'This mod draws your bounty from merged PRs and paid invoices'

  if (tally === null) return `${purpose}, and it is still counting.`

  return `${purpose}, now ${bountyText(tally)} berries${unread(tally)}.`
}

const isWarning = (row: string) => row === PRS_UNREAD || row === INVOICES_UNREAD

const countText = (row: string, index: number) =>
  `<text x="180" y="${444 + index * 19}" font-family="${SERIF_FONT}" font-size="14" font-style="italic" text-anchor="middle" fill="${isWarning(row) ? WARNING : FADED_INK}">${row}</text>`

const STRAW_HAT = `<path d="M128 214C126 172 148 152 180 152S234 172 232 214Z" fill="${INK}"/>
<path d="M127.5 196Q180 208 232.5 196L232 214Q180 226 128 214Z" fill="${PORTRAIT}"/>
<path d="M130 201Q180 212 230 201L230 210Q180 221 130 210Z" fill="${INK}"/>
<path d="M76 228C96 208 136 208 180 208S264 208 284 228C288 234 281 234 279 238L273 235L267 241L259 237L252 244L243 240L235 247L226 243L217 249L208 245L199 251L189 247L180 252L171 247L161 251L152 245L143 249L134 243L125 247L117 240L108 244L101 237L93 241L87 235L81 238C79 234 72 234 76 228Z" fill="${INK}"/>`

export const posterSvg = (tally: Tally | null) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 500" width="360" height="500">
<defs>
<linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PAPER_LIGHT}"/><stop offset="1" stop-color="${PAPER_DARK}"/></linearGradient>
<radialGradient id="stain"><stop offset="0" stop-color="${STAIN}" stop-opacity=".28"/><stop offset="1" stop-color="${STAIN}" stop-opacity="0"/></radialGradient>
</defs>
<path d="M9 7L58 11L104 6L161 10L216 5L268 10L322 6L352 9L349 62L354 128L350 196L353 262L348 334L353 402L349 462L352 493L298 489L241 494L183 490L126 495L71 490L12 494L8 438L12 372L7 301L11 233L6 164L10 92Z" fill="url(#paper)" stroke="${PAPER_EDGE}" stroke-width="1.5"/>
<circle cx="72" cy="428" r="56" fill="url(#stain)"/>
<circle cx="296" cy="70" r="50" fill="url(#stain)"/>
<circle cx="292" cy="372" r="44" fill="url(#stain)"/>
<path d="M12 250Q180 244 349 252" stroke="${PAPER_EDGE}" stroke-width=".7" stroke-opacity=".5" fill="none"/>
<rect x="24" y="24" width="312" height="452" fill="none" stroke="${INK}" stroke-width="2.5"/>
<rect x="30" y="30" width="300" height="440" fill="none" stroke="${INK}" stroke-width=".8"/>
<text x="180" y="94" font-family="${DISPLAY_FONT}" font-size="62" text-anchor="middle" textLength="264" lengthAdjust="spacingAndGlyphs" fill="${INK}">${WANTED}</text>
<text x="180" y="122" font-family="${SERIF_FONT}" font-size="19" font-weight="bold" text-anchor="middle" textLength="216" fill="${INK}">${DEAD_OR_ALIVE}</text>
<rect x="56" y="136" width="248" height="134" fill="${PORTRAIT}" stroke="${INK}" stroke-width="2"/>
${STRAW_HAT}
<text x="180" y="318" font-family="${DISPLAY_FONT}" font-size="42" text-anchor="middle" textLength="150" fill="${INK}">${NAME}</text>
<text x="180" y="366" font-family="${SERIF_FONT}" font-size="34" font-weight="bold" text-anchor="middle" fill="${INK}">${bountyText(tally)}</text>
<text x="180" y="392" font-family="${SERIF_FONT}" font-size="16" font-weight="bold" text-anchor="middle" textLength="120" fill="${INK}">${BERRIES}</text>
${countRows(tally).map(countText).join('\n')}
</svg>`
