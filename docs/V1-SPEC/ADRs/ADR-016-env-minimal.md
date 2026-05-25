# ADR-016: Phase 1 `.env.example` 极简变量集

- 状态: Accepted
- 日期: 2026-05-25

## Context

Phase 1 `.env.example` 与 `packages/core/src/env/index.ts` 的 zod schema 必须严格匹配（`@t3-oss/env-core` 的"声明 = 检验 = 使用"理念）。变量集候选：

- A — 极简（仅 Phase 1 实际 import 的字段）
- B — Phase 2/3 变量预先占位（GitHub App / Sandbox / OSS / ...）

详见 `decisions/phase-1-open-questions.md §11`。

## Decision

**采纳 A —— 极简**：

- `.env.example` 仅含：`DATABASE_URL` + `NODE_ENV` + `LOG_LEVEL`
- `packages/core/src/env/index.ts` 的 zod schema 与 `.env.example` 严格一一对应
- fail-fast at boot：缺失或类型不匹配立即抛错

## Consequences

- 正面: 与 `@t3-oss/env-core` "声明 = 检验 = 使用"理念一致；避免幽灵字段；新增字段需同步改 schema + `.env.example`，drift 自动暴露。
- 负面: Phase 2 起接入业务时需多次小 PR 扩 env——可接受。
- 后续影响: Phase 2 接入 GitHub App / Redis URL / S3 endpoint 时，每项需单独 PR 扩 `.env.example` + schema + 使用点。

## Related

- `decisions/phase-1-open-questions.md §11`
- `.env.example`
- `packages/core/src/env/index.ts`
