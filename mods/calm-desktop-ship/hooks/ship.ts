const WIDTH = 480
const HEIGHT = 32
const TRAVEL = 440
const DRIFT_SECONDS = 96

const BOAT_Y = 1
const BOB = 1.2
const BOB_SECONDS = 3.7
const ROCK_DEGREES = 3
const ROCK_SECONDS = 5.3
const ROCK_X = 20
const ROCK_Y = 26

const EASE = 'calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"'

// One mid tone per part reads on light and dark alike, since prefers-color-scheme in the
// sandboxed frame need not match the theme the app is set to
const WATER = '#5769f7'
const BOAT = '#d77757'

const wavePath = (level: number, amplitude: number, wavelength: number) => {
  const start = -wavelength
  const halves = 2 * Math.ceil((WIDTH + wavelength) / wavelength)
  let path = `M${start} ${HEIGHT}V${level}q${wavelength / 4} ${-2 * amplitude} ${wavelength / 2} 0`

  for (let half = 1; half < halves; half += 1) path += `t${wavelength / 2} 0`

  return `${path}V${HEIGHT}Z`
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

export const SHIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
${wave(27, 1.5, 150, 30, false, 0.45)}
<g>
<animateTransform attributeName="transform" type="translate" values="0 ${BOAT_Y};${TRAVEL} ${BOAT_Y};0 ${BOAT_Y}" dur="${DRIFT_SECONDS}s" ${EASE}/>
<g>
<animateTransform attributeName="transform" type="translate" values="0 ${-BOB};0 ${BOB};0 ${-BOB}" dur="${BOB_SECONDS}s" ${EASE}/>
<g stroke="${BOAT}" stroke-width="2" fill="none">
<animateTransform attributeName="transform" type="rotate" values="${-ROCK_DEGREES} ${ROCK_X} ${ROCK_Y};${ROCK_DEGREES} ${ROCK_X} ${ROCK_Y};${-ROCK_DEGREES} ${ROCK_X} ${ROCK_Y}" dur="${ROCK_SECONDS}s" ${EASE}/>
<path d="M1 16L7 26H33L39 16"/>
<path d="M20 1V26"/>
<path d="M15 3V15H9Z" stroke-width="1"/>
<path d="M24 1L31 15H24Z" fill="${BOAT}" stroke-width="1"/>
</g>
</g>
</g>
${wave(29, 1.5, 96, 16, true, 1)}
</svg>`
