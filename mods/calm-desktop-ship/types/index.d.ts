export type Jobs = readonly string[]

declare module 'claude-code' {
  interface PluginState {
    'calm-desktop-ship': { jobs: Jobs }
  }
}
