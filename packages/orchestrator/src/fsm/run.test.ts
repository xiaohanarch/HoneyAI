import { describe, it, expect } from 'vitest'
import { reduceRun } from './run.js'
import type { RunState } from '../types.js'
import { makeRun } from '../test/fixtures.js'

// ─── fixtures (使用 makeRun factory，Task 4 已落地) ──────────

const created = makeRun({ id: 'run-1', status: 'created' })
const scheduling = makeRun({ id: 'run-1', status: 'scheduling' })
const running = makeRun({ id: 'run-1', status: 'running' })
const pausedAtGate = makeRun({ id: 'run-1', status: 'paused_at_gate' })

// ─── Happy path（spec 05 §10.1） ──────────────────────────────────────────────

describe('reduceRun — happy path (spec 05 §10.1)', () => {
  it('created → SCHEDULE_RUN → scheduling', () => {
    const next = reduceRun(created, { type: 'SCHEDULE_RUN' })
    expect(next.status).toBe('scheduling')
    // id 保持不变
    expect(next.id).toBe('run-1')
  })

  it('scheduling → SANDBOX_READY → running', () => {
    const next = reduceRun(scheduling, { type: 'SANDBOX_READY' })
    expect(next.status).toBe('running')
  })

  it('running → NODE_FINISHED_LAST → completed', () => {
    const next = reduceRun(running, { type: 'NODE_FINISHED_LAST' })
    expect(next.status).toBe('completed')
  })

  it('running → NODE_FINISHED_GATE → paused_at_gate', () => {
    const next = reduceRun(running, { type: 'NODE_FINISHED_GATE' })
    expect(next.status).toBe('paused_at_gate')
  })

  it('paused_at_gate → PASS_GATE → running', () => {
    const next = reduceRun(pausedAtGate, { type: 'PASS_GATE' })
    expect(next.status).toBe('running')
  })
})

// ─── Failure transitions ──────────────────────────────────────────────────────

describe('reduceRun — failure transitions (spec 05 §10.1)', () => {
  it('scheduling → SANDBOX_PENDING_TIMEOUT → failed(sandbox_timeout)', () => {
    const next = reduceRun(scheduling, { type: 'SANDBOX_PENDING_TIMEOUT' })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_timeout')
  })

  it('running → NODE_RETRY_EXHAUSTED(llm_rate_limited) → failed', () => {
    const next = reduceRun(running, {
      type: 'NODE_RETRY_EXHAUSTED',
      failureClass: 'llm_rate_limited',
      failureMessage: '重试 3 次仍 429',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('llm_rate_limited')
    expect(next.failureMessage).toBe('重试 3 次仍 429')
  })

  it('running → NODE_RETRY_EXHAUSTED(llm_quality_failed) → failed', () => {
    const next = reduceRun(running, {
      type: 'NODE_RETRY_EXHAUSTED',
      failureClass: 'llm_quality_failed',
      failureMessage: 'task_graph 缺少 root',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('llm_quality_failed')
  })

  it('running → NODE_RETRY_EXHAUSTED(sandbox_oom) → failed', () => {
    const next = reduceRun(running, {
      type: 'NODE_RETRY_EXHAUSTED',
      failureClass: 'sandbox_oom',
      failureMessage: 'OOMKilled',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_oom')
  })

  it('running → NODE_RETRY_EXHAUSTED(external_failed) → failed', () => {
    const next = reduceRun(running, {
      type: 'NODE_RETRY_EXHAUSTED',
      failureClass: 'external_failed',
      failureMessage: 'GitHub 503',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('external_failed')
  })

  it('(any non-terminal) → RECONCILE_SWEEP_ORPHANED → failed(sandbox_died)', () => {
    const next = reduceRun(running, { type: 'RECONCILE_SWEEP_ORPHANED' })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_died')
  })
})

// ─── Cancel transitions ───────────────────────────────────────────────────────

describe('reduceRun — cancel (spec 05 §10.1)', () => {
  it('running → CANCEL_RUN → cancelled', () => {
    const next = reduceRun(running, { type: 'CANCEL_RUN' })
    expect(next.status).toBe('cancelled')
  })

  it('paused_at_gate → CANCEL_RUN → cancelled', () => {
    const next = reduceRun(pausedAtGate, { type: 'CANCEL_RUN' })
    expect(next.status).toBe('cancelled')
  })
})

// ─── 非法转移（terminal 状态不可转移） ──────────────────────────────────────────

describe('reduceRun — illegal transitions (terminal states are immutable)', () => {
  it('completed + SCHEDULE_RUN → returns completed unchanged (warns)', () => {
    const completed: RunState = { id: 'run-1', status: 'completed' }
    const next = reduceRun(completed, { type: 'SCHEDULE_RUN' })
    expect(next.status).toBe('completed')
    // state 对象不变（identity 不要求相同，status 值相同即可）
  })

  it('failed + SANDBOX_READY → returns failed unchanged', () => {
    const failed: RunState = { id: 'run-1', status: 'failed', failureClass: 'sandbox_died' }
    const next = reduceRun(failed, { type: 'SANDBOX_READY' })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_died')
  })

  it('cancelled + PASS_GATE → returns cancelled unchanged', () => {
    const cancelled: RunState = { id: 'run-1', status: 'cancelled' }
    const next = reduceRun(cancelled, { type: 'PASS_GATE' })
    expect(next.status).toBe('cancelled')
  })
})
