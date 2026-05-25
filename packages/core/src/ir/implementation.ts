import { z } from 'zod'
import {
  parseFrontmatter,
  stringifyFrontmatter,
  FindingSeveritySchema,
  type IRParseOutcome,
} from './shared.js'

export const ImplementationIRSchema = z.object({
  pr: z.object({
    title: z.string().max(72),
    body: z.string(),
    branch: z.string(),
    base: z.string().default('main'),
    draft: z.boolean().default(false),
  }),
  commits: z.array(
    z.object({
      sha: z.string().length(40),
      message: z.string(),
      files_changed: z.number().int().nonnegative(),
    }),
  ),
  files_changed: z.array(
    z.object({
      path: z.string(),
      change: z.enum(['add', 'modify', 'delete', 'rename']),
      additions: z.number().int().nonnegative(),
      deletions: z.number().int().nonnegative(),
    }),
  ),
  tests: z.object({
    added: z.array(z.string()),
    modified: z.array(z.string()),
    coverage_pct: z.number().min(0).max(100).optional(),
  }),
  quality_gates: z.object({
    lint: z.enum(['pass', 'fail', 'skipped']),
    typecheck: z.enum(['pass', 'fail', 'skipped']),
    build: z.enum(['pass', 'fail', 'skipped']),
    security_scan: z.enum(['pass', 'fail', 'skipped']),
    findings: z
      .array(
        z.object({
          severity: FindingSeveritySchema,
          rule: z.string(),
          file: z.string(),
          line: z.number().int().positive(),
          message: z.string(),
        }),
      )
      .default([]),
  }),
  ai_self_review: z.object({
    confidence: z.enum(['low', 'medium', 'high']),
    known_limitations: z.array(z.string()),
    suggested_human_review: z.array(z.string()),
  }),
  task_completion: z.array(
    z.object({
      task_id: z.string(),
      status: z.enum(['done', 'partial', 'skipped']),
      notes: z.string().optional(),
    }),
  ),
  links: z.object({
    pr_url: z.string().url().optional(),
    commit_urls: z.array(z.string().url()).default([]),
  }),
})

export type ImplementationIR = z.infer<typeof ImplementationIRSchema>

export function parseImplementationIR(markdown: string): IRParseOutcome<ImplementationIR> {
  return parseFrontmatter(markdown, ImplementationIRSchema)
}

export function stringifyImplementationIR(data: ImplementationIR, body: string): string {
  return stringifyFrontmatter(data, body)
}
