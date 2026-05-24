# ADR-008: Phase 1 实施范围 — monorepo 骨架 + db 全表落地

- 状态: Accepted
- 日期: 2026-05-24

## Context
V1 spec 冻结（PR #1 合入）后，需选 Phase 1 切入点。三个候选：
- **A. monorepo 骨架 + db 全表落地** — pnpm workspace + 8 packages skeleton + drizzle 30 表 + migration + withTenant + 跨租户阻断单测
- **B. 端到端最薄垂直切片** — next-auth GitHub login + 一个 mock Run（写 DB + SSE 假数据流）+ index.html 跑通
- **C. Infra-first** — 先按 08 把 ECS bootstrap 拉起来（k3s + CNPG + Loki）再写代码

V1 约束：MVP 简单优先 + 数据层先稳 + 避免后续多次回头改 schema。

## Decision
选 **A. monorepo 骨架 + db 全表落地**。

范围：
- pnpm workspace + turborepo + 8 packages 骨架（按 02-architecture §3）
- 落地 drizzle 30 表 schema（含 v0.2.0 新增 `ir_documents` + `artifacts` attempt 模型）
- 首份 migration + CNPG 兼容性验证（本地 PG 17 起）
- `withTenant` middleware + 跨租户阻断单测（覆盖 AC-03-01/02/03）

Tooling 选型（Phase 1 锁定，后续 phase 沿用）：
- **Node**：22 LTS（与 08 §1 一致）
- **包管理**：pnpm（含 `packageManager` 字段锁版本）
- **PostgreSQL**：17（CNPG default，本地 `postgres:17-alpine` docker-compose）
- **PR 策略**：ADR-008 与 Phase 1 实施同一 PR，避免多余 review 轮次

## Consequences
- 正面:
  - 03-data-model 已完整冻结，乘热打铁一次落地，省去后续来回改 schema
  - monorepo 骨架是后续所有 PR 的前提，先一次到位
  - 3 条种子 AC（AC-03-01/02/03）首批闭环，验证 ac:coverage 工具链
- 负面:
  - 没东西能跑，纯结构 + DB，无可视化演示
  - infra 部署链路（C）继续积压
- 后续影响:
  - Phase 2 自然衔接 packages/core（orchestrator + BullMQ）
  - Phase 3 才进 packages/web + sandbox，端到端可演示推迟 2-3 周

## Alternatives Considered
- **B. 端到端最薄垂直切片**: 在没 sandbox / orchestrator 的情况下只能纯 mock，"端到端" 名不副实；且会建 5-6 张表后剩余 TD 化，schema 多版本演进风险高
- **C. Infra-first**: 还没代码可部署，ECS 拉起后会闲置 ≥ 1 周；08 spec 已细到可任何时候执行，不急

## Related
- 02-architecture.md §3（monorepo 边界）
- 03-data-model.md（30 表 + AC-03-01/02/03）
- 04-ir-schemas.md §11（IR 版本规则）
- ADR-001-drizzle-orm.md
