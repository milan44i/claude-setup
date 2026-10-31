export type Running = readonly { id: string; tool: string }[]

declare module 'claude-code' {
  interface PluginState {
    'pirate-spinner': { running: Running }
  }
}
