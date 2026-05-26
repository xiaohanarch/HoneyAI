// @honeyai/orchestrator — 切片 1.1 barrel export
// 含: errors / types / FSM reducers / assertNever
// 不含: Gate service / Redis / BullMQ / Reconcile（切片 1.2-1.4）

// errors + retry policy
export {
  OrchestratorError,
  LlmRateLimitedError,
  LlmQualityFailedError,
  SandboxTimeoutError,
  SandboxOomError,
  SandboxDiedError,
  SandboxDiskFullError,
  ExternalFailedError,
  UserCancelledError,
  RETRY_POLICY,
  shouldAutoRetry,
  nextBackoffMs,
} from './errors.js'

export type { FailureClass, RetryPolicy } from './errors.js'

// state + event types
export type {
  RunStatus,
  RunState,
  RunEvent,
  NodeStatus,
  NodeKind,
  NodeState,
  NodeEvent,
  ArtifactKind,
  ArtifactStatus,
  ArtifactSnapshot,
} from './types.js'

// FSM reducers
export { reduceRun } from './fsm/run.js'
export { reduceNode } from './fsm/node.js'
export { assertNever } from './fsm/assertNever.js'

// Gate FSM (spec §10.3)
export { reduceGate } from './gate/reduce.js'
export type { GateStatus, GateState, GateEvent } from './gate/types.js'
