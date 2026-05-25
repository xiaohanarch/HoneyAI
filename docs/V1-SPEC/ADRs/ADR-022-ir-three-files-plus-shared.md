# ADR-022: `packages/core/src/ir/` 按 IR 拆 3 文件 + 1 共享

- 状态: Accepted
- 日期: 2026-05-26

## Context

3 个 IR(Requirement / Design / Implementation)+ 共享 enum(Priority / Complexity / RiskLevel / FindingSeverity)+ 共享 parse/stringify helper,可选布局:

- A — 按 IR 拆 3 文件 + shared.ts + barrel index.ts
- B — 单文件全塞 `ir.ts`(简单但 200+ 行)
- C — 按 zod / parse / stringify 横切拆分

## Decision

选 **A**。最终结构:

```
packages/core/src/ir/
├── shared.ts         # 共享 enum + IRParseOutcome 类型 + 内部 helper
├── requirement.ts    # RequirementIRSchema + parse/stringify + 必填 section 检测
├── design.ts         # DesignIRSchema + parse/stringify
├── implementation.ts # ImplementationIRSchema + parse/stringify
└── index.ts          # barrel(ADR-014)
```

每文件配 `.test.ts` 同目录,延续 `packages/core/src/errors/` 既有约定。

## Consequences

**正面**:每个 IR 独立文件,与 spec 04 §2/§3/§4 章节一一对应;review 体验最好;single-file 内聚度高。

**负面**:`barrel.test.ts` 需 reflectively 检查所有再导出 —— 已在 Task 8 覆盖。

**后续影响**:切片 5(Tiptap)消费时 import `from '@honeyai/core'`,经 ADR-014 root barrel 透传。

## Alternatives Considered

- B(单文件):200+ 行难维护,git blame / git diff review 噪音大
- C(横切):schema/parse/stringify 一致变化时需改 3 个文件,违反"changes-together-live-together"

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q2`
- 关联 ADR: ADR-014 (core 仅 barrel 导出)
