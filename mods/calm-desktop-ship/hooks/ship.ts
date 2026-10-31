const CELL_WIDTH = 8
const CELL_HEIGHT = 16
const COLUMNS = 60
const HULL_COLUMNS = 5
const HULL_CENTER = 2
const SPAN = COLUMNS - HULL_COLUMNS
const SECONDS_PER_COLUMN = 0.88

const BASELINE = CELL_HEIGHT * 2
const LEVEL_HEIGHT = CELL_HEIGHT / 8
const MAX_LEVEL = 3
const HALF_LENGTH_MIN = 9
const HALF_LENGTH_SPAN = 5
const TROUGH_RADIUS = 5

// One mid tone per part reads on light and dark alike, since prefers-color-scheme in the
// sandboxed frame need not match the theme the app is set to
const WATER = '#5769f7'
const BOAT = '#d77757'

const halfWaveLength = (index: number, isNegative: boolean) => {
  let value = ((isNegative ? 0xc411 : 0x5ea1) + Math.imul(index + 1, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value >>>= 0

  return HALF_LENGTH_MIN + (value % HALF_LENGTH_SPAN)
}

const smoothstep = (value: number) => value * value * (3 - 2 * value)

const waveAmplitude = (coordinate: number) => {
  let distance = Math.abs(coordinate)
  let isRising = true

  for (let index = 0; ; index += 1) {
    const length = halfWaveLength(index, coordinate < 0)

    if (distance <= length) {
      const eased = smoothstep(distance / length)

      return (isRising ? eased : 1 - eased) * MAX_LEVEL
    }
    distance -= length
    isRising = !isRising
  }
}

const waterHeight = (column: number) => {
  if (column >= 0 && column < HULL_COLUMNS) return 0

  const coordinate = column - HULL_CENTER
  const level =
    Math.abs(coordinate) <= TROUGH_RADIUS
      ? 0
      : Math.round(waveAmplitude(coordinate - Math.sign(coordinate) * TROUGH_RADIUS))

  return (level + 1) * LEVEL_HEIGHT
}

const waterPath = () => {
  let path = `M${-SPAN * CELL_WIDTH} ${BASELINE}`

  for (let column = -SPAN; column < COLUMNS; column += 1) {
    path += `V${BASELINE - waterHeight(column)}H${(column + 1) * CELL_WIDTH}`
  }

  return `${path}V${BASELINE}Z`
}

const WIDTH = COLUMNS * CELL_WIDTH
const TRAVEL = SPAN * CELL_WIDTH
const DURATION = 2 * SPAN * SECONDS_PER_COLUMN

export const SHIP_ALT = 'A small sailboat travelling left and right over a moving swell'

export const SHIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${BASELINE}" viewBox="0 0 ${WIDTH} ${BASELINE}">
<g>
<animateTransform attributeName="transform" type="translate" values="0 0;${TRAVEL} 0;0 0" dur="${DURATION}s" repeatCount="indefinite"/>
<path d="${waterPath()}" fill="${WATER}"/>
<g stroke="${BOAT}" stroke-width="2" fill="none">
<path d="M1 16L8 31H32L39 16"/>
<path d="M20 1V16"/>
<path d="M15 3V15H9Z" stroke-width="1"/>
<path d="M24 1L31 15H24Z" fill="${BOAT}" stroke-width="1"/>
</g>
</g>
</svg>`
