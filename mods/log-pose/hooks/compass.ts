export const COMPASS_SIZE = 20

export const COMPASS_ALT = 'A small compass with a swinging needle'

export const COMPASS_GLYPH = '🧭'

const COMPASS_CELLS = 3

export const POPOVER = {
  position: 'absolute',
  top: 0,
  left: COMPASS_CELLS,
  right: 0,
  display: 'none',
  hover: { display: 'flex' },
  backgroundColor: 'text',
} as const

export const COMPASS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${COMPASS_SIZE}" height="${COMPASS_SIZE}" viewBox="0 0 20 20">
<style>
@keyframes swing { from { transform: rotate(-18deg) } to { transform: rotate(18deg) } }
.needle { transform-origin: 10px 10px; animation: swing 2.6s ease-in-out infinite alternate }
</style>
<circle cx="10" cy="10" r="8.5" fill="none" stroke="#b08d57" stroke-width="1.5"/>
<path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2" stroke="#b08d57" stroke-width="1"/>
<g class="needle">
<path d="M10 3.5 12 10H8z" fill="#c8452f"/>
<path d="M10 16.5 12 10H8z" fill="#8a8f98"/>
</g>
<circle cx="10" cy="10" r="1" fill="#b08d57"/>
</svg>`
