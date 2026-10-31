export type Jobs = readonly string[]
export type SeaState = 'calm' | 'rough' | 'heavy' | 'storm'
export type Kraken = { id: string; line: string } | null

declare module 'claude-code' {
  interface PluginState {
    'calm-desktop-ship': {
      jobs: Jobs
      fill: SeaState
      hasRedChecks: boolean
      isNight: boolean
      kraken: Kraken
    }
  }
}
