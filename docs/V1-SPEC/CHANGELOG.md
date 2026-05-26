# V1-SPEC Changelog

> 本文档记录 spec 自身的变更。代码层变更走 git 提交，不在此记录。

## 2026-05-26

### v0.8.0 — Phase 2.4 切片 4.2 — `@honeyai/web` shadcn 基础组件 + AppBar

**Added**

- 5 shadcn/ui 基础组件已安装到 `packages/web/components/ui/`：`Button`、`Card`、`DropdownMenu`、`Avatar`、`Skeleton`（通过 `pnpm dlx shadcn@latest add` 安装）
- `packages/web/components/ui/AppBar.tsx` — 表现层 header 组件，含文字 logo（`HoneyAI`，使用 `--font-display`）、租户下拉菜单（当 `tenants.length === 1` 时按 Q9 拍板自动崩塌为静态标签）、用户头像降级菜单 + 退出登录
- 全部 5 个基础组件的冒烟测试（5 个文件，~120 行）
- AppBar 的 6 个行为单元测试，覆盖：logo 渲染、单租户崩塌、多租户下拉菜单、`onTenantChange` 回调、头像降级首字母、`onSignOut` 回调
- `@testing-library/user-event@14.5.2` devDep，用于下拉菜单点击交互测试
- `lib/strings/zh.ts` 新增 `appBar` 命名空间（`switchTenant`、`userMenu`、`signOut`）

**Changed**

- `packages/web/styles/tokens.css` — 尾部追加 `@media (prefers-color-scheme: dark) { :root { /* TODO V1.1 */ } }` 占位块，符合 spec 07 §7（"深色变量留好不暴露切换"）
- `packages/web/styles/globals.css` — shadcn CLI 自动在开头追加默认浅色主题 HSL CSS 变量块（`--background`、`--foreground`、`--primary` 等）
- `packages/web/package.json` — shadcn CLI 添加的运行时依赖：`@radix-ui/react-slot`、`@radix-ui/react-dropdown-menu`、`@radix-ui/react-avatar`、`class-variance-authority`、`lucide-react`

**Note**

- AppBar 尚未接入任何路由 layout；与 `app/t/[slug]/layout.tsx` 的集成将于切片 4.5 与多租户中间件一并落地（Q3 用户决策）
- 无新增 ADR — Q3/Q4/Q9/Q11 已在 `decisions/phase-2-4-open-questions.md` 中拍板

### v0.7.0 — Phase 2.4 切片 4.1:`@honeyai/web` Next.js 骨架 + Auth + tokens

`@honeyai/web` 从 Phase 1 占位包升级为真实 Next.js 15.3 App Router 包；NextAuth v5 Credentials dev provider(ADR-029)+ 完整 OKLCH tokens(spec 07 §10)+ 登录页 + zh 字符串表 + middleware 占位 + shadcn 脚手架。

**Added**

- `@honeyai/web/styles/tokens.css`:50 个 CSS 自定义属性 verbatim 来自 spec §10(4 surface + 4 text + 5 status + 7 agent = 20 OKLCH 颜色;8 font-size + 3 font-family = 11 typography;8 spacing + 4 radius + 2 shadow + 5 motion = 19 structural);`.bg-atmosphere` + `.grain::before` + `@keyframes pulse-run`
- `@honeyai/web/styles/globals.css`:Tailwind v4 `@import` + 全局 reset
- `@honeyai/web/lib/auth/index.ts`:NextAuth v5 配置(JWT strategy + userId/tenantId callbacks);仅在 `NODE_ENV=development && DEV_AUTH_ENABLED=true` 时启用 Credentials provider(ADR-029)
- `@honeyai/web/lib/auth/dev-credentials.ts`:固定用户 alice/bob/carol/dave + `authorizeDevCredentials`;模块级 guard 在生产环境抛错
- `@honeyai/web/lib/auth/types.ts`:NextAuth v5 模块增强(`Session.user.tenantId` + `JWT` from `@auth/core/jwt`)
- `@honeyai/web/lib/strings/zh.ts`:zh-CN UI 字符串集中表(Q10)
- `@honeyai/web/lib/utils.ts`:shadcn `cn` 工具(clsx + tailwind-merge)
- `@honeyai/web/app/layout.tsx`:`lang="zh-CN"` 根 RSC layout + globals.css import + Inter 字体
- `@honeyai/web/app/page.tsx`:欢迎首页引用 token CSS vars
- `@honeyai/web/app/(auth)/login/page.tsx` + `LoginForm.tsx`:登录页 + 客户端表单(controlled inputs + useTransition + signIn redirect:false)
- `@honeyai/web/app/(welcome)/layout.tsx` + `app/t/[slug]/layout.tsx`:路由组占位(4.3 / 4.5 后续填充)
- `@honeyai/web/app/api/auth/[...nextauth]/route.ts`:NextAuth v5 catch-all 路由 handler
- `@honeyai/web/middleware.ts`:passthrough 占位(tenant routing 在 4.5 实现)
- `@honeyai/web/components.json`:shadcn 配置(slice 4.2 添加 Button/Card 等)
- `@honeyai/web/next.config.mjs` + `postcss.config.mjs` + `vitest.config.ts`:Next 15 standalone + Tailwind v4 + Vitest jsdom(singleFork pool 绕过 Windows OOM)
- `.env.example`:`NEXTAUTH_SECRET` / `NEXTAUTH_URL` / `DEV_AUTH_ENABLED` 条目
- 17 个 Vitest + jsdom 单元测试(8 dev-credentials + 3 auth + 2 layout + 4 login)100% 通过

**Changed**

- `@honeyai/web/package.json`:新增运行时依赖 `next@15.3.2` / `next-auth@5.0.0-beta.25` / `react@19.1.0` / `react-dom@19.1.0` / `clsx@2.1.1` / `tailwind-merge@2.6.0`;dev 依赖 `@auth/core@0.37.2` / `@tailwindcss/postcss@4.1.6` / `@testing-library/jest-dom@6.6.3` / `@testing-library/react@16.3.0` / `@vitejs/plugin-react@4.4.1` / `jsdom@26.1.0` / `tailwindcss@4.1.6` / `vitest@2.1.8`
- `@honeyai/web/tsconfig.json`:Bundler 模块解析 + `@/*` paths alias + Next plugin

**ADRs referenced**:ADR-029(Credentials dev provider)、ADR-031(RSC + Server Actions no tRPC)、ADR-003(unified Next.js)、ADR-006(Welcome layout stub)

**Note**

- 切片 4.1 不含 shadcn UI 组件(Button/Card 等),不含 tenant routing,不含 Welcome 4-step 流程,不含 GitHub OAuth provider — 以上按 slice 4.2 / 4.3 / 4.5 / 3.x 后续推进
- `output: 'standalone'` 在 Windows 本地需要 admin/开发者模式以创建 symlink;CI(Linux)无此限制

### v0.4.0 — Phase 2.0 切片 0:`@honeyai/core` IR zod schemas

3 个 IR(Requirement / Design / Implementation)zod schema + parse/stringify 工具 + spec §8 golden roundtrip 测试落地。
不含版本规则运行时(Q5=B,切片 1)、不含 Tiptap generator(Q6=B,切片 4)、不含 ir_documents 持久化(切片 1)。

**Added**

- `@honeyai/core/src/ir/shared.ts`:Priority / Complexity / RiskLevel / FindingSeverity enums + `IRParseOutcome<T>` discriminated union + 内部 `parseFrontmatter` / `stringifyFrontmatter` helper(gray-matter wrapper)
- `@honeyai/core/src/ir/requirement.ts`:`RequirementIRSchema` + `parseRequirementIR` + `stringifyRequirementIR` + `REQUIRED_REQUIREMENT_SECTIONS` 常量(对齐 spec 04 §2.1 / §2.2)
- `@honeyai/core/src/ir/design.ts`:`DesignIRSchema` + `parseDesignIR` + `stringifyDesignIR`(对齐 spec 04 §3.1)
- `@honeyai/core/src/ir/implementation.ts`:`ImplementationIRSchema` + `parseImplementationIR` + `stringifyImplementationIR`(对齐 spec 04 §4.1)
- `@honeyai/core/src/ir/index.ts`:IR 模块 barrel
- 单元测试:每 schema happy + failure case + spec §8.1 / §8.2 / §8.3 golden roundtrip
- ADR-021 至 ADR-026:Phase 2.0 Q1-Q6 拍板入档

**Changed**

- `@honeyai/core/package.json`:新增 `gray-matter 4.0.3` 依赖
- `@honeyai/core/src/index.ts`:根 barrel 追加 IR 模块再导出

**Note**

- IR 正文 H2 section(spec 04 §2.2)仅返回 warning,**不**进 zod 强校验(ADR-023)
- Phase 2.0 PR 不含 orchestrator / adapter / sandbox / web / github / worker 任何代码;以上交付按 `decisions/phase-2-open-questions.md §M1` 切片顺序后续推进

## 2026-05-25

### v0.3.0 — Phase 1 implementation

10 包 pnpm/Turborepo workspace 实建；`@honeyai/db` 全量 schema + migration + repos + `withTenant`；
`@honeyai/tools-ac-coverage` 实建；CI workflow + PR comment；ADR-009..016 入档。

**Added**

- 10-package pnpm/Turborepo workspace（core 最小子集 / db 全量 / tools-ac-coverage 全量 / 7 包占位 `export {}`）
- `@honeyai/db`：30 表 Drizzle schema + drizzle-zod re-export + 首份 migration + `run_cost_summary` 物化视图单独 SQL（ADR-011）
- `withTenant(db, tenantId)` Proxy + ESLint `no-restricted-imports` 强制业务包不准 import `rawDb` / `systemDb`
- 种子 AC 测试：`AC-03-01` / `AC-03-02` / `AC-03-03` 全部 green（template-DB + testcontainers 模式）
- `@honeyai/tools-ac-coverage`：spec markdown scanner + vitest title scanner + 三态 join 报表 + seed AC 退出码门禁；`pnpm ac:coverage` 在 root 暴露
- `.github/workflows/ci.yml`：`lint` / `typecheck` / `migration-check` 并行 → `test`（postgres:17-alpine service）→ `ac-coverage`（artifact 上传）
- `.github/workflows/pr-comment.yml`：`workflow_run` 触发，下载 `ac-coverage` artifact，`actions/github-script` 渲染 PR comment
- ADR-009 至 ADR-016（Phase 1 拍板 8 项入档）

**Changed**

- `02-architecture.md §2`：`infra/migrations/` → `packages/db/drizzle/`（ADR-010）
- `02-architecture.md §3`：包矩阵新增 `tools-ac-coverage` 行 + 新增 Phase 1 状态列

**Note**

- Phase 1 不动业务（orchestrator / sandbox-runner / web / github / worker / adapter-claude / adapter-opencode）；7 包仅 `export {}`，等 Phase 2+
- `@honeyai/core` IR zod schemas 推迟 Phase 2（ADR-008 + ADR-014）

### ADR-019 — docker-compose host 端口改 5 字头非标准映射

- 新增 `docs/V1-SPEC/ADRs/ADR-019-docker-compose-ports.md`：host 端口 `5432→55432` / `6379→56379` / `9000→59000` / `9001→59001`，容器内端口不变
- 触发：本机 `honeybadge-postgres` / `honeybadge-redis` 已占用标准端口，B1 `docker compose up -d` 报 `port is already allocated`
- 影响范围：`docker-compose.yml` 4 个端口行 + `.env.example` `DATABASE_URL` 主机端口 + plan §B1 字面 + `CLAUDE.md` tech stack 表

### ADR-018 — docker-compose MinIO tag 改为 `RELEASE.2025-01-20T14-49-07Z`

- 新增 `docs/V1-SPEC/ADRs/ADR-018-minio-image-tag.md`：MinIO 镜像 tag 由 plan §B1 原 `RELEASE.2024-12-18T13-15-30Z` 改为 `RELEASE.2025-01-20T14-49-07Z`
- 触发：Phase 1 §B1 `docker compose up -d` 时本机阿里云镜像源对原 tag 返回 403 Forbidden
- 影响范围：仅 `docker-compose.yml` + plan §B1 字面 + `CLAUDE.md` tech stack 表本地容器行
- 与 Phase 1 功能无关：`@honeyai/db` 不读写 object storage，新 tag 仅满足"本机可拉 + 仍 pin 固定版本"

### ADR-017 — 本地 Node 引擎上界放宽

- 新增 `docs/V1-SPEC/ADRs/ADR-017-node-engines-relaxed.md`：`engines.node` 由 `">=22.11.0 <23"` 改为 `">=22.11.0"`；CI/Prod 仍固定 22.11.0
- 触发：Phase 1 §A1 启动时本地 Node v24，原上界阻塞 pnpm install
- 影响范围：仅 root `package.json` + `CLAUDE.md` tech stack 表 Node 行

## 2026-05-24

### v0.2.0 — Audit P0 闭环（artifact 版本规则 + 验收清单框架）

来源：grill-me 会话 11 轮（Q1-Q11），针对前次 audit 的 2 个 P0 缺口。

**P0-2 / Artifact 与 IR 版本规则**
- **04 §11**：新增 IR 版本规则 6 小节（monotonic int + 乐观锁 + Redis advisory 编辑锁 5min idle + 强抢二次确认 + zod 失败 / 锁丢失 UX + 与 artifact 语义对比表）
- **03 §6.6b**：新增 `ir_documents` 完整 Drizzle schema（append-only、PK=(run_id,stage,version)、tenant 级联删除）
- **03 §6**：`artifacts` 表去掉 `version`，新增 `attempt` 字段 + UNIQUE `(run_id, node_id, attempt, kind)`；`artifact_blobs.oss_key` UNIQUE 实现 CAS 物理去重 + INSERT 幂等
- **06 §16-17**：OSS 写入语义（PUT-first + emit JSONL + worker 幂等 INSERT，无 GC，孤儿与 tenant 级联清理）+ canonical OSS key 规范 `oss://honeyai-prod/<tenant_id>/blobs/<sha256[0:2]>/<sha256[2:]>`
- **02 §5.1 + 08 deploy-prod.yml**：sandbox image digest 通过 worker `SANDBOX_IMAGE_DIGEST` env 注入（kustomize patch），worker/sandbox 强绑定同一 release
- **10 TD-016**：新增"单 OSS bucket + tenant 前缀隔离"债务条目 + 触发表更新

**P0-1 / 验收清单（Acceptance Criteria）框架**
- **00 README**：新增"验收清单约定"段（AC-XX-YY ID + 7 维度标签 + 强制 Happy+Failure + 测试 title prefix 绑定 + `pnpm ac:coverage` 工具 + V1.0 release 门槛：种子 100% / 全量 ≥50% / 关键章节 ≥70% + PR template 集成）
- **01-09 各章**：末尾追加"验收清单（V1.0 种子）"段，共 24 条种子 AC（01:3 / 02:2 / 03:3 / 04:2 / 05:4 / 06:3 / 07:2 / 08:2 / 09:3）

## 2026-05-23

### v0.1.0 — 完整版（10 章 + 7 ADR）
- 批 A（00/01/02）：术语表 + 3 黄金路径 + 4 wireframe + 4 时序图 + 9 package public API + 文件结构
- 批 B（03/04）：30 张 Drizzle 表完整 schema + 3 份 IR markdown 示例 + Tiptap SchemaForm
- 批 C（05/06）：FSM 完整转移表 + 8 类 SSE 事件示例 + retry POLICY + Dockerfile.sandbox + Cilium NetworkPolicy + Pod template
- 批 D（07/08/09）：tokens.css 完整 OKLCH 设计系统 + 02-services.sh + deploy-prod.yml + CNPG/Ingress/Deployment manifest + Grafana 面板 JSON + prom-client + 黄金路径 A 实算成本 121,955 μUSD ≈ $0.12
- 批 E（10 + ADRs）：15 条 Tech Debt（含 V2 触发信号）+ 7 个完整 ADR（drizzle / sse / unified-next / kubectl-exec / ghcr-only / bootstrap-ux / run-binary-state）

### v0.1.0-skeleton — 初版骨架
- 从 grill-me 会话 Q1-Q17 生成 10 个章节骨架 + 7 个 ADR 索引
- 决策：Tier B 范围 / Bootstrap UX 4 步 / 失败 UX 二元状态 / 原型 B 策略（legacy 参考）/ ECS 单节点 / Tech debt 15 条
