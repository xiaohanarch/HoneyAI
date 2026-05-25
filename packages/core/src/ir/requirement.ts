import { z } from 'zod'
import {
  PrioritySchema,
  ComplexitySchema,
  RiskLevelSchema,
  parseFrontmatter,
  stringifyFrontmatter,
  type IRParseOutcome,
  type IRParseWarning,
} from './shared.js'

export const RequirementIRSchema = z.object({
  title: z.string().min(1).max(200),
  one_liner: z.string().min(5).max(500),
  priority: PrioritySchema,
  estimated_complexity: ComplexitySchema,
  in_scope: z.array(z.string()).min(1),
  out_of_scope: z.array(z.string()),
  success_criteria: z.array(z.string()).min(1),
  constraints: z
    .array(
      z.object({
        kind: z.enum(['tech', 'business', 'compliance', 'perf']),
        statement: z.string(),
      }),
    )
    .default([]),
  risks: z
    .array(
      z.object({
        description: z.string(),
        likelihood: RiskLevelSchema,
        impact: RiskLevelSchema,
        mitigation: z.string().optional(),
      }),
    )
    .default([]),
  impact_surface: z.array(z.string()).default([]),
  related: z
    .array(
      z.object({
        kind: z.enum(['issue', 'pr', 'doc']),
        url: z.string().url(),
      }),
    )
    .default([]),
})

export type RequirementIR = z.infer<typeof RequirementIRSchema>

export const REQUIRED_REQUIREMENT_SECTIONS = [
  '背景',
  '用户故事',
  '验收标准明细',
  '开放问题',
] as const

function findMissingSections(body: string, required: readonly string[]): IRParseWarning[] {
  const headings = new Set<string>()
  for (const match of body.matchAll(/^##\s+(.+?)\s*$/gm)) {
    if (match[1]) headings.add(match[1].trim())
  }
  return required
    .filter((s) => !headings.has(s))
    .map<IRParseWarning>((s) => ({ kind: 'missing_section', section: s }))
}

export function parseRequirementIR(markdown: string): IRParseOutcome<RequirementIR> {
  const base = parseFrontmatter(markdown, RequirementIRSchema)
  if (!base.ok) return base
  const warnings = findMissingSections(base.body, REQUIRED_REQUIREMENT_SECTIONS)
  return { ...base, warnings }
}

export function stringifyRequirementIR(data: RequirementIR, body: string): string {
  return stringifyFrontmatter(data, body)
}
