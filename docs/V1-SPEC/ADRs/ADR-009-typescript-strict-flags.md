# ADR-009: TypeScript strict flags 推荐子集

- 状态: Accepted
- 日期: 2026-05-25

## Context

`tsconfig.base.json` 需要确定 strict 相关 flag 的具体档位。三档候选：

- A — 仅 `strict: true`（最宽松）
- B — `strict: true` + 推荐子集（覆盖 90% 真实 bug，drift 最小）
- C — 全开（含 `exactOptionalPropertyTypes` / `noPropertyAccessFromIndexSignature` / `noImplicitReturns`）

详见 `decisions/phase-1-open-questions.md §1`。

## Decision

**采纳 B —— 推荐子集**：

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
  },
}
```

**显式不启用**：`exactOptionalPropertyTypes`（与第三方包冲突最多）、`noPropertyAccessFromIndexSignature`、`noImplicitReturns`。

## Consequences

- 正面: 覆盖大多数运行时 bug；与 Next.js 15 / Drizzle / Vitest 默认体验一致；CI 噪音低。
- 负面: 不抓 strict optional / index-signature 误用——需 code review 补位。
- 后续影响: 后续如需提档至 C，新开 ADR 并集中改造 `noUncheckedIndexedAccess` 兼容点。

## Related

- `decisions/phase-1-open-questions.md §1`
- `tsconfig.base.json`
- ADR-008（Phase 1 scope）
