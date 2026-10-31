export type Ringing = readonly string[]

declare module 'claude-code' {
  interface PluginState {
    'den-den-mushi': { ringing: Ringing }
  }
}
