# ADR-026: Tiptap 表单 generator 不进 `@honeyai/core`,延后切片 4

- 状态: Accepted
- 日期: 2026-05-26

## Context

Spec 04 §9 描述 zod schema 喂给 generator 自动出 Tiptap 表单。是否 Phase 2.0 内交付:

- A — 进 Phase 2.0(`@honeyai/core` 暴露 zod-to-tiptap util)
- B — 不进,推迟到切片 4(`@honeyai/web`)
- C — 进单独包 `@honeyai/forms`

## Decision

选 **B**。`@honeyai/core` 不引入 React / Tiptap 任何依赖。Tiptap generator 在切片 4 落到 `@honeyai/web/src/lib/forms/`。

## Consequences

**正面**:`@honeyai/core` 维持无 DOM 依赖,可在 sandbox-runner / Node CLI / web SSR 三端跑;`pnpm install --filter sandbox-runner` 不拖 React。

**负面**:切片 4 实施 PR 需独立设计 generator,不能复用 core 内代码 —— 但 generator 本身就是 React 组件,放 web 合理。

**后续影响**:切片 4 在 `@honeyai/web/src/lib/forms/schema-to-tiptap.ts` 实现 zod → Tiptap node spec 的递归映射;依赖 `@honeyai/core` 仅取 schema 对象,不取 UI。

## Alternatives Considered

- A(进 core):core 必然引入 React 类型,破坏 server/sandbox/web 三端可跑性
- C(独立包):再开一个 npm package 增加 workspace 维护成本;切片 4 唯一消费,放 web 内部更简单

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q6`
- 关联 spec: 04 §9
- 关联 ADR: ADR-022 (core/ir 布局,不含 Tiptap 部分)
