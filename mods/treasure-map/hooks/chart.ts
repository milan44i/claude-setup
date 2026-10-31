import type { Island, Stage } from '../types'

export const STAGES: readonly { stage: Stage; title: string }[] = [
  { stage: 'lead', title: 'Leads' },
  { stage: 'demo', title: 'Demo sent' },
  { stage: 'offer', title: 'Offer' },
  { stage: 'paid', title: 'Paid' },
]

const CELL_WIDTH = 172
const CELL_HEIGHT = 96
const MARGIN = 24
const BANNER = 96
const BAND_HEADER = 38
const BAND_GAP = 10
const LABEL_CHARS = 21
const CELLS_PER_COLUMN = 22
const INK = '#3b2a18'
const SEPIA = '#8a6b3d'
const RED = '#b3261e'

const escapeXml = (text: string) =>
  text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)

const seedOf = (text: string) => {
  let seed = 2166136261

  for (const char of text) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619)

  return seed >>> 0
}

const randomFrom = (seed: number) => {
  let state = seed

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0

    return state / 2 ** 32
  }
}

const shore = (x: number, y: number, radii: readonly number[], scale: number) => {
  const points = radii.map((radius, index): [number, number] => {
    const angle = (index / radii.length) * 2 * Math.PI

    return [x + Math.cos(angle) * radius * 42 * scale, y + Math.sin(angle) * radius * 21 * scale]
  })
  const middle = ([ax, ay]: [number, number], [bx, by]: [number, number]) =>
    `${Math.round((ax + bx) / 2)} ${Math.round((ay + by) / 2)}`
  const curves = points.map((point, index) => {
    const next = points[(index + 1) % points.length] ?? point

    return `${index === 0 ? `M${middle(points.at(-1) ?? point, point)}` : ''}Q${Math.round(point[0])} ${Math.round(point[1])} ${middle(point, next)}`
  })

  return `${curves.join('')}Z`
}

export const labelLines = (name: string) => {
  const lines: string[] = []
  let line = ''

  for (const word of name.split(' ')) {
    const joined = line === '' ? word : `${line} ${word}`

    if (joined.length <= LABEL_CHARS || line === '') {
      line = joined
    } else {
      lines.push(line)
      line = word
    }
  }
  lines.push(line)

  const cut = (text: string) => `${text.slice(0, LABEL_CHARS - 1)}…`
  const shown = lines.slice(0, 2).map(text => (text.length > LABEL_CHARS ? cut(text) : text))

  return lines.length > 2 ? [shown[0] ?? '', cut(shown[1] ?? '')] : shown
}

const drawIsland = ({ name, stage }: Island, x: number, y: number) => {
  const random = randomFrom(seedOf(name))
  const radii = Array.from({ length: 9 }, () => 0.72 + random() * 0.38)
  const cross =
    stage === 'paid'
      ? `<path d="M${x - 11} ${y - 10}L${x + 11} ${y + 10}M${x + 11} ${y - 10}L${x - 11} ${y + 10}" stroke="${RED}" stroke-width="5" stroke-linecap="round"/>`
      : ''
  const lines = labelLines(name)
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : 15}">${escapeXml(line)}</tspan>`)
    .join('')

  return (
    `<path d="${shore(x, y, radii, 1.2)}" fill="none" stroke="${SEPIA}" stroke-opacity=".45" stroke-dasharray="2 4"/>` +
    `<path d="${shore(x, y, radii, 1)}" fill="#e8d3a0" stroke="${SEPIA}" stroke-width="1.5"/>` +
    `<path d="${shore(x, y, radii, 0.55)}" fill="#a3ad6e"/>` +
    cross +
    `<text x="${x}" y="${y + 41}" text-anchor="middle" font-size="13" fill="${INK}">${lines}</text>`
  )
}

const drawCompass = (x: number, y: number) => {
  const point = (angle: number, length: number, width: number, fill: string) =>
    `<path transform="rotate(${angle} ${x} ${y})" d="M${x} ${y - length}L${x + width} ${y}L${x} ${y + width}L${x - width} ${y}Z" fill="${fill}" stroke="${INK}" stroke-width=".6"/>`
  const rhumbs = Array.from(
    { length: 16 },
    (_, index) =>
      `<path transform="rotate(${index * 22.5} ${x} ${y})" d="M${x} ${y}V${y - 4000}" stroke="${SEPIA}" stroke-opacity=".14"/>`,
  ).join('')
  const small = [45, 135, 225, 315].map(angle => point(angle, 24, 5, '#f3e5c2')).join('')
  const large = [0, 90, 180, 270].map(angle => point(angle, 38, 7, INK)).join('')

  return {
    rhumbs,
    rose:
      `<circle cx="${x}" cy="${y}" r="28" fill="none" stroke="${INK}" stroke-width=".8"/>` +
      small +
      large +
      `<text x="${x}" y="${y - 41}" text-anchor="middle" font-size="12" font-weight="bold" fill="${INK}">N</text>`,
  }
}

export const columnsFor = (bodyColumns: number) =>
  Math.min(5, Math.max(2, Math.floor(bodyColumns / CELLS_PER_COLUMN)))

export const stageCounts = (islands: readonly Island[]) =>
  Object.fromEntries(
    STAGES.map(({ stage }) => [stage, islands.filter(island => island.stage === stage).length]),
  ) as Record<Stage, number>

const altFor = (islands: readonly Island[]) => {
  const counts = stageCounts(islands)
  const parts = STAGES.map(({ stage, title }) => `${title} ${counts[stage]}`)

  return `Sea chart of the Potpis sales pipeline. ${parts.join(', ')}.`
}

export const drawChart = (islands: readonly Island[], columns: number) => {
  const width = MARGIN * 2 + columns * CELL_WIDTH
  let y = MARGIN + BANNER
  let bands = ''
  let land = ''

  for (const { stage, title } of STAGES) {
    const here = islands.filter(island => island.stage === stage)
    const rows = Math.ceil(here.length / columns)
    const height = BAND_HEADER + rows * CELL_HEIGHT + (rows === 0 ? 0 : 8)

    bands +=
      `<rect x="${MARGIN}" y="${y}" width="${width - MARGIN * 2}" height="${height}" rx="6" fill="#7fb0a6" fill-opacity=".22" stroke="${SEPIA}" stroke-opacity=".5" stroke-dasharray="6 5"/>` +
      `<text x="${MARGIN + 14}" y="${y + 26}" font-size="18" font-style="italic" fill="${INK}">${title} (${here.length})</text>`

    here.forEach((island, index) => {
      const cellX = MARGIN + (index % columns) * CELL_WIDTH + CELL_WIDTH / 2
      const cellY = y + BAND_HEADER + Math.floor(index / columns) * CELL_HEIGHT + 30

      land += drawIsland(island, cellX, cellY)
    })

    y += height + BAND_GAP
  }

  const height = y - BAND_GAP + MARGIN
  const compass = drawCompass(width - MARGIN - 46, MARGIN + 50)

  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Georgia, 'Times New Roman', serif">` +
    `<defs><radialGradient id="parchment" cx="50%" cy="45%" r="75%"><stop offset="0%" stop-color="#f6ead0"/><stop offset="70%" stop-color="#ead6a8"/><stop offset="100%" stop-color="#cfae78"/></radialGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#parchment)"/>` +
    `<ellipse cx="${Math.round(width * 0.22)}" cy="${Math.round(height * 0.7)}" rx="${Math.round(width * 0.16)}" ry="${Math.round(height * 0.09)}" fill="${SEPIA}" fill-opacity=".07"/>` +
    `<ellipse cx="${Math.round(width * 0.8)}" cy="${Math.round(height * 0.35)}" rx="${Math.round(width * 0.12)}" ry="${Math.round(height * 0.06)}" fill="${SEPIA}" fill-opacity=".06"/>` +
    bands +
    compass.rhumbs +
    `<rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="13" y="13" width="${width - 26}" height="${height - 26}" fill="none" stroke="${INK}" stroke-width=".7"/>` +
    `<text x="${MARGIN + 6}" y="${MARGIN + 42}" font-size="28" font-style="italic" fill="${INK}">Potpis Waters</text>` +
    compass.rose +
    land +
    `</svg>`

  return { source, width, height, alt: altFor(islands) }
}
