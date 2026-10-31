export type Stage = 'lead' | 'demo' | 'offer' | 'paid'

export type Island = { name: string; stage: Stage }

export type Survey = { islands: readonly Island[]; missing: readonly string[] }

declare module 'claude-code' {
  interface PluginState {
    'treasure-map': { survey: Survey | null }
  }
}
