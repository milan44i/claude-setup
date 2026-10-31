export type Walking = string | null

declare module 'claude-code' {
  interface PluginState {
    'walk-the-plank': { walking: Walking }
  }
}
