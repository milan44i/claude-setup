export type Squawk = string | null

declare module 'claude-code' {
  interface PluginState {
    parrot: { squawk: Squawk }
  }
}
