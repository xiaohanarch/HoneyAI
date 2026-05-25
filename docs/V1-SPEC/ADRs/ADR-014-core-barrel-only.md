# ADR-014: `@honeyai/core` 仅 barrel 导出

- 状态: Accepted
- 日期: 2026-05-25

## Context

`@honeyai/core` 的导入风格候选：

- A — 仅 barrel（`import { ... } from '@honeyai/core'`）
- B — 鼓励 deep path（`import ... from '@honeyai/core/log'`）
- C — 两者并存

详见 `decisions/phase-1-open-questions.md §8`。

## Decision

**采纳 A —— 仅 barrel**：

- `packages/core/src/index.ts` 单一 barrel re-export 所有公共 API
- 消费方统一 `import { CrossTenantAccessError, logger, env } from '@honeyai/core'`
- 内部 deep path 仅作为 package-private 实现细节
- `package.json` 的 `exports` 字段仅暴露 `'.'`，**不**开 deep subpath

## Consequences

- 正面: 跨包重构 import 一致；外部消费者只需记一个入口；公开 API 边界显式。
- 负面: tree-shaking 损失少量字节——V1 规模 + 内部消费场景下可忽略。
- 后续影响: 公开 API 任何新增必须 barrel re-export；任何 deep-import 视为内部细节、随时可破坏。

## Related

- `decisions/phase-1-open-questions.md §8`
- `packages/core/src/index.ts`
- `packages/core/package.json`
