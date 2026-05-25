# ADR-024: `parseIR` / `stringifyIR` 内化到 `@honeyai/core`

- 状态: Accepted
- 日期: 2026-05-26

## Context

`@honeyai/core` 是 IR 类型权威。是否同时承担 IR 的 parse / stringify 工具,可选:

- A — 内化(schema + parse + stringify 同包同 PR 落)
- B — 不含,Phase 2.0 仅暴露 zod schema,工具函数推迟到使用方(orchestrator / web)各自实现
- C — 仅含 parse,不含 stringify

## Decision

选 **A**。`@honeyai/core/src/ir/` 同时暴露:

- 3 个 zod schema + 3 个 TypeScript type
- 3 个 `parse<IR>(markdown)` 函数,返回 `IRParseOutcome<T>` discriminated union
- 3 个 `stringify<IR>(data, body)` 函数,输出 markdown 字符串
- shared.ts 内部 `parseFrontmatter` / `stringifyFrontmatter` helper (gray-matter wrapper)

`stringify<IR>` 不在内部做 zod 校验 —— 调用方(orchestrator / sandbox / Server Action)在 stringify 前已经 zod-validate,此处 stringify 视为纯字符串组装。

## Consequences

**正面**:`@honeyai/core` 是 IR 唯一权威,parse/stringify 与 schema 配对最自然;orchestrator / sandbox-runner / web 三个消费方零重复 frontmatter 提取逻辑;Phase 2.0 PR 体量仍小。

**负面**:`@honeyai/core` 体积略增(gray-matter ≈ 1.5 KB gzipped),可接受。

**后续影响**:切片 1 orchestrator FSM、切片 2 sandbox-runner、切片 5 web Server Action 均 `import { parseRequirementIR } from '@honeyai/core'`。

## Alternatives Considered

- B(分散):3 个消费方各写一遍 frontmatter 提取逻辑,drift 风险高;schema 变更后 stringify 不同步会产生坏数据
- C(仅 parse):stringify 在 Tiptap 保存 (切片 5) 触发,推迟到切片 5 实现等价于"先卡 parse 跑通"——但 Phase 2.0 测试需要 roundtrip 验证,stringify 必须就位

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q4`
- 关联 ADR: ADR-021 (gray-matter), ADR-022 (文件布局), ADR-023 (输出形状含 warnings)
