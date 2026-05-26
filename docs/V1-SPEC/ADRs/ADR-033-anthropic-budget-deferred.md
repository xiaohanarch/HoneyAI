# ADR-033: Anthropic budget 输入推迟到 Phase 3

- 状态: Accepted
- 日期: 2026-05-26

## Context

ADR-006 的 Welcome 4 步定义包含"预算设置"一步。spec 06 §billing 已将预算功能标注为 V1.0 非核心功能。切片 4.3 必须对 4 步内容做出最终裁定(见 ADR-032),预算步骤是否纳入直接影响 Welcome 流程的复杂度与新手体验。

## Decision

**V1 Welcome 引导流程不要求用户填写月度预算上限。** 预算 UI 推迟到 Phase 3(配合用量数据观察阶段)再实施。

切片 4.3 的 4 步定义为:Anthropic Key / GitHub App / GitHub repo / Skills 种子,不含预算步骤(见 ADR-032)。`tenants.settings.budget` jsonb 子键保留空位,slice 5 填充,不影响 Phase 2 schema。

## Consequences

**正面**:
- 减少新手负担:用户在首次配置时无需估算用量上限,降低心理摩擦。
- 缩短 Welcome 流程关键路径,提升完成率。
- Phase 3 上线时有真实用量数据支撑预算 UI 的设计决策。

**负面**:
- `tenants.settings.budget` 字段暂时无 UI 入口,仅靠 jsonb 空位预留。
- ADR-006 §步骤定义与实施结果不一致,需要同 PR patch `ADR-006-bootstrap-ux.md`。

**后续影响**:
- Phase 3 引入预算 UI 时,需新建 ADR-0XX 说明月度限额设计与超限告警策略。
- `tenants.settings` jsonb 扩展 `budget` 子键时需 `.$type<>()` 同步更新。

## Alternatives Considered

- **B — 按 ADR-006 原样实现(含预算)**:预算输入在用户无历史用量时缺乏参考基准,且增加 Welcome 步骤数会降低完成率。
- **Phase 1 出 budget 表**:Phase 1 scope 已 frozen(ADR-008),不予考虑。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q1`
- 关联 spec: ADR-006-bootstrap-ux.md §预算步骤, 06-billing.md
- 关联 ADR: ADR-032(4 步定义统一), ADR-006(原始 bootstrap UX)
