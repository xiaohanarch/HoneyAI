# V1-SPEC Changelog

> 本文档记录 spec 自身的变更。代码层变更走 git 提交，不在此记录。

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
