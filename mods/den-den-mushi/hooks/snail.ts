export const SNAIL_MEANING =
  'Den Den Mushi is ringing because a client or prospect just mailed you, and your next prompt clears it.'
export const SNAIL_ALT = 'A snail phone wobbling as it rings'
export const SNAIL_WIDTH = 64
export const SNAIL_HEIGHT = 44

const WOBBLE_SECONDS = 0.28
const WOBBLE_DEGREES = 5
const PIVOT = '32px 41px'

const DIAL_X = 37
const DIAL_Y = 25
const DIAL_REACH = 8.5
const DIAL_HOLES = 8

// One mid tone per part reads on light and dark alike, as in calm-desktop-ship
const BODY = '#d8a15c'
const BODY_EDGE = '#8a5f2c'
const SHELL = '#b5473a'
const DIAL = '#efe6d2'
const HOLE = '#6e2a22'
const HANDSET = '#3a3f4a'

const holes = Array.from({ length: DIAL_HOLES }, (_, at) => {
  const angle = (2 * Math.PI * at) / DIAL_HOLES
  const x = (DIAL_X + DIAL_REACH * Math.cos(angle)).toFixed(1)
  const y = (DIAL_Y + DIAL_REACH * Math.sin(angle)).toFixed(1)

  return `<circle cx="${x}" cy="${y}" r="1.3" fill="${DIAL}"/>`
}).join('')

export const SNAIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SNAIL_WIDTH} ${SNAIL_HEIGHT}" width="${SNAIL_WIDTH}" height="${SNAIL_HEIGHT}">
<title>${SNAIL_MEANING}</title>
<style>
.snail{transform-origin:${PIVOT};animation:wobble ${WOBBLE_SECONDS}s ease-in-out infinite alternate}
@keyframes wobble{from{transform:rotate(-${WOBBLE_DEGREES}deg)}to{transform:rotate(${WOBBLE_DEGREES}deg)}}
</style>
<g class="snail">
<path d="M12 28 9 14M18 28 19 13" fill="none" stroke="${BODY_EDGE}" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="9" cy="12" r="2.6" fill="${BODY_EDGE}"/>
<circle cx="19" cy="11" r="2.6" fill="${BODY_EDGE}"/>
<path d="M5 37C5 29 10 25 15 25 20 25 22 29 24 32L50 32C56 32 60 36 61 40 61 41 60 42 59 42L9 42C6 42 5 40 5 37Z" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1"/>
<circle cx="${DIAL_X}" cy="${DIAL_Y}" r="13" fill="${SHELL}" stroke="${HOLE}" stroke-width="1"/>
${holes}
<circle cx="${DIAL_X}" cy="${DIAL_Y}" r="4" fill="${DIAL}" stroke="${HOLE}" stroke-width="1"/>
<path d="M26 8C30 3 44 3 48 8" fill="none" stroke="${HANDSET}" stroke-width="3.5"/>
<rect x="22" y="6" width="8" height="5" rx="2" fill="${HANDSET}"/>
<rect x="44" y="6" width="8" height="5" rx="2" fill="${HANDSET}"/>
</g>
</svg>`
