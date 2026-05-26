// spec 05 §10.2 Node FSM 转换表
// ADR-027: exhaustive switch reducer（纯函数，不可变）

import { assertNever } from './assertNever.js'
import { shouldAutoRetry } from '../errors.js'
import type { NodeState, NodeEvent } from '../types.js'

/** 终态集合（terminal states） */
const TERMINAL_STATUSES = new Set<NodeState['status']>(['success', 'failed', 'skipped'])

/**
 * reduceNode — Node FSM reducer（纯函数）
 * 非法事件：返回原 state 不变 + console.warn（pino 在切片 1.2 接入后替换）。
 *
 * 终态规则：
 *   - CANCEL_RUN: 可中断任意非终态 → skipped；终态时忽略
 *   - RETRY_NODE_MANUAL: 可从 failed 重回 running；failed 不是对此事件的终态
 *   - 其余事件: success / failed / skipped 均为终态，返回 state 不变
 */
export function reduceNode(state: NodeState, event: NodeEvent): NodeState {
  switch (event.type) {
    case 'CANCEL_RUN': {
      // spec 05 §10.2: (any non-terminal) cancelRun() → skipped
      if (TERMINAL_STATUSES.has(state.status)) {
        console.warn(`[reduceNode] CANCEL_RUN on terminal status=${state.status}, ignoring`)
        return state
      }
      return { ...state, status: 'skipped' }
    }

    case 'RETRY_NODE_MANUAL': {
      // spec 05 §10.2: failed → running（人工重试，UI 触发）
      // failed 是终态，但 RETRY_NODE_MANUAL 是唯一可从 failed 逃脱的事件
      if (state.status !== 'failed') {
        console.warn(`[reduceNode] RETRY_NODE_MANUAL expected failed, got ${state.status}`)
        return state
      }
      // 清除 failureClass / failureMessage（重试后如再失败由新 NODE_FAILURE 事件写入）
      const { failureClass: _fc, failureMessage: _fm, ...rest } = state
      return { ...rest, status: 'running' }
    }

    case 'START_NODE': {
      // 终态保护
      if (TERMINAL_STATUSES.has(state.status)) {
        console.warn(
          `[reduceNode] illegal transition: status=${state.status} is terminal, ignoring event=${event.type}`,
        )
        return state
      }
      // spec 05 §10.2: pending → running
      if (state.status !== 'pending') {
        console.warn(`[reduceNode] START_NODE expected pending, got ${state.status}`)
        return state
      }
      return { ...state, status: 'running' }
    }

    case 'NODE_SUCCESS': {
      // 终态保护
      if (TERMINAL_STATUSES.has(state.status)) {
        console.warn(
          `[reduceNode] illegal transition: status=${state.status} is terminal, ignoring event=${event.type}`,
        )
        return state
      }
      // spec 05 §10.2: running → success
      if (state.status !== 'running') {
        console.warn(`[reduceNode] NODE_SUCCESS expected running, got ${state.status}`)
        return state
      }
      return { ...state, status: 'success' }
    }

    case 'NODE_FAILURE': {
      // 终态保护
      if (TERMINAL_STATUSES.has(state.status)) {
        console.warn(
          `[reduceNode] illegal transition: status=${state.status} is terminal, ignoring event=${event.type}`,
        )
        return state
      }
      // spec 05 §10.2: running → (running w/ retry++) | failed
      if (state.status !== 'running') {
        console.warn(`[reduceNode] NODE_FAILURE expected running, got ${state.status}`)
        return state
      }

      const { failureClass, failureMessage } = event

      if (shouldAutoRetry(failureClass, state.retryCount)) {
        // auto retry — retryCount++ stays running
        return { ...state, retryCount: state.retryCount + 1 }
      }

      // exhausted or manual-only → failed
      return {
        ...state,
        status: 'failed',
        failureClass,
        failureMessage,
      }
    }

    default:
      return assertNever(event)
  }
}
