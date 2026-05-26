# ADR-035: Welcome 每步独立 Server Action 模块

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 4.3 需要 4 个 step 各自的 mutation 入口。Server Action 的模块组织方式、zod schema 位置、成功/失败返回类型、以及客户端绑定形式四个子项均需明确约定,以保证测试隔离性和 Next.js 15 + React 19 最佳实践的一致性。

## Decision

采用 **P2 + A + R1 + T2** 组合:

**P2 — 每步独立 action 文件**:`packages/web/lib/actions/welcome/step1-save-key.ts` / `step2-mark-github-app.ts` / `step3-save-repo.ts` / `step4-import-skills.ts`。

**A — 本地 zod schema**:每个 action 文件内部定义 schema,避免跨步骤耦合(各步字段差异大)。

**R1 — 成功 redirect / 失败返回 ErrorCode**:成功调用 Next.js `redirect('/welcome/step/{n+1}')`;失败返回 discriminated union:

```ts
type WelcomeActionResult =
  | { success: true }
  | { success: false; code: WelcomeErrorCode; fields?: Record<string, string> }

type WelcomeErrorCode =
  | 'INVALID_KEY_FORMAT'
  | 'INVALID_REPO_FORMAT'
  | 'BOOTSTRAP_ALREADY_COMPLETE'
  | 'UNAUTHENTICATED'
  | 'TENANT_NOT_FOUND'
  | 'INTERNAL_ERROR'
```

**T2 — React 19 `useActionState`**:客户端页面组件通过 `useActionState(action, null)` 处理 pending + error 状态展示。

## Consequences

**正面**:
- 独立模块让单测完全隔离,每个 action 可单独 `vi.mock`。
- 本地 zod 避免共享 schema 在字段变更时的连锁影响。
- `redirect()` 成功路径不需要 try-catch 包裹,代码流程清晰。
- `useActionState` 是 Next.js 15 推荐范式,与 ADR-031 RSC + Server Action 一致。

**负面**:
- 4 个独立文件带来一定重复的 boilerplate(session 校验、tenantId 提取)。
- `WelcomeErrorCode` union 需要在 `zh.ts` 中为每个 code 提供中文提示(见 ADR-041)。

**后续影响**:
- 切片 4.4+ 新 action 遵循同一 P2+A+R1+T2 模式。
- `BOOTSTRAP_ALREADY_COMPLETE` 错误码配合 T3 幂等 gate(ADR-041)防止 Step 4 双写。

## Alternatives Considered

- **P1 — 单文件 dispatcher**:4 个 step 混在一个文件,测试隔离性差,且文件容易超 800 行上限。
- **R2 — 统一 throw**:业务错误混入系统错误堆栈,error.tsx 无法区分展示策略(见 ADR-041 X3)。
- **T1 — 原生 form action**:无 pending 状态管理,用户体验差;不支持程序化触发。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q4`
- 关联 spec: 07-frontend.md §Server Action 规范
- 关联 ADR: ADR-031(RSC + Server Action 策略), ADR-041(错误边界 UX), ADR-034(key 加密)
