import { z } from 'zod'
import { PrioritySchema, ComplexitySchema, RiskLevelSchema } from './shared.js'

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
