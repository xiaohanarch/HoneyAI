# ADR-048: Dev tenants 通过 `instrumentation.ts` 启动种子

- 状态: Accepted
- 日期: 2026-05-26

## Context

`dev-credentials.ts` 内存数组 `DEV_USERS` 的 `id` 字段为字符串(如 `'dev-user-alice'`),与 `users.id uuid` 类型冲突。`auth/index.ts` JWT callback 的 `token['tenantId'] = null` 硬编码导致 layout guard 无法从 JWT 取到 tenantId。需要明确 dev tenant seed 的触发时机、uuid 映射、JWT 集成方式,以及防止 seed 进入生产环境的双重 guard 策略。

## Decision

采用 **L2 + U1 + JT3 + ID3 + TS1 + PG3** 组合:

**L2 — `packages/web/instrumentation.ts` 作为触发入口**:在 `register()` 函数内,当 `NEXT_RUNTIME === 'nodejs' && process.env.DEV_AUTH_ENABLED === 'true'` 时调用 `seedDevTenants()`。`instrumentation.ts` 是 Next.js 15 server boot 唯一标准钩子。

**U1 — 硬编码 uuidv7 字面量**:dev fixture 的 user id 和 tenant id 使用硬编码 uuidv7 字面量,跨进程/跨测试 run 保持一致,便于 testcontainer template db seed。

**JT3 — `authorize` 返回 `tenantId`**:`dev-credentials.ts` 的 `DEV_USERS` 增加 `tenantId: string` 和 `tenantSlug: string` 字段;`authorize` 回调返回 `{ id, name, email, tenantId }`;JWT callback 中 `token['tenantId'] = user.tenantId`(替换原 `null` 硬编码)。

**ID3 — `onConflictDoNothing` 事务**:`seedDevTenants()` 在单个 db 事务内写入 tenants + users,使用 drizzle `onConflictDoNothing`,保证幂等——多次 server boot 不重复插入。

**TS1 — template db 一次性 seed**:testcontainer template db(`template_honeyai`)在 `beforeAll` 阶段运行 `seedDevTenants()`,测试内使用 `CREATE DATABASE ... TEMPLATE template_honeyai`,无需每测 re-seed。

**PG3 — 双重 guard + ESLint ban + slice 4.5 ADR 弃用承诺**:
- `instrumentation.ts` 内双重检查:`NEXT_RUNTIME === 'nodejs'` + `DEV_AUTH_ENABLED === 'true'`,任一不满足则跳过。
- ESLint 规则 ban 业务包(非 web 测试文件)导入 `dev-seed.ts`。
- slice 4.5 全局 middleware 落地后,出 ADR-049+ 标记 `dev-seed` 路径为 deprecated,准备 slice 3 GitHub App 接入后整体下线。

## Consequences

**正面**:
- `instrumentation.ts` 是 Next.js 15 标准 server boot 钩子,无需 hack next.config。
- 硬编码 uuidv7 让 dev fixture 跨进程可重复,testcontainer template seed 天然兼容。
- JT3 让 layout guard(ADR-039)从 session JWT 直接取 tenantId,无需额外 db 查询。

**负面**:
- `instrumentation.ts` 在 prod 环境也会 `register()`,PG3 双重 guard 是唯一防线。
- `DEV_AUTH_ENABLED` 是 dev-only env var,必须在生产部署 checklist 中确认未设置。

**后续影响**:
- slice 4.5 ADR 弃用承诺:middleware 落地后正式标记 `dev-seed` 为 deprecated 入档。
- `packages/web/lib/test/db.ts` 作为 testcontainer template 桥,供 AC-01-11 等跨租户测试使用。

## Alternatives Considered

- **L1 — next.config**:`next.config.js` 不支持异步 server-only boot hook,时机不确定。
- **L3 — lazy first-request seed**:首请求延迟触发 seed 会导致竞态条件(多并发首请求并发写入)。
- **U3 — random per-boot uuid**:每次 server boot uuid 不同,testcontainer fixture 无法跨进程复用。
- **JT1 — 留 null**:tenantId = null 导致所有 layout guard 失效,`auth/index.ts` 修改是必要的。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q12`
- 关联 spec: 02-architecture.md §dev-credentials, packages/web instrumentation
- 关联 ADR: ADR-039(layout guard tenantId 来源), ADR-036(AC-01-11 跨租户 testcontainer)
