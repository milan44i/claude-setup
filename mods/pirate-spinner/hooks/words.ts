const THINKING = 'Luffy is thinking about meat'
const ANY_OTHER_TOOL = 'Chopper is mixing a remedy'

const WORDS = new Map([
  ['Read', 'Robin is deciphering a poneglyph'],
  ['Grep', 'Usopp is scanning the horizon'],
  ['Glob', 'Usopp is scanning the horizon'],
  ['Edit', 'Franky is welding the hull'],
  ['Write', 'Franky is welding the hull'],
  ['NotebookEdit', 'Franky is welding the hull'],
  ['WebSearch', 'Nami is charting a course'],
  ['WebFetch', 'Nami is charting a course'],
  ['Agent', 'Luffy is rallying the crew'],
  ['Workflow', 'Luffy is rallying the crew'],
  ['Skill', 'Brook is tuning his violin'],
  ['Monitor', 'Jinbe is reading the currents'],
])

export const wordFor = (tool: string | undefined) => {
  if (tool === undefined) return THINKING

  return WORDS.get(tool) ?? ANY_OTHER_TOOL
}

export const hintFor = (tool: string | undefined) =>
  tool === undefined
    ? 'The pirate spinner names a crewmate per job, and this one means Claude is thinking.'
    : `The pirate spinner names a crewmate per job, and this one means ${tool} is running.`
