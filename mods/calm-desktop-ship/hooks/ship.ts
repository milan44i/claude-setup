import type { SeaState } from '../types'

// The app clamps the frame to the band, so an oversized width makes it fill the text column
export const SHIP_WIDTH = 4096
export const SHIP_HEIGHT = 46
const DRIFT_SECONDS = 200

const BOAT_WIDTH = 40
const BOAT_Y = 10.5
const ROCK_X = 20
const ROCK_Y = 26

const BACK_LEVEL = 39.5
const FRONT_LEVEL = 41

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

const KRAKEN_SECONDS = 30

const SPLINE = '.45 0 .55 1'
const EASE = `calcMode="spline" keyTimes="0;.5;1" keySplines="${SPLINE};${SPLINE}" repeatCount="indefinite"`

// One mid tone per part reads on light and dark alike, since prefers-color-scheme in the
// sandboxed frame need not match the theme the app is set to
const WATER = '#5769f7'
const STORM_WATER = '#4a5578'
const NIGHT_WATER = '#2c3a86'
const WOOD = '#a86b36'
const TIMBER = '#7a4e28'
const CANVAS = '#eadfc6'
const SEAM = '#8a7654'
const FLAG = '#1c1c1c'
const FLAG_EDGE = '#d9d2c0'
const BONE = '#f4f1e8'
const STRAW = '#e8b93a'
const RIBBON = '#d0312d'
const FLAME = '#ffb02e'
const RAIN = '#9fb0d0'
const BOLT = '#ffe680'
const KRAKEN = '#8a3f9e'
const SUCKER = '#e3b7ec'

export type Scene = { sea: SeaState; isNight: boolean; hasKraken: boolean }

const SEAS = {
  calm: { amplitude: 1, backSeconds: 30, frontSeconds: 16, bob: 0.8, bobSeconds: 3.7, rock: 3, rockSeconds: 5.3 },
  rough: { amplitude: 2, backSeconds: 20, frontSeconds: 11, bob: 1.3, bobSeconds: 2.8, rock: 6, rockSeconds: 4 },
  heavy: { amplitude: 3.2, backSeconds: 13, frontSeconds: 7, bob: 1.9, bobSeconds: 2.1, rock: 10, rockSeconds: 3 },
  storm: { amplitude: 4.5, backSeconds: 9, frontSeconds: 5, bob: 2.6, bobSeconds: 1.6, rock: 14, rockSeconds: 2.2 },
} as const

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
  water: string,
) => {
  const [from, to] = isRightward ? [0, wavelength] : [wavelength, 0]

  return `<path d="${wavePath(level, amplitude, wavelength)}" fill="${water}">
<animateTransform attributeName="transform" type="translate" from="${from} 0" to="${to} 0" dur="${seconds}s" repeatCount="indefinite"/>
</path>`
}

// The hump's foot sits below the wave's trough, so it rises out of the water with no step at its edges
const humpPath = (level: number, crest: number, amplitude: number) => {
  const half = SWELL_HALF_WIDTH
  const foot = level + amplitude

  return `M${-half} ${SHIP_HEIGHT}V${foot}C${-half / 2} ${foot} ${-half / 2} ${crest} 0 ${crest}S${half / 2} ${foot} ${half} ${foot}V${SHIP_HEIGHT}Z`
}

// The crest travels in the boat's own frame, so it reaches the boat on cue at any frame width
const swell = (level: number, height: number, amplitude: number, water: string) => {
  const flat = humpPath(level, level + amplitude, amplitude)
  const full = humpPath(level, level - height, amplitude)
  const center = BOAT_WIDTH / 2
  const [left, right] = [center - SWELL_REACH, center + SWELL_REACH]

  return `<g>
<animateTransform attributeName="transform" type="translate" values="${left} 0;${left} 0;${right} 0;${right} 0" ${swellClock([0, SWELL_START, SWELL_END, SWELL_SECONDS])}/>
<path d="${flat}" fill="${water}">
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

const LANTERN = `<title>This lantern is the night watch, lit from 20:00 to 06:00 local time.</title>
<circle cx="4.5" cy="14" r="6" fill="${FLAME}" opacity="0.35">
<animate attributeName="opacity" values="0.25;0.5;0.3;0.55;0.25" dur="2.3s" repeatCount="indefinite"/>
</circle>
<path d="M4.5 18.5V11.5" stroke="${TIMBER}" stroke-width="0.8" fill="none"/>
<path d="M3 12.5H6V15.5H3Z" fill="${FLAME}" stroke="${TIMBER}" stroke-width="0.5"/>`

const boat = ({ sea, isNight }: Scene) => {
  const { bob, bobSeconds, rock, rockSeconds } = SEAS[sea]
  // A taller bob takes the same height off the ride, so the flag stays inside the frame
  const crest = BOAT_Y - RIDE_LIFT + (bob - SEAS.calm.bob)

  return `<g>
<animateTransform attributeName="transform" type="translate" values="0 ${BOAT_Y};0 ${BOAT_Y};0 ${crest};0 ${BOAT_Y};0 ${BOAT_Y}" ${swellTiming([0, RIDE_START, SWELL_CREST, RIDE_END, SWELL_SECONDS])}/>
<g>
<animateTransform attributeName="transform" type="translate" values="0 ${-bob};0 ${bob};0 ${-bob}" dur="${bobSeconds}s" ${EASE}/>
<g>
<animateTransform attributeName="transform" type="rotate" values="${-rock} ${ROCK_X} ${ROCK_Y};${rock} ${ROCK_X} ${ROCK_Y};${-rock} ${ROCK_X} ${ROCK_Y}" dur="${rockSeconds}s" ${EASE}/>
<g>
<animateTransform attributeName="transform" type="rotate" values="0 ${ROCK_X} ${ROCK_Y};0 ${ROCK_X} ${ROCK_Y};${RIDE_DEGREES} ${ROCK_X} ${ROCK_Y};0 ${ROCK_X} ${ROCK_Y};${-RIDE_DEGREES} ${ROCK_X} ${ROCK_Y};0 ${ROCK_X} ${ROCK_Y};0 ${ROCK_X} ${ROCK_Y}" ${swellTiming([0, RIDE_START, SWELL_CREST - RIDE_SECONDS / 2, SWELL_CREST, SWELL_CREST + RIDE_SECONDS / 2, RIDE_END, SWELL_SECONDS])}/>
${PIRATE_SHIP}
${isNight ? `<g>${LANTERN}</g>` : ''}
</g>
</g>
</g>
</g>`
}

// It rises, grips the hull and sinks on its own clock, ending hidden below the frame
const TENTACLE = `<g>
<title>The Kraken grips the ship for 30 seconds when one tool result passes about 10k tokens.</title>
<animateTransform attributeName="transform" type="translate" values="0 32;0 0;0 0;0 32" keyTimes="0;.06;.94;1" dur="${KRAKEN_SECONDS}s" fill="freeze"/>
<g>
<animateTransform attributeName="transform" type="rotate" values="-5 30 46;5 30 46;-5 30 46" dur="2.6s" ${EASE}/>
<path d="M31 46C37 36 35 25 26 22" stroke="${KRAKEN}" stroke-width="3.6" stroke-linecap="round" fill="none"/>
<path d="M26 22C20 20 13 23 14 28C14.6 31 18.5 30.5 18 27.5" stroke="${KRAKEN}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
<circle cx="33.6" cy="36" r="0.8" fill="${SUCKER}"/>
<circle cx="33" cy="30" r="0.8" fill="${SUCKER}"/>
<circle cx="29.6" cy="25.2" r="0.7" fill="${SUCKER}"/>
<circle cx="23" cy="21.8" r="0.6" fill="${SUCKER}"/>
<circle cx="17" cy="23.2" r="0.6" fill="${SUCKER}"/>
</g>
</g>`

const RAIN_PATTERN = `<defs>
<pattern id="rain" width="26" height="46" patternUnits="userSpaceOnUse">
<animateTransform attributeName="patternTransform" type="translate" from="0 0" to="-13 46" dur="0.7s" repeatCount="indefinite"/>
<path d="M22 2L20 8M9 14L7 20M18 27L16 33M4 36L2 42" stroke="${RAIN}" stroke-width="0.8"/>
</pattern>
</defs>
<rect width="${SHIP_WIDTH}" height="${SHIP_HEIGHT}" fill="url(#rain)"/>`

const LIGHTNING = `<svg x="68%" overflow="visible">
<path d="M12 0L4 15H10L5 30L19 11H12L17 0Z" fill="${BOLT}" opacity="0">
<animate attributeName="opacity" values="0;0;1;0.1;1;0;0" keyTimes="0;.7;.71;.73;.75;.78;1" dur="7s" repeatCount="indefinite"/>
</path>
</svg>`

const waterOf = ({ sea, isNight }: Scene) => {
  if (isNight) return NIGHT_WATER

  return sea === 'storm' ? STORM_WATER : WATER
}

const SEA_TITLES = {
  calm: 'This ship shows the session, and the sea is calm because the context is under 60 percent full.',
  rough: 'This ship shows the session, and the sea is rough because the context is at least 60 percent full.',
  heavy: 'This ship shows the session, and the sea is heavy because the context is at least 80 percent full.',
  storm: 'This ship shows the session, and the storm means a recorded PR has a failing check.',
} as const

const seaWords = { calm: 'a calm sea', rough: 'a rough sea', heavy: 'a heavy sea', storm: 'a storm' } as const

export const shipAlt = ({ sea, isNight, hasKraken }: Scene) =>
  [
    `A small wooden pirate ship under a straw-hat skull flag, floating on ${seaWords[sea]} and riding over a swell`,
    isNight ? ', its lantern lit on a dark sea' : '',
    hasKraken ? ', a tentacle gripping its hull' : '',
  ].join('')

// The markup has no viewBox so its units stay CSS pixels at any frame width. The group opacity
// makes the back wave and its swell read as one body of water where they overlap
export const shipSvg = (scene: Scene) => {
  const { amplitude, backSeconds, frontSeconds } = SEAS[scene.sea]
  const water = waterOf(scene)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHIP_WIDTH}" height="${SHIP_HEIGHT}">
<title>${SEA_TITLES[scene.sea]}</title>
<rect width="${SHIP_WIDTH}" height="${SHIP_HEIGHT}" fill="transparent"/>
${scene.sea === 'storm' ? `${RAIN_PATTERN}\n${LIGHTNING}` : ''}
<g opacity="0.45">
${wave(BACK_LEVEL, amplitude, 150, backSeconds, false, water)}
${drifting(swell(BACK_LEVEL, BACK_SWELL, amplitude, water))}
</g>
${drifting(boat(scene))}
${scene.hasKraken ? drifting(TENTACLE) : ''}
${wave(FRONT_LEVEL, amplitude, 96, frontSeconds, true, water)}
${drifting(swell(FRONT_LEVEL, FRONT_SWELL, amplitude, water))}
</svg>`
}
