# Phase 1 Implementation Plan — Monorepo Skeleton + DB Full Landing

> **For agentic workers:** REQUIRED SUB-SKILL — use `superpowers:subagent-driven-development` per CLAUDE.md §7. Steps use checkbox (`- [ ]`) syntax. **Plan-phase output only — execution requires explicit user approval.**

**Goal:** 落地 HoneyAI V1 的 pnpm + Turborepo monorepo 骨架（9 主包 + 1 工具包），实建 `@honeyai/core` 最小子集 + `@honeyai/db` 30 表全量，跑通 `withTenant` Proxy 让 AC-03-01/02/03 三条种子 AC 转绿，配齐 `@honeyai/tools-ac-coverage` + CI workflow + 8 个新 ADR + spec §3 patch + CHANGELOG v0.3.0 条目。

**Architecture:** pnpm workspace + Turborepo (local cache only) + 源码 import 模式（无 build 产物）+ Node 22 + PG 17 + Drizzle ORM + 运行时 Proxy 实现 multi-tenant 防线。测试基础设施用 `@testcontainers/postgresql` + 模板库（每 test < 50ms `CREATE DATABASE ... TEMPLATE`）。Phase 1 实施在 `feat/phase-1-monorepo-db-skeleton` 分支，从 `main` 切出（不是从 `docs/phase-1-prep`，那条只走 spec patch PR）。

**Tech Stack:** Node 22 LTS / pnpm / Turborepo / TypeScript / Drizzle ORM + drizzle-kit + drizzle-zod / Vitest workspace / testcontainers / pino / @t3-oss/env-core / zod / uuid v7 / husky + lint-staged + commitlint / typescript-eslint / Prettier / GitHub Actions.

**Branch:** `feat/phase-1-monorepo-db-skeleton`（从 `main` 切出）

**Spec Authority Reminder:** `D:\code\ai-devops\docs\V1-SPEC\` 只读。**§12 是唯一允许 patch §3 + CHANGELOG 的任务。** 其他 spec 章节一律不准改。新留白触发时停下问用户，落 ADR-017+。

---

## Version Pins（RECOMMENDED — 用户审核时确认或覆盖）

> CLAUDE.md §7 明确「各依赖具体 minor / patch 版本号 TBD — Superpowers plan 阶段确认」。下表是我的推荐值（取每个工具当前主版本最新稳定 minor / patch），请审核：

### NPM 包

| 包                                | 推荐版本                                  | 用途                                |
| --------------------------------- | ----------------------------------------- | ----------------------------------- |
| `pnpm`                            | `9.15.0`（`packageManager` 字段锁）       | 包管理                              |
| `turbo`                           | `2.3.3`                                   | monorepo task runner                |
| `typescript`                      | `5.7.2`                                   | 编译器                              |
| `@types/node`                     | `22.10.0`                                 | Node 22 类型                        |
| `typescript-eslint`               | `8.18.0`（含 `parser` + `eslint-plugin`） | ESLint preset                       |
| `eslint`                          | `9.17.0`（flat config）                   | linter                              |
| `prettier`                        | `3.4.2`                                   | 格式化                              |
| `vitest`                          | `2.1.8`                                   | 测试 runner                         |
| `@vitest/coverage-v8`             | `2.1.8`                                   | 覆盖率                              |
| `drizzle-orm`                     | `0.36.4`                                  | ORM                                 |
| `drizzle-kit`                     | `0.28.1`                                  | migration 工具                      |
| `drizzle-zod`                     | `0.5.1`                                   | schema → zod                        |
| `@testcontainers/postgresql`      | `10.16.0`                                 | 测试 PG                             |
| `pg`                              | `8.13.1`                                  | PG 驱动                             |
| `pino`                            | `9.5.0`                                   | logger                              |
| `pino-pretty`                     | `13.0.0`                                  | dev 输出                            |
| `@t3-oss/env-core`                | `0.11.1`                                  | env 校验                            |
| `zod`                             | `3.24.1`                                  | schema 校验                         |
| `uuid`                            | `11.0.3`                                  | uuid v7（v11 是 ESM-only，确认 ok） |
| `husky`                           | `9.1.7`                                   | git hooks                           |
| `lint-staged`                     | `15.2.11`                                 | staged 检查                         |
| `@commitlint/cli`                 | `19.6.0`                                  | commitlint CLI                      |
| `@commitlint/config-conventional` | `19.6.0`                                  | 规约                                |
| `tsx`                             | `4.19.2`                                  | seed 脚本运行                       |
| `cross-env`                       | `7.0.3`                                   | 跨平台 env                          |

### 容器镜像

| 镜像          | 推荐 tag                       | 用途                                  |
| ------------- | ------------------------------ | ------------------------------------- |
| `postgres`    | `17-alpine`                    | 主 DB（开放问题 #2 已锁）             |
| `redis`       | `7-alpine`                     | BullMQ broker（Phase 1 仅起，不消费） |
| `minio/minio` | `RELEASE.2024-12-18T13-15-30Z` | OSS local（Phase 1 仅起，不消费）     |

**确认这些版本 = ok 前别动 execution。** 任何替换在审核时直接指出。

---

## Reorder Note（vs CLAUDE.md §5）

CLAUDE.md §5 列 step 4（schemas）→ step 5（migration）→ step 6（test 基础设施）。但 TDD 要求测试先红 → 才能验证 schema 实现转绿，因此**测试容器 boot 必须先于第一张表落地**。

我的真实执行顺序：

```
A. Workspace 基础设施         （CLAUDE.md step 1）
B. docker-compose.yml         （CLAUDE.md step 2）
C. @honeyai/core 最小子集     （CLAUDE.md step 3）
D. 测试容器 + vitest workspace（CLAUDE.md step 6 提前到此）
E. 30 表 schema TDD 落地     （CLAUDE.md step 4）
F. drizzle-kit generate +     （CLAUDE.md step 5）
   matview raw SQL migration
G. withTenant Proxy + AC      （CLAUDE.md step 7）
H. Repos 纯函数（最小子集）   （CLAUDE.md step 8）
I. 7 占位包                   （CLAUDE.md step 9）
J. @honeyai/tools-ac-coverage （CLAUDE.md step 11 提前到 CI 前）
K. CI workflow                （CLAUDE.md step 10 推迟到 J 之后）
L. Spec patch + CHANGELOG +   （CLAUDE.md step 12）
   ADR-009..016
```

**变动只是 step 顺序，没有 scope 变化。** 仍是 12 个 step 的全集。

---

## Task Index

| #                                            | Title                                                                                  | TDD?          | Spec / Decision Source                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------- | ------------- | ------------------------------------------ |
| **Section A — Workspace 基础设施**           |                                                                                        |               |                                            |
| A1                                           | 创建 feature 分支 + 根 `package.json` + `pnpm-workspace.yaml`                          | verify        | decisions §A1+A5+A11                       |
| A2                                           | `tsconfig.base.json` + 严格度子集                                                      | verify        | open-Q #1, decisions §A2                   |
| A3                                           | Prettier + EditorConfig + `.nvmrc` + `.gitignore`                                      | verify        | decisions §A4+A5, §G1                      |
| A4                                           | ESLint 9 flat config (typescript-eslint)                                               | verify        | decisions §A3                              |
| A5                                           | Turborepo `turbo.json`（local cache）                                                  | verify        | ADR-008, decisions §A8                     |
| A6                                           | husky + lint-staged + commitlint dotfiles                                              | verify        | open-Q #9, decisions §A6+A7                |
| A7                                           | `.github\pull_request_template.md`                                                     | verify        | decisions §F5                              |
| A8                                           | Commit Section A 验证（lint + format + commit hook 触发）                              | verify        | —                                          |
| **Section B — docker-compose**               |                                                                                        |               |                                            |
| B1                                           | `docker-compose.yml` + 健康检查脚本                                                    | verify        | open-Q #11, decisions §C3                  |
| **Section C — `@honeyai/core` 最小子集**     |                                                                                        |               |                                            |
| C1                                           | package 骨架 + barrel exports                                                          | verify        | open-Q #8, decisions §A9+A10               |
| C2                                           | `HoneyAIError` 基类                                                                    | **TDD**       | decisions §D5                              |
| C3                                           | `CrossTenantAccessError` 子类                                                          | **TDD**       | decisions §D5, 03-data-model §9 (AC-03-02) |
| C4                                           | `logger` (pino + child 接口)                                                           | **TDD**       | decisions §G3+G5                           |
| C5                                           | `env` (@t3-oss/env-core + zod, fail-fast)                                              | **TDD**       | open-Q #11, decisions §G4                  |
| C6                                           | `constants` (V1 必需子集)                                                              | verify        | CLAUDE.md §6                               |
| **Section D — 测试基础设施**                 |                                                                                        |               |                                            |
| D1                                           | `@honeyai/db` package 骨架 + `drizzle.config.ts`                                       | verify        | open-Q #2, decisions §C1                   |
| D2                                           | testcontainers harness + 模板库引导                                                    | **TDD**       | decisions §E1                              |
| D3                                           | `vitest.workspace.ts` 根配置                                                           | verify        | decisions §E3                              |
| **Section E — 30 表 Schema TDD**             |                                                                                        |               |                                            |
| E1                                           | `_helpers.ts`（tsCols / softDelete）                                                   | **TDD**       | 03-data-model §6.1                         |
| E2                                           | `identity.ts`（5 表）                                                                  | **TDD**       | 03-data-model §6.2                         |
| E3                                           | `github.ts`（3 表）                                                                    | **TDD**       | 03-data-model §6.3                         |
| E4                                           | `assets.ts`（3 表）                                                                    | **TDD**       | 03-data-model §6.4                         |
| E5                                           | `runs.ts`（5 表）                                                                      | **TDD**       | 03-data-model §6.5                         |
| E6                                           | `artifacts.ts`（2 表）                                                                 | **TDD**       | 03-data-model §6.6, 06-sandbox §16         |
| E7                                           | `ir-documents.ts`（1 表）                                                              | **TDD**       | 03-data-model §6.6b, 04-ir-schemas §11     |
| E8                                           | `sandbox.ts`（2 表）                                                                   | **TDD**       | 03-data-model §6.7                         |
| E9                                           | `cost.ts`（2 表，含 enum）                                                             | **TDD**       | 03-data-model §6.8                         |
| E10                                          | `audit.ts`（2 表）                                                                     | **TDD**       | 03-data-model §6.9                         |
| E11                                          | `encryption.ts`（1 表）                                                                | **TDD**       | 03-data-model §6.10                        |
| E12                                          | `jobs.ts`（3 表）                                                                      | **TDD**       | 03-data-model §6.11                        |
| E13                                          | `schema/index.ts` relations 聚合 + drizzle-zod re-exports                              | **TDD**       | 03-data-model §7, open-Q #7                |
| E14                                          | `packages\db\README.md` 写完整 FK 行为表                                               | verify        | open-Q #6, decisions §B5                   |
| **Section F — Migration**                    |                                                                                        |               |                                            |
| F1                                           | `drizzle-kit generate` 产首份 init migration                                           | verify        | open-Q #2, decisions §C1                   |
| F2                                           | matview raw SQL migration（`NNNN_run_cost_summary_matview.sql`）                       | **TDD**       | open-Q #3, decisions §B7                   |
| F3                                           | `factories.ts` 测试工厂（最小集）                                                      | **TDD**       | decisions §E2                              |
| **Section G — withTenant Proxy + AC 转绿**   |                                                                                        |               |                                            |
| G1                                           | 写 AC-03-01 失败测试                                                                   | **TDD red**   | 03-data-model §9                           |
| G2                                           | 写 AC-03-02 失败测试                                                                   | **TDD red**   | 03-data-model §9                           |
| G3                                           | 写 AC-03-03 失败测试                                                                   | **TDD red**   | 03-data-model §9                           |
| G4                                           | `withTenant` Proxy + `systemDb` 实现 → 三测试转绿                                      | **TDD green** | decisions §D1+D2+D3                        |
| G5                                           | ESLint custom rule 禁止业务包 import `rawDb` / `systemDb`                              | **TDD**       | decisions §D2                              |
| **Section H — Repos 纯函数**                 |                                                                                        |               |                                            |
| H1                                           | `repos/tenants.ts`（createTenant / getTenant）                                         | **TDD**       | decisions §D4                              |
| H2                                           | `repos/users.ts`（createUser）                                                         | **TDD**       | decisions §D4                              |
| H3                                           | `repos/runs.ts`（createRun / getRun / listRuns）                                       | **TDD**       | decisions §D4                              |
| H4                                           | `repos/artifacts.ts`（insertArtifact 幂等 / listByNode）                               | **TDD**       | 03-data-model §9 (AC-03-03), decisions §D4 |
| H5                                           | `src/seed/index.ts` 空占位 + `db:seed` 脚本                                            | verify        | open-Q #5, decisions §A10                  |
| **Section I — 7 占位包**                     |                                                                                        |               |                                            |
| I1                                           | 创建 7 个占位包（package.json + tsconfig + src/index.ts）                              | verify        | CLAUDE.md §6                               |
| **Section J — `@honeyai/tools-ac-coverage`** |                                                                                        |               |                                            |
| J1                                           | package 骨架 + CLI bin                                                                 | verify        | open-Q #4, decisions §E4                   |
| J2                                           | spec markdown scanner (regex `AC-\d{2}-\d{2}`)                                         | **TDD**       | decisions §E5                              |
| J3                                           | vitest title scanner                                                                   | **TDD**       | decisions §E5                              |
| J4                                           | join + 三态报表（covered / missing / orphan）                                          | **TDD**       | decisions §E5                              |
| J5                                           | JSON output（`coverage\ac.json`）                                                      | **TDD**       | decisions §E4                              |
| J6                                           | stdout markdown table                                                                  | **TDD**       | decisions §E4                              |
| J7                                           | seed 100% exit-code 强制 fail 逻辑                                                     | **TDD**       | decisions §E7                              |
| **Section K — CI workflow**                  |                                                                                        |               |                                            |
| K1                                           | `.github\workflows\ci.yml`（lint/typecheck/migration-check 并行 → test → ac-coverage） | verify        | decisions §F1-F4                           |
| K2                                           | PR comment 渲染（`actions/github-script` 读 `ac.json`）                                | verify        | decisions §E4+E6                           |
| **Section L — Spec patch + ADR + CHANGELOG** |                                                                                        |               |                                            |
| L1                                           | `02-architecture.md §3` 9 包真实状态 patch                                             | verify        | CLAUDE.md §11                              |
| L2                                           | `02-architecture.md §2` migration 目录路径 patch（`packages\db\drizzle\`）             | verify        | open-Q #2                                  |
| L3                                           | 8 个新 ADR（ADR-009..016）+ ADRs/README.md 索引                                        | verify        | open-Q #1-3, #5, #7-9, #11                 |
| L4                                           | `CHANGELOG.md` v0.3.0 条目                                                             | verify        | CLAUDE.md §11                              |

**Total tasks:** 51

**TDD 红绿循环任务:** 30 项（C2-C5, D2, E1-E13, F2-F3, G1-G5, H1-H4, J2-J7）
**Verify-only 任务:** 21 项（其余）

---

## Section A — Workspace 基础设施（CLAUDE.md step 1）

### Task A1: 创建 feature 分支 + 根 `package.json` + `pnpm-workspace.yaml`

**Files:**

- Create: `package.json`（根）
- Create: `pnpm-workspace.yaml`
- Verify branch: `feat/phase-1-monorepo-db-skeleton` 已从 `main` 切出

**Spec source:** decisions §A1（命名 scope `@honeyai/*`）、§A5（`packageManager` 字段）、§A11（无 changesets）

- [ ] **Step 1: 切分支**

```bash
git fetch origin
git checkout main
git pull --ff-only
git checkout -b feat/phase-1-monorepo-db-skeleton
```

- [ ] **Step 2: 写根 `package.json`**

```json
{
  "name": "honeyai-monorepo",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=22.11.0 <23" },
  "scripts": {
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md,yaml,yml}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,json,md,yaml,yml}\"",
    "ac:coverage": "tsx packages/tools/ac-coverage/src/cli.ts",
    "db:migrate": "pnpm --filter @honeyai/db drizzle-kit migrate",
    "db:generate": "pnpm --filter @honeyai/db drizzle-kit generate",
    "db:check": "pnpm --filter @honeyai/db drizzle-kit check",
    "db:seed": "pnpm --filter @honeyai/db db:seed",
    "prepare": "husky"
  },
  "devDependencies": {
    "turbo": "2.3.3",
    "typescript": "5.7.2",
    "@types/node": "22.10.0",
    "prettier": "3.4.2",
    "eslint": "9.17.0",
    "@eslint/js": "9.17.0",
    "typescript-eslint": "8.18.0",
    "vitest": "2.1.8",
    "@vitest/coverage-v8": "2.1.8",
    "tsx": "4.19.2",
    "husky": "9.1.7",
    "lint-staged": "15.2.11",
    "@commitlint/cli": "19.6.0",
    "@commitlint/config-conventional": "19.6.0",
    "cross-env": "7.0.3"
  }
}
```

- [ ] **Step 3: 写 `pnpm-workspace.yaml`**

```yaml
packages:
  - 'packages/*'
  - 'packages/tools/*'
```

- [ ] **Step 4: Verify**

```bash
pnpm install --lockfile-only
# expected: 生成 pnpm-lock.yaml，无 packages 警告
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: bootstrap pnpm workspace + root package.json"
```

---

### Task A2: `tsconfig.base.json` + 严格度子集

**Files:** Create `tsconfig.base.json` + `tsconfig.json`
**Spec source:** open-Q #1（拍板 B）、decisions §A2

- [ ] **Step 1: 写 `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 2: 写根 `tsconfig.json`**

```json
{ "extends": "./tsconfig.base.json", "include": [], "exclude": ["node_modules", "dist", ".turbo"] }
```

- [ ] **Step 3: Verify**

```bash
pnpm exec tsc --noEmit -p tsconfig.json
# expected: 静默通过
```

- [ ] **Step 4: Commit**

```bash
git add tsconfig.base.json tsconfig.json
git commit -m "chore: add strict tsconfig.base.json (open-Q #1 subset)"
```

---

### Task A3: Prettier + EditorConfig + `.nvmrc` + `.gitignore`

**Files:** Create `.prettierrc.json` / `.prettierignore` / `.editorconfig` / `.nvmrc` / `.gitignore`
**Spec source:** decisions §A4 / §A5 / §G1

- [ ] **Step 1: `.prettierrc.json`**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "endOfLine": "lf"
}
```

- [ ] **Step 2: `.prettierignore`**

```
node_modules
dist
.turbo
.next
coverage
pnpm-lock.yaml
**/*.min.js
**/drizzle/**/*.sql
```

- [ ] **Step 3: `.editorconfig`**

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: `.nvmrc`**

```
22.11.0
```

- [ ] **Step 5: `.gitignore`**

```
node_modules/
.turbo/
dist/
.next/
*.tsbuildinfo
coverage/
.env*
!.env.example
.DS_Store
*.log
.vitest-cache/
```

- [ ] **Step 6: Verify**

```bash
pnpm exec prettier --check .
# expected: 全部 pass
```

- [ ] **Step 7: Commit**

```bash
git add .prettierrc.json .prettierignore .editorconfig .nvmrc .gitignore
git commit -m "chore: add prettier + editorconfig + nvmrc + gitignore"
```

---

### Task A4: ESLint 9 flat config

**Files:** Create `eslint.config.js`
**Spec source:** decisions §A3

- [ ] **Step 1: 写 `eslint.config.js`**

```js
import tseslint from 'typescript-eslint'
import eslint from '@eslint/js'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.turbo/**', '**/.next/**', '**/node_modules/**', '**/drizzle/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
)
```

- [ ] **Step 2: Verify**

```bash
pnpm exec eslint .
# expected: 0 错
```

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "chore: add eslint 9 flat config (typescript-eslint preset)"
```

---

### Task A5: Turborepo `turbo.json`

**Files:** Create `turbo.json`
**Spec source:** ADR-008、decisions §A8

- [ ] **Step 1: 写 `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "stream",
  "remoteCache": { "enabled": false },
  "tasks": {
    "build": { "outputs": ["dist/**"], "dependsOn": ["^build"] },
    "typecheck": { "outputs": [] },
    "lint": { "outputs": [] },
    "test": { "outputs": ["coverage/**"], "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 2: Verify**

```bash
pnpm exec turbo run typecheck --dry=json
# expected: 列 0 task，无错
```

- [ ] **Step 3: Commit**

```bash
git add turbo.json
git commit -m "chore: add turbo.json (local cache only)"
```

---

### Task A6: husky + lint-staged + commitlint dotfiles

**Files:** `.husky/pre-commit` / `.husky/commit-msg` / `.lintstagedrc.json` / `commitlint.config.cjs`
**Spec source:** open-Q #9 / decisions §A6+A7

- [ ] **Step 1: husky init**

```bash
pnpm exec husky init
```

- [ ] **Step 2: 改写 `.husky/pre-commit`**

```sh
pnpm exec lint-staged
```

- [ ] **Step 3: 写 `.husky/commit-msg`**

```sh
pnpm exec commitlint --edit "$1"
```

- [ ] **Step 4: `.lintstagedrc.json`**

```json
{
  "*.{ts,tsx,js,mjs,cjs}": ["prettier --write", "eslint --fix"],
  "*.{json,md,yaml,yml}": ["prettier --write"]
}
```

- [ ] **Step 5: `commitlint.config.cjs`**

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'ci']],
  },
}
```

- [ ] **Step 6: Verify**

```bash
echo "bad message" | pnpm exec commitlint
# expected: exit 1
echo "chore: ok" | pnpm exec commitlint
# expected: exit 0
```

- [ ] **Step 7: Commit**

```bash
git add .husky .lintstagedrc.json commitlint.config.cjs
git commit -m "chore: add husky + lint-staged + commitlint dotfiles"
```

---

### Task A7: PR template

**Files:** Create `.github/pull_request_template.md`
**Spec source:** decisions §F5

- [ ] **Step 1: 写模板**

```markdown
## Summary

<!-- 1-3 句话描述本 PR 做了什么、为什么 -->

## Acceptance

<!-- 本 PR 自动覆盖的 AC（与 vitest title `AC-XX-YY:` 匹配） -->

- AC-XX-YY: <描述>

## Manual AC

<!-- 需要人工验证的 [Manual] AC，勾选 = 完成 + 粘贴证据 -->

- [ ] AC-XX-YY: <描述>
  - 证据：<截图链接 / 日志片段>

## Test Plan

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm ac:coverage` seed AC 100%

## Spec Impact

<!-- 触发了哪些 ADR / spec patch / CHANGELOG 条目 -->
```

- [ ] **Step 2: Commit**

```bash
git add .github/pull_request_template.md
git commit -m "chore: add PR template"
```

---

### Task A8: Section A 闭环验证（hook 触发）

**Spec source:** —（自检）

- [ ] **Step 1: 触发 lint-staged + commitlint 一次**

```bash
echo "const x:string='hi';" > scratch.ts
git add scratch.ts
git commit -m "chore: verify hook chain"
# expected: prettier 自动 format scratch.ts，commit 通过
git rm scratch.ts && git commit -m "chore: remove scratch verify file"
```

- [ ] **Step 2: 反例 commitlint**

```bash
git commit --allow-empty -m "bad no type"
# expected: exit 1，commit 被拒
```

---

## Section B — docker-compose.yml（CLAUDE.md step 2）

### Task B1: docker-compose + .env.example

**Files:** Create `docker-compose.yml` + `.env.example`
**Spec source:** decisions §C3、open-Q #11

- [ ] **Step 1: 写 `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: honeyai-postgres
    environment:
      POSTGRES_USER: honeyai
      POSTGRES_PASSWORD: honeyai_dev
      POSTGRES_DB: honeyai
    ports: ['5432:5432']
    volumes: ['honeyai-pg-data:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U honeyai -d honeyai']
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: honeyai-redis
    ports: ['6379:6379']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 10

  minio:
    image: minio/minio:RELEASE.2024-12-18T13-15-30Z
    container_name: honeyai-minio
    command: server /data --console-address ':9001'
    environment:
      MINIO_ROOT_USER: honeyai
      MINIO_ROOT_PASSWORD: honeyai_dev
    ports: ['9000:9000', '9001:9001']
    volumes: ['honeyai-minio-data:/data']
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  honeyai-pg-data:
  honeyai-minio-data:
```

- [ ] **Step 2: 写 `.env.example`**

```bash
DATABASE_URL=postgresql://honeyai:honeyai_dev@localhost:5432/honeyai
NODE_ENV=development
LOG_LEVEL=debug
```

- [ ] **Step 3: Verify**

```bash
docker compose up -d
sleep 10
docker compose ps
# expected: 3 service 全部 healthy
docker compose exec postgres pg_isready -U honeyai
docker compose exec redis redis-cli ping
curl -fsS http://localhost:9000/minio/health/live
docker compose down
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: add docker-compose.yml (pg17 + redis7 + minio)"
```

---

## Section C — `@honeyai/core` 最小子集（CLAUDE.md step 3）

> **Phase 1 范围**：errors / log / env / constants。**IR zod 推迟 Phase 2。** Barrel-only（open-Q #8）。

### Task C1: package 骨架

**Files:** `packages/core/{package.json,tsconfig.json,src/index.ts}`
**Spec source:** open-Q #8、decisions §A9+A10

- [ ] **Step 1: `packages/core/package.json`**

```json
{
  "name": "@honeyai/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": {
    "pino": "9.5.0",
    "@t3-oss/env-core": "0.11.1",
    "zod": "3.24.1"
  },
  "devDependencies": {
    "pino-pretty": "13.0.0",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "noEmit": true },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: `packages/core/src/index.ts`**

```ts
export * from './errors/index.js'
export * from './log/index.js'
export * from './env/index.js'
export * from './constants/index.js'
```

- [ ] **Step 4: Verify**

```bash
pnpm install
# expected: lockfile 更新，无错
```

- [ ] **Step 5: Commit**

```bash
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): scaffold @honeyai/core package with barrel exports"
```

---

### Task C2: `HoneyAIError` 基类（TDD）

**Files:** `packages/core/src/errors/{base.ts,base.test.ts,index.ts}`
**Function under test:** `HoneyAIError` 构造器 + `code`/`userMessage`/`httpStatus`/`cause`
**Spec source:** decisions §D5

- [ ] **Step 1: Write failing test**

```ts
// packages/core/src/errors/base.test.ts
import { describe, it, expect } from 'vitest'
import { HoneyAIError } from './base.js'

describe('HoneyAIError', () => {
  it('carries code / userMessage / httpStatus and is instanceof Error', () => {
    const cause = new Error('upstream')
    const err = new HoneyAIError({
      code: 'TEST_CODE',
      message: 'internal',
      userMessage: 'something went wrong',
      httpStatus: 500,
      cause,
    })
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(HoneyAIError)
    expect(err.code).toBe('TEST_CODE')
    expect(err.userMessage).toBe('something went wrong')
    expect(err.httpStatus).toBe(500)
    expect(err.cause).toBe(cause)
    expect(err.name).toBe('HoneyAIError')
  })

  it('subclass inherits name from constructor', () => {
    class Sub extends HoneyAIError {
      constructor() {
        super({ code: 'SUB', message: 'sub', userMessage: 'sub', httpStatus: 400 })
      }
    }
    expect(new Sub().name).toBe('Sub')
  })
})
```

- [ ] **Step 2: RED**

```bash
pnpm --filter @honeyai/core test
# expected: FAIL — Cannot find module './base.js'
```

- [ ] **Step 3: Write impl**

```ts
// packages/core/src/errors/base.ts
export type HoneyAIErrorInput = {
  code: string
  message: string
  userMessage: string
  httpStatus: number
  cause?: unknown
}

export class HoneyAIError extends Error {
  public readonly code: string
  public readonly userMessage: string
  public readonly httpStatus: number

  constructor(input: HoneyAIErrorInput) {
    super(input.message, { cause: input.cause })
    this.code = input.code
    this.userMessage = input.userMessage
    this.httpStatus = input.httpStatus
    this.name = new.target.name
  }
}
```

```ts
// packages/core/src/errors/index.ts
export * from './base.js'
```

- [ ] **Step 4: GREEN**

```bash
pnpm --filter @honeyai/core test
# expected: PASS — 2 tests
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/errors
git commit -m "feat(core): add HoneyAIError base class"
```

---

### Task C3: `CrossTenantAccessError` 子类（TDD）

**Files:** `packages/core/src/errors/{cross-tenant.ts,cross-tenant.test.ts}` + modify `index.ts`
**Function under test:** `CrossTenantAccessError`
**Spec source:** decisions §D5；AC-03-02 引用 `code='CROSS_TENANT_ACCESS'`

- [ ] **Step 1: Write failing test**

```ts
// packages/core/src/errors/cross-tenant.test.ts
import { describe, it, expect } from 'vitest'
import { CrossTenantAccessError, HoneyAIError } from './index.js'

describe('CrossTenantAccessError', () => {
  it('has code CROSS_TENANT_ACCESS and httpStatus 403', () => {
    const err = new CrossTenantAccessError({
      attemptedTenantId: 't-a',
      actualTenantId: 't-b',
    })
    expect(err).toBeInstanceOf(HoneyAIError)
    expect(err.code).toBe('CROSS_TENANT_ACCESS')
    expect(err.httpStatus).toBe(403)
    expect(err.attemptedTenantId).toBe('t-a')
    expect(err.actualTenantId).toBe('t-b')
    expect(err.userMessage).toMatch(/access denied/i)
  })
})
```

- [ ] **Step 2: RED**

```bash
pnpm --filter @honeyai/core test cross-tenant
# expected: FAIL — Cannot find module './cross-tenant.js'
```

- [ ] **Step 3: Write impl**

```ts
// packages/core/src/errors/cross-tenant.ts
import { HoneyAIError } from './base.js'

export class CrossTenantAccessError extends HoneyAIError {
  public readonly attemptedTenantId: string
  public readonly actualTenantId: string

  constructor(input: { attemptedTenantId: string; actualTenantId: string; cause?: unknown }) {
    super({
      code: 'CROSS_TENANT_ACCESS',
      message: `Cross-tenant access: actor=${input.actualTenantId} target=${input.attemptedTenantId}`,
      userMessage: 'Access denied: this resource belongs to a different tenant',
      httpStatus: 403,
      cause: input.cause,
    })
    this.attemptedTenantId = input.attemptedTenantId
    this.actualTenantId = input.actualTenantId
  }
}
```

修改 `packages/core/src/errors/index.ts`：

```ts
export * from './base.js'
export * from './cross-tenant.js'
```

- [ ] **Step 4: GREEN**

```bash
pnpm --filter @honeyai/core test
# expected: PASS — 3 tests
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/errors
git commit -m "feat(core): add CrossTenantAccessError"
```

---

### Task C4: `logger`（TDD）

**Files:** `packages/core/src/log/{index.ts,log.test.ts}`
**Function under test:** `logger` + `logger.child({ traceId, tenantId })`
**Spec source:** decisions §G3+G5

- [ ] **Step 1: Write failing test**

```ts
// packages/core/src/log/log.test.ts
import { describe, it, expect } from 'vitest'
import { logger } from './index.js'

describe('logger', () => {
  it('exposes pino-compatible methods', () => {
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  it('.child({ traceId, tenantId }) returns a logger with the same shape', () => {
    const child = logger.child({ traceId: 't-123', tenantId: 'ten-a' })
    expect(typeof child.info).toBe('function')
    expect(child).not.toBe(logger)
  })
})
```

- [ ] **Step 2: RED**

```bash
pnpm --filter @honeyai/core test log
# expected: FAIL — Cannot find module
```

- [ ] **Step 3: Write impl**

```ts
// packages/core/src/log/index.ts
import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'
const level = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info')

export const logger = pino({
  level,
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
})

export type Logger = typeof logger
```

- [ ] **Step 4: GREEN**

```bash
pnpm --filter @honeyai/core test
# expected: PASS — 5 tests
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/log
git commit -m "feat(core): add pino-based logger"
```

---

### Task C5: `env` fail-fast loader（TDD）

**Files:** `packages/core/src/env/{index.ts,env.test.ts}`
**Function under test:** `loadEnv()` 工厂
**Spec source:** decisions §G4、open-Q #11

- [ ] **Step 1: Write failing test**

```ts
// packages/core/src/env/env.test.ts
import { describe, it, expect } from 'vitest'
import { loadEnv } from './index.js'

describe('loadEnv', () => {
  it('parses valid env', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://u:p@h:5432/d',
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
    })
    expect(env.DATABASE_URL).toBe('postgresql://u:p@h:5432/d')
    expect(env.NODE_ENV).toBe('development')
    expect(env.LOG_LEVEL).toBe('debug')
  })

  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadEnv({ NODE_ENV: 'development', LOG_LEVEL: 'info' })).toThrow(/DATABASE_URL/)
  })

  it('throws when DATABASE_URL is not a postgres URL', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: 'mysql://u:p@h/d',
        NODE_ENV: 'development',
        LOG_LEVEL: 'info',
      }),
    ).toThrow(/postgres/i)
  })
})
```

- [ ] **Step 2: RED**

```bash
pnpm --filter @honeyai/core test env
# expected: FAIL — Cannot find module
```

- [ ] **Step 3: Write impl**

```ts
// packages/core/src/env/index.ts
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export function loadEnv(source: Record<string, string | undefined> = process.env) {
  return createEnv({
    server: {
      DATABASE_URL: z
        .string()
        .url()
        .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
          message: 'DATABASE_URL must be a postgres URL',
        }),
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    },
    runtimeEnv: source,
    emptyStringAsUndefined: true,
  })
}

export type Env = ReturnType<typeof loadEnv>
```

> **不导出顶层 `env` 实例** — 业务包按需 `loadEnv()`；这样测试可注入而不污染 boot fail-fast 行为。生产代码在 worker / web 入口各调一次 `loadEnv()` 实现 fail-fast。

- [ ] **Step 4: GREEN**

```bash
pnpm --filter @honeyai/core test
# expected: PASS — 8 tests
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/env
git commit -m "feat(core): add fail-fast env loader"
```

---

### Task C6: `constants` 子集

**Files:** `packages/core/src/constants/{index.ts,constants.test.ts}`
**Spec source:** CLAUDE.md §6

- [ ] **Step 1: Write smoke test**

```ts
// packages/core/src/constants/constants.test.ts
import { describe, it, expect } from 'vitest'
import * as C from './index.js'

describe('constants', () => {
  it('exports DEFAULT_TARGET_BRANCH = "main"', () => {
    expect(C.DEFAULT_TARGET_BRANCH).toBe('main')
  })
  it('exports MAX_RUN_DURATION_MS = 30min', () => {
    expect(C.MAX_RUN_DURATION_MS).toBe(30 * 60 * 1000)
  })
  it('exports COST_MICRO_USD_PER_USD = 1_000_000', () => {
    expect(C.COST_MICRO_USD_PER_USD).toBe(1_000_000)
  })
})
```

- [ ] **Step 2: RED**

```bash
pnpm --filter @honeyai/core test constants
```

- [ ] **Step 3: Write impl**

```ts
// packages/core/src/constants/index.ts
export const DEFAULT_TARGET_BRANCH = 'main'
export const MAX_RUN_DURATION_MS = 30 * 60 * 1000
export const COST_MICRO_USD_PER_USD = 1_000_000
```

- [ ] **Step 4: GREEN**

```bash
pnpm --filter @honeyai/core test
pnpm --filter @honeyai/core typecheck
# expected: 11 tests pass + 0 typecheck errors
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/constants
git commit -m "feat(core): add phase-1 constants subset"
```

> **🛑 汇报点 #1（CLAUDE.md §7 每 3 step 一汇报）：A+B+C = step 1+2+3 完成。**
> 汇报内容：commit 列表 + `pnpm test` 全绿截图 / 输出 + 下一组 D-E-F 计划。

---

## Section D — 测试基础设施（CLAUDE.md step 6，前置到 schema 之前）

### Task D1: `@honeyai/db` package 骨架 + `drizzle.config.ts`

**Files:** `packages/db/{package.json,tsconfig.json,drizzle.config.ts,src/index.ts}` + `packages/db/drizzle/.gitkeep`
**Spec source:** open-Q #2（migration 目录 `packages\db\drizzle\`）、decisions §C1

- [ ] **Step 1: `packages/db/package.json`**

```json
{
  "name": "@honeyai/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts",
    "./test": "./src/test/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run",
    "drizzle-kit": "drizzle-kit",
    "db:seed": "tsx src/seed/index.ts"
  },
  "dependencies": {
    "@honeyai/core": "workspace:*",
    "drizzle-orm": "0.36.4",
    "drizzle-zod": "0.5.1",
    "pg": "8.13.1",
    "uuid": "11.0.3",
    "zod": "3.24.1"
  },
  "devDependencies": {
    "@types/pg": "8.11.10",
    "drizzle-kit": "0.28.1",
    "@testcontainers/postgresql": "10.16.0",
    "typescript": "5.7.2",
    "vitest": "2.1.8",
    "tsx": "4.19.2"
  }
}
```

- [ ] **Step 2: `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "noEmit": true },
  "include": ["src/**/*.ts", "drizzle.config.ts"]
}
```

- [ ] **Step 3: `packages/db/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://honeyai:honeyai_dev@localhost:5432/honeyai',
  },
  strict: true,
  verbose: true,
})
```

- [ ] **Step 4: 占位 `src/index.ts` 和 schema barrel**

```ts
// packages/db/src/index.ts
export * from './schema/index.js'
```

```ts
// packages/db/src/schema/index.ts
export {} // 后续 E 任务填充
```

```bash
touch packages/db/drizzle/.gitkeep
```

- [ ] **Step 5: Verify**

```bash
pnpm install
pnpm --filter @honeyai/db typecheck
# expected: 0 errors
```

- [ ] **Step 6: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): scaffold @honeyai/db package + drizzle.config.ts"
```

---

### Task D2: testcontainers harness + 模板库引导（TDD）

**Files:** `packages/db/src/test/{container.ts,container.test.ts,index.ts}`
**Function under test:** `startTestPostgres()` / `createTestDatabase(template)` / `dropTestDatabase(name)`
**Spec source:** decisions §E1（testcontainers + 模板库模式）

- [ ] **Step 1: Write failing test**

```ts
// packages/db/src/test/container.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  type TestPgHandle,
} from './container.js'

describe('testcontainers harness', () => {
  let handle: TestPgHandle

  beforeAll(async () => {
    handle = await startTestPostgres()
  }, 60_000)

  afterAll(async () => {
    await handle.stop()
  })

  it('can create a database from template_honeyai in < 1s', async () => {
    const start = Date.now()
    const name = await createTestDatabase(handle)
    const elapsed = Date.now() - start
    expect(name).toMatch(/^test_[0-9a-f]+$/)
    expect(elapsed).toBeLessThan(1000)
    await dropTestDatabase(handle, name)
  })

  it('parallel createTestDatabase calls produce unique names', async () => {
    const names = await Promise.all([
      createTestDatabase(handle),
      createTestDatabase(handle),
      createTestDatabase(handle),
    ])
    expect(new Set(names).size).toBe(3)
    await Promise.all(names.map((n) => dropTestDatabase(handle, n)))
  })
})
```

- [ ] **Step 2: RED**

```bash
pnpm --filter @honeyai/db test container
# expected: FAIL — Cannot find module './container.js'
```

- [ ] **Step 3: Write impl**

```ts
// packages/db/src/test/container.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Client } from 'pg'
import { randomBytes } from 'node:crypto'
import * as path from 'node:path'

export type TestPgHandle = {
  container: StartedPostgreSqlContainer
  adminUrl: string
  templateName: string
  stop: () => Promise<void>
}

const TEMPLATE_NAME = 'template_honeyai'

export async function startTestPostgres(): Promise<TestPgHandle> {
  const container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('postgres')
    .withUsername('honeyai')
    .withPassword('honeyai_test')
    .start()

  const adminUrl = container.getConnectionUri()

  // 创建 template 库 + 跑 migration
  const admin = new Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${TEMPLATE_NAME}`)
  await admin.end()

  const templateUrl = adminUrl.replace(/\/postgres(\?|$)/, `/${TEMPLATE_NAME}$1`)
  const client = new Client({ connectionString: templateUrl })
  await client.connect()
  const db = drizzle(client)
  const migrationsFolder = path.resolve(import.meta.dirname, '../../drizzle')
  await migrate(db, { migrationsFolder })
  await client.end()

  // 标记 template 为只读（PG 要求）
  const lock = new Client({ connectionString: adminUrl })
  await lock.connect()
  await lock.query(`ALTER DATABASE ${TEMPLATE_NAME} IS_TEMPLATE true`)
  await lock.end()

  return {
    container,
    adminUrl,
    templateName: TEMPLATE_NAME,
    stop: async () => {
      await container.stop()
    },
  }
}

export async function createTestDatabase(handle: TestPgHandle): Promise<string> {
  const name = `test_${randomBytes(8).toString('hex')}`
  const admin = new Client({ connectionString: handle.adminUrl })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${name} TEMPLATE ${handle.templateName}`)
  await admin.end()
  return name
}

export async function dropTestDatabase(handle: TestPgHandle, name: string): Promise<void> {
  const admin = new Client({ connectionString: handle.adminUrl })
  await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
  await admin.end()
}

export function testDatabaseUrl(handle: TestPgHandle, name: string): string {
  return handle.adminUrl.replace(/\/postgres(\?|$)/, `/${name}$1`)
}
```

```ts
// packages/db/src/test/index.ts
export * from './container.js'
```

- [ ] **Step 4: GREEN**

```bash
pnpm --filter @honeyai/db test container
# expected: PASS — 2 tests
# 注意：第一轮 PASS 需要 drizzle 目录里至少有一份 migration（即使是空）
```

> **依赖前置**：drizzle 目录此时还是空的，`migrate()` 应正确处理"无 migrations"。如果失败：在 `drizzle/` 放一个 `0000_empty.sql`（空文件）+ `meta/_journal.json` 空骨架。这是 drizzle-kit 自身的 bootstrap 行为，详见 drizzle-kit 文档。

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/test
git commit -m "feat(db): add testcontainers + template-db test harness"
```

---

### Task D3: `vitest.workspace.ts` 根配置

**Files:** Create `vitest.workspace.ts` + `packages/db/vitest.config.ts`
**Spec source:** decisions §E3（vitest workspace 模式）

- [ ] **Step 1: 根 `vitest.workspace.ts`**

```ts
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace(['packages/core', 'packages/db', 'packages/tools/ac-coverage'])
```

- [ ] **Step 2: `packages/db/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 90_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: false } },
  },
})
```

- [ ] **Step 3: `packages/core/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: {} })
```

- [ ] **Step 4: Verify**

```bash
pnpm test
# expected: 跑 core + db 两个 workspace 的测试，全绿
```

- [ ] **Step 5: Commit**

```bash
git add vitest.workspace.ts packages/db/vitest.config.ts packages/core/vitest.config.ts
git commit -m "test: enable vitest workspace mode"
```

---

## Section E — 30 表 Schema TDD（CLAUDE.md step 4）

> **TDD 形态**：每个 schema 文件（按域）一个测试文件。测试用 testcontainers + drizzle 直接 push schema 到 test DB（开发期），然后 INSERT/SELECT 断言。**Phase 1 不预先 generate migration**，直接 push；F1 任务在所有 schema 落地后一次性 generate 一份 init migration。
>
> **测试模板**（每个 schema 任务沿用）：`beforeAll` 启动 testcontainer + create test DB + `drizzle-orm/migrator` 仅在 F1 完成后才用；E1-E13 阶段用 `pushSchema` helper 直接执行 `pg-core` 的 CREATE TABLE。
>
> **临时 push helper（仅 E 阶段用）**：

```ts
// packages/db/src/test/push-schema.ts （Task E1 同时创建）
import { Client } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../schema/index.js'

export async function withTestSchema<T>(
  url: string,
  fn: (db: ReturnType<typeof drizzle<typeof schema>>) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: url })
  await client.connect()
  // Phase 1 dev shortcut: 执行 schema-to-sql 直接 CREATE
  // 通过 drizzle 反射 schema metadata 生成 CREATE TABLE 语句
  // 详情：用 `drizzle-kit push` 程序化接口，或临时 raw CREATE
  const db = drizzle(client, { schema })
  try {
    return await fn(db)
  } finally {
    await client.end()
  }
}
```

> **重要**：`drizzle-kit push` 程序化接口在 0.28+ 暴露为 `drizzle-kit/api`。如果不可靠，**回退方案**：让 F1（drizzle-kit generate）在 E1 之前执行一次生成空 init.sql，后续每张表 E2-E12 都调用 `drizzle-kit generate` 增量产 migration，testcontainer 每次重启用累积 migration。这样测试基础设施更稳，**但每个 schema 任务多一步**。审核时选哪个：
>
> - **方案 P（push）**：上面写的 `withTestSchema` 用 `drizzle-kit/api` push。如果 `drizzle-kit/api` 不稳定，回退到方案 G。
> - **方案 G（generate-per-task）**：每个 E 任务结尾跑 `pnpm db:generate`，commit 中包含 migration 增量。
>
> **默认选 P**，如果 D2 一轮失败 → 切 G。

---

### Task E1: `_helpers.ts`（tsCols / softDelete）

**Files:** `packages/db/src/schema/{_helpers.ts,_helpers.test.ts}` + 修改 `schema/index.ts`
**Function under test:** `tsCols.createdAt` / `tsCols.updatedAt` / `softDelete.deletedAt` 列定义形态
**Spec source:** 03-data-model §6.1

- [ ] **Step 1: Write failing test**

```ts
// packages/db/src/schema/_helpers.test.ts
import { describe, it, expect } from 'vitest'
import { tsCols, softDelete } from './_helpers.js'

describe('schema/_helpers', () => {
  it('exposes createdAt / updatedAt with timestamp + tz + defaultNow', () => {
    expect(tsCols.createdAt).toBeDefined()
    expect(tsCols.updatedAt).toBeDefined()
    // drizzle 列对象有 `name` 属性
    expect((tsCols.createdAt as { name: string }).name).toBe('created_at')
    expect((tsCols.updatedAt as { name: string }).name).toBe('updated_at')
  })

  it('exposes softDelete.deletedAt as nullable timestamp', () => {
    expect(softDelete.deletedAt).toBeDefined()
    expect((softDelete.deletedAt as { name: string }).name).toBe('deleted_at')
  })
})
```

- [ ] **Step 2: RED**

```bash
pnpm --filter @honeyai/db test _helpers
# expected: FAIL — Cannot find module
```

- [ ] **Step 3: Write impl**

```ts
// packages/db/src/schema/_helpers.ts
import { timestamp } from 'drizzle-orm/pg-core'

export const tsCols = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}
```

修改 `schema/index.ts`：

```ts
export * from './_helpers.js'
```

- [ ] **Step 4: GREEN**

```bash
pnpm --filter @honeyai/db test
# expected: PASS — 2 tests
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/_helpers.ts packages/db/src/schema/_helpers.test.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add schema/_helpers (tsCols + softDelete)"
```

---

### Task E2-E12: 域 schema 文件（同一 TDD 模板）

> **共同模板**：每张表的测试包含 (a) schema metadata 断言（列名 / not null / enum 值）+ (b) testcontainer 内 INSERT + SELECT round-trip。**每域一个 task = 一个红绿循环**（多张表的断言可放同一 test file）。
>
> **schema 代码 100% 取自 03-data-model.md §6.X**，逐字粘贴。Plan 不在此重复 30 张表全文（spec 已固化），只列每域：
>
> - 测试文件路径
> - 被测函数 / 表名 + 关键列断言
> - 对应 03-data-model.md 节
> - commit message
>
> **每个 E2-E12 任务都遵循 5 步**：write test → RED → 粘贴 schema → GREEN → commit。

| Task | 文件                                  | 表                                                    | 关键断言（最少）                                                                                                | Spec 节                   |
| ---- | ------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------- |
| E2   | `schema/identity.ts` + `.test.ts`     | users / accounts / sessions / tenants / tenantMembers | users.githubId UNIQUE / tenants.slug UNIQUE / tenant_role enum {owner, member} / tenantMembers PK (tenant,user) | §6.2                      |
| E3   | `schema/github.ts` + `.test.ts`       | githubInstallations / repositories / githubTokens     | repos uniq (tenantId, githubRepoId) / githubTokens PK userId                                                    | §6.3                      |
| E4   | `schema/assets.ts` + `.test.ts`       | assetSources / assets / assetVersions                 | asset_kind enum 8 值 / asset_sync_mode enum 3 值 / assets uniq (tenantId, kind, name)                           | §6.4                      |
| E5   | `schema/runs.ts` + `.test.ts`         | runs / nodes / gates / events / nodeRetries           | run_status 7 值 / node_status 5 值 / failure_class 8 值 / events.seq bigint                                     | §6.5                      |
| E6   | `schema/artifacts.ts` + `.test.ts`    | artifactBlobs / artifacts                             | artifacts uniq (runId, nodeId, attempt, kind) / artifact_status enum {ok, failed} / artifact_kind enum 7 值     | §6.6 + 06-sandbox §16     |
| E7   | `schema/ir-documents.ts` + `.test.ts` | irDocuments                                           | PK (runId, stage, version) / ir_stage enum 3 值 / created_by_kind enum {agent, user}                            | §6.6b + 04-ir-schemas §11 |
| E8   | `schema/sandbox.ts` + `.test.ts`      | sandboxes / sandboxCredentials                        | sandboxes.runId UNIQUE / sandbox_status enum 4 值                                                               | §6.7                      |
| E9   | `schema/cost.ts` + `.test.ts`         | pricingBook / costEvents                              | cost_kind enum 6 值 / pricing uniq (kind, provider, sku, effectiveFrom)                                         | §6.8                      |
| E10  | `schema/audit.ts` + `.test.ts`        | auditLog / activityFeed                               | auditLog BRIN index on occurredAt / set null FK 行为                                                            | §6.9                      |
| E11  | `schema/encryption.ts` + `.test.ts`   | dataEncryptionKeys                                    | algorithm default 'AES-256-GCM' / kekVersion not null                                                           | §6.10                     |
| E12  | `schema/jobs.ts` + `.test.ts`         | jobs / jobLocks / assetSyncQueue                      | jobs.status enum 4 值 / jobLocks PK lockKey / assetSyncQueue.status enum 4 值                                   | §6.11                     |

**每张表的 INSERT/SELECT round-trip 测试范例**（以 users 为例，其他比照）：

```ts
// packages/db/src/schema/identity.test.ts (片段)
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'
import { withTestSchema } from '../test/push-schema.js'
import { users } from './identity.js'

describe('schema/identity — users', () => {
  let handle: TestPgHandle
  let dbName: string

  beforeAll(async () => {
    handle = await startTestPostgres()
  }, 60_000)
  afterAll(async () => {
    await handle.stop()
  })
  beforeEach(async () => {
    dbName = await createTestDatabase(handle)
  })
  afterEach(async () => {
    await dropTestDatabase(handle, dbName)
  })

  it('inserts and selects a users row', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestSchema(url, async (db) => {
      const id = uuidv7()
      await db.insert(users).values({
        id,
        githubId: 12345,
        githubLogin: 'octocat',
      })
      const rows = await db.select().from(users)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.id).toBe(id)
      expect(rows[0]?.githubLogin).toBe('octocat')
      expect(rows[0]?.isPlatformAdmin).toBe(false) // default
    })
  })

  it('rejects duplicate githubId via UNIQUE constraint', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestSchema(url, async (db) => {
      await db.insert(users).values({ id: uuidv7(), githubId: 99, githubLogin: 'a' })
      await expect(
        db.insert(users).values({ id: uuidv7(), githubId: 99, githubLogin: 'b' }),
      ).rejects.toThrow(/unique/i)
    })
  })
})
```

**所有 E2-E12 任务的 commit message 模板**：

```
feat(db): add schema/<domain> with INSERT/SELECT round-trip tests
```

> **TDD 顺序内的强制 5 步**（每个 E2-E12 都严格执行）：
>
> 1. 写 `<domain>.test.ts`（含 metadata 断言 + round-trip + 关键约束反例）
> 2. `pnpm --filter @honeyai/db test <domain>` → RED
> 3. 从 03-data-model §6.X 粘贴 schema 到 `<domain>.ts` + 在 `schema/index.ts` 追加 `export * from './<domain>.js'`
> 4. 重跑测试 → GREEN
> 5. `git commit -m "feat(db): add schema/<domain> with ..."`

---

### Task E13: `schema/index.ts` relations 聚合 + drizzle-zod re-exports

**Files:** modify `packages/db/src/schema/index.ts` + 在各 `<domain>.ts` 末尾追加 zod schema
**Function under test:** `relations(users, ...)` 等聚合；`insertUsersSchema` / `selectUsersSchema` 等
**Spec source:** 03-data-model §7（relations）、open-Q #7（drizzle-zod 同文件 re-export）

- [ ] **Step 1: Write failing test**

```ts
// packages/db/src/schema/relations.test.ts
import { describe, it, expect } from 'vitest'
import * as schema from './index.js'

describe('schema relations + drizzle-zod', () => {
  it('exposes relations objects for runs / users / tenants', () => {
    expect(schema.usersRelations).toBeDefined()
    expect(schema.tenantsRelations).toBeDefined()
    expect(schema.runsRelations).toBeDefined()
  })

  it('exposes insertSchema / selectSchema for each table', () => {
    expect(schema.insertUsersSchema).toBeDefined()
    expect(schema.selectUsersSchema).toBeDefined()
    expect(schema.insertRunsSchema).toBeDefined()
    expect(schema.insertArtifactsSchema).toBeDefined()
    expect(schema.insertIrDocumentsSchema).toBeDefined()
  })

  it('insertUsersSchema validates required fields', () => {
    const valid = schema.insertUsersSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000001',
      githubId: 1,
      githubLogin: 'x',
    })
    expect(valid.success).toBe(true)
    const invalid = schema.insertUsersSchema.safeParse({ id: 'not-uuid' })
    expect(invalid.success).toBe(false)
  })
})
```

- [ ] **Step 2: RED**

```bash
pnpm --filter @honeyai/db test relations
```

- [ ] **Step 3: Write impl**

在每个 `<domain>.ts` 末尾追加（以 identity.ts 为例）：

```ts
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
export const insertUsersSchema = createInsertSchema(users)
export const selectUsersSchema = createSelectSchema(users)
export const insertTenantsSchema = createInsertSchema(tenants)
export const selectTenantsSchema = createSelectSchema(tenants)
// ... 每张表一对
```

`schema/index.ts`（聚合 + relations，03-data-model §7 全量）：

```ts
import { relations } from 'drizzle-orm'
import * as identity from './identity.js'
import * as github from './github.js'
// ... 其他 10 个文件
export * from './_helpers.js'
export * from './identity.js'
export * from './github.js'
// ... 其余
export * from './ir-documents.js'

export const usersRelations = relations(identity.users, ({ many, one }) => ({
  memberships: many(identity.tenantMembers),
  githubToken: one(github.githubTokens),
}))
export const tenantsRelations = relations(identity.tenants, ({ many }) => ({
  members: many(identity.tenantMembers),
  repositories: many(github.repositories),
  // ... 其余照 03-data-model §7
}))
// ... runsRelations / artifactsRelations / ...
```

- [ ] **Step 4: GREEN**

```bash
pnpm --filter @honeyai/db test
# expected: 全部 pass，相加 50+ tests
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema
git commit -m "feat(db): add relations + drizzle-zod schemas across all domains"
```

---

### Task E14: `packages/db/README.md` 完整 FK 行为表

**Files:** Create `packages/db/README.md`
**Spec source:** open-Q #6（FK 行为表交付物）、decisions §B5

- [ ] **Step 1: 写 README（完整 FK 行为表）**

```markdown
# @honeyai/db

V1 数据层（30 表 Drizzle schema + migration + `withTenant` Proxy + repos）。

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

## withTenant Proxy

见 `src/tenant.ts`。所有租户作用域查询必须经过 `withTenant(tenantId, db)`。跨租户操作必须显式调用 `systemDb()`（仅 platform-admin / migration / system job 使用），且必须写 `audit_log`。

## 测试

`@testcontainers/postgresql` + 模板库模式。详见 `src/test/container.ts`。
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/README.md
git commit -m "docs(db): add FK behavior table per open-Q #6"
```

> **🛑 汇报点 #2（CLAUDE.md §7）：D+E = step 4+6 完成（先后调换）。**

---

## Section F — Migration（CLAUDE.md step 5）

### Task F1: `drizzle-kit generate` 产首份 init migration

**Files:** `packages/db/drizzle/0000_init.sql`（由 drizzle-kit 自动生成）+ `meta/_journal.json`
**Spec source:** decisions §C1（drizzle-kit generate）

- [ ] **Step 1: 跑 generate**

```bash
pnpm db:generate
# expected: 在 packages/db/drizzle/ 产 0000_<slug>.sql + meta/_journal.json + meta/0000_snapshot.json
```

- [ ] **Step 2: Verify migration check 通过**

```bash
pnpm db:check
# expected: "Everything is up to date"
```

- [ ] **Step 3: 启 docker-compose + 跑 migrate 验证可应用**

```bash
docker compose up -d postgres
DATABASE_URL=postgresql://honeyai:honeyai_dev@localhost:5432/honeyai pnpm db:migrate
# expected: 0000_init applied
psql postgresql://honeyai:honeyai_dev@localhost:5432/honeyai -c "\dt"
# expected: 列出 30 张表 + __drizzle_migrations
docker compose down
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/drizzle
git commit -m "feat(db): generate init migration (30 tables)"
```

---

### Task F2: matview raw SQL migration（TDD）

**Files:** Create `packages/db/drizzle/0001_run_cost_summary_matview.sql` + `packages/db/src/schema/matview.test.ts`
**Function under test:** matview `run_cost_summary` 存在 + unique index 存在 + 可 REFRESH
**Spec source:** open-Q #3（拍板 A 单独 migration 文件）、decisions §B7、03-data-model §6.8 末尾

- [ ] **Step 1: Write failing test**

```ts
// packages/db/src/schema/matview.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'

describe('migrations — run_cost_summary matview', () => {
  let handle: TestPgHandle
  let dbName: string
  beforeAll(async () => {
    handle = await startTestPostgres()
  }, 60_000)
  afterAll(async () => {
    await handle.stop()
  })

  it('creates matview run_cost_summary with unique index after migrate', async () => {
    dbName = await createTestDatabase(handle)
    const url = testDatabaseUrl(handle, dbName)
    const client = new Client({ connectionString: url })
    await client.connect()
    try {
      const mv = await client.query(
        "SELECT 1 FROM pg_matviews WHERE matviewname = 'run_cost_summary'",
      )
      expect(mv.rowCount).toBe(1)
      const idx = await client.query(
        "SELECT indexname FROM pg_indexes WHERE tablename = 'run_cost_summary' AND indexname LIKE '%uniq%'",
      )
      expect(idx.rowCount).toBe(1)
    } finally {
      await client.end()
      await dropTestDatabase(handle, dbName)
    }
  })

  it('REFRESH MATERIALIZED VIEW CONCURRENTLY succeeds', async () => {
    dbName = await createTestDatabase(handle)
    const url = testDatabaseUrl(handle, dbName)
    const client = new Client({ connectionString: url })
    await client.connect()
    try {
      await expect(
        client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY run_cost_summary'),
      ).resolves.toBeDefined()
    } finally {
      await client.end()
      await dropTestDatabase(handle, dbName)
    }
  })
})
```

- [ ] **Step 2: RED**

```bash
pnpm --filter @honeyai/db test matview
# expected: FAIL — matview 不存在
```

- [ ] **Step 3: Write raw migration**

```sql
-- packages/db/drizzle/0001_run_cost_summary_matview.sql

CREATE MATERIALIZED VIEW IF NOT EXISTS run_cost_summary AS
SELECT
  tenant_id,
  run_id,
  SUM(total_micro_usd) AS total_cost_micro_usd,
  jsonb_object_agg(kind, kind_total) AS by_kind,
  MAX(occurred_at) AS last_event_at
FROM (
  SELECT
    tenant_id,
    run_id,
    kind,
    SUM(total_micro_usd) AS kind_total,
    SUM(total_micro_usd) AS total_micro_usd,
    MAX(occurred_at) AS occurred_at
  FROM cost_events
  WHERE run_id IS NOT NULL
  GROUP BY tenant_id, run_id, kind
) sub
GROUP BY tenant_id, run_id
WITH NO DATA;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS run_cost_summary_uniq_tenant_run
  ON run_cost_summary (tenant_id, run_id);
```

修改 `packages/db/drizzle/meta/_journal.json` 追加：

```json
{
  "idx": 1,
  "version": "7",
  "when": <timestamp>,
  "tag": "0001_run_cost_summary_matview",
  "breakpoints": true
}
```

> **注意**：drizzle-kit 不会自动接管 raw SQL。手动维护 \_journal.json。如果 drizzle-kit 在后续 generate 时报"unknown migration"，按 0.28 文档处理 hand-rolled migration。

- [ ] **Step 4: GREEN**

```bash
pnpm --filter @honeyai/db test matview
# expected: PASS — 2 tests
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/drizzle/0001_run_cost_summary_matview.sql packages/db/drizzle/meta/_journal.json packages/db/src/schema/matview.test.ts
git commit -m "feat(db): add run_cost_summary matview migration"
```

---

### Task F3: `factories.ts` 测试工厂（最小集）

**Files:** Create `packages/db/src/test/factories.ts` + `factories.test.ts`
**Function under test:** `makeTenant()` / `makeUser()` / `makeRepository()` / `makeRun()` / `makeNode()`
**Spec source:** decisions §E2

- [ ] **Step 1: Write failing test**

```ts
// packages/db/src/test/factories.test.ts
import { describe, it, expect } from 'vitest'
import { makeTenant, makeUser, makeRepository, makeRun, makeNode } from './factories.js'

describe('test factories', () => {
  it('makeTenant returns valid insert payload with defaults', () => {
    const t = makeTenant()
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(t.slug).toBeTruthy()
    expect(t.name).toBeTruthy()
    expect(t.kind).toBe('personal')
  })
  it('makeRun ties to provided tenant + user + repo', () => {
    const tenantId = makeTenant().id
    const userId = makeUser().id
    const repoId = makeRepository({ tenantId }).id
    const run = makeRun({ tenantId, createdByUserId: userId, repositoryId: repoId })
    expect(run.tenantId).toBe(tenantId)
    expect(run.createdByUserId).toBe(userId)
    expect(run.repositoryId).toBe(repoId)
  })
  it('overrides win over defaults', () => {
    const t = makeTenant({ slug: 'custom' })
    expect(t.slug).toBe('custom')
  })
})
```

- [ ] **Step 2: RED**

- [ ] **Step 3: Write impl**

```ts
// packages/db/src/test/factories.ts
import { v7 as uuidv7 } from 'uuid'

let seq = 0
const next = () => ++seq

export function makeTenant(overrides: Partial<TenantInput> = {}): TenantInput {
  const id = overrides.id ?? uuidv7()
  return {
    id,
    slug: `tenant-${next()}`,
    name: `Tenant ${next()}`,
    kind: 'personal',
    ...overrides,
  }
}

export function makeUser(overrides: Partial<UserInput> = {}): UserInput {
  return {
    id: uuidv7(),
    githubId: 1000 + next(),
    githubLogin: `user-${next()}`,
    ...overrides,
  }
}

export function makeRepository(overrides: Partial<RepoInput> = {}): RepoInput {
  return {
    id: uuidv7(),
    tenantId: overrides.tenantId ?? uuidv7(),
    installationId: overrides.installationId ?? uuidv7(),
    githubRepoId: 2000 + next(),
    owner: 'org',
    name: `repo-${next()}`,
    ...overrides,
  }
}

export function makeRun(overrides: Partial<RunInput> = {}): RunInput {
  return {
    id: uuidv7(),
    tenantId: overrides.tenantId ?? uuidv7(),
    repositoryId: overrides.repositoryId ?? uuidv7(),
    createdByUserId: overrides.createdByUserId ?? uuidv7(),
    title: `Run ${next()}`,
    oneLiner: 'do something',
    ...overrides,
  }
}

export function makeNode(overrides: Partial<NodeInput> = {}): NodeInput {
  return {
    id: uuidv7(),
    runId: overrides.runId ?? uuidv7(),
    stage: 1,
    ordinal: 1,
    name: `node-${next()}`,
    kind: 'agent',
    ...overrides,
  }
}

type TenantInput = { id: string; slug: string; name: string; kind: 'personal' | 'team' }
type UserInput = { id: string; githubId: number; githubLogin: string }
type RepoInput = {
  id: string
  tenantId: string
  installationId: string
  githubRepoId: number
  owner: string
  name: string
}
type RunInput = {
  id: string
  tenantId: string
  repositoryId: string
  createdByUserId: string
  title: string
  oneLiner: string
}
type NodeInput = {
  id: string
  runId: string
  stage: number
  ordinal: number
  name: string
  kind: 'agent' | 'gate' | 'merge' | 'deploy'
}
```

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/test/factories.ts packages/db/src/test/factories.test.ts
git commit -m "test(db): add minimal factories (tenant/user/repo/run/node)"
```

---

## Section G: `withTenant` Proxy + 3 Seed AC Tests

**Goal:** 实现租户隔离 Proxy，三条种子 AC 红→绿；这是 Phase 1 的核心交付物。

**Spec source:** `03-data-model.md §9`（AC-03-01/02/03 定义）+ `phase-1-resolved-questions.md §B5+D1-D5`。

**Files:**

- Create: `packages/db/src/client.ts`（导出 `rawDb` / `systemDb` / `withTenant`）
- Create: `packages/db/src/tenant/with-tenant.ts`（Proxy 实现）
- Create: `packages/db/src/tenant/with-tenant.test.ts`（3 条 AC 测试）
- Create: `packages/db/src/audit.ts`（`logCrossTenantAttempt` 写入 `audit_log`）
- Modify: `eslint.config.js`（追加禁止业务包 import `rawDb`/`systemDb` 的规则）

---

### Task G1: AC-03-01 — 自动 WHERE tenant_id 注入

**Files:**

- Test: `packages/db/src/tenant/with-tenant.test.ts`
- Function under test: `withTenant(tenantId).db.select().from(runs)`
- AC source: `03-data-model.md §9 AC-03-01`

- [ ] **Step 1: RED — 写失败测试**

```ts
// packages/db/src/tenant/with-tenant.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
} from '../test/harness'
import * as schema from '../schema'
import { withTenant } from './with-tenant'
import { tenants } from '../schema/identity'
import { runs } from '../schema/runs'

let ctx: Awaited<ReturnType<typeof startTestPostgres>>
let dbName: string
let pool: Pool
let rawDb: ReturnType<typeof drizzle<typeof schema>>

beforeAll(async () => {
  ctx = await startTestPostgres()
})

afterAll(async () => {
  await ctx.stop()
})

beforeEach(async () => {
  dbName = await createTestDatabase(ctx)
  pool = new Pool({ connectionString: testDatabaseUrl(ctx, dbName) })
  rawDb = drizzle(pool, { schema })
})

afterEach(async () => {
  await pool.end()
  await dropTestDatabase(ctx, dbName)
})

describe('AC-03-01: withTenant auto-injects tenant_id WHERE clause', () => {
  it('select(runs) only returns rows of the bound tenant', async () => {
    // Arrange — 两个租户各一条 Run
    const [tenantA] = await rawDb.insert(tenants).values({ slug: 'a', name: 'A' }).returning()
    const [tenantB] = await rawDb.insert(tenants).values({ slug: 'b', name: 'B' }).returning()
    await rawDb.insert(runs).values([
      { tenantId: tenantA.id, repositoryId: tenantA.id, branch: 'main', state: 'pending' },
      { tenantId: tenantB.id, repositoryId: tenantB.id, branch: 'main', state: 'pending' },
    ])

    // Act
    const scoped = withTenant(rawDb, tenantA.id)
    const rows = await scoped.select().from(runs)

    // Assert
    expect(rows).toHaveLength(1)
    expect(rows[0].tenantId).toBe(tenantA.id)
  })
})
```

- [ ] **Step 2: 跑测试看到红**

```bash
pnpm --filter @honeyai/db test -- with-tenant
```

Expected: FAIL — `withTenant` not implemented.

- [ ] **Step 3: 写最小实现使 G1 通过**

```ts
// packages/db/src/tenant/with-tenant.ts
import { and, eq, type SQL } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import type * as schema from '../schema'

const SCOPED_TABLES = new Set([
  'tenants',
  'repositories',
  'runs',
  'nodes',
  'artifacts',
  'ir_documents',
  'cost_events',
  'audit_log',
  // ... 其他 tenant_id 列存在的表（运行时通过 schema 反射，见 G4）
])

export function withTenant<TSchema extends typeof schema>(
  db: PgDatabase<any, TSchema>,
  tenantId: string,
) {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver)
      if (prop !== 'select') return orig
      return (...args: unknown[]) => {
        const builder = (orig as Function).apply(target, args)
        const fromOrig = builder.from.bind(builder)
        builder.from = (table: any) => {
          const q = fromOrig(table)
          if (SCOPED_TABLES.has(table[Symbol.for('drizzle:Name')])) {
            return q.where(eq(table.tenantId, tenantId))
          }
          return q
        }
        return builder
      }
    },
  }) as PgDatabase<any, TSchema>
}
```

- [ ] **Step 4: GREEN**

```bash
pnpm --filter @honeyai/db test -- with-tenant
```

Expected: G1 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/tenant/with-tenant.ts packages/db/src/tenant/with-tenant.test.ts
git commit -m "feat(db): withTenant Proxy auto-injects tenant_id (AC-03-01)"
```

---

### Task G2: AC-03-02 — 跨租户查询返回 0 行 + 写 audit_log

**Files:**

- Test: `packages/db/src/tenant/with-tenant.test.ts`（追加 describe）
- Function under test: `withTenant(tenantId).db.select().from(runs).where(eq(runs.id, foreignRunId))`
- Implementation: `packages/db/src/audit.ts` + Proxy 拦截器
- AC source: `03-data-model.md §9 AC-03-02`

- [ ] **Step 1: RED**

```ts
describe('AC-03-02: cross-tenant access returns 0 rows + writes audit_log', () => {
  it('querying tenant B run from tenant A scope yields empty array', async () => {
    const [tenantA] = await rawDb.insert(tenants).values({ slug: 'a2', name: 'A2' }).returning()
    const [tenantB] = await rawDb.insert(tenants).values({ slug: 'b2', name: 'B2' }).returning()
    const [runB] = await rawDb
      .insert(runs)
      .values({ tenantId: tenantB.id, repositoryId: tenantB.id, branch: 'main', state: 'pending' })
      .returning()

    const scoped = withTenant(rawDb, tenantA.id)
    const rows = await scoped.select().from(runs).where(eq(runs.id, runB.id))

    expect(rows).toHaveLength(0)
  })

  it('writes one audit_log row of action=cross_tenant_attempt for tenant A', async () => {
    const [tenantA] = await rawDb.insert(tenants).values({ slug: 'a3', name: 'A3' }).returning()
    const [tenantB] = await rawDb.insert(tenants).values({ slug: 'b3', name: 'B3' }).returning()
    const [runB] = await rawDb
      .insert(runs)
      .values({ tenantId: tenantB.id, repositoryId: tenantB.id, branch: 'main', state: 'pending' })
      .returning()

    const scoped = withTenant(rawDb, tenantA.id)
    await scoped.select().from(runs).where(eq(runs.id, runB.id))

    const logs = await rawDb
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, 'cross_tenant_attempt'))
    expect(logs.length).toBeGreaterThanOrEqual(1)
    expect(logs[0].tenantId).toBe(tenantA.id)
  })
})
```

- [ ] **Step 2: 看红**

```bash
pnpm --filter @honeyai/db test -- with-tenant
```

Expected: FAIL — 跨租户访问不会产出 audit log。

- [ ] **Step 3: 实现 — 改 Proxy + 加 audit helper**

```ts
// packages/db/src/audit.ts
import type { PgDatabase } from 'drizzle-orm/pg-core'
import type * as schema from './schema'
import { auditLog } from './schema/audit'

export async function logCrossTenantAttempt(
  db: PgDatabase<any, typeof schema>,
  tenantId: string,
  table: string,
  attemptedId: string | null,
): Promise<void> {
  await db.insert(auditLog).values({
    tenantId,
    action: 'cross_tenant_attempt',
    entityKind: table,
    entityId: attemptedId,
    actorUserId: null,
    meta: {},
  })
}
```

```ts
// 补丁 packages/db/src/tenant/with-tenant.ts
// 在 builder.from 改写处加：每条 SELECT 执行后若返回 0 行且 WHERE 中含 id 等值条件，
// 调用 logCrossTenantAttempt。
// Phase 1 简化实现：使用执行后的 Promise.then 拦截，检测 0 行 + 调用 helper。
```

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/audit.ts packages/db/src/tenant/with-tenant.ts packages/db/src/tenant/with-tenant.test.ts
git commit -m "feat(db): cross-tenant attempt logs audit row (AC-03-02)"
```

---

### Task G3: AC-03-03 — Artifact idempotent insert (`ON CONFLICT DO NOTHING`)

**Files:**

- Test: `packages/db/src/tenant/with-tenant.test.ts`（追加 describe）
- Function under test: `insertArtifact()` 走 `INSERT ... ON CONFLICT (node_id, name, attempt) DO NOTHING`
- AC source: `03-data-model.md §9 AC-03-03`

- [ ] **Step 1: RED**

```ts
import { artifacts } from '../schema/artifacts'

describe('AC-03-03: artifact insert is idempotent on (node_id, name, attempt)', () => {
  it('second insert with same triple returns the existing row, no duplicate', async () => {
    // ... 建 tenant / repository / run / node 上下文
    const payload = {
      tenantId: tenant.id,
      runId: run.id,
      nodeId: node.id,
      name: 'design.md',
      attempt: 1,
      contentSha256: 'abc',
      sizeBytes: 100,
      storageKey: 'tenants/x/runs/y/nodes/z/1/design.md',
      mimeType: 'text/markdown',
    }

    const first = await rawDb.insert(artifacts).values(payload).onConflictDoNothing().returning()
    expect(first).toHaveLength(1)

    const second = await rawDb.insert(artifacts).values(payload).onConflictDoNothing().returning()
    expect(second).toHaveLength(0)

    const all = await rawDb.select().from(artifacts).where(eq(artifacts.nodeId, node.id))
    expect(all).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 看红**（如果 E phase 已正确建好 `unique(node_id, name, attempt)` 约束，此处可能直接绿；红条件 = 未建约束）

- [ ] **Step 3: 修 `packages/db/src/schema/artifacts.ts` 增加 unique 约束（若 E phase 漏了）**

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/tenant/with-tenant.test.ts packages/db/src/schema/artifacts.ts
git commit -m "feat(db): artifacts idempotent insert via unique constraint (AC-03-03)"
```

---

### Task G4: SCOPED_TABLES 由 schema 反射生成（去硬编码）

**Files:** Modify `packages/db/src/tenant/with-tenant.ts`
**测试目标:** G1/G2 现有测试仍绿，新增 1 个 sanity test 验证 `SCOPED_TABLES` 与实际带 `tenant_id` 列的表 1:1 匹配。

- [ ] **Step 1: 写 sanity 测试**

```ts
it('SCOPED_TABLES matches all tables that declare a tenant_id column', () => {
  const declared = Object.values(schema).filter(
    (t: any) => t?.tenantId !== undefined && typeof t[Symbol.for('drizzle:Name')] === 'string',
  )
  const names = new Set(declared.map((t: any) => t[Symbol.for('drizzle:Name')]))
  expect(SCOPED_TABLES).toEqual(names)
})
```

- [ ] **Step 2: 看红**（硬编码集合不会与反射结果完全一致）

- [ ] **Step 3: 重构 `SCOPED_TABLES`**

```ts
import * as schema from '../schema'

const SCOPED_TABLES = new Set(
  Object.values(schema)
    .filter((t: any) => t?.tenantId !== undefined)
    .map((t: any) => t[Symbol.for('drizzle:Name')] as string),
)
```

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/tenant/with-tenant.ts packages/db/src/tenant/with-tenant.test.ts
git commit -m "refactor(db): reflect SCOPED_TABLES from schema (no hardcoded list)"
```

---

### Task G5: ESLint 自定义规则 — 业务包禁止 import `rawDb`/`systemDb`

**Files:**

- Modify: `eslint.config.js`（追加 `no-restricted-imports` 规则）
- Test: `packages/db/src/tenant/eslint.test.ts`（一个文本断言：违规 import 触发规则）

- [ ] **Step 1: RED — 写 ESLint 配置断言测试**

```ts
import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'

describe('ESLint forbids importing rawDb/systemDb outside @honeyai/db', () => {
  it('importing rawDb from web emits no-restricted-imports', async () => {
    const linter = new ESLint({ overrideConfigFile: 'eslint.config.js' })
    const results = await linter.lintText(
      `import { rawDb } from '@honeyai/db/client'\nexport const x = rawDb`,
      { filePath: 'packages/web/src/x.ts' },
    )
    const messages = results[0].messages.map((m) => m.ruleId)
    expect(messages).toContain('no-restricted-imports')
  })
})
```

- [ ] **Step 2: 看红**

- [ ] **Step 3: 改 `eslint.config.js`**

```js
// 追加规则
{
  files: ['packages/!(db)/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@honeyai/db/client',
            importNames: ['rawDb', 'systemDb'],
            message: 'Use withTenant(...) instead. rawDb/systemDb is reserved for @honeyai/db internals.',
          },
        ],
      },
    ],
  },
},
```

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js packages/db/src/tenant/eslint.test.ts
git commit -m "feat(eslint): forbid rawDb/systemDb imports outside @honeyai/db"
```

---

> **Section G 完成检查:** AC-03-01 / AC-03-02 / AC-03-03 三条种子测试全绿；`ac:coverage` 扫描应识别此三条（前缀 `AC-03-01:` / `AC-03-02:` / `AC-03-03:`）。**停下来汇报。**

---

## Section H: Repos 纯函数 + Seed 占位

**Goal:** Phase 1 最小 repo 函数集（仅本 phase 单测会用到的函数）+ seed 入口空骨架。

**Spec source:** `phase-1-resolved-questions.md §D7` + `phase-1-open-questions.md #5`。

**Files:**

- Create: `packages/db/src/repos/tenants.ts`（`createTenant`）
- Create: `packages/db/src/repos/users.ts`（`createUser`）
- Create: `packages/db/src/repos/runs.ts`（`createRun` / `getRun` / `listRunsByTenant`）
- Create: `packages/db/src/repos/artifacts.ts`（`insertArtifactIdempotent` / `listArtifactsByNode`）
- Create: `packages/db/src/repos/index.ts`（barrel）
- Create: `packages/db/src/seed/index.ts`（空 `runSeed()`）
- Test: 每个 repo 一个 `.test.ts`

---

### Task H1: `createTenant` + `createUser`

**Files:**

- Test: `packages/db/src/repos/tenants.test.ts` / `users.test.ts`
- Function under test: `createTenant({ slug, name })` / `createUser({ tenantId, githubId, email })`
- AC source: 无显式 AC；服务 G phase 测试上下文。

- [ ] **Step 1: RED**

```ts
// packages/db/src/repos/tenants.test.ts
import { describe, it, expect } from 'vitest'
import { createTenant } from './tenants'
// ... beforeEach 起 testdb（复用 G phase harness）

describe('createTenant', () => {
  it('creates a tenant and returns it with id', async () => {
    const t = await createTenant(rawDb, { slug: 'acme', name: 'Acme' })
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(t.slug).toBe('acme')
  })
})
```

- [ ] **Step 2: 看红**

- [ ] **Step 3: 实现**

```ts
// packages/db/src/repos/tenants.ts
import type { PgDatabase } from 'drizzle-orm/pg-core'
import type * as schema from '../schema'
import { tenants, type InsertTenant, type SelectTenant } from '../schema/identity'

export async function createTenant(
  db: PgDatabase<any, typeof schema>,
  input: Pick<InsertTenant, 'slug' | 'name'>,
): Promise<SelectTenant> {
  const [row] = await db.insert(tenants).values(input).returning()
  return row
}
```

类似 `createUser`。

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repos/tenants.ts packages/db/src/repos/tenants.test.ts \
        packages/db/src/repos/users.ts packages/db/src/repos/users.test.ts
git commit -m "feat(db): repos createTenant + createUser"
```

---

### Task H2: `createRun` / `getRun` / `listRunsByTenant`

**Files:**

- Test: `packages/db/src/repos/runs.test.ts`
- Function under test: `createRun({ tenantId, repositoryId, branch })` / `getRun(id)` / `listRunsByTenant(tenantId, { limit, offset })`
- AC source: 无；服务 Phase 2 orchestrator 入口。

- [ ] **Step 1: RED — 三个测试**

```ts
it('createRun stores a pending run', async () => {
  /* ... */
})
it('getRun returns the row by id', async () => {
  /* ... */
})
it('listRunsByTenant respects limit and is ordered by created_at desc', async () => {
  /* ... */
})
```

- [ ] **Step 2: 看红**

- [ ] **Step 3: 实现**

```ts
// packages/db/src/repos/runs.ts
export async function createRun(db, input) {
  /* INSERT INTO runs ... RETURNING * */
}
export async function getRun(db, id) {
  /* SELECT ... WHERE id = $1 LIMIT 1 */
}
export async function listRunsByTenant(db, tenantId, { limit = 20, offset = 0 } = {}) {
  return db
    .select()
    .from(runs)
    .where(eq(runs.tenantId, tenantId))
    .orderBy(desc(runs.createdAt))
    .limit(limit)
    .offset(offset)
}
```

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repos/runs.ts packages/db/src/repos/runs.test.ts
git commit -m "feat(db): repos createRun/getRun/listRunsByTenant"
```

---

### Task H3: `insertArtifactIdempotent` + `listArtifactsByNode`

**Files:**

- Test: `packages/db/src/repos/artifacts.test.ts`
- Function under test: `insertArtifactIdempotent({ tenantId, nodeId, name, attempt, ... })`（包装 ON CONFLICT DO NOTHING）

- [ ] **Step 1: RED** — 复用 AC-03-03 风格断言两次插入只有一条。

- [ ] **Step 2: 看红**

- [ ] **Step 3: 实现**

```ts
export async function insertArtifactIdempotent(db, payload) {
  const [row] = await db.insert(artifacts).values(payload).onConflictDoNothing().returning()
  if (row) return { row, created: true }
  // 命中冲突，回查现有行
  const [existing] = await db
    .select()
    .from(artifacts)
    .where(
      and(
        eq(artifacts.nodeId, payload.nodeId),
        eq(artifacts.name, payload.name),
        eq(artifacts.attempt, payload.attempt),
      ),
    )
  return { row: existing, created: false }
}
```

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repos/artifacts.ts packages/db/src/repos/artifacts.test.ts
git commit -m "feat(db): repos insertArtifactIdempotent + listArtifactsByNode"
```

---

### Task H4: Repos barrel + 包出口

**Files:**

- Create: `packages/db/src/repos/index.ts` — `export * from './tenants'` 等
- Modify: `packages/db/src/index.ts` — 追加 `export * as repos from './repos'`

- [ ] **Step 1-4: 一次提交。无 TDD（纯 re-export）。**

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repos/index.ts packages/db/src/index.ts
git commit -m "chore(db): barrel exports for repos"
```

---

### Task H5: Seed 入口空骨架

**Files:**

- Create: `packages/db/src/seed/index.ts`
- Modify: `packages/db/package.json` — 追加 `"db:seed": "tsx src/seed/index.ts"`

- [ ] **Step 1: 写**

```ts
// packages/db/src/seed/index.ts
import { logger } from '@honeyai/core'

export async function runSeed(): Promise<void> {
  // Phase 2+ business seed will land here (pricing_book, official assets, ...).
  logger.info('seed: no-op in Phase 1')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runSeed()
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter @honeyai/db db:seed
```

Expected: 打出一行 INFO 即退出。

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed/index.ts packages/db/package.json
git commit -m "chore(db): seed placeholder (no-op for Phase 1)"
```

---

> **Section H 完成检查:** `pnpm --filter @honeyai/db test` 全绿，repos 函数全部覆盖最小用例。**停下来汇报。**

---

## Section I: 7 个占位包

**Goal:** orchestrator / adapter-claude / adapter-opencode / github / web / worker / sandbox-runner 各只产出最小骨架，CLAUDE.md 明确要求 `src/index.ts` 内容仅 `export {}`。

**Spec source:** `CLAUDE.md §Phase 1 Scope` + `02-architecture.md §3`。

---

### Task I1: 7 个占位包一次性建出

**Files (× 7):**

- `packages/orchestrator/{package.json,tsconfig.json,src/index.ts}`
- `packages/adapter-claude/{package.json,tsconfig.json,src/index.ts}`
- `packages/adapter-opencode/{package.json,tsconfig.json,src/index.ts}`
- `packages/github/{package.json,tsconfig.json,src/index.ts}`
- `packages/web/{package.json,tsconfig.json,src/index.ts}`
- `packages/worker/{package.json,tsconfig.json,src/index.ts}`
- `packages/sandbox-runner/{package.json,tsconfig.json,src/index.ts}`

每包的 `package.json` 模板：

```json
{
  "name": "@honeyai/<pkg>",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "5.7.2"
  }
}
```

每包的 `tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src" },
  "include": ["src"]
}
```

每包的 `src/index.ts`：

```ts
export {}
```

- [ ] **Step 1: Verify**

```bash
pnpm install
pnpm -r typecheck
```

Expected: 7 个包 typecheck 通过；无 lint 报错。

- [ ] **Step 2: Commit**

```bash
git add packages/{orchestrator,adapter-claude,adapter-opencode,github,web,worker,sandbox-runner}
git commit -m "chore: scaffold 7 placeholder packages (Phase 1 leaves bodies empty per ADR-008)"
```

---

> **Section I 完成检查:** `pnpm -r typecheck` 全绿；workspace 共 9 包识别正确（`pnpm -r list` 见 9 行）。

---

## Section J: `@honeyai/tools-ac-coverage`

**Goal:** AC 覆盖率扫描工具最小实现，Phase 1 需识别 `AC-XX-YY` 标识，输出 markdown 表 + JSON，CI 中对 seed AC 强制 100%。

**Spec source:** `phase-1-open-questions.md #4` + `phase-1-resolved-questions.md §E4+E6+E7`。

**Files:**

- `packages/tools-ac-coverage/package.json`
- `packages/tools-ac-coverage/src/index.ts`（CLI 入口）
- `packages/tools-ac-coverage/src/scan-spec.ts`（扫 markdown）
- `packages/tools-ac-coverage/src/scan-tests.ts`（扫 vitest title）
- `packages/tools-ac-coverage/src/report.ts`（生成 markdown + JSON）
- 每个文件配 `.test.ts`

---

### Task J1: 包骨架 + CLI 入口

**Files:**

- Create: `packages/tools-ac-coverage/package.json`
- Create: `packages/tools-ac-coverage/src/index.ts`

```json
{
  "name": "@honeyai/tools-ac-coverage",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "bin": { "ac-coverage": "src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "fast-glob": "3.3.2",
    "tinyrainbow": "1.2.0"
  },
  "devDependencies": { "vitest": "2.1.8", "typescript": "5.7.2" }
}
```

```ts
// packages/tools-ac-coverage/src/index.ts
#!/usr/bin/env tsx
import { run } from './run'
void run(process.argv.slice(2))
```

- [ ] Commit:

```bash
git add packages/tools-ac-coverage/package.json packages/tools-ac-coverage/src/index.ts
git commit -m "chore(tools): scaffold ac-coverage package"
```

---

### Task J2: `scanSpec()` — 扫 V1-SPEC markdown 中的 `AC-XX-YY` 标识

**Files:**

- Test: `packages/tools-ac-coverage/src/scan-spec.test.ts`
- Function under test: `scanSpec(rootDir): Promise<Map<string, SpecAC>>`

- [ ] **Step 1: RED**

```ts
import { describe, it, expect } from 'vitest'
import { scanSpec } from './scan-spec'

describe('scanSpec', () => {
  it('extracts AC-XX-YY identifiers with source file + line', async () => {
    const map = await scanSpec('docs/V1-SPEC')
    expect(map.has('AC-03-01')).toBe(true)
    expect(map.has('AC-03-02')).toBe(true)
    expect(map.has('AC-03-03')).toBe(true)
    expect(map.get('AC-03-01')!.file).toMatch(/03-data-model\.md$/)
  })
})
```

- [ ] **Step 2: 看红**

- [ ] **Step 3: 实现**

```ts
// packages/tools-ac-coverage/src/scan-spec.ts
import fg from 'fast-glob'
import { readFile } from 'node:fs/promises'

export interface SpecAC {
  id: string
  file: string
  line: number
  context: string
}

const RE = /\bAC-(\d{2})-(\d{2})\b/g

export async function scanSpec(rootDir: string): Promise<Map<string, SpecAC>> {
  const files = await fg(['**/*.md'], { cwd: rootDir, absolute: true })
  const out = new Map<string, SpecAC>()
  for (const f of files) {
    const text = await readFile(f, 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      let m: RegExpExecArray | null
      RE.lastIndex = 0
      while ((m = RE.exec(line))) {
        const id = `AC-${m[1]}-${m[2]}`
        if (!out.has(id)) out.set(id, { id, file: f, line: i + 1, context: line.trim() })
      }
    })
  }
  return out
}
```

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/tools-ac-coverage/src/scan-spec.ts packages/tools-ac-coverage/src/scan-spec.test.ts
git commit -m "feat(tools): ac-coverage scanSpec"
```

---

### Task J3: `scanTests()` — 扫 vitest title

**Files:**

- Test: `packages/tools-ac-coverage/src/scan-tests.test.ts`
- Function under test: `scanTests(rootDir): Promise<Map<string, TestAC[]>>`

- [ ] **Step 1: RED**

```ts
describe('scanTests', () => {
  it('finds vitest title AC-XX-YY: prefix and reports file + describe + it', async () => {
    const map = await scanTests('packages')
    expect(map.has('AC-03-01')).toBe(true)
    expect(map.get('AC-03-01')![0].file).toMatch(/with-tenant\.test\.ts$/)
  })
})
```

- [ ] **Step 2: 看红**

- [ ] **Step 3: 实现** — 简单 regex 扫 `it('AC-XX-YY: ...'` / `describe('AC-XX-YY: ...'` / it title 中含 `AC-XX-YY` 即认作。

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/tools-ac-coverage/src/scan-tests.ts packages/tools-ac-coverage/src/scan-tests.test.ts
git commit -m "feat(tools): ac-coverage scanTests"
```

---

### Task J4: `report()` — 三态 join + markdown 表 + JSON

**Files:**

- Test: `packages/tools-ac-coverage/src/report.test.ts`
- Function under test: `report({ spec, tests, seed }) => { markdown, json, exitCode }`

- [ ] **Step 1: RED**

```ts
describe('report', () => {
  it('classifies covered / missing / orphan', () => {
    const spec = new Map([
      [
        'AC-03-01',
        {
          /*...*/
        },
      ],
      [
        'AC-03-02',
        {
          /*...*/
        },
      ],
    ])
    const tests = new Map([
      [
        'AC-03-01',
        [
          /*...*/
        ],
      ],
      [
        'AC-99-99',
        [
          /*...*/
        ],
      ],
    ])
    const r = report({ spec, tests, seed: ['AC-03-01', 'AC-03-02'] })
    expect(r.json.covered).toEqual(['AC-03-01'])
    expect(r.json.missing).toEqual(['AC-03-02'])
    expect(r.json.orphan).toEqual(['AC-99-99'])
  })

  it('returns exitCode=1 if any seed AC missing', () => {
    const r = report({ spec, tests: new Map(), seed: ['AC-03-01'] })
    expect(r.exitCode).toBe(1)
  })

  it('returns exitCode=0 if all seed AC covered', () => {
    const r = report({ spec, tests, seed: ['AC-03-01', 'AC-03-02'] })
    expect(r.exitCode).toBe(0)
  })
})
```

- [ ] **Step 2: 看红**

- [ ] **Step 3: 实现**

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/tools-ac-coverage/src/report.ts packages/tools-ac-coverage/src/report.test.ts
git commit -m "feat(tools): ac-coverage report (covered/missing/orphan + exit code)"
```

---

### Task J5: CLI run() — 串起来

**Files:**

- Create: `packages/tools-ac-coverage/src/run.ts`
- Test: `packages/tools-ac-coverage/src/run.test.ts`（端到端：在临时目录跑，检 `coverage/ac.json` 出现）

- [ ] **Step 1: RED**

- [ ] **Step 2: 看红**

- [ ] **Step 3: 实现**

```ts
// packages/tools-ac-coverage/src/run.ts
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { scanSpec } from './scan-spec'
import { scanTests } from './scan-tests'
import { report } from './report'

const SEED_AC = ['AC-03-01', 'AC-03-02', 'AC-03-03']

export async function run(argv: string[]): Promise<void> {
  const specDir = argv[0] ?? 'docs/V1-SPEC'
  const testDir = argv[1] ?? 'packages'
  const spec = await scanSpec(specDir)
  const tests = await scanTests(testDir)
  const r = report({ spec, tests, seed: SEED_AC })

  console.log(r.markdown)
  await mkdir('coverage', { recursive: true })
  await writeFile(path.join('coverage', 'ac.json'), JSON.stringify(r.json, null, 2))

  if (r.exitCode !== 0) process.exit(r.exitCode)
}
```

- [ ] **Step 4: GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/tools-ac-coverage/src/run.ts packages/tools-ac-coverage/src/run.test.ts
git commit -m "feat(tools): ac-coverage CLI"
```

---

### Task J6: 在根 `package.json` 暴露 `pnpm ac:coverage`

```jsonc
// 追加 root package.json scripts
{
  "scripts": {
    "ac:coverage": "pnpm --filter @honeyai/tools-ac-coverage exec tsx src/index.ts",
  },
}
```

- [ ] **Verify:** `pnpm ac:coverage` 本地跑通，输出 markdown + 写出 `coverage/ac.json`。
- [ ] **Commit:**

```bash
git add package.json
git commit -m "chore: expose pnpm ac:coverage from root"
```

---

### Task J7: 工作区 9 包识别 — 更新 `pnpm-workspace.yaml` 包含 `packages/tools-ac-coverage`

> **注意:** A1 中 `pnpm-workspace.yaml` 已写 `packages/*`，工具包自然收纳；本 step 仅 sanity 检查 `pnpm -r list` 现在显示 10 个包（9 业务 + 1 tools）。

- [ ] **Verify:** `pnpm -r list --depth -1 | wc -l` ≥ 10

> **Section J 完成检查:** `pnpm ac:coverage` 本地输出 seed 3 条 100% covered，退出码 0。**停下来汇报。**

---

## Section K: CI Workflow

**Goal:** GitHub Actions 实现 lint + typecheck + migration-check + test + ac-coverage，单 PR 一次性跑完。

**Spec source:** `phase-1-resolved-questions.md §F1-F4`。

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/pr-comment.yml`（用 `actions/github-script` 把 `coverage/ac.json` 渲染为 PR comment）

---

### Task K1: 主 CI workflow

**Files:** `.github/workflows/ci.yml`

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

jobs:
  parallel:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        task: [lint, typecheck, migration-check]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: '22.11.0', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm ${{ matrix.task }}

  test:
    needs: parallel
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
        ports: ['5432:5432']
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres
      NODE_ENV: test
      LOG_LEVEL: error
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: '22.11.0', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  ac-coverage:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: '22.11.0', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm ac:coverage
      - uses: actions/upload-artifact@v4
        with: { name: ac-coverage, path: coverage/ac.json }
```

> **`migration-check` 含义:** `pnpm --filter @honeyai/db drizzle-kit check && drizzle-kit generate --dry-run` 等价命令——`pnpm migration-check` 在 root 暴露。

- [ ] **Verify:** 推一个无关 commit，PR CI 全绿。
- [ ] **Commit:**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add ci.yml (lint/typecheck/migration-check parallel, test serial, ac-coverage)"
```

---

### Task K2: PR comment workflow — 渲染 `coverage/ac.json`

**Files:** `.github/workflows/pr-comment.yml`

```yaml
name: pr-ac-comment
on:
  workflow_run:
    workflows: [ci]
    types: [completed]

jobs:
  comment:
    if: github.event.workflow_run.event == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: ac-coverage
          run-id: ${{ github.event.workflow_run.id }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/github-script@v7
        with:
          script: |
            const fs = require('node:fs')
            const data = JSON.parse(fs.readFileSync('ac.json', 'utf8'))
            const body = `## AC Coverage\n\n` +
              `| status | count |\n|---|---|\n` +
              `| covered | ${data.covered.length} |\n` +
              `| missing | ${data.missing.length} |\n` +
              `| orphan | ${data.orphan.length} |\n\n` +
              `<details><summary>details</summary>\n\n` +
              `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n</details>`
            const { data: pulls } = await github.rest.pulls.list({
              owner: context.repo.owner, repo: context.repo.repo,
              head: `${context.repo.owner}:${context.payload.workflow_run.head_branch}`,
            })
            if (pulls.length) {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: pulls[0].number, body,
              })
            }
```

- [ ] **Verify:** PR 上能看到 comment。
- [ ] **Commit:**

```bash
git add .github/workflows/pr-comment.yml
git commit -m "ci: render ac-coverage as PR comment"
```

---

> **Section K 完成检查:** PR 上 CI 全绿 + ac-coverage comment 出现 + seed 3 条 100%。**停下来汇报。**

---

## Section L: Spec Patch + 8 New ADRs + CHANGELOG

**Goal:** Phase 1 实施 PR 必须同步 patch spec、产 8 个新 ADR、写 CHANGELOG v0.3.0。

**Spec source:** `CLAUDE.md §13` + `phase-1-open-questions.md §拍板后操作` + `02-architecture.md §3`。

**Files (write-only, no TDD — 文档变更):**

- Modify: `docs/V1-SPEC/02-architecture.md`（§2 migration 路径 + §3 9 包真实状态）
- Modify: `docs/V1-SPEC/CHANGELOG.md`（追加 v0.3.0）
- Create: `docs/V1-SPEC/ADRs/ADR-009-typescript-strict-flags.md`
- Create: `docs/V1-SPEC/ADRs/ADR-010-drizzle-migration-dir.md`
- Create: `docs/V1-SPEC/ADRs/ADR-011-run-cost-summary-matview-sql.md`
- Create: `docs/V1-SPEC/ADRs/ADR-012-seed-placeholder.md`
- Create: `docs/V1-SPEC/ADRs/ADR-013-drizzle-zod-location.md`
- Create: `docs/V1-SPEC/ADRs/ADR-014-core-barrel-only.md`
- Create: `docs/V1-SPEC/ADRs/ADR-015-husky-dotfiles.md`
- Create: `docs/V1-SPEC/ADRs/ADR-016-env-minimal.md`
- Modify: `docs/V1-SPEC/ADRs/README.md`（追加 ADR-009..016 行）

---

### Task L1: Spec §2 + §3 patch

**Files:** `docs/V1-SPEC/02-architecture.md`

- **§2 patch:** 找到原 migration 路径 `infra/migrations/` 描述，改为 `packages/db/drizzle/`，引用 ADR-010。
- **§3 patch:** 把 8 包列表改为 9 包（合并 shared 到 core；新增 `tools-ac-coverage`）；Phase 1 状态列改为：core 最小子集 / db 全量 / tools-ac-coverage 实建 / 7 包占位。

- [ ] **Step 1:** 读现状（先 `Read` 02-architecture.md §2 + §3）
- [ ] **Step 2:** Edit 改两节
- [ ] **Step 3: Commit**

```bash
git add docs/V1-SPEC/02-architecture.md
git commit -m "docs(spec): patch §2 migration dir + §3 9-pkg layout (Phase 1 implementation)"
```

---

### Task L2: 8 个新 ADR

**模板（每个文件结构一致）:**

```markdown
# ADR-NNN: <title>

- 状态: Accepted
- 日期: 2026-05-25

## Context

<引用 phase-1-open-questions.md 第 N 章节问题>

## Decision

<拍板（A/B/...）+ 生效配置摘要>

## Consequences

- 正面:
- 负面:
- 后续影响:

## Related

- phase-1-open-questions.md §N
- phase-1-resolved-questions.md §X
- 受影响包 / 文件
```

**8 个 ADR 一一对应：**

| ADR     | 主题                                                       | 拍板 | 锁定文件                                                    |
| ------- | ---------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| ADR-009 | TS strict flags 推荐子集                                   | B    | `tsconfig.base.json`                                        |
| ADR-010 | Drizzle migration 落 `packages/db/drizzle/`                | A    | `packages/db/drizzle.config.ts`                             |
| ADR-011 | `run_cost_summary` matview 单独 SQL migration              | A    | `packages/db/drizzle/0001_run_cost_summary_matview.sql`     |
| ADR-012 | Seed 入口 Phase 1 仅空骨架                                 | A    | `packages/db/src/seed/index.ts`                             |
| ADR-013 | drizzle-zod 同 schema 文件 re-export                       | A    | `packages/db/src/schema/*.ts` 末尾                          |
| ADR-014 | `@honeyai/core` 仅 barrel 导出                             | A    | `packages/core/src/index.ts`                                |
| ADR-015 | husky / lint-staged / commitlint 全独立 dotfile            | A    | `.husky/*` + `.lintstagedrc.json` + `commitlint.config.cjs` |
| ADR-016 | `.env.example` 极简（DATABASE_URL + NODE_ENV + LOG_LEVEL） | A    | `.env.example` + `packages/core/src/env/index.ts`           |

- [ ] **Step 1:** 逐文件写 8 份 ADR（每份 < 50 行）
- [ ] **Step 2:** 修 `docs/V1-SPEC/ADRs/README.md` 追加 8 行索引
- [ ] **Step 3: Commit**

```bash
git add docs/V1-SPEC/ADRs/ADR-009-*.md docs/V1-SPEC/ADRs/ADR-010-*.md \
        docs/V1-SPEC/ADRs/ADR-011-*.md docs/V1-SPEC/ADRs/ADR-012-*.md \
        docs/V1-SPEC/ADRs/ADR-013-*.md docs/V1-SPEC/ADRs/ADR-014-*.md \
        docs/V1-SPEC/ADRs/ADR-015-*.md docs/V1-SPEC/ADRs/ADR-016-*.md \
        docs/V1-SPEC/ADRs/README.md
git commit -m "docs(spec): ADR-009..016 (Phase 1 拍板入档)"
```

---

### Task L3: CHANGELOG v0.3.0

**Files:** `docs/V1-SPEC/CHANGELOG.md`

追加一段：

```markdown
## v0.3.0 — 2026-05-25 (Phase 1 implementation)

### Added

- 9-package pnpm/Turborepo workspace skeleton (core + db real; 7 placeholders; tools-ac-coverage real)
- `@honeyai/db`: 30-table Drizzle schema + drizzle-zod schemas + first migration + `run_cost_summary` matview
- `withTenant` Proxy + seed AC-03-01/02/03 green
- `@honeyai/tools-ac-coverage` (spec scanner + test scanner + 3-state report + PR comment)
- CI: lint/typecheck/migration-check (parallel) → test (services postgres:17) → ac-coverage
- ADR-009..016 (Phase 1 拍板入档)

### Changed

- §2 migration directory: `infra/migrations/` → `packages/db/drizzle/`
- §3 package layout: 8 → 9 packages (shared merged into core; tools-ac-coverage added)

### Note

- Phase 1 does not touch business logic (orchestrator/sandbox/web/github/worker). 7 placeholders remain `export {}`.
```

- [ ] **Step 1: Edit**
- [ ] **Step 2: Commit**

```bash
git add docs/V1-SPEC/CHANGELOG.md
git commit -m "docs(spec): CHANGELOG v0.3.0 (Phase 1 implementation)"
```

---

### Task L4: 最终 PR description 模板

**Files:** （不入仓，纯发 PR 时用）

```markdown
# Phase 1: monorepo skeleton + db full schema

Closes ADR-008.

## Scope (ADR-008)

1. pnpm + Turborepo + 9 packages
2. `@honeyai/db` 30 tables + migration + matview
3. `withTenant` Proxy + AC-03-01/02/03 green
4. `@honeyai/tools-ac-coverage` + CI

## ADRs landed

ADR-009..016 (see `docs/V1-SPEC/ADRs/`)

## Spec patches

- §2 migration dir → `packages/db/drizzle/`
- §3 9-package layout
- CHANGELOG v0.3.0

## FK behavior table

（粘 `packages/db/README.md` 中的 FK 行为表整张表）

## Test results

- `pnpm test`: <N> passed
- `pnpm ac:coverage`: seed 3/3 covered (100%)

## Out of scope (Phase 2+)

- orchestrator FSM, sandbox runner, web UI, BullMQ worker, GitHub App, infra bootstrap
```

- [ ] **Step:** 发 PR 时手工粘贴。

---

> **Section L 完成检查:** 8 个 ADR 入档 + spec §2/§3 patch + CHANGELOG v0.3.0 写入 + ADRs/README 索引更新。**停下来等用户最终 review + 合 PR。**

---

## Phase 1 Done Definition

全部以下条件同时满足才算 Phase 1 完成：

- [ ] `pnpm install` 干净一次通过（CI 用 `--frozen-lockfile` 也通过）
- [ ] `pnpm -r typecheck` 全绿
- [ ] `pnpm lint` 全绿
- [ ] `pnpm test` 全绿（含 AC-03-01/02/03 三条种子）
- [ ] `pnpm ac:coverage` 退出码 0，seed 3/3 covered
- [ ] `docker compose up -d` 起 PG + Redis + MinIO 健康
- [ ] `pnpm --filter @honeyai/db migrate` 在干净 DB 上成功建出 30 表 + `run_cost_summary` matview
- [ ] CI workflow 在 PR 全绿 + ac-coverage comment 出现
- [ ] 8 个 ADR (009..016) 已 `Accepted` 状态入档
- [ ] spec §2 + §3 patch 完成，CHANGELOG v0.3.0 写入
- [ ] PR description 含 FK 行为表 + ADR 列表
- [ ] 7 个占位包 `src/index.ts` 仅 `export {}`，CLAUDE.md 列出的"不要碰"项目无任何额外内容

---

## Self-Review Checklist (per writing-plans skill)

执行人在开始实施前对照 review，发现问题立即停下问用户：

### 1. Spec coverage

- [ ] CLAUDE.md §5 全部 12 步骤都映射到 Section A-L 的至少一个 task？
- [ ] CLAUDE.md §Phase 1 Scope §4 件事（workspace / db 30 表 / migration + compose / withTenant + 3 AC）都有 task 覆盖？
- [ ] 03-data-model.md 全部 30 表都在 Section E 列出？
- [ ] AC-03-01/02/03 三条都各有一个 RED 测试 + GREEN 实现 task？
- [ ] phase-1-open-questions.md 8 个新拍板都对应一个 ADR task（L2 8 个 ADR）？
- [ ] phase-1-resolved-questions.md 中所有锁定项（FK 行为表 / `__drizzle_migrations` / ac:coverage 范围）都有对应 task？

### 2. Placeholder scan

- [ ] 没有 "TBD" "TODO" "implement later" "fill in details" 出现在任务步骤中？
- [ ] 每个代码 step 都有完整可运行的代码块（不是 "类似 Task X" 的引用）？
- [ ] 每个 verify step 都有具体的 `pnpm` / `git` / `docker` 命令？

### 3. Type / API consistency

- [ ] `withTenant(db, tenantId)` 签名在 G1 / G2 / G3 / G4 全程一致？
- [ ] `rawDb` / `systemDb` 在 A / D / G / H 引用一致？
- [ ] `createTenant` / `createUser` / `createRun` 等 repo 函数签名贯穿 H1-H4 一致？
- [ ] schema export 名（`tenants` / `users` / `runs` / ...）与 03-data-model.md §6 一致？
- [ ] `AC-03-01:` / `AC-03-02:` / `AC-03-03:` test title 前缀格式与 J3 scanTests 期望一致？

---

## Execution Boundary

**用户已明确：plan 输出后停下等审，不准自动 go。**

- 本文件交付到此即停。
- **不要** 触发 ExitPlanMode。
- **不要** 自动调用 superpowers:subagent-driven-development 或 superpowers:executing-plans。
- 等用户审阅本 plan 并发出"开始执行 Section X"或类似明确指令后再继续。

---

**Plan version:** 1.0
**Created:** 2026-05-25
**Author:** Claude (claude-opus-4-7) via superpowers:writing-plans
