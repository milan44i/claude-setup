export type Tally = { prs: number | null; invoices: number | null }

declare module 'claude-code' {
  interface PluginState {
    'wanted-poster': { tally: Tally | null }
  }
}
