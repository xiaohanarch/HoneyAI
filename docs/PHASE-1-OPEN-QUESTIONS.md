# Phase 1 实施前的开放问题清单

> 范围：ADR-008 选定的 A 范围 — monorepo 骨架 + db 全表落地 + withTenant + AC 单测 + CI。
> 用途：新 session 启动 Superpowers 时带过去，逐条决策。

## A. monorepo 工程约束

- A1. 内部 package 命名 scope？（`@honeyai/*` / `@honey/*` / `honeyai-*`）
- A2. `tsconfig.base.json` 放哪里？根目录 / `packages/config`？严格度档位？（strict / noUncheckedIndexedAccess / exactOptionalPropertyTypes 是否全开）
- A3. ESLint 配置：选什么 preset？(`eslint-config-next` / typescript-eslint recommended / airbnb)
- A4. Prettier 规则：tab 还是 space？`printWidth`？trailing comma？
- A5. EditorConfig + `.nvmrc` + `packageManager` 字段是否都铺？
- A6. pre-commit hook：husky + lint-staged 现在引入还是延后？
- A7. commitlint：是否强制 Conventional Commits？枚举 `feat/fix/...` 列表？
- A8. Turbo cache：仅本地 / 远端（Vercel remote cache 等）？
- A9. 内部包构建产物：esm only / cjs only / dual？是否生成 `.d.ts`？还是源码 import（`"main": "src/index.ts"`）？
- A10. 8 个 package 哪些 Phase 1 实建、哪些只占位 `package.json`？
- A11. 是否引入 `changesets`（内部 package 版本管理）？还是统一 `workspace:*` 固定？

## B. 数据层 schema 落地

- B1. schema 文件组织：`packages/db/src/schema/` 单文件 vs 按域拆分（runs / assets / cost / audit ...）？
- B2. UUID 来源：客户端 `uuidv7()` 还是 DB `gen_random_uuid()`（PG 17 自带）？性能 vs 可调试性？
- B3. `pgEnum` 命名约定（`run_status_enum` vs `runStatus`）+ 新增枚举值迁移模式
- B4. Index 命名约定（`idx_<table>_<cols>` vs Drizzle 默认）
- B5. FK `ON DELETE` 全表枚举：spec hint cascade 的表，其他表（如 audit_log）默认行为是什么？
- B6. `jsonb` 默认值策略：null / `'{}'::jsonb` / 结构化默认对象？
- B7. 物化视图 `run_cost_summary` 在 migration 里如何幂等创建 + 刷新调度？
- B8. multi-schema：全部塞 `public`，还是按域分（`runs`/`assets`/`audit`）？

## C. migrations & 部署兼容

- C1. Migration 工具链：`drizzle-kit generate` + `drizzle-kit migrate`；命名格式（timestamp / sequential 序号）
- C2. Prod migration 运行点：app 启动时 auto-migrate vs 独立 k8s Job vs 手动 kubectl exec
- C3. 本地 docker-compose 内容：PG 17 + Redis + MinIO（OSS local）？或 Phase 1 只起 PG？
- C4. CNPG 兼容性验证策略：本地 PG 17 通过即可，还是必须在 k3s 上跑一次烟雾？
- C5. 多环境 migration 一致性保证（local / CI / prod 之间漂移如何检测）

## D. withTenant + repo 层

- D1. `withTenant` 实现：Proxy / codegen / 类型层枚举允许表？
- D2. 跨租户表（`tenants` / `users` / `platform_admin` 操作）走 `withTenant` 还是 `rawDb`？接口怎么暴露？
- D3. 事务回调内拿到的 db：自动继承 `tenantId` 还是必须重新 `withTenant(tx)`？
- D4. Repo 风格：纯函数 + 模块导出 vs class-based vs DAO 接口？
- D5. 错误类型层级（`CrossTenantAccessError` / `IRVersionConflictError` 等）放哪个 package？`@honeyai/errors`？
- D6. drizzle-zod：从 schema 自动生成 zod，还是手写 zod schema？版本如何同步？

## E. 测试 & ac:coverage

- E1. Test DB 策略：testcontainers / 启动前 schema reset / 事务 rollback / 模板库 + 每测 createdb？
- E2. Test fixture：手写工厂函数 / faker / 共享 seed 脚本？
- E3. Vitest workspace 一次跑全部 vs 各 package 各自 `vitest.config.ts`？
- E4. `pnpm ac:coverage` 工具实现位置（`packages/tools/ac-coverage` / `scripts/`）+ 输出格式（stdout / JSON / PR comment）？
- E5. AC 来源：扫 spec markdown 找 `AC-XX-YY` 还是维护单独 `ac-registry.yaml`？哪种更不容易 drift？
- E6. `[Manual]` AC 验证机制：PR 模板 checkbox 解析？由谁勾选？CI 如何认账？
- E7. AC 覆盖率阈值（V1.0 门槛 50% / 关键章节 70%）在 CI 强制 fail 还是只 comment？

## F. CI 链路

- F1. CI 服务：GitHub Actions 确认；job 矩阵（仅 Node 22 还是加 20？仅 ubuntu 还是加 macos）？
- F2. CI 内 DB：`services: postgres` action vs 自起 container？版本固定 17？
- F3. 必跑 job：`lint` / `typecheck` / `test` / `migration-check`（drizzle-kit check）/ `ac-coverage`？顺序 + 并行度？
- F4. Branch protection：哪些 job 是 required？
- F5. PR 模板（00-README 提到的 Acceptance 段）需要在 Phase 1 一并落地吗？

## G. 杂项 / 影响后续 phase

- G1. `.gitignore`：补充 `.turbo/` `dist/` `.next/` `*.tsbuildinfo` `coverage/` 等？
- G2. 根目录 `LICENSE` / `CONTRIBUTING.md`：现在写还是等 V1 release？
- G3. 日志库选型（pino 在 02-architecture 提到）：Phase 1 db 层是否就引入？还是 console 临时占位？
- G4. 环境变量管理（`.env` / `@t3-oss/env` / zod-env）：在 Phase 1 就铺，还是先 `process.env` + zod 手验？
- G5. 监控埋点（OpenTelemetry trace_id 注入）：Phase 1 db 层是否就准备好 context propagation 接口？
