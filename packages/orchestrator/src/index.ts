// @honeyai/orchestrator — Phase 2.2 barrel export
// 含: errors / types / FSM reducers / Gate service / persist / reconcile

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

// Gate FSM (slice 1.2 — pure)
export type { GateStatus, GateState, GateEvent } from './gate/types.js'
export { reduceGate } from './gate/reduce.js'

// Gate service (slice 1.2 — DB)
export type { PassGateResult } from './gate/service.js'
export { pauseRunAtGate, viewGate, passGate, resumeFromGate } from './gate/service.js'

// Persist functions (slice 1.3 — DB)
export { persistRun } from './persist/run.js'
export { persistNode } from './persist/node.js'

// Reconcile loop (slice 1.4 — DB)
export type { PodStatus, PodChecker } from './reconcile.js'
export { reconcileSweep, startReconcileLoop } from './reconcile.js'
