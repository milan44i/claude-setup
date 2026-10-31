export type ReportedFailures = readonly string[]

declare module 'claude-code' {
  interface PluginState {
    'sound-deck': { reportedFailures: ReportedFailures }
  }
}
