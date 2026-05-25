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

const SPEC_8_1_REQUIREMENT_MD = `---
title: 给 /health 端点添加 db/redis 状态返回
one_liner: "GET /health 返回 200 + {db: ok/down, redis: ok/down}"
priority: P2
estimated_complexity: XS
in_scope:
  - 修改 /health 路由
  - 加 db ping
  - 加 redis ping
  - 加单元测试
out_of_scope:
  - 鉴权
  - rate limit
  - 历史指标
success_criteria:
  - GET /health 始终返回 200
  - body 字段 db 和 redis 各自为 'ok' 或 'down'
  - db/redis 不可用时不抛 500
  - 测试覆盖率 >= 80%
constraints:
  - kind: tech
    statement: 必须复用现有 db.pool 和 redis.client,不要新建连接
  - kind: tech
    statement: 返回格式参考 k8s liveness probe 风格(短字符串)
risks:
  - description: redis 不可达时 ping 阻塞影响 /health 响应时间
    likelihood: medium
    impact: medium
    mitigation: ping 加 500ms 超时
impact_surface:
  - src/routes/health.ts
  - src/health/db_check.ts
  - src/health/redis_check.ts
  - tests/health.test.ts
related: []
---

## 背景
当前 /health 仅返回 200 OK 字符串,监控系统无法判断 db 和 redis 是否健康。
SRE 反馈需要细化健康状态。

## 用户故事
As a SRE 工程师
I want /health 返回结构化健康信息
So that 我能在监控面板分别看到 db/redis 状态

## 验收标准明细
1. 正常情况: \`{db: 'ok', redis: 'ok'}\` 200
2. db 挂: \`{db: 'down', redis: 'ok'}\` 200

## 开放问题
- 是否需要返回版本号 / 启动时间?→ 暂不(out_of_scope)
`

describe('RequirementIR — spec §8.1 golden fixture', () => {
  it('parses the spec example without errors and warnings', () => {
    const out = parseRequirementIR(SPEC_8_1_REQUIREMENT_MD)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.title).toBe('给 /health 端点添加 db/redis 状态返回')
      expect(out.data.priority).toBe('P2')
      expect(out.data.estimated_complexity).toBe('XS')
      expect(out.data.in_scope).toHaveLength(4)
      expect(out.data.constraints).toHaveLength(2)
      expect(out.data.risks).toHaveLength(1)
      expect(out.data.risks[0]?.likelihood).toBe('medium')
      expect(out.warnings).toEqual([])
    }
  })

  it('roundtrips: parse → stringify → parse → data preserved', () => {
    const first = parseRequirementIR(SPEC_8_1_REQUIREMENT_MD)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const back = stringifyRequirementIR(first.data, first.body)
    const second = parseRequirementIR(back)
    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.data).toEqual(first.data)
    }
  })
})
