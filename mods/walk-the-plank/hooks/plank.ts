export const SCENE_WIDTH = 560
export const SCENE_HEIGHT = 64

const MAX_CHARACTERS = 60
const CHARACTER_WIDTH = 7.2
const FONT_SIZE = 12

const PLANK_END = 440
const PLANK_Y = 34
const TEXT_START = 8
const LEAD_OVER_EDGE = 10
const SHORTEST_WALK = 24
const WATER_Y = 52
const FALL_X = 40
const TIP_DEGREES = 25

const WALK_SECONDS = 3
const STEP_SECONDS = 0.5
const FALL_SECONDS = 1.1
const FADE_SECONDS = 0.5
const SPLASH_SECONDS = 1

// One mid tone per part reads on light and dark alike
const WATER = '#5769f7'
const WOOD = '#a86b36'
const TIMBER = '#7a4e28'
const SENTENCE = '#d0312d'
const FOAM = '#c8d0ff'

const POPOVER = 'Walk the plank stopped a commit or PR text with a dash or AI slop, and Claude has to rewrite this sentence.'

const CONTROLS = /[\u0000-\u001f\u007f-\u009f]+/g

const escapeXml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export const shortened = (sentence: string) => {
  const line = sentence.replace(CONTROLS, ' ').replace(/\s+/g, ' ').trim()

  return line.length > MAX_CHARACTERS ? `${line.slice(0, MAX_CHARACTERS - 3)}...` : line
}

const splash = (rx: number, ry: number, delay: number) => {
  const begin = WALK_SECONDS + FALL_SECONDS + delay

  return `<ellipse cx="${PLANK_END + 40}" cy="${WATER_Y}" rx="0" ry="0" fill="none" stroke="${FOAM}" stroke-width="1.5">
<animate attributeName="rx" from="0" to="${rx}" begin="${begin}s" dur="${SPLASH_SECONDS}s" fill="freeze"/>
<animate attributeName="ry" from="0" to="${ry}" begin="${begin}s" dur="${SPLASH_SECONDS}s" fill="freeze"/>
<animate attributeName="opacity" from="1" to="0" begin="${begin}s" dur="${SPLASH_SECONDS}s" fill="freeze"/>
</ellipse>`
}

export const plankAlt = (sentence: string) => `A sentence walks off a plank into the sea: ${shortened(sentence)}`

export const plankSvg = (sentence: string) => {
  const line = shortened(sentence)
  const walk = Math.max(SHORTEST_WALK, PLANK_END + LEAD_OVER_EDGE - TEXT_START - line.length * CHARACTER_WIDTH)
  const tipX = PLANK_END - walk
  const fall = SCENE_HEIGHT - PLANK_Y
  const steps = Math.round(WALK_SECONDS / STEP_SECONDS)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}" width="${SCENE_WIDTH}" height="${SCENE_HEIGHT}">
<title>${POPOVER}</title>
<rect x="0" y="${WATER_Y}" width="${SCENE_WIDTH}" height="${SCENE_HEIGHT - WATER_Y}" fill="${WATER}" opacity="0.6"/>
<path d="M60 ${PLANK_Y}V${WATER_Y}M140 ${PLANK_Y}V${WATER_Y}" stroke="${TIMBER}" stroke-width="4"/>
<rect x="0" y="${PLANK_Y}" width="${PLANK_END}" height="5" rx="1" fill="${WOOD}" stroke="${TIMBER}" stroke-width="0.8"/>
<g>
<animateTransform attributeName="transform" type="translate" from="0 0" to="${walk} 0" dur="${WALK_SECONDS}s" fill="freeze"/>
<g>
<animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur="${STEP_SECONDS}s" repeatCount="${steps}"/>
<g>
<animateTransform attributeName="transform" type="translate" from="0 0" to="${FALL_X} ${fall}" begin="${WALK_SECONDS}s" dur="${FALL_SECONDS}s" fill="freeze"/>
<animateTransform attributeName="transform" type="rotate" additive="sum" from="0 ${tipX} ${PLANK_Y}" to="${TIP_DEGREES} ${tipX} ${PLANK_Y}" begin="${WALK_SECONDS}s" dur="${FALL_SECONDS}s" fill="freeze"/>
<animate attributeName="opacity" from="1" to="0" begin="${WALK_SECONDS + FALL_SECONDS - FADE_SECONDS}s" dur="${FADE_SECONDS}s" fill="freeze"/>
<text x="${TEXT_START}" y="${PLANK_Y - 5}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="${FONT_SIZE}" fill="${SENTENCE}">${escapeXml(line)}</text>
</g>
</g>
</g>
${splash(34, 6, 0)}
${splash(20, 4, 0.25)}
</svg>`
}
