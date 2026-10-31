// The app clamps the frame to the row, so an oversized width makes it fill the text column
export const SHIP_WIDTH = 4096
// The app clips the row to one line of text, so anything drawn lower never shows
export const SHIP_HEIGHT = 20
const DRIFT_SECONDS = 200

const BOAT_WIDTH = 28
const BOAT_Y = 0.5
const BOB = 0.8
const BOB_SECONDS = 3.7
const ROCK_DEGREES = 3
const ROCK_SECONDS = 5.3
const ROCK_X = 14
const ROCK_Y = 16

const EASE = 'calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"'

// One mid tone per part reads on light and dark alike, since prefers-color-scheme in the
// sandboxed frame need not match the theme the app is set to
const WATER = '#5769f7'
const BOAT = '#d77757'

const wavePath = (level: number, amplitude: number, wavelength: number) => {
  const start = -wavelength
  const halves = 2 * Math.ceil((SHIP_WIDTH + wavelength) / wavelength)
  let path = `M${start} ${SHIP_HEIGHT}V${level}q${wavelength / 4} ${-2 * amplitude} ${wavelength / 2} 0`

  for (let half = 1; half < halves; half += 1) path += `t${wavelength / 2} 0`

  return `${path}V${SHIP_HEIGHT}Z`
}

const wave = (
  level: number,
  amplitude: number,
  wavelength: number,
  seconds: number,
  isRightward: boolean,
  opacity: number,
) => {
  const [from, to] = isRightward ? [0, wavelength] : [wavelength, 0]

  return `<path d="${wavePath(level, amplitude, wavelength)}" fill="${WATER}" fill-opacity="${opacity}">
<animateTransform attributeName="transform" type="translate" from="${from} 0" to="${to} 0" dur="${seconds}s" repeatCount="indefinite"/>
</path>`
}

export const SHIP_ALT = 'A small sailboat floating and rocking on a gently moving swell'

// The markup has no viewBox so its units stay CSS pixels at any frame width, and the boat's
// range is a percentage of that width less its own width, in two animations on one clock
export const SHIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHIP_WIDTH}" height="${SHIP_HEIGHT}">
${wave(16.5, 1, 150, 30, false, 0.45)}
<svg overflow="visible">
<animate attributeName="x" values="0%;100%;0%" dur="${DRIFT_SECONDS}s" ${EASE}/>
<g>
<animateTransform attributeName="transform" type="translate" values="0 ${BOAT_Y};${-BOAT_WIDTH} ${BOAT_Y};0 ${BOAT_Y}" dur="${DRIFT_SECONDS}s" ${EASE}/>
<g>
<animateTransform attributeName="transform" type="translate" values="0 ${-BOB};0 ${BOB};0 ${-BOB}" dur="${BOB_SECONDS}s" ${EASE}/>
<g stroke="${BOAT}" stroke-width="1.5" fill="none">
<animateTransform attributeName="transform" type="rotate" values="${-ROCK_DEGREES} ${ROCK_X} ${ROCK_Y};${ROCK_DEGREES} ${ROCK_X} ${ROCK_Y};${-ROCK_DEGREES} ${ROCK_X} ${ROCK_Y}" dur="${ROCK_SECONDS}s" ${EASE}/>
<path d="M1 9L5 16H23L27 9"/>
<path d="M14 1V16"/>
<path d="M10.5 2.5V9H6.5Z" stroke-width="0.75"/>
<path d="M17 1.5L22 9H17Z" fill="${BOAT}" stroke-width="0.75"/>
</g>
</g>
</g>
</svg>
${wave(18, 1, 96, 16, true, 1)}
</svg>`
