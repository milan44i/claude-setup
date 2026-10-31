export type Decision = { id: string; title: string; reason: string }
export type Option = { label: string; consequence: string; isRecommended: boolean }
export type Explanation = { text: string; options: readonly Option[] }
export type Mark = { title: string; choice: string; consequence: string; time: string }
export type Queue = { marks: Readonly<Record<string, Mark>>; damaged: readonly string[] }

declare module 'claude-code' {
  interface PluginState {
    'decisions-band': {
      decisions: readonly Decision[]
      explained: Readonly<Record<string, Explanation>>
      queue: Queue
      focused: string
      sent: string
      continued: Readonly<Record<string, string>>
    }
  }
}
