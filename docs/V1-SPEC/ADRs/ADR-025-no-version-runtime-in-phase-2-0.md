# ADR-025: IR 版本规则运行时逻辑不在 Phase 2.0,延后切片 1

- 状态: Accepted
- 日期: 2026-05-26

## Context

Spec 04 §11 定义 IR 版本规则:`ir_documents.version` monotonic int + Redis advisory 编辑锁 5min idle + 强抢二次确认 + zod 失败 / 锁丢失 UX。是否 Phase 2.0 内一并交付:

- A — 包含完整运行时 (`acquireEditLock` / `incrementVersion` / `forceUnlock`)
- B — 不含,Phase 2.0 仅暴露 zod 类型 + parse/stringify;版本规则运行时延后到切片 1(orchestrator)或切片 5(web)
- C — 仅含版本号字段定义,不含锁逻辑

## Decision

选 **B**。

## Consequences

**正面**:`@honeyai/core` 维持"纯函数 + 纯类型"定位,无 Redis / DB / Server Action 依赖,server-side / sandbox-side / web 三端可跑;Phase 2.0 PR 体量收窄,TDD 友好。

**负面**:切片 5(web Gate UI)依赖版本规则运行时,排期顺序需保证 orchestrator(切片 1)先于 web 完成 —— 已在 `decisions/phase-2-open-questions.md §M1` 切片顺序中保证。

**后续影响**:切片 1 在 `@honeyai/orchestrator` 新增 `irVersion.ts` 模块,封装 (a) 乐观锁版本检查;(b) Redis advisory lock 客户端;(c) 强抢 SSE 广播。`@honeyai/core` 不知情。

## Alternatives Considered

- A(全装):违反 `@honeyai/core` 纯函数定位;引入 ioredis 依赖到 core 后,sandbox-runner / 三端跑面将被迫装 Redis 客户端
- C(字段):字段无运行时配合等于半成品,价值低

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q5`
- 关联 spec: 04 §11
- 关联 ADR: ADR-014 (core 仅 barrel),M1 切片顺序
