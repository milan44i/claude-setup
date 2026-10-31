export type Deadline = { name: string; due: string }

declare module 'claude-code' {
  interface PluginState {
    'log-pose': { obligations: readonly Deadline[]; tasks: readonly Deadline[] }
  }
}
