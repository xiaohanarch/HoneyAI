import { z } from 'zod'
import { parseFrontmatter, stringifyFrontmatter, type IRParseOutcome } from './shared.js'

export const DesignIRSchema = z.object({
  approach_summary: z.string().min(20),
  architecture_decisions: z
    .array(
      z.object({
        id: z.string().regex(/^ADR-\d+$/),
        title: z.string(),
        context: z.string(),
        decision: z.string(),
        consequences: z.string(),
        alternatives_considered: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  affected_components: z.array(z.string()).min(1),
  data_model_changes: z
    .array(
      z.object({
        table: z.string(),
        change: z.enum(['add_table', 'add_column', 'alter_column', 'drop_column', 'add_index']),
        detail: z.string(),
      }),
    )
    .default([]),
  api_changes: z
    .array(
      z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
        path: z.string(),
        change: z.enum(['add', 'modify', 'deprecate', 'remove']),
        detail: z.string(),
      }),
    )
    .default([]),
  task_graph: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        kind: z.enum(['code', 'test', 'doc', 'migration']),
        estimated_effort_lines: z.number().int().positive(),
      }),
    ),
    edges: z.array(z.object({ from: z.string(), to: z.string() })),
  }),
  test_strategy: z.object({
    unit: z.array(z.string()),
    integration: z.array(z.string()),
    e2e: z.array(z.string()),
  }),
  security_review: z.object({
    threats_considered: z.array(z.string()),
    mitigations: z.array(z.string()),
    requires_secrets: z.boolean(),
  }),
  rollout: z.object({
    strategy: z.enum(['big_bang', 'feature_flag', 'gradual']),
    rollback_plan: z.string(),
  }),
})

export type DesignIR = z.infer<typeof DesignIRSchema>

export function parseDesignIR(markdown: string): IRParseOutcome<DesignIR> {
  return parseFrontmatter(markdown, DesignIRSchema)
}

export function stringifyDesignIR(data: DesignIR, body: string): string {
  return stringifyFrontmatter(data, body)
}
