# ADR-013: drizzle-zod schema 同文件 re-export

- 状态: Accepted
- 日期: 2026-05-25

## Context

`drizzle-zod` 生成的 zod schema 需要决定文件位置：

- A — 同 schema 文件末尾 re-export
- B — 独立 `packages/db/src/zod/` 目录
- C — 在 repos 层按需即时构造

详见 `decisions/phase-1-open-questions.md §7`。

## Decision

**采纳 A —— 同 schema 文件 re-export**：

- 每个 `packages/db/src/schema/<domain>.ts` 文件末尾追加：
  ```ts
  export const insertXxxSchema = createInsertSchema(xxx)
  export const selectXxxSchema = createSelectSchema(xxx)
  ```
- 业务 refine 用 `.extend()` 在 repos 层叠加
- 显式不做：独立 `packages/db/src/zod/` 目录

## Consequences

- 正面: drift 风险零（schema 与 zod 同文件，rename 一致）；同文件搜索体验最好；schema 文件仍在 800 行硬上限内。
- 负面: schema 文件略长——已通过 11 域拆分 schema 控制。
- 后续影响: Phase 2 引入 IR zod schemas 时仍走 `@honeyai/core/ir`，与 db schema zod 互不干扰。

## Related

- `decisions/phase-1-open-questions.md §7`
- `packages/db/src/schema/*.ts`
