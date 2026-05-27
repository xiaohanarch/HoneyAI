import { describe, it, expect } from 'vitest'
import { parseIRFromEvents } from './parse-ir.js'
import { LlmQualityFailedError } from '@honeyai/core'
import type { StreamingNodeEvent } from '@honeyai/core'

// helpers
function makeTextEvent(content: string): StreamingNodeEvent {
  return { ts: new Date().toISOString(), kind: 'text', content }
}
function makeThinkingEvent(): StreamingNodeEvent {
  return { ts: new Date().toISOString(), kind: 'thinking', content: 'thinking...' }
}

const REQUIREMENT_IR_MD = `---
title: Test requirement
one_liner: Testing the requirement IR parsing
priority: P1
estimated_complexity: S
in_scope:
  - feature A
out_of_scope: []
success_criteria:
  - criterion 1
constraints: []
risks: []
impact_surface: []
related: []
---

## 背景
Test background.

## 用户故事
As a user I want something.

## 验收标准明细
1. Criterion 1 detail.

## 开放问题
None.
`

const DESIGN_IR_MD = `---
approach_summary: This is a detailed approach summary with more than twenty characters here.
architecture_decisions: []
affected_components:
  - src/app.ts
data_model_changes: []
api_changes: []
task_graph:
  nodes:
    - id: T1
      title: Task 1
      kind: code
      estimated_effort_lines: 10
  edges: []
test_strategy:
  unit: []
  integration: []
  e2e: []
security_review:
  threats_considered: []
  mitigations: []
  requires_secrets: false
rollout:
  strategy: big_bang
  rollback_plan: revert PR
---

## Design
Some design notes.
`

const IMPLEMENTATION_IR_MD = `---
pr:
  title: "feat(test): implement feature"
  body: Implements feature X
  branch: feat/test
  base: main
  draft: false
commits:
  - sha: a1b2c3d4e5f6789012345678901234567890abcd
    message: "feat(test): initial commit"
    files_changed: 1
files_changed:
  - path: src/test.ts
    change: add
    additions: 10
    deletions: 0
tests:
  added:
    - src/test.test.ts
  modified: []
quality_gates:
  lint: pass
  typecheck: pass
  build: pass
  security_scan: pass
  findings: []
ai_self_review:
  confidence: high
  known_limitations: []
  suggested_human_review: []
task_completion:
  - task_id: T1
    status: done
links:
  pr_url: https://github.com/user/repo/pull/1
  commit_urls: []
---

## Implementation
Done.
`

describe('parseIRFromEvents', () => {
  it('AC-06-09: kind=enrich + valid RequirementIR text → returns RequirementIR object', () => {
    const events: StreamingNodeEvent[] = [makeThinkingEvent(), makeTextEvent(REQUIREMENT_IR_MD)]
    const result = parseIRFromEvents(events, 'enrich')
    expect(result).toMatchObject({ title: 'Test requirement', priority: 'P1' })
  })

  it('AC-06-10: kind=design + valid DesignIR text → returns DesignIR object', () => {
    const events: StreamingNodeEvent[] = [makeThinkingEvent(), makeTextEvent(DESIGN_IR_MD)]
    const result = parseIRFromEvents(events, 'design')
    expect(result).toMatchObject({ affected_components: ['src/app.ts'] })
  })

  it('AC-06-11: kind=implement + valid ImplementationIR text → returns ImplementationIR object', () => {
    const events: StreamingNodeEvent[] = [makeThinkingEvent(), makeTextEvent(IMPLEMENTATION_IR_MD)]
    const result = parseIRFromEvents(events, 'implement')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).pr.title).toBe('feat(test): implement feature')
  })

  it('AC-06-12: no text events → throws LlmQualityFailedError', () => {
    const events: StreamingNodeEvent[] = [makeThinkingEvent()]
    expect(() => parseIRFromEvents(events, 'enrich')).toThrow(LlmQualityFailedError)
  })

  it('AC-06-13: last text event has invalid IR content → throws LlmQualityFailedError', () => {
    const events: StreamingNodeEvent[] = [makeTextEvent('not valid YAML frontmatter IR content')]
    expect(() => parseIRFromEvents(events, 'enrich')).toThrow(LlmQualityFailedError)
  })

  it('AC-06-13b: uses LAST text event (not first) when multiple text events', () => {
    const badEvent = makeTextEvent('not valid IR')
    const goodEvent = makeTextEvent(REQUIREMENT_IR_MD)
    const events: StreamingNodeEvent[] = [badEvent, goodEvent]
    const result = parseIRFromEvents(events, 'enrich')
    expect(result).toMatchObject({ title: 'Test requirement' })
  })
})
