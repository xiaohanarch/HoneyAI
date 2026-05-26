// spec 05 §10.3 Gate FSM reducer
// ADR-027: exhaustive switch reducer (state, event) => state（纯函数，不可变）

import { assertNever } from '../fsm/assertNever.js'
import type { GateState, GateEvent, GateStatus } from './types.js'

/** 终态集合（terminal states — 不允许任何事件触发转移） */
const TERMINAL_STATUSES = new Set<GateStatus>(['passed'])

/**
 * reduceGate — Gate FSM reducer（纯函数）
 *
 * state 为 null 时仅接受 GATE_OPENED 事件（初始化 Gate）。
 * 终态 `passed` 不接受任何进一步转移。
 * 收到不合法事件时返回原 state 不变，并 console.warn。
 * console.warn 是临时日志（pino 在切片 1.2/1.3 接入后替换）。
 */
export function reduceGate(state: GateState | null, event: GateEvent): GateState | null {
  // 终态保护：passed 是唯一终态，任何事件到达终态均返回原 state
  if (state !== null && TERMINAL_STATUSES.has(state.status)) {
    console.warn(
      // pino 在切片 1.2/1.3 接入后替换
      `[reduceGate] illegal transition: status=passed is terminal, ignoring event=${event.type}`,
    )
    return state
  }

  switch (event.type) {
    case 'GATE_OPENED': {
      // null → opened（Gate 初始化）
      if (state !== null) {
        console.warn(`[reduceGate] GATE_OPENED received but gate already exists, ignoring`) // pino 在切片 1.2/1.3 接入后替换
        return state
      }
      return {
        nodeId: event.nodeId,
        status: 'opened',
        openedAt: event.openedAt,
      }
    }

    case 'USER_VIEWED_EDITOR': {
      // opened → opened(+viewedAt)
      if (state === null) {
        console.warn(`[reduceGate] USER_VIEWED_EDITOR received but gate is null, ignoring`) // pino 在切片 1.2/1.3 接入后替换
        return null
      }
      return { ...state, viewedAt: event.viewedAt }
    }

    case 'PASS_GATE_OK': {
      // opened → passed（所有检查通过）
      if (state === null) {
        console.warn(`[reduceGate] PASS_GATE_OK received but gate is null, ignoring`) // pino 在切片 1.2/1.3 接入后替换
        return null
      }
      return {
        ...state,
        status: 'passed',
        passedAt: event.passedAt,
        passedByUserId: event.passedByUserId,
        pinnedArtifactId: event.pinnedArtifactId,
      }
    }

    case 'PASS_GATE_NOT_VIEWED': {
      // 拒绝：用户未查看 artifact，Gate 保持 opened，不发生状态变更
      if (state === null) {
        console.warn(`[reduceGate] PASS_GATE_NOT_VIEWED received but gate is null, ignoring`) // pino 在切片 1.2/1.3 接入后替换
        return null
      }
      console.warn(`[reduceGate] pass gate rejected: reason=not_viewed, nodeId=${state.nodeId}`) // pino 在切片 1.2/1.3 接入后替换
      return state
    }

    case 'PASS_GATE_VERSION_MISMATCH': {
      // 拒绝：版本不匹配，Gate 保持 opened，不发生状态变更
      if (state === null) {
        console.warn(`[reduceGate] PASS_GATE_VERSION_MISMATCH received but gate is null, ignoring`) // pino 在切片 1.2/1.3 接入后替换
        return null
      }
      console.warn(
        `[reduceGate] pass gate rejected: reason=version_mismatch, nodeId=${state.nodeId}`, // pino 在切片 1.2/1.3 接入后替换
      )
      return state
    }

    default:
      return assertNever(event)
  }
}
