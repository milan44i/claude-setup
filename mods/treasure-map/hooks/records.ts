import type { Island, Stage } from '../types'

const RANK: Record<Stage, number> = { lead: 0, demo: 1, offer: 2, paid: 3 }

const TEST_ENTRY = /^test( \d+)?$/i

// The rows before the first ad are build-week test submissions, per the studio repo's DEPLOY.md
const FIRST_AD = '2026-09-28'

const TIED = (condition: string) =>
  `EXISTS (SELECT 1 FROM lead_zahtevi lz JOIN zahtevi z ON z.id = lz.zahtev_id WHERE lz.lead_id = l.id AND ${condition})`

export const REQUESTS_SQL = `SELECT naziv AS name, demo_poslat_at IS NOT NULL AS demo, placeno_at IS NOT NULL AS paid
FROM zahtevi
WHERE created_at >= '${FIRST_AD}' AND bez_demoa_at IS NULL AND id NOT IN (SELECT zahtev_id FROM lead_zahtevi)
UNION ALL
SELECT l.ime,
  l.demo_poslat_at IS NOT NULL OR ${TIED('z.demo_poslat_at IS NOT NULL')},
  l.placeno_at IS NOT NULL OR ${TIED('z.placeno_at IS NOT NULL')}
FROM leadovi l
WHERE l.ishod <> 'odbili' AND (
  l.ishod = 'prihvatili' OR l.demo_poslat_at IS NOT NULL OR l.placeno_at IS NOT NULL
  OR ${TIED('z.bez_demoa_at IS NULL')}
)`

// potpis-prodaja's own reader, because its AGENTS.md forbids another parser of the PIPELINE tables
export const PIPELINE_SCRIPT = `import { citajSveRedove } from './src/pipeline-upis.mjs'
const open = citajSveRedove().filter(row => !row.arhiva && row.ishod.toLowerCase() === 'prihvatili')
console.log(JSON.stringify(open.map(row => ({ name: row.ime, hasDemo: row.demo.startsWith('http') }))))`

const requestIslands = (stdout: string): Island[] => {
  const [{ results }] = JSON.parse(stdout) as [
    { results: { name: string; demo: number; paid: number }[] },
  ]

  return results.map(({ name, demo, paid }) => ({
    name,
    stage: paid ? 'paid' : demo ? 'demo' : 'lead',
  }))
}

const pipelineIslands = (stdout: string): Island[] =>
  (JSON.parse(stdout) as { name: string; hasDemo: boolean }[]).map(({ name, hasDemo }) => ({
    name,
    stage: hasDemo ? 'demo' : 'lead',
  }))

const clientIslands = (stdout: string): Island[] =>
  (JSON.parse(stdout) as { name: string; paid: unknown[] }[])
    .filter(client => client.paid.length > 0)
    .map(({ name }) => ({ name, stage: 'paid' }))

const documentIslands = (stdout: string): Island[] =>
  (JSON.parse(stdout) as { type: string; status: string; client_name: string }[]).flatMap(
    ({ type, status, client_name: name }): Island[] => {
      if (type === 'invoice' && status === 'paid') return [{ name, stage: 'paid' }]
      if (type === 'proforma' && status === 'sent') return [{ name, stage: 'offer' }]

      return []
    },
  )

const PAUSAL = ['npm', 'run', '-s', 'pausal', '--']

export const SOURCES = [
  {
    label: 'site requests',
    cwd: 'work/potpis/studio',
    argv: ['npx', 'wrangler', 'd1', 'execute', 'potpis-studio-db', '--remote', '--json', '--command', REQUESTS_SQL],
    parse: requestIslands,
  },
  {
    label: 'outreach pipeline',
    cwd: 'work/potpis/alati/potpis-prodaja',
    argv: ['node', '--input-type=module', '-e', PIPELINE_SCRIPT],
    parse: pipelineIslands,
  },
  {
    label: 'paušal clients',
    cwd: 'work/potpis/posao/pausal',
    argv: [...PAUSAL, 'clients', 'list', '--archived'],
    parse: clientIslands,
  },
  {
    label: 'paušal documents',
    cwd: 'work/potpis/posao/pausal',
    argv: [...PAUSAL, 'docs', 'list'],
    parse: documentIslands,
  },
]

const cleanName = (name: string) =>
  name
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const nameKey = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')

export const plot = (sightings: readonly Island[]): Island[] => {
  const islands = new Map<string, Island>()

  for (const { name, stage } of sightings) {
    const clean = cleanName(name)
    const key = nameKey(clean)
    const known = islands.get(key)

    if (key !== '' && !TEST_ENTRY.test(clean) && (!known || RANK[stage] > RANK[known.stage])) {
      islands.set(key, { name: known?.name ?? clean, stage })
    }
  }

  return [...islands.values()].sort((a, b) => a.name.localeCompare(b.name))
}
