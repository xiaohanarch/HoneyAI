# Phase 1 Open Questions

> **来源**：alignment-check 阶段（2026-05-25）识别的 11 条留白
> **当前状态**：**全部 11 项已拍板**（2026-05-25 用户逐一确认）
> **门禁**：✅ 已解除 —— Superpowers 可进入 plan 阶段
> **后续变更**：任意一项后续变更必须新建 ADR-00X（自 ADR-009 起递增）追加

## 状态总览

| # | 主题 | 原状态 | 拍板 |
|---|---|---|---|
| 1 | TS strict flags 档位 | ❌ 未解 | **B**（推荐子集） |
| 2 | Drizzle migration 落盘目录 | ❌ 未解 | **A**（`packages\db\drizzle\`） |
| 3 | `run_cost_summary` matview SQL 文件形式 | 🟡 半解 | **A**（单独 migration 文件） |
| 4 | `ac:coverage` Phase 1 范围 | ✅ 已解 | **锁定**（§E4+E6+E7） |
| 5 | Seed 脚本入口 Phase 1 处置 | ❌ 未解 | **A**（仅占位空骨架） |
| 6 | FK 行为表交付物 | ✅ 已解 | **锁定**（§B5，表落 `packages\db\README.md`） |
| 7 | drizzle-zod 输出文件位置 | 🟡 半解 | **A**（同 schema 文件 re-export） |
| 8 | `@honeyai/core` 导入风格 | ❌ 未解 | **A**（仅 barrel） |
| 9 | husky / lint-staged / commitlint 配置文件形式 | ❌ 未解 | **A**（全独立 dotfile） |
| 10 | `__drizzle_migrations` 系统表 | ✅ 已解 | **锁定**（drizzle-kit 默认） |
| 11 | Phase 1 `.env.example` 变量集 | ❌ 未解 | **A**（极简） |

---

## 1. TypeScript strict flags 档位

- **拍板**：**B —— 推荐子集**
- **生效配置**：`tsconfig.base.json` 启用 `strict: true` + `noUncheckedIndexedAccess` + `noImplicitOverride` + `noFallthroughCasesInSwitch`
- **不启用**：`exactOptionalPropertyTypes`（与第三方包冲突最多）/ `noPropertyAccessFromIndexSignature` / `noImplicitReturns`
- **理由**：覆盖 90% 真实 bug，与 Next.js 15 / Drizzle 默认体验最匹配，drift 最小
- **ADR**：ADR-009（待开）

---

## 2. Drizzle migration 文件落盘目录

- **拍板**：**A —— `packages\db\drizzle\`**
- **生效配置**：`packages\db\drizzle.config.ts` 的 `out: './drizzle'`
- **附带 spec patch**：同 Phase 1 PR 必须 patch `02-architecture.md §2` 的 `infra\migrations\` 路径描述（与 §3 9 包 patch 并行）
- **理由**：内聚最高；schema 改动同包内出 migration；CI / 本地命令最简单
- **ADR**：ADR-010（待开）

---

## 3. `run_cost_summary` 物化视图 SQL 文件形式

- **拍板**：**A —— 单独 migration 文件**
- **生效约束**：在 `packages\db\drizzle\` 下手写 `NNNN_run_cost_summary_matview.sql`（NNNN 紧跟 drizzle-kit 生成的最后一份 migration 序号），与生成的 migration 并列；内容遵循 `phase-1-resolved-questions.md §B7`：`CREATE MATERIALIZED VIEW IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS`
- **理由**：部署模型一致（k8s Job 跑 migrate 一次建完），迁移工具一致，drizzle-kit 不会覆盖
- **ADR**：ADR-011（待开）

---

## 4. `ac:coverage` Phase 1 范围

- **状态**：✅ 锁定（无需新 ADR）
- **答案来源**：`phase-1-resolved-questions.md §E4+E6+E7`
  - 包路径：`packages\tools\ac-coverage`（独立 package）
  - 输入：扫 spec markdown（regex `AC-\d{2}-\d{2}`）+ 扫 vitest title `AC-XX-YY:` 前缀
  - 输出：stdout markdown table + `coverage\ac.json` + GitHub Action 用 `actions/github-script` 渲染 PR comment
  - CI 分级：seed AC 100% 强制 fail；全量 50% + 关键章节 70% 仅 comment；release tag 时全量阈值强制 fail
- **Phase 1 影响**：必须完整实建（不允许"占位 Phase 2 再做"）

---

## 5. Seed 脚本入口 Phase 1 处置

- **拍板**：**A —— Phase 1 仅占位空骨架**
- **生效产物**：
  - `packages\db\src\seed\index.ts` 导出 `async function runSeed()` 空实现（body 为 `// Phase 2+ business seed will land here`）
  - `packages\db\package.json` 暴露 `"db:seed": "tsx src/seed/index.ts"`
- **不做**：`pricing_book` / 官方 assets 数据填充（推迟 Phase 2/3 业务决策）
- **理由**：占住路径，Phase 2 起新增业务 seed 时无需改 root 配置
- **ADR**：ADR-012（待开）

---

## 6. FK 行为表交付物

- **状态**：✅ 锁定（无需新 ADR）
- **答案来源**：`phase-1-resolved-questions.md §B5`
  - 默认 `restrict`（防误删）
  - cascade 例外：`tenants` → 全部子表；`runs` → `nodes` / `artifacts` / `ir_documents`；`users` → `sessions`
  - `audit_log` 父级删用 `set null`（保留事件、丢失主体）
- **交付物落地**：完整 FK 行为表写入 `packages\db\README.md`
- **Phase 1 影响**：30 表所有 FK 必须按此规则落地 + 一张表入 PR description + `packages\db\README.md`

---

## 7. drizzle-zod 输出文件位置

- **拍板**：**A —— 同 schema 文件 re-export**
- **生效约束**：每个 `packages\db\src\schema\<domain>.ts` 文件末尾追加 `export const insert<Table>Schema = createInsertSchema(<table>)` + `export const select<Table>Schema = createSelectSchema(<table>)`；业务 refine 用 `.extend()` 在 repos 层叠加
- **不做**：独立 `packages\db\src\zod\` 目录
- **理由**：drift 风险零；同文件搜索体验最好；schema 文件仍在 800 行硬上限内
- **ADR**：ADR-013（待开）

---

## 8. `@honeyai/core` 导入风格

- **拍板**：**A —— 仅 barrel**
- **生效约束**：
  - `packages\core\src\index.ts` 单一 barrel re-export 所有公共 API
  - 消费方统一 `import { CrossTenantAccessError, logger, env } from '@honeyai/core'`
  - 内部 deep path 仅作为 package-private 实现细节
  - `package.json` 的 `exports` 字段仅暴露 `'.'`，不开 deep subpath
- **理由**：V1 规模 + 内部消费 + 源码 import 模式，barrel 收益 > tree-shaking 损失
- **ADR**：ADR-014（待开）

---

## 9. husky / lint-staged / commitlint 配置文件形式

- **拍板**：**A —— 全独立 dotfile**
- **生效产物**：
  - `.husky\pre-commit`（husky v9 强制）
  - `.husky\commit-msg`
  - `.lintstagedrc.json`
  - `commitlint.config.cjs`
- **不做**：lint-staged / commitlint inline 到 `package.json`
- **理由**：每个工具配置可独立看，commit 历史只动一个文件，diff 干净
- **ADR**：ADR-015（待开）

---

## 10. `__drizzle_migrations` 系统表

- **状态**：✅ 锁定（无需新 ADR）
- **答案来源**：`phase-1-resolved-questions.md §C5`
  - 表名：`__drizzle_migrations`（drizzle-kit 默认）
  - schema：`public`（与 §B8 一致）
  - 自定义：无
- **Phase 1 影响**：`drizzle.config.ts` 无需配置 `migrationsTable` / `migrationsSchema`

---

## 11. Phase 1 `.env.example` 变量集

- **拍板**：**A —— 极简（与 Phase 1 实际 import 严格匹配）**
- **生效内容**：`.env.example` 仅含 `DATABASE_URL` + `NODE_ENV` + `LOG_LEVEL`
- **生效约束**：`packages\core\src\env\index.ts` 的 zod schema 与 `.env.example` 严格一一对应；fail-fast 严格生效
- **不做**：Phase 2/3 变量预先占位
- **理由**：与 `@t3-oss/env-core` 的"声明 = 检验 = 使用"理念一致，避免幽灵字段
- **ADR**：ADR-016（待开）

---

## 拍板后操作

1. ✅ 全部 11 项拍板已填实（2026-05-25）
2. **待办**：8 个新 ADR（ADR-009 至 ADR-016）必须在 Phase 1 实施 PR 中同步创建
   - ADR 状态：`Accepted`
   - 每个 ADR 引用本文件对应章节号 + `phase-1-resolved-questions.md` 相关 §
3. 3 个 ✅ 已锁项（#4/#6/#10）不需要新 ADR，引用 `phase-1-resolved-questions.md` 即可
4. CLAUDE.md §10 当前指向本文件 —— 仍然适用，不需要随拍板更新
5. ✅ **门禁解除**：Superpowers 现在可以进入 plan 阶段
