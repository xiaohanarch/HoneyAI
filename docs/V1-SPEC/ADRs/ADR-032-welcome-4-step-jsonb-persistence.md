# ADR-032: Welcome 4 步引导持久化到 `tenants.settings.bootstrap` jsonb

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 4.3 需要实施 Welcome 4 步引导流程。spec 三处定义(ADR-006 / spec 01 §3.1 / phase-2-4 §4.3)对 4 步内容存在不一致,且 Q2 要求明确持久化模型与 URL 驱动之间的分工。核心矛盾在于:URL 驱动无法满足 AC-01-03 断点续传要求,纯 URL query 在刷新时会丢失敏感输入,而纯 db 方案与 Next.js App Router 的 segment 导航习惯不符。

## Decision

**4 步顺序锁定为:Anthropic Key → GitHub App → GitHub repo → Skills 种子。**

Anthropic key 是 Run 跑起来的硬依赖(Claude Code CLI 必填);GitHub App 安装是租户级一次性操作,必须先于 repo 选择;Skills 种子实现"开箱可用"最小集。预算字段推迟到 Phase 3(见 ADR-033)。

**持久化采用混合模型:URL segment 导航 + jsonb 状态持久化。**

- URL `/welcome/step/[n]`(n ∈ {1,2,3,4})是 step 切换的唯一来源,符合 Next.js App Router dynamic segment 习惯。
- 状态权威来源是 `tenants.settings` jsonb 内嵌的 `bootstrap` 子键:`tenants.settings = { bootstrap: { ... } }`。
- 实施方式:无 SQL migration,仅在 `@honeyai/db` 对已有 `settings` 列加 `.$type<TenantSettings>()` TypeScript 注解(Q11 O1 用户确认)。
- 字段详情见 ADR-046(`TenantBootstrapState` shape)。

## Consequences

**正面**:
- URL segment 是 Next.js 15 推荐导航方式,可书签化、可历史回退。
- jsonb 持久化保证断点续传(AC-01-03),刷新不丢状态。
- 无 SQL migration 降低切片 4.3 风险面。

**负面**:
- URL 与 db 双源需要同步逻辑:布尔 guard 必须读 db,不能仅信任 URL。
- 已有 `settings` jsonb 列增加嵌套子键,schema drift 需靠 `.$type<>()` 注解而非 db 约束。

**后续影响**:
- `completedAt` 写入后,`/welcome` layout guard 反向 redirect 到 `/t/[slug]/runs`(见 ADR-039)。
- slice 5 如需 `budget` 字段,直接扩展 `TenantBootstrapState`。

## Alternatives Considered

- **A — 纯 URL query(`?step=2&key=...`)**:刷新即丢失敏感数据,无法满足断点续传。
- **B — 纯 db jsonb**:失去 Next.js segment routing 的导航语义,不符合 App Router 设计意图。
- **D — sessionStorage**:SSR 不友好,Server Component 无法访问。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q1` + `§Q2`
- 关联 spec: ADR-006-bootstrap-ux.md, 01-product.md §3.1, 03-data-model.md §tenants
- 关联 ADR: ADR-006(bootstrap UX 原始定义), ADR-033(预算推迟), ADR-046(字段 shape)
