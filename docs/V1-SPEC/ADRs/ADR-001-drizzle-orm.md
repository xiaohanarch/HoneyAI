# ADR-001: 选 Drizzle ORM 不选 Prisma

- 状态: Accepted
- 日期: 2026-05-23

## Context
V1 数据层需要：
- TypeScript 类型安全
- PostgreSQL 原生特性（JSONB / 数组 / 物化视图 / 触发器）
- 在 Server Action / worker / migration job 多种环境中跑
- 多租户中间件强制 tenant_id 注入
- 镜像体积控制（V1 单节点 ECS 4C/16G）

候选：Prisma / Drizzle / Kysely / TypeORM。

## Decision
选 **Drizzle ORM + drizzle-kit**。
- schema 写 TypeScript（`pgTable`...），migration 由 drizzle-kit generate
- query builder 风格，不藏 SQL
- 通过 `withTenant(db, tenantId)` 中间件强制注入 WHERE

## Consequences
- 正面:
  - 无独立 schema DSL，schema 就是 TS，IDE 跳转完整
  - 镜像无需打 Prisma engine binary（节省 ~80MB）
  - JSONB / 物化视图 / `sql` 模板直接表达
  - migration 文件就是 SQL，review 友好
- 负面:
  - 生态 < Prisma，部分高级 helper 需自写
  - relations API 比 Prisma include 啰嗦
- 后续影响:
  - 所有 repo 函数签名 `(db: Tx, tenantId: string, ...)` 强制
  - V1.5 加 RLS 时 schema 已就绪，仅需 policy DDL

## Alternatives Considered
- **Prisma**: engine binary 体积 + Edge runtime 限制 + schema 是独立 DSL（双倍维护）；放弃
- **Kysely**: 纯 query builder，无 migration 工具（要配合 kysely-codegen + 单独 migration 框架）；过散
- **TypeORM**: 装饰器风格 + 历史包袱（active record vs data mapper 双模式）；放弃

## Related
- 03-data-model.md（schema 全文）
- TD-002（V1.5 上 RLS）
