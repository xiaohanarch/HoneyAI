# ADR-027: Orchestrator FSM 用 TypeScript exhaustive switch reducer

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 1 `@honeyai/orchestrator` 需要实现 Run / Node 两套 FSM(spec 05 §FSM 转移表)。FSM 范式候选:

- A — TypeScript exhaustive switch reducer:`(state, event) => state` 纯函数,`switch (event.type)` + `default: assertNever(event)` 编译期强制覆盖
- B — `xstate` v5 actor model(完整框架,支持嵌套并行子机 / history / invoked services)
- C — Class-based state pattern(每状态一个 class,transition 为方法)

## Decision

选 **A — TypeScript exhaustive switch reducer**。

- `packages/orchestrator/src/fsm/run.ts` — Run reducer
- `packages/orchestrator/src/fsm/node.ts` — Node reducer
- 共享 helper `packages/orchestrator/src/fsm/assertNever.ts`
- 所有 event / state 类型在 `types.ts` 用 discriminated union 定义

## Consequences

**正面**:
- Zero runtime dependency(不引 xstate ~30 KB gzipped)
- 编译期通过 `assertNever` 强制覆盖所有 event 分支,新增 event 类型时遗漏处理立即报错
- reducer 是纯函数,fixture 驱动测试零 mock(`expect(reduceRun(state, event)).toEqual(...)`)
- SSE 事件重放 / reconcile diff 与 reducer 形态天然吻合(都是 event sequence)

**负面**:
- 失去 xstate 的可视化 inspector(MVP 阶段不需要)
- 嵌套并行子机若未来需要,需重构 —— 但 spec 05 明确不引入

**后续影响**:
- 切片 1.1 落 reducer 骨架;1.2 扩 Gate / Node;1.3 / 1.4 不再改 reducer 自身
- web 端切片 5 Gate UI 通过 orchestrator service fn 调用,reducer 内部不暴露

## Alternatives Considered

- **B — xstate v5**:对单向递进 FSM 是过度工程;30 KB 体积 + 学习曲线 vs 收益不对等;invoked services / actor message 与 BullMQ + Redis 工作流双重抽象
- **C — Class-based**:每状态一个 class 在 TS 严格模式下 method 签名重复;无 exhaustive 编译期保证;与 fixture 测试不友好

## Related

- 触发决策:`decisions/phase-2-1-open-questions.md §Q1`
- 关联 spec:05-state-machine.md §FSM 转移表
- 关联 ADR:ADR-007(Run 状态二元)
