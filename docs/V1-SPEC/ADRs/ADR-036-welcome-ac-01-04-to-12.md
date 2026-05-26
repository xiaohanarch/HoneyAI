# ADR-036: Welcome 9 条新 AC(AC-01-04..12)

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 4.3 的 AC-01-03 已标注为 `[Failure][Manual]`,但 layout-level redirect 完全可以自动化。同时 phase-2-4 §4.3 AC 范围仅泛指"4 步 happy",缺乏字段校验、跨租户隔离、slug mismatch 等失败路径的覆盖。需要明确自动化测试矩阵、测试基础设施选型和 ac:coverage 门禁策略。

## Decision

采用 **γ + 9 ACs + I3 + T-C + G3** 组合:

**γ — 新增 9 条自动化 AC**,AC-01-03 保持 `[Failure][Manual]` 原状不变:

| AC ID | 类型 | 覆盖范围 |
|-------|------|---------|
| AC-01-04 | [Failure][Happy] | layout guard 自动化:completedAt == null → redirect step/1 |
| AC-01-05 | [Happy] | step 1 key 合法 → jsonb 写入 + redirect step 2 |
| AC-01-06 | [Happy] | step 2 checkbox 勾选 → jsonb githubAppInstalled=true + redirect step 3 |
| AC-01-07 | [Happy] | step 3 repo owner/name 合法 → jsonb pendingRepoOwnerName + redirect step 4 |
| AC-01-08 | [Happy] | step 4 import → seed 5 skills + completedAt + redirect /t/[slug]/runs |
| AC-01-09 | [Happy] | step 4 skip → defaultSkillsApplied='skipped' + completedAt + redirect |
| AC-01-10 | [Failure] | key regex 不匹配 → INVALID_KEY_FORMAT 不写库 |
| AC-01-11 | [Failure] | 跨租户:用户 A 的 jsonb 不被用户 B 读到 |
| AC-01-12 | [Failure] | slug mismatch → redirect 到用户自己的 slug |

**I3 — mock-primary + testcontainer for cross-tenant**:单测全 mock(`vi.mock`),AC-01-11 跨租户隔离用真实 PG template db 验证 `withTenant` proxy。

**T-C — dev-credentials server boot seed**:dev tenant fixture 在 `instrumentation.ts` boot 时写入 template db(见 ADR-048)。

**G3 — 9 条 AC 进 ac:coverage 跟踪但不进 seed gate**:切片 4.3 起 web 包覆盖率逐步爬坡,不立即门禁。

## Consequences

**正面**:
- 9 条 AC 覆盖 happy / failure / 跨租户 / slug mismatch 四个维度,测试矩阵完整。
- mock-primary 方案让大多数 action 测试无需启动 PG,速度快。
- ac:coverage 跟踪不门禁,避免切片 4.3 被覆盖率硬门禁阻塞。

**负面**:
- AC-01-11 需要 testcontainer 真实 PG,CI 时间略增。
- G3 不门禁意味着覆盖率爬坡依赖后续切片自律执行。

**后续影响**:
- 切片 4.4 起可逐步将 G3 升级为 G1 紧 gate。
- AC-01-11 testcontainer 模式是后续跨租户测试的基准模板。

## Alternatives Considered

- **α — AC-01-03 保持 [Manual],4 步 happy 用 1 个组合 AC**:粒度不足,字段校验和失败路径无覆盖。
- **β — AC-01-03 改自动化**:破坏已有 manual 语义,且影响 Phase 1 AC 编号稳定性。
- **I1 — testcontainer 跑所有 web 测试**:CI 耗时过长,Phase 1 已确认 mock-primary 为 web 包基准。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q5`
- 关联 spec: 00-README.md §AC 约定, 03-data-model.md §withTenant
- 关联 ADR: ADR-039(layout guard), ADR-047(字段校验), ADR-048(dev-seed fixture)
