import { describe, it, expect } from 'vitest'
import { reduceNode } from './node.js'
import { makeNode } from '../test/fixtures.js'
import type { NodeState } from '../types.js'

// ─── agent 节点 happy path（spec 05 §10.2） ───────────────────────────────────

describe('reduceNode — agent node happy path (spec 05 §10.2)', () => {
  it('pending → START_NODE → running', () => {
    const state = makeNode({ kind: 'agent', status: 'pending' })
    const next = reduceNode(state, { type: 'START_NODE' })
    expect(next.status).toBe('running')
    expect(next.retryCount).toBe(0)
  })

  it('running → NODE_SUCCESS → success', () => {
    const state = makeNode({ kind: 'agent', status: 'running' })
    const next = reduceNode(state, { type: 'NODE_SUCCESS' })
    expect(next.status).toBe('success')
  })
})

// ─── 自动重试（retryable error + retryCount < max） ───────────────────────────

describe('reduceNode — auto-retry (retryable class, attempt < max) (spec 05 §10.2)', () => {
  it('running → NODE_FAILURE(llm_rate_limited, retry=0) → running, retryCount=1', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'llm_rate_limited',
      failureMessage: '429',
    })
    // RETRY_POLICY llm_rate_limited: auto=true, max=3 — attempt=0 < 3 → auto retry
    expect(next.status).toBe('running')
    expect(next.retryCount).toBe(1)
  })

  it('running → NODE_FAILURE(llm_rate_limited, retry=2) → running, retryCount=3', () => {
    const state = makeNode({ status: 'running', retryCount: 2 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'llm_rate_limited',
      failureMessage: '429 again',
    })
    // attempt=2 < 3 → 仍可重试，retryCount becomes 3
    expect(next.status).toBe('running')
    expect(next.retryCount).toBe(3)
  })

  it('running → NODE_FAILURE(llm_quality_failed, retry=0) → running', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'llm_quality_failed',
      failureMessage: 'schema mismatch',
    })
    expect(next.status).toBe('running')
    expect(next.retryCount).toBe(1)
  })

  it('running → NODE_FAILURE(external_failed, retry=0) → running, retryCount=1', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'external_failed',
      failureMessage: 'GitHub 503',
    })
    // external_failed: auto=true, max=1 — attempt=0 < 1 → retry
    expect(next.status).toBe('running')
    expect(next.retryCount).toBe(1)
  })
})

// ─── 重试耗尽（retryCount >= max） ────────────────────────────────────────────

describe('reduceNode — retry exhausted (retryCount >= max) → failed', () => {
  it('llm_rate_limited: retry=3 → failed', () => {
    const state = makeNode({ status: 'running', retryCount: 3 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'llm_rate_limited',
      failureMessage: '429 final',
    })
    // attempt=3 >= max=3 → exhausted
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('llm_rate_limited')
    expect(next.failureMessage).toBe('429 final')
  })

  it('external_failed: retry=1 → failed', () => {
    const state = makeNode({ status: 'running', retryCount: 1 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'external_failed',
      failureMessage: 'GitHub still 503',
    })
    // external_failed max=1 — attempt=1 >= 1 → failed
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('external_failed')
  })
})

// ─── 手动重试类（non-retryable → 直接 failed） ────────────────────────────────

describe('reduceNode — manual-only failure classes → immediate failed', () => {
  it('sandbox_timeout → failed immediately (no auto retry)', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'sandbox_timeout',
      failureMessage: 'pod pending 20min',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_timeout')
    // retryCount 不递增（手动类不消耗 auto retry）
    expect(next.retryCount).toBe(0)
  })

  it('sandbox_oom → failed immediately', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'sandbox_oom',
      failureMessage: 'OOMKilled',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_oom')
  })

  it('sandbox_died → failed immediately', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'sandbox_died',
      failureMessage: 'pod not found',
    })
    expect(next.status).toBe('failed')
  })

  it('sandbox_disk_full → failed immediately', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'sandbox_disk_full',
      failureMessage: 'no space left',
    })
    expect(next.status).toBe('failed')
  })

  it('user_cancelled → failed immediately', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'user_cancelled',
      failureMessage: 'user cancelled',
    })
    expect(next.status).toBe('failed')
  })
})

// ─── 手动重试（failed → RETRY_NODE_MANUAL → running） ─────────────────────────

describe('reduceNode — manual retry (spec 05 §10.2 retryNode(manual))', () => {
  it('failed → RETRY_NODE_MANUAL → running', () => {
    const state = makeNode({ status: 'failed', retryCount: 1, failureClass: 'sandbox_oom' })
    const next = reduceNode(state, { type: 'RETRY_NODE_MANUAL' })
    expect(next.status).toBe('running')
    // retryCount 保持 failed 时的值（orchestrator service 负责 INSERT node_retries）
    expect(next.failureClass).toBeUndefined()
  })
})

// ─── Gate/deploy 节点（kind 不同，状态机逻辑相同） ────────────────────────────

describe('reduceNode — gate node', () => {
  it('pending → START_NODE → running（gate 类型）', () => {
    const state = makeNode({ kind: 'gate', status: 'pending' })
    const next = reduceNode(state, { type: 'START_NODE' })
    expect(next.status).toBe('running')
    expect(next.kind).toBe('gate')
  })

  it('running → NODE_SUCCESS → success（gate 通过后继续）', () => {
    const state = makeNode({ kind: 'gate', status: 'running' })
    const next = reduceNode(state, { type: 'NODE_SUCCESS' })
    expect(next.status).toBe('success')
  })
})

describe('reduceNode — deploy node', () => {
  it('pending → START_NODE → running（deploy 类型）', () => {
    const state = makeNode({ kind: 'deploy', status: 'pending' })
    const next = reduceNode(state, { type: 'START_NODE' })
    expect(next.status).toBe('running')
  })
})

// ─── CANCEL_RUN 事件：任意非终态 → skipped ───────────────────────────────────

describe('reduceNode — CANCEL_RUN → skipped', () => {
  it('pending → CANCEL_RUN → skipped', () => {
    const state = makeNode({ status: 'pending' })
    const next = reduceNode(state, { type: 'CANCEL_RUN' })
    expect(next.status).toBe('skipped')
  })

  it('running → CANCEL_RUN → skipped', () => {
    const state = makeNode({ status: 'running' })
    const next = reduceNode(state, { type: 'CANCEL_RUN' })
    expect(next.status).toBe('skipped')
  })
})

// ─── 终态保护 ─────────────────────────────────────────────────────────────────

describe('reduceNode — terminal state immutability', () => {
  it('success + START_NODE → returns success unchanged', () => {
    const state = makeNode({ status: 'success' })
    const next = reduceNode(state, { type: 'START_NODE' })
    expect(next.status).toBe('success')
  })

  it('skipped + NODE_SUCCESS → returns skipped unchanged', () => {
    const state = makeNode({ status: 'skipped' })
    const next = reduceNode(state, { type: 'NODE_SUCCESS' })
    expect(next.status).toBe('skipped')
  })
})
