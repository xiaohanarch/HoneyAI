# ADR-019: docker-compose host 端口改为 5 字头非标准映射（55432/56379/59000/59001）

- 状态: Accepted
- 日期: 2026-05-25

## Context

Phase 1 plan §B1 初稿 `docker-compose.yml` 使用 host 标准端口：

```yaml
postgres: ports: ['5432:5432']
redis:    ports: ['6379:6379']
minio:    ports: ['9000:9000', '9001:9001']
```

执行 B1 `docker compose up -d` 时本机 `5432` 与 `6379` 被另一项目（`honeybadge-postgres` / `honeybadge-redis`，长期运行）占用：

```text
Bind for 0.0.0.0:5432 failed: port is already allocated
```

MinIO 9000/9001 未冲突。

候选：

- **A**：host 端口改 5 字头非标准映射（`55432` / `56379` / `59000` / `59001`），容器内端口不变
- **B**：临时停 honeybadge-* 容器，B1 验完再起回去
- **C**：用 `127.0.0.1:5432:5432` 限定 + 用户手动停 honeybadge（等价 B + 多一行硬化）
- **D**：docker-compose 不暴露端口，用 `docker exec` 访问

## Decision

选 **A —— host 端口改为 5 字头非标准映射**：

```yaml
postgres: ports: ['55432:5432']
redis:    ports: ['56379:6379']
minio:    ports: ['59000:9000', '59001:9001']
```

生效约束：

- `docker-compose.yml` 的 4 个端口行按上表写
- `.env.example` `DATABASE_URL` 主机端口同步改为 `55432`
- plan §B1 字面 patch 为新端口
- 容器内端口不变（`5432` / `6379` / `9000` / `9001`）—— 仅 host 侧重映射，应用代码 / 容器互联 / k8s 部署逻辑全部不动
- 5 字头选择规则：在原端口前补 `5`，便于团队成员心算定位（`55432` ↔ pg `5432`，`56379` ↔ redis `6379`，`59000` ↔ minio s3 `9000`，`59001` ↔ minio console `9001`）

## Consequences

- 正面:
  - 多项目共存默认零冲突，开发机长期跑多个 stack 不需要 down 其他项目
  - 隔离最彻底：未来 V1 生产部署用 k8s service 内联，本地 host 端口选择对生产无影响
  - 心算映射规则清晰，无需查表
- 负面:
  - 开发者首次 `psql` 连接需要带 `-p 55432`，与 PG 默认 `5432` 不一致
  - Drizzle Studio / TablePlus 等 GUI 工具默认端口需手动改
  - 偏离 plan §B1 原意，需读者结合本 ADR 理解
- 后续影响:
  - V1 生产 / CI 不受影响（CI 用 GH Actions `services: postgres` 行内绑定端口；prod 走 k8s service）
  - 不增加 Tech Debt 条目（5 字头是局部 dev 体验约定）

## Alternatives Considered

- **B**：临时停 honeybadge-* —— 用户一次性方案，不解决长期共存；下次重启又撞
- **C**：`127.0.0.1:5432:5432` —— 仅限定监听网卡，仍然撞同一端口，被拒
- **D**：不暴露端口 + `docker exec` 访问 —— Drizzle Studio / 本地 psql / 浏览器访问 MinIO console 全部失效，dev 体验严重退化

## Related

- `ADR-008-phase-1-scope.md`（锁 Phase 1 范围含 docker-compose）
- `ADR-018-minio-image-tag.md`（同一轮 B1 验证发现的第 2 个本地环境冲突）
- `docs/V1-SPEC/decisions/phase-1-resolved-questions.md §C3`
- `docs/superpowers/plans/2026-05-25-phase-1-monorepo-db-skeleton.md §B1`
- `CLAUDE.md` §Tech Stack —— 本地容器行 patch 包含本 ADR
