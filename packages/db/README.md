# @honeyai/db

V1 数据层（30 表 Drizzle schema + migration + `withTenant` Proxy + repos）。

## Tables

30 张表分布于 11 个 schema 文件：

| 域           | 文件                         | 表                                                 |
| ------------ | ---------------------------- | -------------------------------------------------- |
| identity     | `src/schema/identity.ts`     | users, accounts, sessions, tenants, tenant_members |
| github       | `src/schema/github.ts`       | github_installations, repositories, github_tokens  |
| assets       | `src/schema/assets.ts`       | asset_sources, assets, asset_versions              |
| runs         | `src/schema/runs.ts`         | runs, nodes, gates, events, node_retries           |
| artifacts    | `src/schema/artifacts.ts`    | artifact_blobs, artifacts                          |
| ir-documents | `src/schema/ir-documents.ts` | ir_documents                                       |
| sandbox      | `src/schema/sandbox.ts`      | sandboxes, sandbox_credentials                     |
| cost         | `src/schema/cost.ts`         | pricing_book, cost_events                          |
| audit        | `src/schema/audit.ts`        | audit_log, activity_feed                           |
| encryption   | `src/schema/encryption.ts`   | data_encryption_keys                               |
| jobs         | `src/schema/jobs.ts`         | jobs, job_locks, asset_sync_queue                  |

## Foreign Key Behavior Table

> 默认 `restrict`（防误删），cascade 例外见下；`audit_log` 用 `set null`（保留事件）。

| 子表                | FK 列 → 父表                              | ON DELETE |
| ------------------- | ----------------------------------------- | --------- |
| accounts            | user_id → users.id                        | cascade   |
| sessions            | user_id → users.id                        | cascade   |
| tenant_members      | tenant_id → tenants.id                    | cascade   |
| tenant_members      | user_id → users.id                        | cascade   |
| repositories        | tenant_id → tenants.id                    | cascade   |
| repositories        | installation_id → github_installations.id | restrict  |
| github_tokens       | user_id → users.id                        | cascade   |
| assets              | tenant_id → tenants.id                    | cascade   |
| assets              | source_id → asset_sources.id              | set null  |
| asset_versions      | asset_id → assets.id                      | cascade   |
| asset_sources       | tenant_id → tenants.id                    | cascade   |
| runs                | tenant_id → tenants.id                    | cascade   |
| runs                | repository_id → repositories.id           | restrict  |
| runs                | created_by_user_id → users.id             | restrict  |
| nodes               | run_id → runs.id                          | cascade   |
| nodes               | parent_node_id → nodes.id                 | restrict  |
| gates               | node_id → nodes.id                        | cascade   |
| events              | run_id → runs.id                          | cascade   |
| events              | node_id → nodes.id                        | cascade   |
| node_retries        | node_id → nodes.id                        | cascade   |
| artifacts           | tenant_id → tenants.id                    | cascade   |
| artifacts           | run_id → runs.id                          | cascade   |
| artifacts           | node_id → nodes.id                        | set null  |
| artifacts           | blob_sha256 → artifact_blobs.sha256       | restrict  |
| ir_documents        | run_id → runs.id                          | cascade   |
| ir_documents        | tenant_id → tenants.id                    | cascade   |
| sandboxes           | run_id → runs.id                          | cascade   |
| sandbox_credentials | sandbox_id → sandboxes.id                 | cascade   |
| cost_events         | tenant_id → tenants.id                    | cascade   |
| cost_events         | run_id → runs.id                          | set null  |
| cost_events         | node_id → nodes.id                        | set null  |
| audit_log           | tenant_id → tenants.id                    | cascade   |
| audit_log           | actor_user_id → users.id                  | set null  |
| activity_feed       | tenant_id → tenants.id                    | cascade   |
| activity_feed       | actor_user_id → users.id                  | set null  |
| asset_sync_queue    | source_id → asset_sources.id              | cascade   |

> 实际实现以代码为准（`pnpm exec vitest run` 验证 FK 行为；`packages/db/src/schema/*.test.ts` 中的 round-trip 测试覆盖 cascade / restrict / set null 关键路径）。

## withTenant Proxy

见 `src/tenant.ts`。所有租户作用域查询必须经过 `withTenant(tenantId, db)`。跨租户操作必须显式调用 `systemDb()`（仅 platform-admin / migration / system job 使用），且必须写 `audit_log`。

ESLint 规则禁止业务包直接 import `rawDb`，强制使用 `withTenant` / `systemDb` 入口。

## drizzle-zod

每个 schema 文件末尾同文件 re-export `insert<Name>Schema` / `select<Name>Schema`（来源：open-Q #7）：

```ts
import { insertRunsSchema } from '@honeyai/db'
const parsed = insertRunsSchema.safeParse(input) // server action 边界验证
```

业务层可用 `.extend()` 叠加 refine。

## Migration

drizzle-kit generate 产 SQL（来源：decisions §C1）：

```bash
pnpm --filter @honeyai/db db:generate --name <slug>   # 产 drizzle/00XX_<slug>.sql
pnpm --filter @honeyai/db db:check                    # 验证 snapshot 一致
pnpm --filter @honeyai/db db:migrate                  # 应用到 DATABASE_URL
```

## 测试

`@testcontainers/postgresql` + 模板库模式。详见 `src/test/container.ts` + `src/test/push-schema.ts`。

- `beforeAll` 启 PG 17 容器 + 用 drizzle migrate 把模板库建好
- 每个 test `CREATE DATABASE ... TEMPLATE template_honeyai`（< 50ms）
- 测试结束 drop 测试库 + 关容器

**禁止使用 pg-mem / SQLite in-memory** —— 与 V1 生产 schema 语义不一致（RLS / jsonb / BRIN / matview / enum / FK 行为）。
