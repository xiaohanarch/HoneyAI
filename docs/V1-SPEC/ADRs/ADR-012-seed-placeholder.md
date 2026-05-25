# ADR-012: Seed 入口 Phase 1 仅占位空骨架

- 状态: Accepted
- 日期: 2026-05-25

## Context

`packages/db` 需要暴露 seed 入口供未来业务数据填充。Phase 1 处置候选：

- A — 占位空骨架（路径就位、body 空）
- B — 填 `pricing_book` 与官方 assets
- C — 不暴露入口（Phase 2 再加）

详见 `decisions/phase-1-open-questions.md §5`。

## Decision

**采纳 A —— Phase 1 仅占位空骨架**：

- `packages/db/src/seed/index.ts` 导出 `runSeed(): Promise<void>`，body 仅打印一行 log
- `packages/db/package.json` 暴露 `"db:seed": "tsx src/seed/index.ts"`
- 不填充 `pricing_book` / 官方 assets（推迟 Phase 2/3 业务决策）

## Consequences

- 正面: 占住路径与 npm script，Phase 2 起新增业务 seed 时无需改 root 配置或新建包；CLI 入口检测用 `pathToFileURL(process.argv[1]).href` 跨平台。
- 负面: Phase 1 本地起服务后没有任何业务数据——开发者需手工建第一个 tenant。
- 后续影响: Phase 2 起在 `runSeed()` 内分模块加业务 seed；保持函数签名稳定。

## Related

- `decisions/phase-1-open-questions.md §5`
- `packages/db/src/seed/index.ts`
- `packages/db/package.json`
