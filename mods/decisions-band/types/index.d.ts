export type Decision = { id: string; title: string; reason: string }
export type Option = { label: string; consequence: string; isRecommended: boolean }
export type Explanation = { text: string; options: readonly Option[] }
export type Mark = { choice: string; consequence: string }

declare module 'claude-code' {
  interface PluginState {
    'decisions-band': {
      decisions: readonly Decision[]
      explained: Readonly<Record<string, Explanation>>
      marks: Readonly<Record<string, Mark>>
      sent: string
    }
  }
}
