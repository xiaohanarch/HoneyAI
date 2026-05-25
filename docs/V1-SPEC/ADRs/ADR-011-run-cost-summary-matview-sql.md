# ADR-011: `run_cost_summary` 物化视图单独 SQL migration

- 状态: Accepted
- 日期: 2026-05-25

## Context

`run_cost_summary` 是物化视图（matview），drizzle-kit 不直接支持。需要决定 SQL 落盘形式：

- A — 单独手写 migration 文件，与 drizzle-kit 生成 SQL 并列于 `packages/db/drizzle/`
- B — runtime 在应用启动时 `CREATE MATERIALIZED VIEW IF NOT EXISTS` 执行
- C — 独立 SQL 目录 + 自建 runner

详见 `decisions/phase-1-open-questions.md §3` + `phase-1-resolved-questions.md §B7`。

## Decision

**采纳 A —— 单独 migration 文件**：

- 文件路径：`packages/db/drizzle/NNNN_run_cost_summary_matview.sql`（NNNN 紧跟最后一份 drizzle-kit 生成序号）
- 内容遵循 `phase-1-resolved-questions.md §B7`：`CREATE MATERIALIZED VIEW IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS`（幂等）
- drizzle-kit 不会扫描或覆盖手写 `.sql` 文件——并列共存安全

## Consequences

- 正面: 部署模型一致（k8s Job 跑 migrate 一次建完）；迁移工具一致；版本回滚走同一 `__drizzle_migrations` 表。
- 负面: schema 文件中 matview 无 TypeScript 类型——repo 层需手写 view 行类型。
- 后续影响: 任何 matview 重建（`REFRESH MATERIALIZED VIEW CONCURRENTLY`）由 worker 周期任务负责，不在 migration 链上。

## Related

- `decisions/phase-1-open-questions.md §3`
- `decisions/phase-1-resolved-questions.md §B7`
- ADR-010（migration 落盘目录）
- `packages/db/drizzle/`
