// spec 05 §10.1 Run FSM 转换表
// ADR-027: exhaustive switch reducer (state, event) => state（纯函数，不可变）

import { assertNever } from './assertNever.js'
import type { RunState, RunEvent } from '../types.js'

/** 终态集合（terminal states — 不允许任何事件触发转移） */
const TERMINAL_STATUSES = new Set<RunState['status']>(['completed', 'failed', 'cancelled'])

/**
 * reduceRun — Run FSM reducer（纯函数）
 * 收到非法事件（终态状态 / 状态-事件组合不匹配）时，返回原 state 不变，并 console.warn。
 * console.warn 是临时日志（pino 在切片 1.2/1.3 接入后替换）。
 */
export function reduceRun(state: RunState, event: RunEvent): RunState {
  // 终态保护：任何事件到达终态均返回原 state
  if (TERMINAL_STATUSES.has(state.status)) {
    console.warn(
      `[reduceRun] illegal transition: status=${state.status} is terminal, ignoring event=${event.type}`,
    )
    return state
  }

  switch (event.type) {
    case 'SCHEDULE_RUN': {
      // spec 05 §10.1: created → scheduling
      if (state.status !== 'created') {
        console.warn(`[reduceRun] SCHEDULE_RUN expected created, got ${state.status}`)
        return state
      }
      return { ...state, status: 'scheduling' }
    }

    case 'SANDBOX_READY': {
      // spec 05 §10.1: scheduling → running
      if (state.status !== 'scheduling') {
        console.warn(`[reduceRun] SANDBOX_READY expected scheduling, got ${state.status}`)
        return state
      }
      return { ...state, status: 'running' }
    }

    case 'SANDBOX_PENDING_TIMEOUT': {
      // spec 05 §10.1: scheduling → failed(sandbox_timeout)
      if (state.status !== 'scheduling') {
        console.warn(`[reduceRun] SANDBOX_PENDING_TIMEOUT expected scheduling, got ${state.status}`)
        return state
      }
      return {
        ...state,
        status: 'failed',
        failureClass: 'sandbox_timeout',
        failureMessage: 'sandbox pod pending timeout',
      }
    }

    case 'NODE_FINISHED_LAST': {
      // spec 05 §10.1: running → completed（最后一个节点成功）
      if (state.status !== 'running') {
        console.warn(`[reduceRun] NODE_FINISHED_LAST expected running, got ${state.status}`)
        return state
      }
      return { ...state, status: 'completed' }
    }

    case 'NODE_FINISHED_GATE': {
      // spec 05 §10.1: running → paused_at_gate（当前节点为 Gate 类型）
      if (state.status !== 'running') {
        console.warn(`[reduceRun] NODE_FINISHED_GATE expected running, got ${state.status}`)
        return state
      }
      return { ...state, status: 'paused_at_gate' }
    }

    case 'NODE_RETRY_EXHAUSTED': {
      // spec 05 §10.1: running → failed(<failure_class>)
      if (state.status !== 'running') {
        console.warn(`[reduceRun] NODE_RETRY_EXHAUSTED expected running, got ${state.status}`)
        return state
      }
      return {
        ...state,
        status: 'failed',
        failureClass: event.failureClass,
        failureMessage: event.failureMessage,
      }
    }

    case 'PASS_GATE': {
      // spec 05 §10.1: paused_at_gate → running
      if (state.status !== 'paused_at_gate') {
        console.warn(`[reduceRun] PASS_GATE expected paused_at_gate, got ${state.status}`)
        return state
      }
      return { ...state, status: 'running' }
    }

    case 'CANCEL_RUN': {
      // spec 05 §10.1: running | paused_at_gate → cancelled
      if (state.status !== 'running' && state.status !== 'paused_at_gate') {
        console.warn(`[reduceRun] CANCEL_RUN unexpected in status ${state.status}`)
        return state
      }
      return { ...state, status: 'cancelled' }
    }

    case 'RECONCILE_SWEEP_ORPHANED': {
      // spec 05 §10.1: (any non-terminal) → failed(sandbox_died)
      return {
        ...state,
        status: 'failed',
        failureClass: 'sandbox_died',
        failureMessage: 'reconcile: orphaned run',
      }
    }

    default:
      return assertNever(event)
  }
}
