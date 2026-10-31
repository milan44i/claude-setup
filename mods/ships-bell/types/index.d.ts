export type Decisions = readonly string[] | null

declare module 'claude-code' {
  interface PluginState {
    'ships-bell': { decisions: Decisions; captainAsked: boolean }
  }
}
