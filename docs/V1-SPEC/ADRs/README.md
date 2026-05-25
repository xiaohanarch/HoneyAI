# ADRs — Architecture Decision Records

> 每条 ADR 记录 V1 一个关键架构决策的 **Context / Decision / Consequences / Alternatives**。

## 索引

| ID | 标题 | 状态 |
|---|---|---|
| [ADR-001](./ADR-001-drizzle-orm.md) | 选 Drizzle ORM 不选 Prisma | Accepted |
| [ADR-002](./ADR-002-sse-not-ws.md) | 实时通信用 SSE+POST 不用 WebSocket | Accepted |
| [ADR-003](./ADR-003-unified-nextjs.md) | Unified Next.js 不拆 API/Web | Accepted |
| [ADR-004](./ADR-004-kubectl-exec-sandbox.md) | Sandbox 用 kubectl exec 长跑 pod（V1 妥协） | Accepted with Tech Debt |
| [ADR-005](./ADR-005-ghcr-only.md) | 镜像 registry 只用 ghcr，不用 ACR | Accepted |
| [ADR-006](./ADR-006-bootstrap-ux.md) | Bootstrap Welcome 4 步必填 | Accepted |
| [ADR-007](./ADR-007-run-binary-state.md) | Run 状态二元，不支持部分失败 | Accepted |
| [ADR-008](./ADR-008-phase-1-scope.md) | Phase 1 实施范围 — monorepo 骨架 + db 全表落地 | Accepted |
| [ADR-009](./ADR-009-typescript-strict-flags.md) | TypeScript strict flags 推荐子集 | Accepted |
| [ADR-010](./ADR-010-drizzle-migration-dir.md) | Drizzle migration 落 `packages/db/drizzle/` | Accepted |
| [ADR-011](./ADR-011-run-cost-summary-matview-sql.md) | `run_cost_summary` 物化视图单独 SQL migration | Accepted |
| [ADR-012](./ADR-012-seed-placeholder.md) | Seed 入口 Phase 1 仅占位空骨架 | Accepted |
| [ADR-013](./ADR-013-drizzle-zod-location.md) | drizzle-zod schema 同文件 re-export | Accepted |
| [ADR-014](./ADR-014-core-barrel-only.md) | `@honeyai/core` 仅 barrel 导出 | Accepted |
| [ADR-015](./ADR-015-husky-dotfiles.md) | husky / lint-staged / commitlint 全独立 dotfile | Accepted |
| [ADR-016](./ADR-016-env-minimal.md) | Phase 1 `.env.example` 极简变量集 | Accepted |
| [ADR-017](./ADR-017-node-engines-relaxed.md) | 本地 Node 引擎上界放宽至 `>=22.11.0`（CI/Prod 仍 22.11.0） | Accepted |
| [ADR-018](./ADR-018-minio-image-tag.md) | docker-compose MinIO tag 改为 `RELEASE.2025-01-20T14-49-07Z`（本机镜像源屏蔽 plan 原 tag） | Accepted |
| [ADR-019](./ADR-019-docker-compose-ports.md) | docker-compose host 端口改 5 字头非标准映射（55432/56379/59000/59001） | Accepted |
| [ADR-020](./ADR-020-sandbox-mvp-local-docker.md) | Sandbox MVP 用本地 Docker（替代 spec 06 §k3s,V1.0 仍回 K8s） | Accepted |

## 写作模板

```markdown
# ADR-XXX: <一句话标题>

- 状态: Proposed | Accepted | Deprecated | Superseded by ADR-YYY
- 日期: YYYY-MM-DD

## Context
<为什么要做这个决定，背景约束>

## Decision
<决定是什么>

## Consequences
- 正面: ...
- 负面: ...
- 后续影响: ...

## Alternatives Considered
- Option A: <为什么没选>
- Option B: <为什么没选>

## Related
- 相关 ADR / Tech Debt / Spec 章节
```

## 添加新 ADR
1. 复制模板新建 `ADR-XXX-<slug>.md`
2. 在本文件索引表新增一行
3. 在相关 spec 章节加链接
