import { v7 as uuidv7 } from 'uuid'
import type { RunState, NodeState, ArtifactSnapshot, NodeKind, ArtifactKind } from '../types.js'
import type { GateState } from '../gate/types.js'

/**
 * makeRun — 创建 RunState fixture。
 * 默认状态 'created'，全部字段可通过 overrides 覆盖。
 * 对应 spec 03 §6.5 runs 表结构（快照层，不含 DB 字段）。
 */
export function makeRun(overrides?: Partial<RunState>): RunState {
  return {
    id: uuidv7(),
    status: 'created',
    ...overrides,
  }
}

/**
 * makeNode — 创建 NodeState fixture。
 * 默认 kind='agent'，status='pending'，retryCount=0。
 * 对应 spec 03 §6.5 nodes 表结构（快照层）。
 */
export function makeNode(overrides?: Partial<NodeState> & { kind?: NodeKind }): NodeState {
  return {
    id: uuidv7(),
    kind: 'agent',
    status: 'pending',
    retryCount: 0,
    ...overrides,
  }
}

/**
 * makeGateOpened — 创建 GateState fixture（status='opened'）。
 * 对应 spec 05 §10.3 Gate 初始状态。
 */
export function makeGateOpened(overrides?: Partial<GateState>): GateState {
  return {
    nodeId: uuidv7(),
    status: 'opened',
    openedAt: new Date(),
    ...overrides,
  }
}

/**
 * makeArtifact — 创建 ArtifactSnapshot fixture。
 * 对应 spec 03 §6.6 artifacts 表结构（快照层，不含 blob 物理层）。
 */
export function makeArtifact(
  overrides?: Partial<ArtifactSnapshot> & { kind?: ArtifactKind },
): ArtifactSnapshot {
  const runId = overrides?.runId ?? uuidv7()
  return {
    id: uuidv7(),
    tenantId: uuidv7(),
    runId,
    nodeId: null,
    attempt: 1,
    kind: 'requirement_ir',
    status: 'ok',
    blobSha256: 'sha256:0'.padEnd(71, '0'),
    metadata: {},
    ...overrides,
  }
}
