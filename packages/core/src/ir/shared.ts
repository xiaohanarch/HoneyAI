import matter from 'gray-matter'
import { z } from 'zod'

// Reusable enums (spec 04 §2.1 / §3.1 / §4.1)
export const PrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3'])
export type Priority = z.infer<typeof PrioritySchema>

export const ComplexitySchema = z.enum(['XS', 'S', 'M', 'L', 'XL'])
export type Complexity = z.infer<typeof ComplexitySchema>

export const RiskLevelSchema = z.enum(['low', 'medium', 'high'])
export type RiskLevel = z.infer<typeof RiskLevelSchema>

export const FindingSeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>

// Parse outcome — discriminated union; spec §10 dictates ZodError path-aware reporting upstream.
export type IRParseWarning = { kind: 'missing_section'; section: string }

export type IRParseOk<T> = {
  ok: true
  data: T
  body: string
  warnings: IRParseWarning[]
}

export type IRParseErr = {
  ok: false
  error: z.ZodError
  body: string
}

export type IRParseOutcome<T> = IRParseOk<T> | IRParseErr

/**
 * Internal helper: gray-matter to split YAML frontmatter + body, then zod-validate frontmatter.
 * Returns IRParseOutcome with `warnings: []` — IR-specific callers append section warnings.
 * Throws if gray-matter cannot parse YAML at all.
 */
export function parseFrontmatter<S extends z.ZodTypeAny>(
  markdown: string,
  schema: S,
): IRParseOutcome<z.infer<S>> {
  const parsed = matter(markdown)
  const result = schema.safeParse(parsed.data)
  if (result.success) {
    return { ok: true, data: result.data, body: parsed.content, warnings: [] }
  }
  return { ok: false, error: result.error, body: parsed.content }
}

/**
 * Internal helper: re-emit YAML frontmatter + body as a single markdown document.
 * Callers are expected to have zod-validated `data` already (per ADR-024).
 */
export function stringifyFrontmatter(data: unknown, body: string): string {
  return matter.stringify(body, data as object)
}
