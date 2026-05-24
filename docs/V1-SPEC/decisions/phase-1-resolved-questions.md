\# Phase 1 实施前的开放问题清单的答案



\## A. monorepo 工程约束



\- A1. 内部 package 命名 scope？（`@honeyai/\*` / `@honey/\*` / `honeyai-\*`）

答案：`@honeyai/\*`

\- A2. `tsconfig.base.json` 放哪里？根目录 / `packages/config`？严格度档位？（strict / noUncheckedIndexedAccess / exactOptionalPropertyTypes 是否全开）

答案：根目录，严格度参考业界标准

\- A3. ESLint 配置：选什么 preset？(`eslint-config-next` / typescript-eslint recommended / airbnb)

答案： typescript-eslint

\- A4. Prettier 规则：tab 还是 space？`printWidth`？trailing comma？

答案：2 space / `printWidth: 100` / `trailingComma: 'all'` / `singleQuote: true` / `semi: false`（与 Next.js 社区默认一致，减少 PR diff 噪音）

\- A5. EditorConfig + `.nvmrc` + `packageManager` 字段是否都铺？

答案：全部铺。三者加起来 < 10 行，保证不同 IDE / Node 版本 / 包管理器锁死

\- A6. pre-commit hook：husky + lint-staged 现在引入还是延后？

答案：Phase 1 引入。脚本仅 `prettier --write` + `eslint --fix`，跑在 staged 文件上，几乎无延迟，可避免脏代码进 PR

\- A7. commitlint：是否强制 Conventional Commits？枚举 `feat/fix/...` 列表？

答案：引入 `@commitlint/config-conventional` + husky `commit-msg` hook，枚举沿用 CLAUDE.md 已有的 `feat/fix/refactor/docs/test/chore/perf/ci`

\- A8. Turbo cache：仅本地 / 远端（Vercel remote cache 等）？

答案：仅本地。远端 cache 涉及外部账号 / 网络可靠性，新增 TD-017 留待 V2

\- A9. 内部包构建产物：esm only / cjs only / dual？是否生成 `.d.ts`？还是源码 import（`"main": "src/index.ts"`）？

答案：源码 import 模式（`"main": "src/index.ts"` + `"types": "src/index.ts"`），不构建。理由：内部消费 + Next.js / vitest 都能直消 ts；publish 真有需求时再加 tsup

\- A10. 8 个 package 哪些 Phase 1 实建、哪些只占位 `package.json`？

答案：实建 `@honeyai/db` + `@honeyai/shared`（errors / logger）；其余 6 个（core / web / worker / orchestrator / sandbox / adapter-claude）仅占位 `package.json` + 空 `src/index.ts`，确保 turbo / tsconfig 引用闭合

\- A11. 是否引入 `changesets`（内部 package 版本管理）？还是统一 `workspace:\*` 固定？

答案：统一 `workspace:\*`，不引入 changesets。V1 内部消费不发 npm，版本号无意义；V2 若发布再加



\## B. 数据层 schema 落地



\- B1. schema 文件组织：`packages/db/src/schema/` 单文件 vs 按域拆分（runs / assets / cost / audit ...）？

答案：按域拆分（`runs.ts` / `assets.ts` / `cost.ts` / `audit.ts` / `ir.ts` / `tenant.ts` / `sandbox.ts` 等），`packages/db/src/schema/index.ts` 聚合 re-export。30 表单文件会超 800 行触发 hook 拦截

\- B2. UUID 来源：客户端 `uuidv7()` 还是 DB `gen\_random\_uuid()`（PG 17 自带）？性能 vs 可调试性？

答案：客户端 `uuidv7()`（`uuid@9` v7 实现）。时序可排序 + 应用层日志 / trace 可见 + 跨 service / DB 一致；性能差异在 V1 规模内可忽略

\- B3. `pgEnum` 命名约定（`run\_status\_enum` vs `runStatus`）+ 新增枚举值迁移模式

答案：PG 端 `<domain>_<concept>_enum`（snake_case），如 `run_status_enum` / `ir_stage_enum`；TS 变量驼峰 `runStatusEnum`。新增值用 `ALTER TYPE ... ADD VALUE`（drizzle-kit 0.20+ 支持），不写 down

\- B4. Index 命名约定（`idx\_<table>\_<cols>` vs Drizzle 默认）

答案：`<table>_<cols>_idx`（PG 社区习惯），drizzle `.index('runs_tenant_created_idx').on(...)`。统一后缀便于 `\\di` 输出按表分组

\- B5. FK `ON DELETE` 全表枚举：spec hint cascade 的表，其他表（如 audit\_log）默认行为是什么？

答案：默认 `restrict`（防误删）；仅父级删则子级无意义的明确 cascade（tenants → 全部子表、runs → nodes/artifacts/ir_documents、users → sessions）。`audit_log` 用 `set null`（保留事件 + 失去主体）。落地时在 PR 给一张完整 FK 行为表

\- B6. `jsonb` 默认值策略：null / `'{}'::jsonb` / 结构化默认对象？

答案：必填字段用 `'{}'::jsonb` 默认（`.notNull().default(sql\`'{}'::jsonb\`)`）；可空字段用 null（不给默认）。避免 nullable + default 同时存在的歧义

\- B7. 物化视图 `run\_cost\_summary` 在 migration 里如何幂等创建 + 刷新调度？

答案：migration 用 `CREATE MATERIALIZED VIEW IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS`（drizzle-kit 不直管，走 raw SQL）。刷新调度：BullMQ repeat job（5min）而非 pg_cron，避免 DB 扩展依赖

\- B8. multi-schema：全部塞 `public`，还是按域分（`runs`/`assets`/`audit`）？

答案：全部 `public`。multi-schema 增加 migration / dump / 权限运维复杂度，30 表不到 multi-schema 收益阈值。新增 TD-018 留 V2 考虑



\## C. migrations \& 部署兼容



\- C1. Migration 工具链：`drizzle-kit generate` + `drizzle-kit migrate`；命名格式（timestamp / sequential 序号）

答案：`drizzle-kit generate` + `drizzle-kit migrate`；命名走 drizzle 默认 `<timestamp>_<snake_summary>.sql`（如 `0001_<slug>.sql` 由 drizzle 自动加 hash-suffix）。timestamp 顺序避免 PR 合并时 sequential 序号冲突

\- C2. Prod migration 运行点：app 启动时 auto-migrate vs 独立 k8s Job vs 手动 kubectl exec

答案：独立 k8s Job（pre-deploy hook / Argo PreSync），失败阻止 rollout。app boot auto-migrate 会触发多副本竞态 + 启动慢

\- C3. 本地 docker-compose 内容：PG 17 + Redis + MinIO（OSS local）？或 Phase 1 只起 PG？

答案：Phase 1 全起 PG + Redis + MinIO。一次 `docker-compose up -d` 跑齐，避免后续 phase 反复改 compose 文件 / 文档；MinIO 镜像很小（~ 60MB）

\- C4. CNPG 兼容性验证策略：本地 PG 17 通过即可，还是必须在 k3s 上跑一次烟雾？

答案：Phase 1 仅本地 PG 17 + CI postgres:17 service。CNPG 烟雾推迟到 Infra phase；schema 层级语法与原生 PG 完全一致，CNPG 差异在 HA / 备份而非 SQL

\- C5. 多环境 migration 一致性保证（local / CI / prod 之间漂移如何检测）

答案：CI 强制 `drizzle-kit check`（schema 与 migration 文件夹一致）+ `drizzle-kit migrate --dry-run`（待迁移列表必须为空）；prod 用 drizzle 自带 `__drizzle_migrations` 表追溯



\## D. withTenant + repo 层



\- D1. `withTenant` 实现：Proxy / codegen / 类型层枚举允许表？

答案：运行时 Proxy + 类型层 `TenantScoped` 接口标记。Proxy 拦截 select/insert/update/delete 调用时若 schema 含 `tenantId` 字段则自动注入 WHERE；codegen 维护成本高 + 与 drizzle migration 不友好

\- D2. 跨租户表（`tenants` / `users` / `platform\_admin` 操作）走 `withTenant` 还是 `rawDb`？接口怎么暴露？

答案：`packages/db` 暴露两个：`withTenant(tenantId)` 默认；`systemDb()` 显式跨租户访问，签名注明 "platform-admin only" + 强制写 `audit_log`。误用通过 lint rule 阻止（禁止业务 package 直接 import `systemDb`，仅 admin 路由可用）

\- D3. 事务回调内拿到的 db：自动继承 `tenantId` 还是必须重新 `withTenant(tx)`？

答案：自动继承。`withTenant(t).transaction(async tx => { ... })` 里的 tx 已带 t，开发者无需重复包；Proxy 在 `.transaction()` 调用上递归包装

\- D4. Repo 风格：纯函数 + 模块导出 vs class-based vs DAO 接口？

答案：纯函数 + 按域模块（`packages/db/src/repos/runs.ts` 导出 `createRun` / `getRun` / `listRuns` 等）。class 引入 DI 复杂度，V1 不需要；mock 用 vitest spy

\- D5. 错误类型层级（`CrossTenantAccessError` / `IRVersionConflictError` 等）放哪个 package？`@honeyai/errors`？

答案：`@honeyai/shared/src/errors/`，不单开 `@honeyai/errors`（shared 已够用）。基类 `HoneyAIError` 带 `code` / `cause` / `userMessage` / `httpStatus`，子类继承

\- D6. drizzle-zod：从 schema 自动生成 zod，还是手写 zod schema？版本如何同步？

答案：用 `drizzle-zod` 自动生成 `createInsertSchema` / `createSelectSchema`，业务必要 refine（如 IR markdown 内容 + frontmatter）用 `.extend()` 手写覆盖。drizzle schema 变化自动同步 zod，零 drift



\## E. 测试 \& ac:coverage



\- E1. Test DB 策略：testcontainers / 启动前 schema reset / 事务 rollback / 模板库 + 每测 createdb？

答案：testcontainers（`@testcontainers/postgresql`）+ 模板库模式。`beforeAll` 起 1 个 PG 容器并跑 migration → 创建模板库；每 test 用 `CREATE DATABASE ... TEMPLATE template_honeyai`（< 50ms），test 完 drop。完全隔离 + 与 CI 一致

\- E2. Test fixture：手写工厂函数 / faker / 共享 seed 脚本？

答案：手写工厂函数（`packages/db/src/test/factories.ts` 导出 `makeTenant()` / `makeRun()` / `makeIR()` 等），返回带合理默认 + 可覆盖参数。faker 推迟到压测 / 大数据集场景

\- E3. Vitest workspace 一次跑全部 vs 各 package 各自 `vitest.config.ts`？

答案：workspace 模式（根 `vitest.workspace.ts` 列各 package），单次 `pnpm test` 跑全部 + 共享 setup（如 testcontainers 启停）

\- E4. `pnpm ac:coverage` 工具实现位置（`packages/tools/ac-coverage` / `scripts/`）+ 输出格式（stdout / JSON / PR comment）？

答案：`packages/tools/ac-coverage`（独立 package，便于将来加测试 / 复用）。输出三态：stdout markdown table + `coverage/ac.json` + GitHub Action 用 `actions/github-script` 拿 JSON 渲染 PR comment

\- E5. AC 来源：扫 spec markdown 找 `AC-XX-YY` 还是维护单独 `ac-registry.yaml`？哪种更不容易 drift？

答案：扫 spec markdown（regex `AC-\\d{2}-\\d{2}`）+ 扫测试 title prefix `AC-XX-YY:`，做 join 输出 covered / missing / orphan-test 三态。单独 registry 必 drift

\- E6. `\[Manual]` AC 验证机制：PR 模板 checkbox 解析？由谁勾选？CI 如何认账？

答案：PR 模板内列出本 PR 覆盖的 `\[Manual]` AC 为 checkbox；CI 用 `actions/github-script` 读 PR body checkbox 状态，未勾不阻 merge 但出 warning；勾选证据（截图 / 日志链接）由 PR 作者粘贴在 checkbox 下

\- E7. AC 覆盖率阈值（V1.0 门槛 50% / 关键章节 70%）在 CI 强制 fail 还是只 comment？

答案：分级 — 种子 AC 100% 强制 fail（任何 PR）；全量 50% + 关键章节 70% 仅 comment（避免 Phase 2/3 早期被卡），release tag 时强制 fail



\## F. CI 链路



\- F1. CI 服务：GitHub Actions 确认；job 矩阵（仅 Node 22 还是加 20？仅 ubuntu 还是加 macos）？

答案：仅 Node 22 + ubuntu-latest。V1 部署目标确定（k3s + Node 22），多矩阵只增 CI 分钟数

\- F2. CI 内 DB：`services: postgres` action vs 自起 container？版本固定 17？

答案：`services: postgres:17` GH 原生（速度优于在 step 内 docker run），版本固定 17 与本地 / 生产 CNPG 一致

\- F3. 必跑 job：`lint` / `typecheck` / `test` / `migration-check`（drizzle-kit check）/ `ac-coverage`？顺序 + 并行度？

答案：并行 lint + typecheck + migration-check（drizzle-kit check） → 串行 test → ac-coverage。需要 PG 的 test 在并行块完成后跑，避免起容器浪费

\- F4. Branch protection：哪些 job 是 required？

答案：required = lint + typecheck + migration-check + test + ac-coverage（seed 100%）；optional = ac-coverage（全量阈值）

\- F5. PR 模板（00-README 提到的 Acceptance 段）需要在 Phase 1 一并落地吗？

答案：是。`.github/pull_request_template.md` 10 行内，含 Summary / Acceptance / Manual AC 三段；与 ac:coverage 工具配套生效



\## G. 杂项 / 影响后续 phase



\- G1. `.gitignore`：补充 `.turbo/` `dist/` `.next/` `\*.tsbuildinfo` `coverage/` 等？

答案：Phase 1 一次到位 — `node_modules/` `.turbo/` `dist/` `.next/` `*.tsbuildinfo` `coverage/` `.env*` `!.env.example` `.DS_Store` `*.log`

\- G2. 根目录 `LICENSE` / `CONTRIBUTING.md`：现在写还是等 V1 release？

答案：延后到 V1 release 前。Phase 1 不必；当前 repo 仅内部 / 试用

\- G3. 日志库选型（pino 在 02-architecture 提到）：Phase 1 db 层是否就引入？还是 console 临时占位？

答案：Phase 1 引入薄封装 `@honeyai/shared/src/log.ts` 导出 `logger`（基于 pino，dev 用 pino-pretty）。db / repo 一律调 logger，便于后续注入 `traceId` / `tenantId` 而无需替换调用点

\- G4. 环境变量管理（`.env` / `@t3-oss/env` / zod-env）：在 Phase 1 就铺，还是先 `process.env` + zod 手验？

答案：Phase 1 就铺 `@t3-oss/env-core`（不绑 nextjs，db 也能用）+ zod 校验，boot 时 fail-fast。避免 `process.env.X` 散落各处后期清理

\- G5. 监控埋点（OpenTelemetry trace\_id 注入）：Phase 1 db 层是否就准备好 context propagation 接口？

答案：不接 OTel SDK，但 logger 预留 `logger.child({ traceId, tenantId })` 接口 + repo 函数签名预留 `ctx?: { traceId?: string }` 可选参数。TD-007 已记录 V2 接 OTel，接口位置先占住

