# ADR-037: 默认 skills 每租户独立 copy

- 状态: Accepted
- 日期: 2026-05-26

## Context

`assets` 表的 `tenantId` 列设计为 nullable(`null` = 全局共享资产)。spec 01 §3.2.c 要求"5-10 个官方默认,可禁用不可删"。但 `assets.is_enabled` 是全局布尔列,若默认 skills 以 `tenantId = null` 全局方式存储,多租户间的启停操作会互相干扰,不满足"可禁用"的 per-tenant 语义。

## Decision

选 **S-B:每租户独立 copy + `metadata.is_seed=true` 标记**。

Step 4 import 时,在 `assets` 表为当前 `tenantId` 插入 5 条独立行,每行携带 `metadata: { is_seed: true }` 标记。后续该租户可自由编辑、禁用自己的 copy,不影响其他租户。

导入/跳过二选一(M-B):Step 4 提供"导入默认 skills"和"跳过"两个选项。选择跳过时 `defaultSkillsApplied = 'skipped'`,不写入任何 `assets` 行。

"不可删"强制采用 **E-A — metadata 标记方案**:切片 2 在 assets service 层加守卫,拦截 `metadata.is_seed = true` 的删除请求。V1 切片 4.3 暂不强制,依靠标记识别。

## Consequences

**正面**:
- `is_enabled` 语义与 `tenantId` 一一对应,多租户隔离正确。
- 每租户可独立修改默认 skill 内容,满足"可禁用"需求。
- `metadata.is_seed` 标记为切片 2 守卫提供明确识别字段。

**负面**:
- 5 × N tenants 的行数线性增长;V1 = 5-10 人小团队(< 100 行),可接受。
- 种子数据与全局模板不同步,官方更新需要额外的迁移机制(V1 不涉及)。

**后续影响**:
- 切片 2 实施 `assets` 删除守卫时,扫描 `metadata.is_seed = true` 拦截删除。
- 大规模租户场景(V2+)可考虑全局模板 + per-tenant override 差量模型。

## Alternatives Considered

- **S-A — 全局 null tenantId**:`is_enabled` 一改全改,无法满足 per-tenant 禁用语义;与 spec §3.2.c"可禁用"矛盾。
- **E-B — FK 强约束**:需要额外 seed 表,schema 复杂度过高;V1 YAGNI。
- **E-C — 软删除列**:仅防删除,不解决 `is_enabled` 多租户隔离问题。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q6`
- 关联 spec: 01-product.md §3.2.c, 03-data-model.md §assets
- 关联 ADR: ADR-038(5 seed 清单内容), ADR-035(Step 4 action 写入)
