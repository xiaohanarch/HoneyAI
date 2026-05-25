# ADR-018: docker-compose MinIO 镜像 tag 改为 `RELEASE.2025-01-20T14-49-07Z`

- 状态: Accepted
- 日期: 2026-05-25

## Context

Phase 1 plan §B1 初稿在 `docker-compose.yml` 中将 MinIO 镜像固定为：

```yaml
image: minio/minio:RELEASE.2024-12-18T13-15-30Z
```

执行 B1 `docker compose up -d` 时本机 Docker daemon 配置的阿里云镜像源
（`ng908708.mirror.aliyuncs.com`）对该 tag 返回 **403 Forbidden**，无法拉取。
验证：

- `postgres:17-alpine` ✅ 可拉
- `minio/minio:latest` ✅ 可拉
- `minio/minio:RELEASE.2024-12-18T13-15-30Z` ❌ 403
- `minio/minio:RELEASE.2025-04-22T22-12-26Z` ✅ 可拉
- `minio/minio:RELEASE.2025-01-20T14-49-07Z` ✅ 可拉
- `minio/minio:RELEASE.2024-10-13T13-34-11Z` ✅ 可拉

Phase 1 实际仅用 MinIO 做本地 dev 期 S3 兼容对象存储（`@honeyai/db` Phase 1 不读写
object storage；MinIO 主要为 Phase 2+ orchestrator / sandbox artifact 链路准备）。
具体哪个发版 tag 对 Phase 1 没有功能性差异，只要 S3 兼容 API 接口稳定即可。

候选：

- **A**：换为 `RELEASE.2025-01-20T14-49-07Z`（plan 原意是 2024-12 末，最接近的可拉 release）
- **B**：换为 `RELEASE.2025-04-22T22-12-26Z`（更新）
- **C**：换为 `minio/minio:latest`（浮动 tag）
- **D**：保留 plan 原 tag，要求开发者改 Docker daemon `registry-mirrors` 配置绕过阿里云源

## Decision

选 **A —— `minio/minio:RELEASE.2025-01-20T14-49-07Z`**。

生效约束：

- `docker-compose.yml` 中 `minio.image` = `minio/minio:RELEASE.2025-01-20T14-49-07Z`
- plan §B1 字面 patch 为新 tag
- 后续若发现新的本地镜像源屏蔽问题，单独走 ADR-019，不在本 ADR 范围内
- 不锁更新策略：未来若该 tag 也被屏蔽，再换为当时可拉的近版 RELEASE tag 即可，不再回头改 ADR-018

## Consequences

- 正面:
  - 解除 B1 阻塞，`docker-compose up -d` 在本机镜像源直接可用
  - 仍 pin 固定 tag（不是 `latest`），团队成员复刻行为可预期
  - 与 plan 原意 2024-12 末距离 1 个月，S3 API 表面无差异
- 负面:
  - 团队其他开发者本机 Docker daemon 若用其他镜像源，可能恰好对 2025-01-20 这个 tag 不可用 —— 届时按 ADR-019 走新决策
  - V1 生产部署的 MinIO 版本最终在 k8s 镜像选型时另行决定，本 ADR 仅约束本地 docker-compose
- 后续影响:
  - 不增加 Tech Debt 条目（Phase 1 不依赖 MinIO 功能行为）
  - Phase 2 写 orchestrator artifact upload 时，需复测 MinIO RELEASE.2025-01-20 的 mc client 行为

## Alternatives Considered

- **B**：`RELEASE.2025-04-22T22-12-26Z` —— 更新但偏离 plan 原意更远，无业务收益
- **C**：`minio/minio:latest` —— 失去 pin，CI/local/团队复刻行为漂移风险高，被拒
- **D**：要求改 Docker daemon `registry-mirrors` —— 环境配置变更跟仓库无关；新开发者 onboarding 多一步摩擦；不解决"plan 字面与本机环境的实际可达性"根问题

## Related

- `ADR-008-phase-1-scope.md`（锁 Phase 1 范围含 docker-compose）
- `docs/V1-SPEC/decisions/phase-1-resolved-questions.md §C3+§11`
- `docs/superpowers/plans/2026-05-25-phase-1-monorepo-db-skeleton.md §B1`
- `CLAUDE.md` §Tech Stack —— 本地容器行同步 patch 为"docker-compose（PG + Redis + MinIO，MinIO tag 见 ADR-018）"
