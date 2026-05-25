import { describe, it, expect } from 'vitest'
import { DesignIRSchema, parseDesignIR, stringifyDesignIR, type DesignIR } from './design.js'

const validDesign: DesignIR = {
  approach_summary: 'a'.repeat(25),
  architecture_decisions: [],
  affected_components: ['src/routes/health.ts'],
  data_model_changes: [],
  api_changes: [],
  task_graph: {
    nodes: [{ id: 'T1', title: 't', kind: 'code', estimated_effort_lines: 10 }],
    edges: [],
  },
  test_strategy: { unit: [], integration: [], e2e: [] },
  security_review: { threats_considered: [], mitigations: [], requires_secrets: false },
  rollout: { strategy: 'big_bang', rollback_plan: 'revert' },
}

describe('DesignIRSchema', () => {
  it('accepts a valid design', () => {
    expect(DesignIRSchema.safeParse(validDesign).success).toBe(true)
  })

  it('rejects approach_summary shorter than 20 chars', () => {
    const r = DesignIRSchema.safeParse({ ...validDesign, approach_summary: 'too short' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path[0]).toBe('approach_summary')
    }
  })

  it('rejects ADR id not matching ADR-\\d+', () => {
    const r = DesignIRSchema.safeParse({
      ...validDesign,
      architecture_decisions: [
        { id: 'foo', title: 't', context: 'c', decision: 'd', consequences: 'cs' },
      ],
    })
    expect(r.success).toBe(false)
  })

  it('rejects task_graph node with non-positive estimated_effort_lines', () => {
    const r = DesignIRSchema.safeParse({
      ...validDesign,
      task_graph: {
        nodes: [{ id: 'T1', title: 't', kind: 'code', estimated_effort_lines: 0 }],
        edges: [],
      },
    })
    expect(r.success).toBe(false)
  })

  it('rejects affected_components empty array (min 1)', () => {
    const r = DesignIRSchema.safeParse({ ...validDesign, affected_components: [] })
    expect(r.success).toBe(false)
  })

  it('applies defaults for architecture_decisions / data_model_changes / api_changes', () => {
    const minimal = {
      approach_summary: 'a'.repeat(25),
      affected_components: ['x'],
      task_graph: {
        nodes: [{ id: 'T1', title: 't', kind: 'code', estimated_effort_lines: 1 }],
        edges: [],
      },
      test_strategy: { unit: [], integration: [], e2e: [] },
      security_review: { threats_considered: [], mitigations: [], requires_secrets: false },
      rollout: { strategy: 'big_bang', rollback_plan: 'revert' },
    }
    const r = DesignIRSchema.safeParse(minimal)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.architecture_decisions).toEqual([])
      expect(r.data.data_model_changes).toEqual([])
      expect(r.data.api_changes).toEqual([])
    }
  })
})

const SPEC_8_2_DESIGN_MD = `---
approach_summary: |
  在 src/health/ 新增两个独立 check 模块(db_check.ts, redis_check.ts),
  各自封装 500ms 超时的 ping 函数。/health 路由 Promise.all 并发调用,
  结果合并返回。失败不抛错,统一返回 'down'。
architecture_decisions:
  - id: ADR-001
    title: 健康检查独立模块而非内联
    context: /health 路由原本只有 3 行
    decision: 拆出 src/health/ 目录,每个被检对象一个文件
    consequences: 文件变多但可测;后续加 kafka/s3 check 容易扩
    alternatives_considered:
      - 在 health.ts 内联,更短但不利扩展
affected_components:
  - src/routes/health.ts
  - src/health/db_check.ts (new)
data_model_changes: []
api_changes:
  - method: GET
    path: /health
    change: modify
    detail: 响应体从 'OK' 字符串改为 JSON {db, redis}
task_graph:
  nodes:
    - id: T1
      title: 新增 src/health/db_check.ts
      kind: code
      estimated_effort_lines: 30
    - id: T2
      title: 新增 tests/health.test.ts
      kind: test
      estimated_effort_lines: 80
  edges:
    - { from: T1, to: T2 }
test_strategy:
  unit:
    - db_check 超时返回 'down'
  integration:
    - /health 端到端 4 种状态
  e2e: []
security_review:
  threats_considered:
    - 信息泄露
  mitigations:
    - 只返回 ok/down
  requires_secrets: false
rollout:
  strategy: big_bang
  rollback_plan: revert PR
---

## 设计正文

### 模块拆分
(详细说明)
`

describe('parseDesignIR — spec §8.2 golden fixture', () => {
  it('parses without errors', () => {
    const out = parseDesignIR(SPEC_8_2_DESIGN_MD)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.task_graph.nodes).toHaveLength(2)
      expect(out.data.task_graph.edges).toHaveLength(1)
      expect(out.data.api_changes[0]?.method).toBe('GET')
      expect(out.warnings).toEqual([])
    }
  })

  it('roundtrips: parse → stringify → parse → data preserved', () => {
    const first = parseDesignIR(SPEC_8_2_DESIGN_MD)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const back = stringifyDesignIR(first.data, first.body)
    const second = parseDesignIR(back)
    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.data).toEqual(first.data)
    }
  })
})
