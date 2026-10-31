// The app clamps the frame to the band, so an oversized width makes it fill the text column
export const SHIP_WIDTH = 4096
export const SHIP_HEIGHT = 46
const DRIFT_SECONDS = 200

const BOAT_WIDTH = 40
const BOAT_Y = 10.5
const BOB = 0.8
const BOB_SECONDS = 3.7
const ROCK_DEGREES = 3
const ROCK_SECONDS = 5.3
const ROCK_X = 20
const ROCK_Y = 26

const BACK_LEVEL = 39.5
const FRONT_LEVEL = 41
const WAVE_AMPLITUDE = 1

const SWELL_SECONDS = 60
const SWELL_START = 4
const SWELL_BUILT = 7
const SWELL_CREST = 20
const SWELL_FADING = 33
const SWELL_END = 36
const SWELL_REACH = 1120
const SWELL_HALF_WIDTH = 120
const BACK_SWELL = 11
const FRONT_SWELL = 8
const RIDE_LIFT = 8.5
const RIDE_SECONDS = 1.7
const RIDE_DEGREES = 7

const SPLINE = '.45 0 .55 1'
const EASE = `calcMode="spline" keyTimes="0;.5;1" keySplines="${SPLINE};${SPLINE}" repeatCount="indefinite"`

// One mid tone per part reads on light and dark alike, since prefers-color-scheme in the
// sandboxed frame need not match the theme the app is set to
const WATER = '#5769f7'
const WOOD = '#a86b36'
const TIMBER = '#7a4e28'
const CANVAS = '#eadfc6'
const SEAM = '#8a7654'
const FLAG = '#1c1c1c'
const FLAG_EDGE = '#d9d2c0'
const BONE = '#f4f1e8'
const STRAW = '#e8b93a'
const RIBBON = '#d0312d'

const swellClock = (seconds: number[]) => {
  const keyTimes = seconds.map(second => (second / SWELL_SECONDS).toFixed(4)).join(';')

  return `keyTimes="${keyTimes}" dur="${SWELL_SECONDS}s" repeatCount="indefinite"`
}

const swellTiming = (seconds: number[]) => {
  const keySplines = seconds.slice(1).map(() => SPLINE).join(';')

  return `${swellClock(seconds)} calcMode="spline" keySplines="${keySplines}"`
}

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
) => {
  const [from, to] = isRightward ? [0, wavelength] : [wavelength, 0]

  return `<path d="${wavePath(level, amplitude, wavelength)}" fill="${WATER}">
<animateTransform attributeName="transform" type="translate" from="${from} 0" to="${to} 0" dur="${seconds}s" repeatCount="indefinite"/>
</path>`
}

// The hump's foot sits below the wave's trough, so it rises out of the water with no step at its edges
const humpPath = (level: number, crest: number) => {
  const half = SWELL_HALF_WIDTH
  const foot = level + WAVE_AMPLITUDE

  return `M${-half} ${SHIP_HEIGHT}V${foot}C${-half / 2} ${foot} ${-half / 2} ${crest} 0 ${crest}S${half / 2} ${foot} ${half} ${foot}V${SHIP_HEIGHT}Z`
}

// The crest travels in the boat's own frame, so it reaches the boat on cue at any frame width
const swell = (level: number, height: number) => {
  const flat = humpPath(level, level + WAVE_AMPLITUDE)
  const full = humpPath(level, level - height)
  const center = BOAT_WIDTH / 2
  const [left, right] = [center - SWELL_REACH, center + SWELL_REACH]

  return `<g>
<animateTransform attributeName="transform" type="translate" values="${left} 0;${left} 0;${right} 0;${right} 0" ${swellClock([0, SWELL_START, SWELL_END, SWELL_SECONDS])}/>
<path d="${flat}" fill="${WATER}">
<animate attributeName="d" values="${flat};${flat};${full};${full};${flat};${flat}" ${swellTiming([0, SWELL_START, SWELL_BUILT, SWELL_FADING, SWELL_END, SWELL_SECONDS])}/>
</path>
</g>`
}

// A percentage of the frame less the boat's own width, in two animations on one clock
const drifting = (content: string) => `<svg overflow="visible">
<animate attributeName="x" values="0%;100%;0%" dur="${DRIFT_SECONDS}s" ${EASE}/>
<g>
<animateTransform attributeName="transform" type="translate" values="0 0;${-BOAT_WIDTH} 0;0 0" dur="${DRIFT_SECONDS}s" ${EASE}/>
${content}
</g>
</svg>`

const RIDE_START = SWELL_CREST - RIDE_SECONDS
const RIDE_END = SWELL_CREST + RIDE_SECONDS

const SKULL_FLAG = `<path d="M18 0.5H3.5Q2 5 3.5 10H18Z" fill="${FLAG}" stroke="${FLAG_EDGE}" stroke-width="0.5"/>
<circle cx="10.5" cy="6.4" r="2.5" fill="${BONE}"/>
<path d="M9.2 8.2H11.8V9.4H9.2Z" fill="${BONE}"/>
<circle cx="9.6" cy="6.5" r="0.6" fill="${FLAG}"/>
<circle cx="11.4" cy="6.5" r="0.6" fill="${FLAG}"/>
<path d="M8.3 4.6Q8.3 1.9 10.5 1.9Q12.7 1.9 12.7 4.6Z" fill="${STRAW}"/>
<path d="M8.3 4.1H12.7V4.8H8.3Z" fill="${RIBBON}"/>
<path d="M6.3 4.9Q10.5 3.9 14.7 4.9Q10.5 5.9 6.3 4.9Z" fill="${STRAW}"/>`

const PIRATE_SHIP = `<path d="M18 0V24M30 9V23" stroke="${TIMBER}" stroke-width="1.5" fill="none"/>
${SKULL_FLAG}
<path d="M9 11.5Q18 9.5 27 11.5Q29.5 16.5 27 21.5Q18 19.8 9 21.5Q11.5 16.5 9 11.5Z" fill="${CANVAS}" stroke="${SEAM}" stroke-width="0.6"/>
<path d="M31 10L38 20.5H31Z" fill="${CANVAS}" stroke="${SEAM}" stroke-width="0.6"/>
<path d="M1 18.5H9V22.5H30L39.5 19.5L35.5 30.5Q20 32.5 5 30.5Z" fill="${WOOD}" stroke="${TIMBER}" stroke-width="0.8"/>
<path d="M3.5 26.5Q20 28 36.8 26.5" stroke="${TIMBER}" stroke-width="0.7" fill="none"/>
<circle cx="12" cy="24.6" r="0.9" fill="${TIMBER}"/>
<circle cx="20" cy="24.8" r="0.9" fill="${TIMBER}"/>
<circle cx="28" cy="24.6" r="0.9" fill="${TIMBER}"/>`

const BOAT = `<g>
<animateTransform attributeName="transform" type="translate" values="0 ${BOAT_Y};0 ${BOAT_Y};0 ${BOAT_Y - RIDE_LIFT};0 ${BOAT_Y};0 ${BOAT_Y}" ${swellTiming([0, RIDE_START, SWELL_CREST, RIDE_END, SWELL_SECONDS])}/>
<g>
<animateTransform attributeName="transform" type="translate" values="0 ${-BOB};0 ${BOB};0 ${-BOB}" dur="${BOB_SECONDS}s" ${EASE}/>
<g>
<animateTransform attributeName="transform" type="rotate" values="${-ROCK_DEGREES} ${ROCK_X} ${ROCK_Y};${ROCK_DEGREES} ${ROCK_X} ${ROCK_Y};${-ROCK_DEGREES} ${ROCK_X} ${ROCK_Y}" dur="${ROCK_SECONDS}s" ${EASE}/>
<g>
<animateTransform attributeName="transform" type="rotate" values="0 ${ROCK_X} ${ROCK_Y};0 ${ROCK_X} ${ROCK_Y};${RIDE_DEGREES} ${ROCK_X} ${ROCK_Y};0 ${ROCK_X} ${ROCK_Y};${-RIDE_DEGREES} ${ROCK_X} ${ROCK_Y};0 ${ROCK_X} ${ROCK_Y};0 ${ROCK_X} ${ROCK_Y}" ${swellTiming([0, RIDE_START, SWELL_CREST - RIDE_SECONDS / 2, SWELL_CREST, SWELL_CREST + RIDE_SECONDS / 2, RIDE_END, SWELL_SECONDS])}/>
${PIRATE_SHIP}
</g>
</g>
</g>
</g>`

export const SHIP_ALT = 'A small wooden pirate ship under a straw-hat skull flag, floating and riding over a swell'

// The markup has no viewBox so its units stay CSS pixels at any frame width. The group opacity
// makes the back wave and its swell read as one body of water where they overlap
export const SHIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHIP_WIDTH}" height="${SHIP_HEIGHT}">
<g opacity="0.45">
${wave(BACK_LEVEL, WAVE_AMPLITUDE, 150, 30, false)}
${drifting(swell(BACK_LEVEL, BACK_SWELL))}
</g>
${drifting(BOAT)}
${wave(FRONT_LEVEL, WAVE_AMPLITUDE, 96, 16, true)}
${drifting(swell(FRONT_LEVEL, FRONT_SWELL))}
</svg>`
