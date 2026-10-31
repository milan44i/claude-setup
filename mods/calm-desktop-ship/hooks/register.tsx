import type { EngineInterface, Register } from 'claude-code'

import { SHIP_ALT, SHIP_HEIGHT, SHIP_SVG, SHIP_WIDTH } from './ship'

// fs.exists comes first because a rejected stat is an error in the debug log, once per drawing
const isHome = async ($: EngineInterface, root: string) => {
  if (!(await $.fs.exists(`${root}/bin/fm-crew-state.sh`))) return false

  const state = await $.fs.stat(`${root}/state`).catch(() => undefined)

  return state?.kind === 'dir'
}

const isCalmOn = async ($: EngineInterface) => {
  if ((await $.env.get('CLAUDE_CODE_ENABLE_FUNCTION_HOOKS')) !== '1') return false

  const root = await $.session.root()
  const preference = `${root}/config/calm`

  return (
    (await isHome($, root)) &&
    (await $.fs.exists(preference)) &&
    (await $.fs.read(preference)).trim() === 'on'
  )
}

export const register: Register = on => {
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || !(await isCalmOn($))) return next(e)

    const { Svg } = $.ui.resolve(e)

    return <Svg source={SHIP_SVG} alt={SHIP_ALT} width={SHIP_WIDTH} height={SHIP_HEIGHT} isInteractive />
  })
}
