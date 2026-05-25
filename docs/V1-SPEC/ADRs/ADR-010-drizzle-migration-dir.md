# ADR-010: Drizzle migration 文件落 `packages/db/drizzle/`

- 状态: Accepted
- 日期: 2026-05-25

## Context

`drizzle-kit generate` 输出的 SQL migration 需要确定落盘位置。两个候选：

- A — `packages/db/drizzle/`（包内聚）
- B — `infra/migrations/`（与 k8s manifest 同根，原 `02-architecture.md §2` 描述）

详见 `decisions/phase-1-open-questions.md §2`。

## Decision

**采纳 A —— `packages/db/drizzle/`**：

- `packages/db/drizzle.config.ts` 设置 `out: './drizzle'`
- 同 Phase 1 PR patch `02-architecture.md §2`，废弃 `infra/migrations/` 路径
- 部署模型：k8s Job 跑 `pnpm --filter @honeyai/db drizzle-kit migrate` 一次完成

## Consequences

- 正面: schema 改动同包内出 migration；CI / 本地命令最简；testcontainers `migrationsFolder` 路径稳定（`packages/db/src/test/container.ts:21` 解析 `../../drizzle`）。
- 负面: 与原 spec §2 路径偏离——已在同 PR 同步 patch。
- 后续影响: 任何 schema 变更必须 `pnpm db:generate` 落到本目录；不准手写 migration（`run_cost_summary` matview 除外，见 ADR-011）。

## Related

- `decisions/phase-1-open-questions.md §2`
- `02-architecture.md §2`（同 PR 已 patch）
- ADR-011（matview 单独 SQL）
- `packages/db/drizzle.config.ts`
