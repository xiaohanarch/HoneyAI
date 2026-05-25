import type { SpecAC } from './scan-spec.js'
import type { TestAC } from './scan-tests.js'

/** Summary of one AC's status across spec and test catalogues. */
export interface CoverageJson {
  /** Ids that appear in both spec and tests. */
  covered: string[]
  /** Ids that appear in spec but have no test. */
  missing: string[]
  /** Ids that appear in tests but are not defined in spec. */
  orphan: string[]
  /** Seed ACs that are missing — drives non-zero exit. */
  seedMissing: string[]
  /** Seed ACs that are covered — informational. */
  seedCovered: string[]
  /** Totals for quick scanning. */
  totals: {
    spec: number
    tests: number
    covered: number
    missing: number
    orphan: number
  }
}

export interface ReportInput {
  spec: Map<string, SpecAC>
  tests: Map<string, TestAC[]>
  /** Phase-1 seed ACs that must be 100% covered (exit-code gate). */
  seed: string[]
}

export interface ReportResult {
  markdown: string
  json: CoverageJson
  /** 0 if all seed ACs covered, 1 otherwise. */
  exitCode: 0 | 1
}

/** 3-state join of spec ↔ tests + seed-gated exit code + markdown table. */
export function report(input: ReportInput): ReportResult {
  const specIds = new Set(input.spec.keys())
  const testIds = new Set(input.tests.keys())
  const sortedAsc = (s: Iterable<string>): string[] => [...s].sort()

  const covered = sortedAsc([...specIds].filter((id) => testIds.has(id)))
  const missing = sortedAsc([...specIds].filter((id) => !testIds.has(id)))
  const orphan = sortedAsc([...testIds].filter((id) => !specIds.has(id)))

  const seedCovered = input.seed.filter((id) => testIds.has(id) && specIds.has(id))
  const seedMissing = input.seed.filter((id) => !testIds.has(id) || !specIds.has(id))

  const json: CoverageJson = {
    covered,
    missing,
    orphan,
    seedCovered,
    seedMissing,
    totals: {
      spec: specIds.size,
      tests: testIds.size,
      covered: covered.length,
      missing: missing.length,
      orphan: orphan.length,
    },
  }

  const markdown = renderMarkdown(json, input)
  const exitCode: 0 | 1 = seedMissing.length === 0 ? 0 : 1

  return { markdown, json, exitCode }
}

function renderMarkdown(json: CoverageJson, input: ReportInput): string {
  const lines: string[] = []
  lines.push('# AC Coverage Report', '')
  lines.push(`- spec ACs: **${json.totals.spec}**`)
  lines.push(`- test ACs: **${json.totals.tests}**`)
  lines.push(`- covered: **${json.totals.covered}**`)
  lines.push(`- missing: **${json.totals.missing}**`)
  lines.push(`- orphan: **${json.totals.orphan}**`)
  lines.push(`- seed covered: ${json.seedCovered.length}/${input.seed.length}`)
  if (json.seedMissing.length > 0) {
    lines.push(`- seed **missing**: ${json.seedMissing.join(', ')}`)
  }
  lines.push('')

  lines.push('## Covered', '')
  if (json.covered.length === 0) lines.push('_(none)_')
  else for (const id of json.covered) lines.push(`- ${id}`)
  lines.push('')

  lines.push('## Missing (spec without tests)', '')
  if (json.missing.length === 0) lines.push('_(none)_')
  else
    for (const id of json.missing) {
      const where = input.spec.get(id)
      lines.push(`- ${id} — \`${where?.file ?? '?'}:${where?.line ?? '?'}\``)
    }
  lines.push('')

  lines.push('## Orphan (tests without spec)', '')
  if (json.orphan.length === 0) lines.push('_(none)_')
  else
    for (const id of json.orphan) {
      const occurrences = input.tests.get(id) ?? []
      const first = occurrences[0]
      lines.push(`- ${id} — \`${first?.file ?? '?'}:${first?.line ?? '?'}\``)
    }
  lines.push('')

  return lines.join('\n')
}
