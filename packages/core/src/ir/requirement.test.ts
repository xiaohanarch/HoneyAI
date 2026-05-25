import { describe, it, expect } from 'vitest'
import { RequirementIRSchema } from './requirement.js'

const validFrontmatter = {
  title: 'Add /health detailed status',
  one_liner: 'GET /health returns 200 + {db, redis}',
  priority: 'P2',
  estimated_complexity: 'XS',
  in_scope: ['修改 /health 路由', '加 db ping'],
  out_of_scope: ['鉴权'],
  success_criteria: ['GET /health 始终返回 200'],
  constraints: [],
  risks: [],
  impact_surface: [],
  related: [],
}

describe('RequirementIRSchema', () => {
  it('accepts a valid frontmatter object', () => {
    const r = RequirementIRSchema.safeParse(validFrontmatter)
    expect(r.success).toBe(true)
  })

  it('rejects when title is missing', () => {
    const { title: _omit, ...rest } = validFrontmatter
    const r = RequirementIRSchema.safeParse(rest)
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'title')).toBe(true)
    }
  })

  it('rejects priority outside P0..P3', () => {
    const r = RequirementIRSchema.safeParse({ ...validFrontmatter, priority: 'P9' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'priority')).toBe(true)
    }
  })

  it('rejects empty in_scope (min 1)', () => {
    const r = RequirementIRSchema.safeParse({ ...validFrontmatter, in_scope: [] })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'in_scope')).toBe(true)
    }
  })

  it('applies default [] to constraints / risks / impact_surface / related when omitted', () => {
    const minimal = {
      title: 't',
      one_liner: 'hello',
      priority: 'P2',
      estimated_complexity: 'XS',
      in_scope: ['x'],
      out_of_scope: [],
      success_criteria: ['y'],
    }
    const r = RequirementIRSchema.safeParse(minimal)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.constraints).toEqual([])
      expect(r.data.risks).toEqual([])
      expect(r.data.impact_surface).toEqual([])
      expect(r.data.related).toEqual([])
    }
  })

  it('validates risks.likelihood / impact as low|medium|high', () => {
    const r = RequirementIRSchema.safeParse({
      ...validFrontmatter,
      risks: [{ description: 'r', likelihood: 'critical', impact: 'high' }],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('likelihood'))).toBe(true)
    }
  })
})
