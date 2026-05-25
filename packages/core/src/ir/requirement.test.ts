import { describe, it, expect } from 'vitest'
import { RequirementIRSchema } from './requirement.js'
import {
  parseRequirementIR,
  stringifyRequirementIR,
  REQUIRED_REQUIREMENT_SECTIONS,
} from './requirement.js'

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

describe('REQUIRED_REQUIREMENT_SECTIONS', () => {
  it('lists the 4 sections from spec 04 §2.2', () => {
    expect(REQUIRED_REQUIREMENT_SECTIONS).toEqual(['背景', '用户故事', '验收标准明细', '开放问题'])
  })
})

describe('parseRequirementIR', () => {
  it('parses valid markdown with all 4 sections — zero warnings', () => {
    const md = `---
title: t
one_liner: short
priority: P2
estimated_complexity: XS
in_scope:
  - a
out_of_scope: []
success_criteria:
  - sc
---

## 背景
text

## 用户故事
text

## 验收标准明细
text

## 开放问题
text
`
    const out = parseRequirementIR(md)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.title).toBe('t')
      expect(out.warnings).toEqual([])
    }
  })

  it('emits missing_section warnings for absent sections (non-blocking, ADR-023)', () => {
    const md = `---
title: t
one_liner: short
priority: P2
estimated_complexity: XS
in_scope:
  - a
out_of_scope: []
success_criteria:
  - sc
---

## 背景
only
`
    const out = parseRequirementIR(md)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.warnings).toEqual([
        { kind: 'missing_section', section: '用户故事' },
        { kind: 'missing_section', section: '验收标准明细' },
        { kind: 'missing_section', section: '开放问题' },
      ])
    }
  })

  it('returns ok=false when frontmatter fails zod (preserves body)', () => {
    const md = `---
title: ''
one_liner: short
priority: P2
estimated_complexity: XS
in_scope:
  - a
out_of_scope: []
success_criteria:
  - sc
---

## 背景
text
`
    const out = parseRequirementIR(md)
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.error.issues.some((i) => i.path[0] === 'title')).toBe(true)
      expect(out.body).toContain('## 背景')
    }
  })
})

describe('stringifyRequirementIR', () => {
  it('round-trips: parse → stringify → parse yields equal data', () => {
    const md = `---
title: roundtrip
one_liner: roundtrip test
priority: P1
estimated_complexity: S
in_scope:
  - r1
out_of_scope:
  - r2
success_criteria:
  - sc1
---

## 背景
b

## 用户故事
u

## 验收标准明细
ac

## 开放问题
op
`
    const first = parseRequirementIR(md)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const back = stringifyRequirementIR(first.data, first.body)
    const second = parseRequirementIR(back)
    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.data).toEqual(first.data)
      expect(second.warnings).toEqual([])
    }
  })
})
