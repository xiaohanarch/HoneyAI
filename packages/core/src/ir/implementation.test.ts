import { describe, it, expect } from 'vitest'
import {
  ImplementationIRSchema,
  parseImplementationIR,
  stringifyImplementationIR,
  type ImplementationIR,
} from './implementation.js'

const validImpl: ImplementationIR = {
  pr: { title: 't', body: 'b', branch: 'feat/x', base: 'main', draft: false },
  commits: [{ sha: 'a'.repeat(40), message: 'm', files_changed: 1 }],
  files_changed: [{ path: 'src/x.ts', change: 'add', additions: 10, deletions: 0 }],
  tests: { added: [], modified: [] },
  quality_gates: {
    lint: 'pass',
    typecheck: 'pass',
    build: 'pass',
    security_scan: 'pass',
    findings: [],
  },
  ai_self_review: { confidence: 'high', known_limitations: [], suggested_human_review: [] },
  task_completion: [],
  links: { commit_urls: [] },
}

describe('ImplementationIRSchema', () => {
  it('accepts a valid implementation', () => {
    expect(ImplementationIRSchema.safeParse(validImpl).success).toBe(true)
  })

  it('rejects pr.title longer than 72 chars', () => {
    const r = ImplementationIRSchema.safeParse({
      ...validImpl,
      pr: { ...validImpl.pr, title: 'a'.repeat(73) },
    })
    expect(r.success).toBe(false)
  })

  it('rejects commits.sha not 40 chars', () => {
    const r = ImplementationIRSchema.safeParse({
      ...validImpl,
      commits: [{ sha: 'short', message: 'm', files_changed: 1 }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects negative additions / deletions', () => {
    const r = ImplementationIRSchema.safeParse({
      ...validImpl,
      files_changed: [{ path: 'p', change: 'add', additions: -1, deletions: 0 }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects findings.severity = "info" (only low/medium/high/critical)', () => {
    const r = ImplementationIRSchema.safeParse({
      ...validImpl,
      quality_gates: {
        ...validImpl.quality_gates,
        findings: [{ severity: 'info', rule: 'r', file: 'f', line: 1, message: 'm' }],
      },
    })
    expect(r.success).toBe(false)
  })

  it('applies defaults for pr.base / pr.draft / findings / commit_urls', () => {
    const minimal = {
      pr: { title: 't', body: 'b', branch: 'feat/x' },
      commits: [],
      files_changed: [],
      tests: { added: [], modified: [] },
      quality_gates: {
        lint: 'pass',
        typecheck: 'pass',
        build: 'pass',
        security_scan: 'pass',
      },
      ai_self_review: { confidence: 'low', known_limitations: [], suggested_human_review: [] },
      task_completion: [],
      links: {},
    }
    const r = ImplementationIRSchema.safeParse(minimal)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.pr.base).toBe('main')
      expect(r.data.pr.draft).toBe(false)
      expect(r.data.quality_gates.findings).toEqual([])
      expect(r.data.links.commit_urls).toEqual([])
    }
  })

  it('accepts optional tests.coverage_pct in [0,100]', () => {
    const ok = ImplementationIRSchema.safeParse({
      ...validImpl,
      tests: { ...validImpl.tests, coverage_pct: 92 },
    })
    expect(ok.success).toBe(true)
    const bad = ImplementationIRSchema.safeParse({
      ...validImpl,
      tests: { ...validImpl.tests, coverage_pct: 101 },
    })
    expect(bad.success).toBe(false)
  })
})

const SPEC_8_3_IMPL_MD = `---
pr:
  title: "feat(health): 添加 db/redis 状态返回"
  body: |
    实现 RequirementIR #abc12 中的 /health 增强。
  branch: feat/health-detailed-status
  base: main
  draft: false
commits:
  - sha: a1b2c3d4e5f6789012345678901234567890abcd
    message: "feat(health): add db_check module"
    files_changed: 1
  - sha: b1c2d3e4f56789012345678901234567890abcde
    message: "feat(health): add redis_check module"
    files_changed: 1
files_changed:
  - path: src/health/db_check.ts
    change: add
    additions: 28
    deletions: 0
tests:
  added:
    - tests/health.test.ts
  modified: []
  coverage_pct: 92
quality_gates:
  lint: pass
  typecheck: pass
  build: pass
  security_scan: pass
  findings: []
ai_self_review:
  confidence: high
  known_limitations:
    - redis_check 超时仅依赖 Promise.race,未取消底层连接
  suggested_human_review:
    - 确认 500ms 超时是否合理
task_completion:
  - task_id: T1
    status: done
  - task_id: T2
    status: done
links:
  pr_url: https://github.com/user/repo/pull/42
  commit_urls:
    - https://github.com/user/repo/commit/a1b2c3d
---

## 实现摘要

按 DesignIR.task_graph 拓扑序完成 4 个任务。
所有 quality gates 通过。
`

describe('parseImplementationIR — spec §8.3 golden fixture', () => {
  it('parses without errors', () => {
    const out = parseImplementationIR(SPEC_8_3_IMPL_MD)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.pr.title).toBe('feat(health): 添加 db/redis 状态返回')
      expect(out.data.commits).toHaveLength(2)
      expect(out.data.tests.coverage_pct).toBe(92)
      expect(out.data.task_completion).toHaveLength(2)
      expect(out.warnings).toEqual([])
    }
  })

  it('roundtrips: parse → stringify → parse → data preserved', () => {
    const first = parseImplementationIR(SPEC_8_3_IMPL_MD)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const back = stringifyImplementationIR(first.data, first.body)
    const second = parseImplementationIR(back)
    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.data).toEqual(first.data)
    }
  })
})
