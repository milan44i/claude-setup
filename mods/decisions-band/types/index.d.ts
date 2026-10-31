export type Decision = { id: string; title: string; reason: string }

declare module 'claude-code' {
  interface PluginState {
    'decisions-band': { decisions: readonly Decision[]; explanations: Readonly<Record<string, string>> }
  }
}
