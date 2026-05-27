// spec 05 §10.3 Gate FSM — state + event types

/** Gate 的两个状态 */
export type GateStatus = 'opened' | 'passed'

/**
 * GateState — 运行时 Gate 状态快照（不是 DB row）
 * 对应 spec 05 §10.3 转换表中的 from/to 列
 */
export type GateState = {
  readonly nodeId: string
  readonly status: GateStatus
  readonly openedAt: Date
  readonly viewedAt?: Date
  readonly passedAt?: Date
  readonly passedByUserId?: string
  readonly pinnedArtifactId?: string
}

/**
 * GateEvent — Gate FSM 事件 discriminated union（spec 05 §10.3）
 *
 * GATE_OPENED            : null → opened（Gate 初始化）
 * USER_VIEWED_EDITOR     : opened → opened(+viewedAt)（用户打开编辑器）
 * PASS_GATE_OK           : opened → passed（所有检查通过，Gate 放行）
 * PASS_GATE_NOT_VIEWED   : opened 拒绝（用户未查看 artifact，reason: not_viewed）
 * PASS_GATE_VERSION_MISMATCH: opened 拒绝（版本不匹配，reason: version_mismatch）
 */
export type GateEvent =
  | { type: 'GATE_OPENED'; nodeId: string; openedAt: Date }
  | { type: 'USER_VIEWED_EDITOR'; viewedAt: Date }
  | { type: 'PASS_GATE_OK'; passedAt: Date; passedByUserId: string; pinnedArtifactId: string }
  | { type: 'PASS_GATE_NOT_VIEWED' }
  | { type: 'PASS_GATE_VERSION_MISMATCH' }
