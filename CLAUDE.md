# Project: HoneyAI

多智能体 AI 数字研发产线（DevPipeline）—— 一句话需求经 3 阶段 + 人在回路 Gate 自动产出 GitHub PR。当前阶段：**Phase 1**（monorepo 骨架 + db 全表落地）。

## What This System Does

3 个 stage（需求富化 → 设计与拆解 → 编码+UT），每阶段间一个强制人在回路 Gate 节点。单 ECS / k3s / Next.js 15 / Drizzle / Postgres 17，sandbox 用 kubectl exec 长跑 Pod 跑 Claude Code CLI。V1 = Tier B，目标 5-10 人小团队自部署试用 1-2 周。

详细定位：`D:\code\ai-devops\docs\V1-SPEC\01-product.md`。架构：`D:\code\ai-devops\docs\V1-SPEC\02-architecture.md`。

## Specification Authority

- V1-SPEC 根目录：`D:\code\ai-devops\docs\V1-SPEC\`
- 入口文件：`D:\code\ai-devops\docs\V1-SPEC\README.md` → `00-README.md`（术语 + AC 约定）
- ADR 目录：`D:\code\ai-devops\docs\V1-SPEC\ADRs\`
- 已解决问答：`D:\code\ai-devops\docs\V1-SPEC\decisions\phase-1-resolved-questions.md`
- 变更历史：`D:\code\ai-devops\docs\V1-SPEC\CHANGELOG.md`

**`D:\code\ai-devops\docs\V1-SPEC\` 是只读。** 任何变更必须通过新建 ADR-00X（从 ADR-009 起编号），不准直接改 frozen 章节（01..09）。

**Spec 是 frozen 的。** 实施过程中发现缺失或矛盾，**必须停下来问用户**。不准自决、不准默默补全、不准凭印象推断。

## Phase 1 Scope

**Phase 1 只做以下 4 件事**（来源：`ADR-008`）：

1. pnpm workspace + Turborepo + 9 packages 骨架（见 §6）
2. `@honeyai/db` 30 张表完整 Drizzle schema（含 v0.2.0 新增 `ir_documents` + `artifacts.attempt` 模型）
3. 首份 drizzle migration + `docker-compose.yml`（PG 17 + Redis + MinIO）+ 本地 PG 17 兼容性验证
4. `withTenant` middleware + 三条种子 AC 测试 100% 通过：`AC-03-01` / `AC-03-02` / `AC-03-03`（定义见 `D:\code\ai-devops\docs\V1-SPEC\03-data-model.md §9`）

**不要碰以下包**（Phase 1 仅生成 `package.json` + 空 `src\index.ts`，内容为 `export {}`）：

- `@honeyai/orchestrator` — Run/Node FSM、Gate、retry、reconcile
- `@honeyai/adapter-claude` — Claude Code CLI 适配
- `@honeyai/adapter-opencode` — opencode 适配
- `@honeyai/github` — GitHub App + OAuth + 客户端
- `@honeyai/web` — Next.js 15 主应用
- `@honeyai/worker` — BullMQ worker 进程
- `@honeyai/sandbox-runner` — sandbox 内 Node CLI

**不要碰以下业务和基础设施**：

- 任何 Server Action / React 组件 / Next.js 路由
- 任何 BullMQ job / orchestrator FSM / sandbox 调度
- `D:\code\ai-devops\infra\bootstrap\*.sh` / k8s manifests / Cilium / OSS 集成
- GitHub App 认证、OAuth、webhook、personal tenant 自动创建业务逻辑
- `D:\code\ai-devops\prototype\` 目录（保留为 legacy，只读）

**如果觉得"顺手把 X 也做了会更好"，停下来问用户。** 不准扩张 scope。

## Implementation Order

每步严格 TDD（红 → 绿 → 重构）。每完成 3 个步骤停下来汇报一次。

1. **Workspace 基础设施** —— 根 `package.json` + `pnpm-workspace.yaml` + `turbo.json` + `tsconfig.base.json` + Prettier + ESLint + husky / lint-staged / commitlint + `.gitignore` + `.nvmrc` + `.github\pull_request_template.md`
2. **`docker-compose.yml`** —— PG 17 + Redis + MinIO，本地一键起
3. **`@honeyai/core` 骨架** —— `errors\` + `log\` + `env\` + `constants\`（仅 Phase 1 必需子集；IR zod schemas 推迟 Phase 2）
4. **`@honeyai/db` schema** —— 按域拆 11 个文件，每表先写最小单测（INSERT / SELECT 断言）→ 写 schema → 测试转绿
5. **Drizzle migration** —— `drizzle-kit generate` 产首份 SQL；`run_cost_summary` 物化视图用手写 raw SQL 段补
6. **testcontainers + 模板库测试基础设施** —— `packages\db\src\test\factories.ts` + `vitest.workspace.ts`
7. **`withTenant` Proxy** —— 先写 AC-03-01/02/03 三条测试看到红 → 实现 Proxy 转绿 → 加 ESLint 规则禁止业务包 import `rawDb`
8. **Repos 纯函数** —— 每域一个文件，仅 Phase 1 单测要用到的最小函数集
9. **占位 7 个包** —— 每包仅 `package.json` + `tsconfig.json` + `src\index.ts`（`export {}`）
10. **CI workflow** —— `.github\workflows\ci.yml`：并行 lint + typecheck + migration-check → 串行 test → ac-coverage（seed 100% 强制 fail）
11. **`@honeyai/tools-ac-coverage` 最小实现** —— 扫 spec markdown + 扫 vitest title，输出 seed AC 三态报表
12. **Spec patch + CHANGELOG** —— `02-architecture.md §3` 改为 9 包真实状态 + `CHANGELOG.md` 写 v0.3.0 条目

## Monorepo Structure

9 个 packages（来源：`02-architecture.md §2.1+§3`；shared 内容并入 `core` 是 Phase 1 用户决策，需同 PR patch 进 spec）：

| Package | Phase 1 归属 | 职责 |
|---|---|---|
| `@honeyai/core` | **实建（最小子集）** | errors / log / env / constants（IR schemas 推迟） |
| `@honeyai/db` | **实建（全量）** | 30 表 Drizzle schema + migration + `withTenant` + repos |
| `@honeyai/orchestrator` | 占位 | Run/Node FSM、Gate、retry、reconcile |
| `@honeyai/adapter-claude` | 占位 | Claude Code CLI 适配 |
| `@honeyai/adapter-opencode` | 占位 | opencode 适配（V1 build-time 不上线） |
| `@honeyai/github` | 占位 | GitHub App + OAuth + 客户端 |
| `@honeyai/web` | 占位 | Next.js 15 主应用 |
| `@honeyai/worker` | 占位 | BullMQ worker 进程 |
| `@honeyai/sandbox-runner` | 占位 | sandbox 内 Node CLI |

## Tech Stack

只列 spec 明确定义的。spec 未指定的标 `TBD — Superpowers plan 阶段确认`，**不准默默补全**。

| 维度 | 选型 | 来源 |
|---|---|---|
| Node | 22 LTS | `ADR-008` + decisions §A5 |
| 包管理 | pnpm（`packageManager` 字段锁版本） | decisions §A1+A5 |
| Postgres | 17（本地 `postgres:17-alpine` / CI `services: postgres:17`） | `ADR-008` + decisions §C2/F2 |
| Monorepo | Turborepo（local cache only） | `ADR-008` + decisions §A8 |
| ORM | Drizzle | `ADR-001` |
| Migration | drizzle-kit generate + migrate | decisions §C1 |
| Zod 生成 | drizzle-zod + `.extend()` 业务 refine | decisions §D6 |
| TS 严格度 | `strict: true`（其余 strict flag 由 ADR-009 决定） | decisions §A2 |
| ESLint preset | typescript-eslint | decisions §A3 |
| Prettier | 2 space / printWidth 100 / trailingComma 'all' / singleQuote / no semi | decisions §A4 |
| 测试 | Vitest workspace mode + `@testcontainers/postgresql` + 模板库 | decisions §E1+E3 |
| Hook 工具 | husky + lint-staged + commitlint config-conventional | decisions §A6+A7 |
| Env | `@t3-oss/env-core` + zod，fail-fast at boot | decisions §G4 |
| Log | pino（dev 用 pino-pretty） | decisions §G3 |
| UUID | 客户端 `uuidv7()`（`uuid@9`） | decisions §B2 |
| 本地容器 | docker-compose（PG + Redis + MinIO） | decisions §C3 |
| CI | GitHub Actions，Node 22，ubuntu-latest only | decisions §F1 |
| 各依赖具体 minor / patch 版本号 | TBD — Superpowers plan 阶段确认 | spec 未指定 |
| Redis 镜像版本 / MinIO 镜像版本 | TBD — Superpowers plan 阶段确认 | spec 未指定 |
| `@honeyai/tools-ac-coverage` Phase 1 范围 | TBD — Superpowers plan 阶段确认 | 见 §10 |

## Testing Rules

**所有 DB 测试必须使用真实 Postgres 17**（`@testcontainers/postgresql` + 模板库模式：`beforeAll` 起 PG 跑 migration 建模板库；每 test `CREATE DATABASE ... TEMPLATE template_honeyai` < 50ms）。

**不准用 pg-mem。** 理由：不支持 RLS、jsonb 操作符不完整、BRIN 索引缺失、物化视图行为不一致 —— 与 V1 生产 schema 语义偏移。

**不准用 SQLite in-memory。** 理由：方言差异覆盖 enum / jsonb / UUID / 生成列 / ON CONFLICT / 事务隔离级别 —— 测试通过 ≠ 生产通过。

**TDD 红绿循环不可妥协。** 顺序：写测试 → 跑测试看到红 → 写实现 → 测试转绿 → 重构。映射 AC 的测试 title 必须 `AC-XX-YY:` 前缀以便 `ac:coverage` 扫描。

**AI 模型调用必须可 mock（Phase 2 起生效）。** Phase 1 无 LLM 调用，但 `@honeyai/core` 暴露的 adapter 接口形状必须允许后续 vitest spy / inject。

**同一测试连续 2 轮实现尝试仍未转绿，停下来问用户。** 不准死循环改实现也不准改测试断言。

## Workflow

**使用 Superpowers 的 spec → plan → subagent-driven-development 流程。**

**跳过 brainstorming 阶段。** 理由：spec v0.2.0 已 frozen，方案空间已锁定。

**Plan 输出后必须停下来等用户审核。** 不准 plan 完直接 go，不准用 ExitPlanMode 自动进入实施。

**每完成 §5 中的 3 个步骤停下来汇报一次。** 汇报内容：已完成 step 编号 + 测试通过列表 + 下一 step 计划 + 触发的 ADR / TD 需求。

**同一测试连续 2 轮失败必须停下来问用户**（同 §8）。

**`D:\code\ai-devops\docs\V1-SPEC\` 内任何文件改动必须单独走 PR review。** Phase 1 实施 PR 可包含 `02-architecture.md §3` 的 9 包 patch + `CHANGELOG.md` 条目；其他章节一律不准改。

## Open Questions

**显著留白清单文件：`D:\code\ai-devops\docs\V1-SPEC\decisions\phase-1-open-questions.md`**

**当前状态：全部 11 项已拍板**（2026-05-25 用户逐一确认）。3 项 ✅ 已锁定引用 `phase-1-resolved-questions.md`，8 项新拍板分别为：#1=B / #2=A / #3=A / #5=A / #7=A / #8=A / #9=A / #11=A。

**✅ 门禁解除：Superpowers 可进入 plan 阶段。**

**Phase 1 实施 PR 必须同步创建 8 个新 ADR：ADR-009 至 ADR-016**，每个 `Accepted` 状态，引用 `phase-1-open-questions.md` 对应章节号 + `phase-1-resolved-questions.md` 相关 §。

**Phase 1 实施过程中如触发拍板外的新留白，必须停下来问用户**，不准自决、不准走"实施时自决 + ADR 追加"的兜底路径。新决策必须落 ADR-017+ 到 `D:\code\ai-devops\docs\V1-SPEC\ADRs\`，并同 PR patch 相应 spec 章节与 `CHANGELOG.md`。
