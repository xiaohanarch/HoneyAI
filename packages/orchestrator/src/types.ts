// spec 03 §6.5 runStatusEnum / nodeStatusEnum / nodeKindEnum
// spec 05 §10 FSM 转换表 — event types 与转移规则一一对应

import type { FailureClass } from './errors.js'

// ─── Run ─────────────────────────────────────────────────────────────────────

/** spec 03 §6.5 runStatusEnum — 7 个值 */
export type RunStatus =
  | 'created'
  | 'scheduling'
  | 'running'
  | 'paused_at_gate'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** 运行时 Run 状态快照（FSM reducer 的 state 参数） */
export type RunState = {
  readonly id: string
  readonly status: RunStatus
  readonly failureClass?: FailureClass
  readonly failureMessage?: string
}

/**
 * Run FSM 事件 discriminated union（spec 05 §10.1）
 * event type 命名规则：SCREAMING_SNAKE_CASE，与 spec 描述动词对应
 */
export type RunEvent =
  | { type: 'SCHEDULE_RUN' }
  | { type: 'SANDBOX_READY' }
  | { type: 'SANDBOX_PENDING_TIMEOUT' }
  | { type: 'NODE_FINISHED_LAST' /** 最后一个节点成功结束 */ }
  | { type: 'NODE_FINISHED_GATE' /** 当前节点为 Gate 类型 */ }
  | { type: 'NODE_RETRY_EXHAUSTED'; failureClass: FailureClass; failureMessage: string }
  | { type: 'PASS_GATE' }
  | { type: 'CANCEL_RUN' }
  | { type: 'RECONCILE_SWEEP_ORPHANED' }

// ─── Node ─────────────────────────────────────────────────────────────────────

/** spec 03 §6.5 nodeStatusEnum — 5 个值 */
export type NodeStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

/** spec 03 §6.5 nodeKindEnum — 4 个值 */
export type NodeKind = 'agent' | 'gate' | 'merge' | 'deploy'

/** 运行时 Node 状态快照（FSM reducer 的 state 参数） */
export type NodeState = {
  readonly id: string
  readonly kind: NodeKind
  readonly status: NodeStatus
  readonly retryCount: number
  readonly failureClass?: FailureClass
  readonly failureMessage?: string
}

/**
 * Node FSM 事件 discriminated union（spec 05 §10.2）
 * Gate FSM（§10.3）的 Gate-specific 事件留给切片 1.2
 */
export type NodeEvent =
  | { type: 'START_NODE' }
  | { type: 'NODE_SUCCESS' }
  | { type: 'NODE_FAILURE'; failureClass: FailureClass; failureMessage: string }
  | { type: 'RETRY_NODE_MANUAL' }
  | { type: 'CANCEL_RUN' }

// ─── Artifact（fixture 用，不含数据库层） ────────────────────────────────────

/** spec 03 §6.6 artifactKindEnum 子集（1.1 fixture 所需） */
export type ArtifactKind =
  | 'requirement_ir'
  | 'design_ir'
  | 'design_sub_ir'
  | 'impl_ir'
  | 'pr_meta'
  | 'log_chunk'
  | 'raw_input'

export type ArtifactStatus = 'ok' | 'failed'

/** 轻量 Artifact 快照（fixture factories 使用，不含 blob / OSS 层） */
export type ArtifactSnapshot = {
  readonly id: string
  readonly tenantId: string
  readonly runId: string
  readonly nodeId: string | null
  readonly attempt: number
  readonly kind: ArtifactKind
  readonly status: ArtifactStatus
  readonly blobSha256: string
  readonly metadata: Record<string, unknown>
}
