export type CrewState =
  | 'blocked'
  | 'parked'
  | 'failed'
  | 'working'
  | 'paused'
  | 'done'
  | 'unknown'

export type CrewRow = {
  id: string
  project: string
  state: CrewState
  line: string
  pr?: string
}

declare module 'claude-code' {
  interface PluginState {
    'crew-panel': { rows: CrewRow[] }
  }
}
