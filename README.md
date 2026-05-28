# HoneyAI

**一句话需求 → 三阶段 AI 流水线 → 自动产出 GitHub PR**

面向 5–10 人研发团队的自托管 AI 数字研发产线（DevPipeline）。
AI Agent 完成需求富化、架构设计与编码，人在关键 Gate 节点把关——不是黑盒，不是月底账单惊喜。

[![Node 22 LTS](https://img.shields.io/badge/Node-22%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm 9](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![Postgres 17](https://img.shields.io/badge/Postgres-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logoColor=black)](https://orm.drizzle.team)
[![License MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## 它做什么

```
你输入                         AI 完成                           你拿到
──────          ──────────────────────────────────────────          ────────
一句话    ──→   Stage 1: 需求富化（req IR）                  ──→   GitHub PR
需求            Stage 2: 架构设计（design IR）
                Stage 3: 编码 + 单测（impl IR → code）
                ↑ 每两阶段之间有 Gate 节点，等你审批 ↑
```

与同类工具的核心差异：

|            | HoneyAI                        | 其他 AI 编码工具      |
| ---------- | ------------------------------ | --------------------- |
| 输入门槛   | 一句话                         | 需要详细 Prompt / PRD |
| 执行可见性 | IR 文档演化链 + Agent 工具轨迹 | 黑盒                  |
| 人工介入点 | 强制 Gate 审查（Stage 间）     | 无 / 事后查看         |
| 成本追踪   | 按 Stage 拆解，实时展示        | 月度汇总账单          |
| 部署方式   | 自托管（单 ECS / k3s）         | SaaS                  |

---

## 架构

```
用户浏览器
    │ HTTPS / SSE
    ▼
┌───────────────────────────────────────────┐
│  Next.js 15 App Router  (packages/web)   │
│  RSC · Server Actions · SSE 流式推送      │
└────────┬──────────────────────┬───────────┘
         │                      │ BullMQ Job
┌────────▼──────────┐   ┌───────▼─────────────┐
│  PostgreSQL 17    │   │  Worker              │
│  Drizzle ORM      │   │  Run reconcile       │
│  LISTEN/NOTIFY    │   │  Cost rollup         │
└────────┬──────────┘   └───────┬─────────────┘
         │                      │
         │              ┌───────▼─────────────┐
         │              │  Orchestrator        │
         │              │  Run/Node FSM · Gate │
         │              └───────┬─────────────┘
         │                      │ kubectl exec
         │              ┌───────▼─────────────┐
         │              │  Sandbox Pod         │
         │              │  Claude Code CLI     │
         │              │  sandbox-runner CLI  │
         │              └───┬─────────────┬───┘
         │                  │             │
         │            GitHub API    Anthropic API
         │
┌────────▼───────────────────┐
│  Object Storage (OSS/MinIO)│
│  Artifact CAS · Loki 日志  │
└────────────────────────────┘
```

**本地开发栈：** PostgreSQL 17 + Redis 7 + MinIO（via Docker Compose）

---

## 快速开始

### 前置条件

- Node.js 22 LTS（`node -v` 确认 ≥ 22.11.0）
- pnpm 9（`npm i -g pnpm@9`）
- Docker Desktop（本地数据库）
- GitHub App（[创建指引](docs/V1-SPEC/01-product.md)）
- Anthropic API Key

### 1. 克隆与安装

```bash
git clone https://github.com/your-org/honeyai.git
cd honeyai
pnpm install
```

### 2. 启动本地基础设施

```bash
docker compose up -d
# PostgreSQL → localhost:55432
# Redis      → localhost:56379
# MinIO      → localhost:59000  (Console: 59001)
```

### 3. 初始化数据库

```bash
pnpm --filter @honeyai/db migrate
pnpm --filter @honeyai/db seed:dev   # 写入开发用 fixture 数据
```

### 4. 配置环境变量

```bash
cp .env.example packages/web/.env
# 按注释填写：DATABASE_URL / REDIS_URL / ANTHROPIC_API_KEY /
# GITHUB_APP_ID / GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
```

### 5. 启动开发服务器

```bash
pnpm dev
# Web  → http://localhost:3001
# Worker 在同一进程中热启动
```

### 6. 登录

开发模式内置 fixture 账户（无需真实 GitHub OAuth）：

```
alice / dev-alice   ← 默认演示数据（25 条历史 Run）
bob   / dev-bob
carol / dev-carol
```

---

## 项目结构

```
honeyai/
├── packages/
│   ├── core/              # 共享类型 · zod schema · 错误类 · logger
│   ├── db/                # Drizzle schema（30 表）· migration · withTenant
│   ├── orchestrator/      # Run/Node FSM · Gate · 重试 · reconcile
│   ├── adapter-claude/    # Claude Code CLI 适配器（V1 默认 Runtime）
│   ├── adapter-opencode/  # opencode 适配器（预留，build-time 不上线）
│   ├── github/            # GitHub App · OAuth · REST/GraphQL 客户端
│   ├── web/               # Next.js 15 主应用 · UI · API Routes · SSE
│   ├── worker/            # BullMQ Worker 进程
│   ├── sandbox-runner/    # Sandbox 内 Node CLI（stream-json → JSONL）
│   └── tools-ac-coverage/ # Spec ↔ Vitest title 覆盖率扫描（CI 门禁）
├── docs/V1-SPEC/          # 产品规格 · ADR · 决策记录（只读）
├── infra/
│   ├── k8s/               # Kustomize manifests（base + overlays）
│   ├── docker/            # Dockerfile.web / .worker / .sandbox
│   └── bootstrap/         # 主机初始化脚本
├── docker-compose.yml     # 本地开发：PG + Redis + MinIO
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 技术栈

| 层         | 选型                                          |
| ---------- | --------------------------------------------- |
| 语言       | TypeScript 5（`strict: true`）                |
| 运行时     | Node.js 22 LTS                                |
| Web 框架   | Next.js 15 App Router（RSC + Server Actions） |
| ORM        | Drizzle + drizzle-kit                         |
| 数据库     | PostgreSQL 17                                 |
| 任务队列   | BullMQ / Redis 7                              |
| AI Runtime | Claude Code CLI（Anthropic）                  |
| 对象存储   | Aliyun OSS / MinIO（本地）                    |
| 容器化     | k3s + kubectl exec 沙箱                       |
| Monorepo   | Turborepo + pnpm workspaces                   |
| 测试       | Vitest + @testcontainers/postgresql           |
| 代码规范   | typescript-eslint · Prettier · commitlint     |
| 日志       | pino + pino-pretty                            |
| 环境变量   | @t3-oss/env-core + zod（启动时 fail-fast）    |

---

## 常用命令

```bash
# 开发
pnpm dev                        # 启动所有包的 watch 模式
pnpm --filter @honeyai/web dev  # 只启动 Web

# 测试（需要 Docker 运行）
pnpm test                       # Vitest workspace 全量测试
pnpm --filter @honeyai/db test  # 只跑 DB 包测试

# 数据库
pnpm --filter @honeyai/db generate  # drizzle-kit generate（变更 schema 后）
pnpm --filter @honeyai/db migrate   # 应用 migration

# 质量检查
pnpm lint                       # ESLint 全量
pnpm typecheck                  # tsc --noEmit 全量
pnpm ac:coverage                # AC 覆盖率报表（CI 门禁）

# 构建
pnpm build                      # Turborepo 并行构建所有包
```

---

## 演示

本地启动后，访问原型演示页面：

| 页面          | URL                                                       | 说明                       |
| ------------- | --------------------------------------------------------- | -------------------------- |
| 运行列表      | `http://localhost:3001/prototype/runs-list.html`          | 列表 + 看板双视图          |
| Run 详情      | `http://localhost:3001/prototype/run-detail.html?runId=…` | 节点 Rail · IR 链 · 成本   |
| **Demo 指南** | `http://localhost:3001/prototype/demo-guide.html`         | **PPT 演示幻灯片（推荐）** |
| 初始化配置    | `http://localhost:3001/prototype/setup.html`              | API Key · GitHub · Skills  |

---

## 流水线详解

### 三阶段 + 两个 Gate

```
Stage 1 — 需求富化（Enrich）
  输入：一句话需求
  产出：requirement_ir v1（含验收标准 · 技术约束 · 边界情况）
  耗时：~3 分钟  成本：~$0.20

  ⏸ Gate 1 — 人工审查 requirement_ir，确认 AI 理解正确再继续

Stage 2 — 架构设计（Design）
  输入：requirement_ir v1
  产出：design_ir（模块依赖 · 接口定义 · 文件变更计划）
  耗时：~5 分钟  成本：~$0.37

  ⏸ Gate 2 — 人工审查 design_ir，确认技术方案再启动编码

Stage 3 — 编码 + 单测（Code）
  输入：design_ir + impl_ir
  产出：代码变更 + 单测 + GitHub PR
  耗时：~9 分钟  成本：~$0.75

总计：~17 分钟  $1.32  →  PR 就绪
```

### Gate 的价值

用 $0.20 的 Stage 1 成本确认方向正确，再投入 $1.12 完成剩余工作。
方向错误时随时中止，不浪费后续算力。

---

## 开发规范

- **TDD 强制**：新功能先写测试（RED → GREEN → REFACTOR）
- **真实 PG 测试**：所有 DB 测试使用 `@testcontainers/postgresql`，禁止 pg-mem / SQLite
- **AC 覆盖率门禁**：`pnpm ac:coverage` 在 CI 中强制 seed AC 100% 通过
- **Spec 只读**：`docs/V1-SPEC/` 不允许直接修改，变更通过新建 ADR 提议
- **提交规范**：遵循 Conventional Commits（`feat` / `fix` / `chore` / `docs` / `test`）

详细开发规约见 [`CLAUDE.md`](CLAUDE.md)。

---

## 路线图

| 阶段    | 目标                                             | 状态      |
| ------- | ------------------------------------------------ | --------- |
| Phase 1 | Monorepo 骨架 · DB 30 表 Schema · withTenant     | ✅ 完成   |
| Phase 2 | Orchestrator FSM · Worker · Web UI · GitHub 集成 | 🚧 进行中 |
| Phase 3 | 生产部署（k3s）· Observability · 多 Tenant       | 📋 计划中 |

---

## 贡献

1. Fork 本仓库并创建特性分支：`git checkout -b feat/your-feature`
2. 遵循 TDD 流程，确保测试通过：`pnpm test`
3. 代码规范检查：`pnpm lint && pnpm typecheck`
4. 提交 PR，标题使用 Conventional Commits 格式

如发现 Bug 或有功能建议，欢迎提 [Issue](../../issues)。

---

## License

[MIT](LICENSE) © HoneyAI Contributors
