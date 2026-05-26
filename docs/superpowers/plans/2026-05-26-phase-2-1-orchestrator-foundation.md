# Phase 2.1 切片 1.1 — `@honeyai/orchestrator` 基础设施 + FSM 骨架 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `@honeyai/orchestrator` 从占位 `export {}` 转为实建。交付内容：8 类错误类、Run/Node FSM switch reducer（exhaustive，含 `assertNever`）、TypeScript fixture factories、干净的 barrel 导出，以及覆盖 happy path + retry 触发条件的单元测试（Vitest）。不引入 Redis / BullMQ / Drizzle。

**Architecture:** Pure TypeScript FSM reducer 模式（ADR-027）。每个 reducer 是纯函数 `(state, event) => state`，`switch (event.type)` + `default: assertNever(event)` 编译期强制覆盖。状态类型与事件类型均用 discriminated union（参照 `@honeyai/core/src/ir/shared.ts` 的 `IRParseOutcome<T>` 写法）。Fixture factories（`makeRun` / `makeNode` / `makeArtifact`）集中在 `src/test/fixtures.ts`，与 `@honeyai/db` 的 `packages/db/src/test/factories.ts` 惯例一致。

**Tech Stack:**

- `@honeyai/core` — 内部依赖（workspace: `*`）；不需要显式 `zod`（core 透传，1.1 范围不直接 zod.parse）
- Vitest 2.1.8 — 单元测试框架（workspace mode）
- TypeScript 5.7.2 — strict 模式（`tsconfig.base.json`）
- 无 ioredis / BullMQ / Drizzle / pino（留给 1.2 / 1.3）；日志用 `console.warn`

**Reference docs (read before starting):**

- `docs/V1-SPEC/05-orchestrator.md` — §10 FSM 转换表（权威来源：Run §10.1 / Node §10.2 / Gate §10.3）
- `docs/V1-SPEC/03-data-model.md §6.5` — `runStatusEnum` / `nodeStatusEnum` / `nodeKindEnum` / `failureClassEnum` 精确枚举值
- `docs/V1-SPEC/ADRs/ADR-027-orchestrator-fsm-switch-reducer.md` — FSM 范式决策
- `docs/V1-SPEC/decisions/phase-2-1-open-questions.md §Q1 / §Q2 / §Q6` — 拍板细节
- `packages/core/src/ir/shared.ts` — `IRParseOutcome<T>` discriminated union 写法参照
- `packages/core/package.json` — 依赖声明、scripts、tsconfig 惯例参照

**Scope (locked by `decisions/phase-2-1-open-questions.md §切片 1.1`):**

- ✅ `packages/orchestrator/package.json` — 从占位转实建（添加 vitest + @honeyai/core 依赖）
- ✅ `packages/orchestrator/tsconfig.json` — 添加 `noEmit: true`（与 core 对齐）
- ✅ `packages/orchestrator/src/errors.ts` — 8 类 error class（继承 `OrchestratorError extends Error`）
- ✅ `packages/orchestrator/src/types.ts` — Run / Node 状态 + event discriminated union
- ✅ `packages/orchestrator/src/fsm/assertNever.ts` — exhaustive helper
- ✅ `packages/orchestrator/src/fsm/run.ts` — Run reducer
- ✅ `packages/orchestrator/src/fsm/node.ts` — Node reducer
- ✅ `packages/orchestrator/src/test/fixtures.ts` — TS factories
- ✅ `packages/orchestrator/src/index.ts` — barrel（只导出 1.1 范围内容）
- ✅ 单元测试：errors / assertNever / Run reducer / Node reducer
- ❌ Gate approve/reject 逻辑（切片 1.2）
- ❌ IR 乐观锁（切片 1.2）
- ❌ Redis advisory lock（切片 1.3）
- ❌ Reconcile / setInterval（切片 1.3）
- ❌ BullMQ mock / @testcontainers/redis（切片 1.4）
- ❌ SSE 事件类型（切片 1.4）
- ❌ worker 进程封装

**Branch:** `feat/phase-2-1-orchestrator-foundation`

**Acceptance:**

- `pnpm --filter @honeyai/orchestrator test` 100% green（所有 errors / reducer / assertNever 用例）
- `pnpm --filter @honeyai/orchestrator typecheck` green
- `pnpm --filter @honeyai/orchestrator lint` green
- `pnpm ac:coverage` 不退步（切片 1.1 不引入新种子 AC，种子 AC 在 spec 03 §9 绑定 db 层）
- PR 针对 `main` 开出，标题 `feat(orchestrator): slice 1.1 — FSM skeleton + error classes`

---

## FSM 状态与事件速查（来源：spec 05 §10 + spec 03 §6.5）

### Run 状态枚举（`runs.status` 列）

```
created | scheduling | running | paused_at_gate | completed | failed | cancelled
```

终态（terminal）：`completed` / `failed` / `cancelled` — reducer 收到任何 event 返回原 state。

### Node 状态枚举（`nodes.status` 列）

```
pending | running | success | failed | skipped
```

终态：`success` / `failed` / `skipped`。

### Node 种类枚举（`nodes.kind` 列）

```
agent | gate | merge | deploy
```

### FailureClass 枚举（`failure_class` 列）— Q6 拍板：严格 8 类

```
llm_rate_limited | llm_quality_failed | sandbox_timeout | sandbox_oom
sandbox_died     | sandbox_disk_full  | external_failed | user_cancelled
```

### Retry 策略（spec 05 §4.1 + §12 代码示意）

| failureClass       | auto  | maxRetries | backoffMs             |
| ------------------ | ----- | ---------- | --------------------- |
| llm_rate_limited   | true  | 3          | [5000, 30000, 120000] |
| llm_quality_failed | true  | 3          | [0, 0, 0]             |
| external_failed    | true  | 1          | [30000]               |
| sandbox_timeout    | false | 0          | []                    |
| sandbox_oom        | false | 0          | []                    |
| sandbox_died       | false | 0          | []                    |
| sandbox_disk_full  | false | 0          | []                    |
| user_cancelled     | false | 0          | []                    |

---

## File Structure

| Path                                                | 责任                                                              | 预估行数 |
| --------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| `packages/orchestrator/package.json`                | 添加 vitest / @honeyai/core 依赖 + test script                    | 30       |
| `packages/orchestrator/tsconfig.json`               | 添加 `noEmit: true` 与 `include src/**/*.ts`                      | 8        |
| `packages/orchestrator/src/errors.ts`               | 8 类 error class + `OrchestratorError` 基类 + `RETRY_POLICY` 常量 | 90       |
| `packages/orchestrator/src/errors.test.ts`          | 8 类错误实例化 + name/message/cause/retryable 断言                | 70       |
| `packages/orchestrator/src/types.ts`                | Run state / Node state / event discriminated union                | 80       |
| `packages/orchestrator/src/fsm/assertNever.ts`      | `assertNever(x: never): never` helper                             | 10       |
| `packages/orchestrator/src/fsm/run.ts`              | `reduceRun(state, event): RunState` — 9 条转移规则                | 80       |
| `packages/orchestrator/src/fsm/run.test.ts`         | happy path + failed/cancelled + 非法转移 测试                     | 100      |
| `packages/orchestrator/src/fsm/node.ts`             | `reduceNode(state, event): NodeState` — 7 条转移规则              | 80       |
| `packages/orchestrator/src/fsm/node.test.ts`        | agent/gate/deploy 节点转移 + auto-retry + exhausted               | 110      |
| `packages/orchestrator/src/fsm/assertNever.test.ts` | 编译期 TS narrowing + 运行时 throw 验证                           | 20       |
| `packages/orchestrator/src/test/fixtures.ts`        | `makeRun()` / `makeNode()` / `makeArtifact()` factories           | 80       |
| `packages/orchestrator/src/index.ts`                | barrel re-exports（1.1 scope 仅）                                 | 20       |
| **合计**                                            |                                                                   | **~780** |

---

## Task 1: 创建分支 + 升级 package.json

**Files:**

- Modify: `packages/orchestrator/package.json`
- Modify: `packages/orchestrator/tsconfig.json`

- [ ] **Step 1: 创建功能分支**

```bash
cd /d/code/ai-devops
git checkout main
git pull --ff-only
git checkout -b feat/phase-2-1-orchestrator-foundation
```

Expected output: `Switched to a new branch 'feat/phase-2-1-orchestrator-foundation'`

- [ ] **Step 2: 升级 package.json — 添加依赖和 test script**

将 `packages/orchestrator/package.json` 替换为：

```json
{
  "name": "@honeyai/orchestrator",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": {
    "@honeyai/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 3: 更新 tsconfig.json — 添加 noEmit 和 include 覆盖测试文件**

将 `packages/orchestrator/tsconfig.json` 替换为：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: 安装依赖**

```bash
pnpm install
```

Expected: 安装成功，`@honeyai/core` workspace 依赖解析正常，无报错。

- [ ] **Step 5: 验证 @honeyai/core 可访问**

```bash
pnpm --filter @honeyai/orchestrator exec node --input-type=module <<'EOF'
import { OrchestratorError } from '@honeyai/orchestrator'
EOF
```

Expected: 暂报错（`@honeyai/orchestrator` 尚未导出 `OrchestratorError`），但可见 `@honeyai/core` 能解析即可：

```bash
pnpm --filter @honeyai/orchestrator exec node --input-type=module <<'EOF'
import('@honeyai/core').then(m => console.log(typeof m)).catch(e => console.error(e.message))
EOF
```

Expected output: `object`

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/package.json packages/orchestrator/tsconfig.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(orchestrator): upgrade package.json to real build — add vitest + @honeyai/core deps
EOF
)"
```

---

## Task 2: `errors.ts` — 8 类错误类 + OrchestratorError 基类

**Files:**

- Create: `packages/orchestrator/src/errors.ts`
- Create: `packages/orchestrator/src/errors.test.ts`

- [ ] **Step 1: 先写失败的测试**

创建 `packages/orchestrator/src/errors.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import {
  OrchestratorError,
  LlmRateLimitedError,
  LlmQualityFailedError,
  SandboxTimeoutError,
  SandboxOomError,
  SandboxDiedError,
  SandboxDiskFullError,
  ExternalFailedError,
  UserCancelledError,
  RETRY_POLICY,
} from './errors.js'

describe('OrchestratorError base class', () => {
  it('is instanceof Error', () => {
    const e = new LlmRateLimitedError('rate limit hit')
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(OrchestratorError)
  })

  it('preserves cause when provided', () => {
    const cause = new Error('upstream')
    const e = new LlmRateLimitedError('rate limit', { cause })
    expect(e.cause).toBe(cause)
  })
})

describe('LlmRateLimitedError', () => {
  it('has correct kind and retryable=true', () => {
    const e = new LlmRateLimitedError('429 from Anthropic')
    expect(e.kind).toBe('llm_rate_limited')
    expect(e.retryable).toBe(true)
    expect(e.name).toBe('LlmRateLimitedError')
    expect(e.message).toBe('429 from Anthropic')
  })
})

describe('LlmQualityFailedError', () => {
  it('has kind llm_quality_failed and retryable=true', () => {
    const e = new LlmQualityFailedError('task_graph missing root')
    expect(e.kind).toBe('llm_quality_failed')
    expect(e.retryable).toBe(true)
    expect(e.name).toBe('LlmQualityFailedError')
  })
})

describe('SandboxTimeoutError', () => {
  it('has kind sandbox_timeout and retryable=false', () => {
    const e = new SandboxTimeoutError('pod pending 20min')
    expect(e.kind).toBe('sandbox_timeout')
    expect(e.retryable).toBe(false)
    expect(e.name).toBe('SandboxTimeoutError')
  })
})

describe('SandboxOomError', () => {
  it('has kind sandbox_oom and retryable=false', () => {
    const e = new SandboxOomError('OOMKilled')
    expect(e.kind).toBe('sandbox_oom')
    expect(e.retryable).toBe(false)
  })
})

describe('SandboxDiedError', () => {
  it('has kind sandbox_died and retryable=false', () => {
    const e = new SandboxDiedError('pod not found')
    expect(e.kind).toBe('sandbox_died')
    expect(e.retryable).toBe(false)
  })
})

describe('SandboxDiskFullError', () => {
  it('has kind sandbox_disk_full and retryable=false', () => {
    const e = new SandboxDiskFullError('no space left on device')
    expect(e.kind).toBe('sandbox_disk_full')
    expect(e.retryable).toBe(false)
  })
})

describe('ExternalFailedError', () => {
  it('has kind external_failed and retryable=true', () => {
    const e = new ExternalFailedError('GitHub API 503')
    expect(e.kind).toBe('external_failed')
    expect(e.retryable).toBe(true)
    expect(e.name).toBe('ExternalFailedError')
  })
})

describe('UserCancelledError', () => {
  it('has kind user_cancelled and retryable=false', () => {
    const e = new UserCancelledError('user clicked cancel')
    expect(e.kind).toBe('user_cancelled')
    expect(e.retryable).toBe(false)
    expect(e.name).toBe('UserCancelledError')
  })
})

describe('RETRY_POLICY', () => {
  it('llm_rate_limited: auto=true, max=3, backoff=[5000,30000,120000]', () => {
    const p = RETRY_POLICY['llm_rate_limited']
    expect(p.auto).toBe(true)
    expect(p.max).toBe(3)
    expect(p.backoffMs).toEqual([5_000, 30_000, 120_000])
  })

  it('llm_quality_failed: auto=true, max=3, backoff=[0,0,0]', () => {
    const p = RETRY_POLICY['llm_quality_failed']
    expect(p.auto).toBe(true)
    expect(p.max).toBe(3)
    expect(p.backoffMs).toEqual([0, 0, 0])
  })

  it('external_failed: auto=true, max=1, backoff=[30000]', () => {
    const p = RETRY_POLICY['external_failed']
    expect(p.auto).toBe(true)
    expect(p.max).toBe(1)
    expect(p.backoffMs).toEqual([30_000])
  })

  it('sandbox_timeout: auto=false, max=0', () => {
    expect(RETRY_POLICY['sandbox_timeout'].auto).toBe(false)
    expect(RETRY_POLICY['sandbox_timeout'].max).toBe(0)
  })

  it('user_cancelled: auto=false, max=0', () => {
    expect(RETRY_POLICY['user_cancelled'].auto).toBe(false)
  })

  it('covers all 8 failure classes', () => {
    const classes = [
      'llm_rate_limited',
      'llm_quality_failed',
      'sandbox_timeout',
      'sandbox_oom',
      'sandbox_died',
      'sandbox_disk_full',
      'external_failed',
      'user_cancelled',
    ] as const
    for (const klass of classes) {
      expect(RETRY_POLICY[klass]).toBeDefined()
    }
  })
})
```

- [ ] **Step 2: 跑测试验证红色**

```bash
pnpm --filter @honeyai/orchestrator test
```

Expected: FAIL — `Cannot find module './errors.js'` 或类似错误。

- [ ] **Step 3: 写最小实现**

创建 `packages/orchestrator/src/errors.ts`：

```ts
// spec 05 §4.1 + spec 03 §6.5 failureClassEnum — Q6 拍板：严格 8 类
// 不引入 pino（1.1 范围日志用 console.warn）

/** 所有 orchestrator 错误的基类 */
export abstract class OrchestratorError extends Error {
  abstract readonly kind: FailureClass
  abstract readonly retryable: boolean

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
    // V8 stack trace 正确指向子类构造调用处
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target)
    }
  }
}

/** spec 03 §6.5 failureClassEnum — 8 类严格枚举 */
export type FailureClass =
  | 'llm_rate_limited'
  | 'llm_quality_failed'
  | 'sandbox_timeout'
  | 'sandbox_oom'
  | 'sandbox_died'
  | 'sandbox_disk_full'
  | 'external_failed'
  | 'user_cancelled'

// ─── 自动重试类（retryable=true） ────────────────────────────────────────────

export class LlmRateLimitedError extends OrchestratorError {
  readonly kind = 'llm_rate_limited' as const
  readonly retryable = true
}

export class LlmQualityFailedError extends OrchestratorError {
  readonly kind = 'llm_quality_failed' as const
  readonly retryable = true
}

export class ExternalFailedError extends OrchestratorError {
  readonly kind = 'external_failed' as const
  readonly retryable = true
}

// ─── 人工处理类（retryable=false） ────────────────────────────────────────────

export class SandboxTimeoutError extends OrchestratorError {
  readonly kind = 'sandbox_timeout' as const
  readonly retryable = false
}

export class SandboxOomError extends OrchestratorError {
  readonly kind = 'sandbox_oom' as const
  readonly retryable = false
}

export class SandboxDiedError extends OrchestratorError {
  readonly kind = 'sandbox_died' as const
  readonly retryable = false
}

export class SandboxDiskFullError extends OrchestratorError {
  readonly kind = 'sandbox_disk_full' as const
  readonly retryable = false
}

export class UserCancelledError extends OrchestratorError {
  readonly kind = 'user_cancelled' as const
  readonly retryable = false
}

// ─── Retry policy 常量（spec 05 §4.1 + §12） ─────────────────────────────────

export type RetryPolicy = {
  auto: boolean
  max: number
  backoffMs: readonly number[]
}

export const RETRY_POLICY: Readonly<Record<FailureClass, RetryPolicy>> = {
  llm_rate_limited: { auto: true, max: 3, backoffMs: [5_000, 30_000, 120_000] },
  llm_quality_failed: { auto: true, max: 3, backoffMs: [0, 0, 0] },
  external_failed: { auto: true, max: 1, backoffMs: [30_000] },
  sandbox_timeout: { auto: false, max: 0, backoffMs: [] },
  sandbox_oom: { auto: false, max: 0, backoffMs: [] },
  sandbox_died: { auto: false, max: 0, backoffMs: [] },
  sandbox_disk_full: { auto: false, max: 0, backoffMs: [] },
  user_cancelled: { auto: false, max: 0, backoffMs: [] },
}

/** shouldAutoRetry — spec 05 §12 shouldAutoRetry 语义 */
export function shouldAutoRetry(klass: FailureClass, attempt: number): boolean {
  const p = RETRY_POLICY[klass]
  return p.auto && attempt < p.max
}

/** nextBackoffMs — 返回第 attempt 次重试的等待毫秒数（0=立即） */
export function nextBackoffMs(klass: FailureClass, attempt: number): number {
  return RETRY_POLICY[klass].backoffMs[attempt] ?? 0
}
```

- [ ] **Step 4: 跑测试验证绿色**

```bash
pnpm --filter @honeyai/orchestrator test
```

Expected: PASS — 所有 errors.test.ts 用例绿色，控制台无报错。

- [ ] **Step 5: Commit**

```bash
git add packages/orchestrator/src/errors.ts packages/orchestrator/src/errors.test.ts
git commit -m "$(cat <<'EOF'
feat(orchestrator): 8-class OrchestratorError hierarchy + RETRY_POLICY (spec 05 §4.1)
EOF
)"
```

---

## Task 3: `types.ts` — Run / Node 状态 + event discriminated union

**Files:**

- Create: `packages/orchestrator/src/types.ts`
- Create: `packages/orchestrator/src/fsm/assertNever.ts`
- Create: `packages/orchestrator/src/fsm/assertNever.test.ts`

> 注：类型文件本身无运行时逻辑，TDD 体现在 assertNever.test.ts + 后续 reducer 测试。

- [ ] **Step 1: 先写 assertNever 失败测试**

创建 `packages/orchestrator/src/fsm/assertNever.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { assertNever } from './assertNever.js'

describe('assertNever', () => {
  it('throws at runtime when called with any value', () => {
    // 运行时守卫（编译期不会走到这里 — 测试中故意 cast）
    const badValue = 'UNKNOWN_STATE' as never
    expect(() => assertNever(badValue)).toThrow('Unexpected value in assertNever: "UNKNOWN_STATE"')
  })

  it('throws with number value', () => {
    expect(() => assertNever(42 as never)).toThrow('42')
  })
})
```

- [ ] **Step 2: 跑测试验证红色**

```bash
pnpm --filter @honeyai/orchestrator test -- assertNever
```

Expected: FAIL — `Cannot find module './assertNever.js'`.

- [ ] **Step 3: 写 assertNever 实现**

创建 `packages/orchestrator/src/fsm/assertNever.ts`：

```ts
/**
 * Exhaustive check helper for switch-reducer default branches.
 * TypeScript 保证：若所有 union members 已处理，default 分支参数类型为 never，编译通过。
 * 若未处理，编译报错。运行时兜底：若意外到达 default 分支，抛 Error。
 * (ADR-027)
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value in assertNever: ${JSON.stringify(x)}`)
}
```

- [ ] **Step 4: 跑测试验证 assertNever 绿色**

```bash
pnpm --filter @honeyai/orchestrator test -- assertNever
```

Expected: PASS — 2 个用例绿色。

- [ ] **Step 5: 写 types.ts**

创建 `packages/orchestrator/src/types.ts`：

```ts
// spec 03 §6.5 runStatusEnum / nodeStatusEnum / nodeKindEnum
// spec 05 §10 FSM 转换表 — event types 与转移规则一一对应

import type { FailureClass } from './errors.js'

// ─── Run ─────────────────────────────────────────────────────────────────────

/** spec 03 §6.5 runStatusEnum — 7 个值 */
export type RunStatus =
  | 'created'
  | 'scheduling'
  | 'running'
  | 'paused_at_gate'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** 运行时 Run 状态快照（FSM reducer 的 state 参数） */
export type RunState = {
  readonly id: string
  readonly status: RunStatus
  readonly failureClass?: FailureClass
  readonly failureMessage?: string
}

/**
 * Run FSM 事件 discriminated union（spec 05 §10.1）
 * event type 命名规则：SCREAMING_SNAKE_CASE，与 spec 描述动词对应
 */
export type RunEvent =
  | { type: 'SCHEDULE_RUN' }
  | { type: 'SANDBOX_READY' }
  | { type: 'SANDBOX_PENDING_TIMEOUT' }
  | { type: 'NODE_FINISHED_LAST' /** 最后一个节点成功结束 */ }
  | { type: 'NODE_FINISHED_GATE' /** 当前节点为 Gate 类型 */ }
  | { type: 'NODE_RETRY_EXHAUSTED'; failureClass: FailureClass; failureMessage: string }
  | { type: 'PASS_GATE' }
  | { type: 'CANCEL_RUN' }
  | { type: 'RECONCILE_SWEEP_ORPHANED' }

// ─── Node ─────────────────────────────────────────────────────────────────────

/** spec 03 §6.5 nodeStatusEnum — 5 个值 */
export type NodeStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

/** spec 03 §6.5 nodeKindEnum — 4 个值 */
export type NodeKind = 'agent' | 'gate' | 'merge' | 'deploy'

/** 运行时 Node 状态快照（FSM reducer 的 state 参数） */
export type NodeState = {
  readonly id: string
  readonly kind: NodeKind
  readonly status: NodeStatus
  readonly retryCount: number
  readonly failureClass?: FailureClass
  readonly failureMessage?: string
}

/**
 * Node FSM 事件 discriminated union（spec 05 §10.2）
 * Gate FSM（§10.3）的 Gate-specific 事件留给切片 1.2
 */
export type NodeEvent =
  | { type: 'START_NODE' }
  | { type: 'NODE_SUCCESS' }
  | { type: 'NODE_FAILURE'; failureClass: FailureClass; failureMessage: string }
  | { type: 'RETRY_NODE_MANUAL' }
  | { type: 'CANCEL_RUN' }

// ─── Artifact（fixture 用，不含数据库层） ────────────────────────────────────

/** spec 03 §6.6 artifactKindEnum 子集（1.1 fixture 所需） */
export type ArtifactKind =
  | 'requirement_ir'
  | 'design_ir'
  | 'design_sub_ir'
  | 'impl_ir'
  | 'pr_meta'
  | 'log_chunk'
  | 'raw_input'

export type ArtifactStatus = 'ok' | 'failed'

/** 轻量 Artifact 快照（fixture factories 使用，不含 blob / OSS 层） */
export type ArtifactSnapshot = {
  readonly id: string
  readonly tenantId: string
  readonly runId: string
  readonly nodeId: string | null
  readonly attempt: number
  readonly kind: ArtifactKind
  readonly status: ArtifactStatus
  readonly blobSha256: string
  readonly metadata: Record<string, unknown>
}
```

- [ ] **Step 6: 验证 TypeScript 编译**

```bash
pnpm --filter @honeyai/orchestrator typecheck
```

Expected: 无报错（`types.ts` 纯类型文件）。

- [ ] **Step 7: Commit**

```bash
git add packages/orchestrator/src/types.ts \
        packages/orchestrator/src/fsm/assertNever.ts \
        packages/orchestrator/src/fsm/assertNever.test.ts
git commit -m "$(cat <<'EOF'
feat(orchestrator): RunState/NodeEvent types + assertNever helper (ADR-027)
EOF
)"
```

---

## Task 4: `fixtures.ts` — TS factory functions

**Files:**

- Create: `packages/orchestrator/src/test/fixtures.ts`

> Fixture 在 reducer 测试之前定义（Task 5/6 使用）。Task 5/6 先用 inline literal 写测试 Step 1，Task 4 factory 定义后，Step 4 重构测试用 factory（TDD 节奏自然）。

- [ ] **Step 1: 写 fixtures.ts**

创建 `packages/orchestrator/src/test/fixtures.ts`：

```ts
import { uuidv7 } from 'uuid'
import type { RunState, NodeState, ArtifactSnapshot, NodeKind, ArtifactKind } from '../types.js'

/**
 * makeRun — 创建 RunState fixture。
 * 默认状态 'created'，全部字段可通过 overrides 覆盖。
 * 对应 spec 03 §6.5 runs 表结构（快照层，不含 DB 字段）。
 */
export function makeRun(overrides?: Partial<RunState>): RunState {
  return {
    id: uuidv7(),
    status: 'created',
    ...overrides,
  }
}

/**
 * makeNode — 创建 NodeState fixture。
 * 默认 kind='agent'，status='pending'，retryCount=0。
 * 对应 spec 03 §6.5 nodes 表结构（快照层）。
 */
export function makeNode(overrides?: Partial<NodeState> & { kind?: NodeKind }): NodeState {
  return {
    id: uuidv7(),
    kind: 'agent',
    status: 'pending',
    retryCount: 0,
    ...overrides,
  }
}

/**
 * makeArtifact — 创建 ArtifactSnapshot fixture。
 * 对应 spec 03 §6.6 artifacts 表结构（快照层，不含 blob 物理层）。
 */
export function makeArtifact(
  overrides?: Partial<ArtifactSnapshot> & { kind?: ArtifactKind },
): ArtifactSnapshot {
  const runId = overrides?.runId ?? uuidv7()
  return {
    id: uuidv7(),
    tenantId: uuidv7(),
    runId,
    nodeId: null,
    attempt: 1,
    kind: 'requirement_ir',
    status: 'ok',
    blobSha256: 'sha256:0'.padEnd(71, '0'),
    metadata: {},
    ...overrides,
  }
}
```

- [ ] **Step 2: 验证类型编译（无单独测试文件 — 类型已被 reducer 测试覆盖）**

```bash
pnpm --filter @honeyai/orchestrator typecheck
```

Expected: 无报错。

- [ ] **Step 3: Commit**

```bash
git add packages/orchestrator/src/test/fixtures.ts
git commit -m "$(cat <<'EOF'
feat(orchestrator): TS fixture factories makeRun/makeNode/makeArtifact (Q2 decision)
EOF
)"
```

---

## Task 5: `fsm/run.ts` — Run reducer

**Files:**

- Create: `packages/orchestrator/src/fsm/run.ts`
- Create: `packages/orchestrator/src/fsm/run.test.ts`

- [ ] **Step 1: 先写失败的测试（inline literal，Task 4 factory 重构在 Step 4）**

创建 `packages/orchestrator/src/fsm/run.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { reduceRun } from './run.js'
import type { RunState, RunEvent } from '../types.js'

// ─── inline fixtures（Task 4 factory 完成后在 Step 4 重构为 makeRun） ──────────

const created: RunState = { id: 'run-1', status: 'created' }
const scheduling: RunState = { id: 'run-1', status: 'scheduling' }
const running: RunState = { id: 'run-1', status: 'running' }
const pausedAtGate: RunState = { id: 'run-1', status: 'paused_at_gate' }

// ─── Happy path（spec 05 §10.1） ──────────────────────────────────────────────

describe('reduceRun — happy path (spec 05 §10.1)', () => {
  it('created → SCHEDULE_RUN → scheduling', () => {
    const next = reduceRun(created, { type: 'SCHEDULE_RUN' })
    expect(next.status).toBe('scheduling')
    // id 保持不变
    expect(next.id).toBe('run-1')
  })

  it('scheduling → SANDBOX_READY → running', () => {
    const next = reduceRun(scheduling, { type: 'SANDBOX_READY' })
    expect(next.status).toBe('running')
  })

  it('running → NODE_FINISHED_LAST → completed', () => {
    const next = reduceRun(running, { type: 'NODE_FINISHED_LAST' })
    expect(next.status).toBe('completed')
  })

  it('running → NODE_FINISHED_GATE → paused_at_gate', () => {
    const next = reduceRun(running, { type: 'NODE_FINISHED_GATE' })
    expect(next.status).toBe('paused_at_gate')
  })

  it('paused_at_gate → PASS_GATE → running', () => {
    const next = reduceRun(pausedAtGate, { type: 'PASS_GATE' })
    expect(next.status).toBe('running')
  })
})

// ─── Failure transitions ──────────────────────────────────────────────────────

describe('reduceRun — failure transitions (spec 05 §10.1)', () => {
  it('scheduling → SANDBOX_PENDING_TIMEOUT → failed(sandbox_timeout)', () => {
    const next = reduceRun(scheduling, { type: 'SANDBOX_PENDING_TIMEOUT' })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_timeout')
  })

  it('running → NODE_RETRY_EXHAUSTED(llm_rate_limited) → failed', () => {
    const next = reduceRun(running, {
      type: 'NODE_RETRY_EXHAUSTED',
      failureClass: 'llm_rate_limited',
      failureMessage: '重试 3 次仍 429',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('llm_rate_limited')
    expect(next.failureMessage).toBe('重试 3 次仍 429')
  })

  it('running → NODE_RETRY_EXHAUSTED(llm_quality_failed) → failed', () => {
    const next = reduceRun(running, {
      type: 'NODE_RETRY_EXHAUSTED',
      failureClass: 'llm_quality_failed',
      failureMessage: 'task_graph 缺少 root',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('llm_quality_failed')
  })

  it('running → NODE_RETRY_EXHAUSTED(sandbox_oom) → failed', () => {
    const next = reduceRun(running, {
      type: 'NODE_RETRY_EXHAUSTED',
      failureClass: 'sandbox_oom',
      failureMessage: 'OOMKilled',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_oom')
  })

  it('running → NODE_RETRY_EXHAUSTED(external_failed) → failed', () => {
    const next = reduceRun(running, {
      type: 'NODE_RETRY_EXHAUSTED',
      failureClass: 'external_failed',
      failureMessage: 'GitHub 503',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('external_failed')
  })

  it('(any non-terminal) → RECONCILE_SWEEP_ORPHANED → failed(sandbox_died)', () => {
    const next = reduceRun(running, { type: 'RECONCILE_SWEEP_ORPHANED' })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_died')
  })
})

// ─── Cancel transitions ───────────────────────────────────────────────────────

describe('reduceRun — cancel (spec 05 §10.1)', () => {
  it('running → CANCEL_RUN → cancelled', () => {
    const next = reduceRun(running, { type: 'CANCEL_RUN' })
    expect(next.status).toBe('cancelled')
  })

  it('paused_at_gate → CANCEL_RUN → cancelled', () => {
    const next = reduceRun(pausedAtGate, { type: 'CANCEL_RUN' })
    expect(next.status).toBe('cancelled')
  })
})

// ─── 非法转移（terminal 状态不可转移） ──────────────────────────────────────────

describe('reduceRun — illegal transitions (terminal states are immutable)', () => {
  it('completed + SCHEDULE_RUN → returns completed unchanged (warns)', () => {
    const completed: RunState = { id: 'run-1', status: 'completed' }
    const next = reduceRun(completed, { type: 'SCHEDULE_RUN' })
    expect(next.status).toBe('completed')
    // state 对象不变（identity 不要求相同，status 值相同即可）
  })

  it('failed + SANDBOX_READY → returns failed unchanged', () => {
    const failed: RunState = { id: 'run-1', status: 'failed', failureClass: 'sandbox_died' }
    const next = reduceRun(failed, { type: 'SANDBOX_READY' })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_died')
  })

  it('cancelled + PASS_GATE → returns cancelled unchanged', () => {
    const cancelled: RunState = { id: 'run-1', status: 'cancelled' }
    const next = reduceRun(cancelled, { type: 'PASS_GATE' })
    expect(next.status).toBe('cancelled')
  })
})
```

- [ ] **Step 2: 跑测试验证红色**

```bash
pnpm --filter @honeyai/orchestrator test -- run
```

Expected: FAIL — `Cannot find module './run.js'`.

- [ ] **Step 3: 写 Run reducer 实现**

创建 `packages/orchestrator/src/fsm/run.ts`：

```ts
// spec 05 §10.1 Run FSM 转换表
// ADR-027: exhaustive switch reducer (state, event) => state（纯函数，不可变）

import { assertNever } from './assertNever.js'
import type { RunState, RunEvent } from '../types.js'

/** 终态集合（terminal states — 不允许任何事件触发转移） */
const TERMINAL_STATUSES = new Set<RunState['status']>(['completed', 'failed', 'cancelled'])

/**
 * reduceRun — Run FSM reducer（纯函数）
 * 收到非法事件（终态状态 / 状态-事件组合不匹配）时，返回原 state 不变，并 console.warn。
 * console.warn 是临时日志（pino 在切片 1.2/1.3 接入后替换）。
 */
export function reduceRun(state: RunState, event: RunEvent): RunState {
  // 终态保护：任何事件到达终态均返回原 state
  if (TERMINAL_STATUSES.has(state.status)) {
    console.warn(
      `[reduceRun] illegal transition: status=${state.status} is terminal, ignoring event=${event.type}`,
    )
    return state
  }

  switch (event.type) {
    case 'SCHEDULE_RUN': {
      // spec 05 §10.1: created → scheduling
      if (state.status !== 'created') {
        console.warn(`[reduceRun] SCHEDULE_RUN expected created, got ${state.status}`)
        return state
      }
      return { ...state, status: 'scheduling' }
    }

    case 'SANDBOX_READY': {
      // spec 05 §10.1: scheduling → running
      if (state.status !== 'scheduling') {
        console.warn(`[reduceRun] SANDBOX_READY expected scheduling, got ${state.status}`)
        return state
      }
      return { ...state, status: 'running' }
    }

    case 'SANDBOX_PENDING_TIMEOUT': {
      // spec 05 §10.1: scheduling → failed(sandbox_timeout)
      if (state.status !== 'scheduling') {
        console.warn(`[reduceRun] SANDBOX_PENDING_TIMEOUT expected scheduling, got ${state.status}`)
        return state
      }
      return {
        ...state,
        status: 'failed',
        failureClass: 'sandbox_timeout',
        failureMessage: 'sandbox pod pending timeout',
      }
    }

    case 'NODE_FINISHED_LAST': {
      // spec 05 §10.1: running → completed（最后一个节点成功）
      if (state.status !== 'running') {
        console.warn(`[reduceRun] NODE_FINISHED_LAST expected running, got ${state.status}`)
        return state
      }
      return { ...state, status: 'completed' }
    }

    case 'NODE_FINISHED_GATE': {
      // spec 05 §10.1: running → paused_at_gate（当前节点为 Gate 类型）
      if (state.status !== 'running') {
        console.warn(`[reduceRun] NODE_FINISHED_GATE expected running, got ${state.status}`)
        return state
      }
      return { ...state, status: 'paused_at_gate' }
    }

    case 'NODE_RETRY_EXHAUSTED': {
      // spec 05 §10.1: running → failed(<failure_class>)
      if (state.status !== 'running') {
        console.warn(`[reduceRun] NODE_RETRY_EXHAUSTED expected running, got ${state.status}`)
        return state
      }
      return {
        ...state,
        status: 'failed',
        failureClass: event.failureClass,
        failureMessage: event.failureMessage,
      }
    }

    case 'PASS_GATE': {
      // spec 05 §10.1: paused_at_gate → running
      if (state.status !== 'paused_at_gate') {
        console.warn(`[reduceRun] PASS_GATE expected paused_at_gate, got ${state.status}`)
        return state
      }
      return { ...state, status: 'running' }
    }

    case 'CANCEL_RUN': {
      // spec 05 §10.1: running | paused_at_gate → cancelled
      if (state.status !== 'running' && state.status !== 'paused_at_gate') {
        console.warn(`[reduceRun] CANCEL_RUN unexpected in status ${state.status}`)
        return state
      }
      return { ...state, status: 'cancelled' }
    }

    case 'RECONCILE_SWEEP_ORPHANED': {
      // spec 05 §10.1: (any non-terminal) → failed(sandbox_died)
      return {
        ...state,
        status: 'failed',
        failureClass: 'sandbox_died',
        failureMessage: 'reconcile: orphaned run',
      }
    }

    default:
      return assertNever(event)
  }
}
```

- [ ] **Step 4: 重构测试使用 makeRun factory**

修改 `packages/orchestrator/src/fsm/run.test.ts` 顶部 import 区域，添加 factory 并将 inline literal 替换：

```ts
// 在文件顶部替换 inline fixtures 块为：
import { makeRun } from '../test/fixtures.js'

const created = makeRun({ id: 'run-1', status: 'created' })
const scheduling = makeRun({ id: 'run-1', status: 'scheduling' })
const running = makeRun({ id: 'run-1', status: 'running' })
const pausedAtGate = makeRun({ id: 'run-1', status: 'paused_at_gate' })
```

删除文件中原先的 4 行 `const xxx: RunState = { ... }` inline literal 定义，其他测试逻辑保持不变。

- [ ] **Step 5: 跑测试验证绿色**

```bash
pnpm --filter @honeyai/orchestrator test -- run
```

Expected: PASS — 所有 run.test.ts 用例绿色（happy path + failure + cancel + illegal 共约 14 个）。

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/src/fsm/run.ts packages/orchestrator/src/fsm/run.test.ts
git commit -m "$(cat <<'EOF'
feat(orchestrator): Run FSM switch reducer — 9 transition rules (spec 05 §10.1)
EOF
)"
```

---

## Task 6: `fsm/node.ts` — Node reducer

**Files:**

- Create: `packages/orchestrator/src/fsm/node.ts`
- Create: `packages/orchestrator/src/fsm/node.test.ts`

- [ ] **Step 1: 先写失败的测试**

创建 `packages/orchestrator/src/fsm/node.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { reduceNode } from './node.js'
import { makeNode } from '../test/fixtures.js'
import type { NodeState } from '../types.js'

// ─── agent 节点 happy path（spec 05 §10.2） ───────────────────────────────────

describe('reduceNode — agent node happy path (spec 05 §10.2)', () => {
  it('pending → START_NODE → running', () => {
    const state = makeNode({ kind: 'agent', status: 'pending' })
    const next = reduceNode(state, { type: 'START_NODE' })
    expect(next.status).toBe('running')
    expect(next.retryCount).toBe(0)
  })

  it('running → NODE_SUCCESS → success', () => {
    const state = makeNode({ kind: 'agent', status: 'running' })
    const next = reduceNode(state, { type: 'NODE_SUCCESS' })
    expect(next.status).toBe('success')
  })
})

// ─── 自动重试（retryable error + retryCount < max） ───────────────────────────

describe('reduceNode — auto-retry (retryable class, attempt < max) (spec 05 §10.2)', () => {
  it('running → NODE_FAILURE(llm_rate_limited, retry=0) → running, retryCount=1', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'llm_rate_limited',
      failureMessage: '429',
    })
    // RETRY_POLICY llm_rate_limited: auto=true, max=3 — attempt=0 < 3 → auto retry
    expect(next.status).toBe('running')
    expect(next.retryCount).toBe(1)
  })

  it('running → NODE_FAILURE(llm_rate_limited, retry=2) → running, retryCount=3', () => {
    const state = makeNode({ status: 'running', retryCount: 2 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'llm_rate_limited',
      failureMessage: '429 again',
    })
    // attempt=2 < 3 → 仍可重试，retryCount becomes 3
    expect(next.status).toBe('running')
    expect(next.retryCount).toBe(3)
  })

  it('running → NODE_FAILURE(llm_quality_failed, retry=0) → running', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'llm_quality_failed',
      failureMessage: 'schema mismatch',
    })
    expect(next.status).toBe('running')
    expect(next.retryCount).toBe(1)
  })

  it('running → NODE_FAILURE(external_failed, retry=0) → running, retryCount=1', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'external_failed',
      failureMessage: 'GitHub 503',
    })
    // external_failed: auto=true, max=1 — attempt=0 < 1 → retry
    expect(next.status).toBe('running')
    expect(next.retryCount).toBe(1)
  })
})

// ─── 重试耗尽（retryCount >= max） ────────────────────────────────────────────

describe('reduceNode — retry exhausted (retryCount >= max) → failed', () => {
  it('llm_rate_limited: retry=3 → failed', () => {
    const state = makeNode({ status: 'running', retryCount: 3 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'llm_rate_limited',
      failureMessage: '429 final',
    })
    // attempt=3 >= max=3 → exhausted
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('llm_rate_limited')
    expect(next.failureMessage).toBe('429 final')
  })

  it('external_failed: retry=1 → failed', () => {
    const state = makeNode({ status: 'running', retryCount: 1 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'external_failed',
      failureMessage: 'GitHub still 503',
    })
    // external_failed max=1 — attempt=1 >= 1 → failed
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('external_failed')
  })
})

// ─── 手动重试类（non-retryable → 直接 failed） ────────────────────────────────

describe('reduceNode — manual-only failure classes → immediate failed', () => {
  it('sandbox_timeout → failed immediately (no auto retry)', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'sandbox_timeout',
      failureMessage: 'pod pending 20min',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_timeout')
    // retryCount 不递增（手动类不消耗 auto retry）
    expect(next.retryCount).toBe(0)
  })

  it('sandbox_oom → failed immediately', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'sandbox_oom',
      failureMessage: 'OOMKilled',
    })
    expect(next.status).toBe('failed')
    expect(next.failureClass).toBe('sandbox_oom')
  })

  it('sandbox_died → failed immediately', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'sandbox_died',
      failureMessage: 'pod not found',
    })
    expect(next.status).toBe('failed')
  })

  it('sandbox_disk_full → failed immediately', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'sandbox_disk_full',
      failureMessage: 'no space left',
    })
    expect(next.status).toBe('failed')
  })

  it('user_cancelled → failed immediately', () => {
    const state = makeNode({ status: 'running', retryCount: 0 })
    const next = reduceNode(state, {
      type: 'NODE_FAILURE',
      failureClass: 'user_cancelled',
      failureMessage: 'user cancelled',
    })
    expect(next.status).toBe('failed')
  })
})

// ─── 手动重试（failed → RETRY_NODE_MANUAL → running） ─────────────────────────

describe('reduceNode — manual retry (spec 05 §10.2 retryNode(manual))', () => {
  it('failed → RETRY_NODE_MANUAL → running', () => {
    const state = makeNode({ status: 'failed', retryCount: 1, failureClass: 'sandbox_oom' })
    const next = reduceNode(state, { type: 'RETRY_NODE_MANUAL' })
    expect(next.status).toBe('running')
    // retryCount 保持 failed 时的值（orchestrator service 负责 INSERT node_retries）
    expect(next.failureClass).toBeUndefined()
  })
})

// ─── Gate/deploy 节点（kind 不同，状态机逻辑相同） ────────────────────────────

describe('reduceNode — gate node', () => {
  it('pending → START_NODE → running（gate 类型）', () => {
    const state = makeNode({ kind: 'gate', status: 'pending' })
    const next = reduceNode(state, { type: 'START_NODE' })
    expect(next.status).toBe('running')
    expect(next.kind).toBe('gate')
  })

  it('running → NODE_SUCCESS → success（gate 通过后继续）', () => {
    const state = makeNode({ kind: 'gate', status: 'running' })
    const next = reduceNode(state, { type: 'NODE_SUCCESS' })
    expect(next.status).toBe('success')
  })
})

describe('reduceNode — deploy node', () => {
  it('pending → START_NODE → running（deploy 类型）', () => {
    const state = makeNode({ kind: 'deploy', status: 'pending' })
    const next = reduceNode(state, { type: 'START_NODE' })
    expect(next.status).toBe('running')
  })
})

// ─── CANCEL_RUN 事件：任意非终态 → skipped ───────────────────────────────────

describe('reduceNode — CANCEL_RUN → skipped', () => {
  it('pending → CANCEL_RUN → skipped', () => {
    const state = makeNode({ status: 'pending' })
    const next = reduceNode(state, { type: 'CANCEL_RUN' })
    expect(next.status).toBe('skipped')
  })

  it('running → CANCEL_RUN → skipped', () => {
    const state = makeNode({ status: 'running' })
    const next = reduceNode(state, { type: 'CANCEL_RUN' })
    expect(next.status).toBe('skipped')
  })
})

// ─── 终态保护 ─────────────────────────────────────────────────────────────────

describe('reduceNode — terminal state immutability', () => {
  it('success + START_NODE → returns success unchanged', () => {
    const state = makeNode({ status: 'success' })
    const next = reduceNode(state, { type: 'START_NODE' })
    expect(next.status).toBe('success')
  })

  it('skipped + NODE_SUCCESS → returns skipped unchanged', () => {
    const state = makeNode({ status: 'skipped' })
    const next = reduceNode(state, { type: 'NODE_SUCCESS' })
    expect(next.status).toBe('skipped')
  })
})
```

- [ ] **Step 2: 跑测试验证红色**

```bash
pnpm --filter @honeyai/orchestrator test -- node
```

Expected: FAIL — `Cannot find module './node.js'`.

- [ ] **Step 3: 写 Node reducer 实现**

创建 `packages/orchestrator/src/fsm/node.ts`：

```ts
// spec 05 §10.2 Node FSM 转换表
// ADR-027: exhaustive switch reducer（纯函数，不可变）

import { assertNever } from './assertNever.js'
import { RETRY_POLICY, shouldAutoRetry } from '../errors.js'
import type { NodeState, NodeEvent } from '../types.js'

/** 终态集合（terminal states） */
const TERMINAL_STATUSES = new Set<NodeState['status']>(['success', 'failed', 'skipped'])

/**
 * reduceNode — Node FSM reducer（纯函数）
 * 非法事件：返回原 state 不变 + console.warn（pino 在切片 1.2 接入后替换）。
 */
export function reduceNode(state: NodeState, event: NodeEvent): NodeState {
  // CANCEL_RUN 可中断任意非终态节点 → skipped（spec 05 §10.2 "(any) cancelRun() → skipped"）
  if (event.type === 'CANCEL_RUN') {
    if (TERMINAL_STATUSES.has(state.status)) {
      console.warn(`[reduceNode] CANCEL_RUN on terminal status=${state.status}, ignoring`)
      return state
    }
    return { ...state, status: 'skipped' }
  }

  // 终态保护
  if (TERMINAL_STATUSES.has(state.status)) {
    console.warn(
      `[reduceNode] illegal transition: status=${state.status} is terminal, ignoring event=${event.type}`,
    )
    return state
  }

  switch (event.type) {
    case 'START_NODE': {
      // spec 05 §10.2: pending → running
      if (state.status !== 'pending') {
        console.warn(`[reduceNode] START_NODE expected pending, got ${state.status}`)
        return state
      }
      return { ...state, status: 'running' }
    }

    case 'NODE_SUCCESS': {
      // spec 05 §10.2: running → success
      if (state.status !== 'running') {
        console.warn(`[reduceNode] NODE_SUCCESS expected running, got ${state.status}`)
        return state
      }
      return { ...state, status: 'success' }
    }

    case 'NODE_FAILURE': {
      // spec 05 §10.2: running → (running w/ retry++) | failed
      if (state.status !== 'running') {
        console.warn(`[reduceNode] NODE_FAILURE expected running, got ${state.status}`)
        return state
      }

      const { failureClass, failureMessage } = event

      if (shouldAutoRetry(failureClass, state.retryCount)) {
        // auto retry — retryCount++ stays running
        return { ...state, retryCount: state.retryCount + 1 }
      }

      // exhausted or manual-only → failed
      return {
        ...state,
        status: 'failed',
        failureClass,
        failureMessage,
      }
    }

    case 'RETRY_NODE_MANUAL': {
      // spec 05 §10.2: failed → running（人工重试，UI 触发）
      if (state.status !== 'failed') {
        console.warn(`[reduceNode] RETRY_NODE_MANUAL expected failed, got ${state.status}`)
        return state
      }
      // 清除 failureClass / failureMessage（重试后如再失败由新 NODE_FAILURE 事件写入）
      const { failureClass: _fc, failureMessage: _fm, ...rest } = state
      return { ...rest, status: 'running' }
    }

    default:
      return assertNever(event)
  }
}
```

- [ ] **Step 4: 跑测试验证绿色**

```bash
pnpm --filter @honeyai/orchestrator test -- node
```

Expected: PASS — 所有 node.test.ts 用例绿色（约 20 个用例）。

- [ ] **Step 5: 全量测试回归**

```bash
pnpm --filter @honeyai/orchestrator test
```

Expected: PASS — errors + assertNever + run + node 全部绿色。

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/src/fsm/node.ts packages/orchestrator/src/fsm/node.test.ts
git commit -m "$(cat <<'EOF'
feat(orchestrator): Node FSM switch reducer — 7 transition rules (spec 05 §10.2)
EOF
)"
```

---

## Task 7: barrel `index.ts` + typecheck + lint + 全量验收

**Files:**

- Modify: `packages/orchestrator/src/index.ts`

- [ ] **Step 1: 更新 barrel 导出（切片 1.1 范围内）**

将 `packages/orchestrator/src/index.ts` 替换为：

```ts
// @honeyai/orchestrator — 切片 1.1 barrel export
// 含: errors / types / FSM reducers / assertNever
// 不含: Gate service / Redis / BullMQ / Reconcile（切片 1.2-1.4）

// errors + retry policy
export {
  OrchestratorError,
  LlmRateLimitedError,
  LlmQualityFailedError,
  SandboxTimeoutError,
  SandboxOomError,
  SandboxDiedError,
  SandboxDiskFullError,
  ExternalFailedError,
  UserCancelledError,
  RETRY_POLICY,
  shouldAutoRetry,
  nextBackoffMs,
} from './errors.js'

export type { FailureClass, RetryPolicy } from './errors.js'

// state + event types
export type {
  RunStatus,
  RunState,
  RunEvent,
  NodeStatus,
  NodeKind,
  NodeState,
  NodeEvent,
  ArtifactKind,
  ArtifactStatus,
  ArtifactSnapshot,
} from './types.js'

// FSM reducers
export { reduceRun } from './fsm/run.js'
export { reduceNode } from './fsm/node.js'
export { assertNever } from './fsm/assertNever.js'
```

- [ ] **Step 2: typecheck 验证**

```bash
pnpm --filter @honeyai/orchestrator typecheck
```

Expected: 无报错。

- [ ] **Step 3: lint 验证**

```bash
pnpm --filter @honeyai/orchestrator lint
```

Expected: 无 error（可能有 warn，若 lint 配置未覆盖 orchestrator 则先通过，后续统一 fix）。

如遇 `eslint: No files matching the pattern "src" were found.` 则添加 `.eslintignore` 或检查根 eslint 配置是否覆盖 packages。

- [ ] **Step 4: 全量测试 + ac:coverage 回归验证**

```bash
pnpm --filter @honeyai/orchestrator test
pnpm ac:coverage
```

Expected:

- 所有 orchestrator 测试绿色
- `ac:coverage` 退出码 0（切片 1.1 不引入新种子 AC，不改变已有报告）

- [ ] **Step 5: Turbo 全量 CI 模拟**

```bash
pnpm turbo run lint typecheck test --filter=@honeyai/orchestrator
```

Expected: 3 个 task 全部成功。

- [ ] **Step 6: Commit + 推送分支**

```bash
git add packages/orchestrator/src/index.ts
git commit -m "$(cat <<'EOF'
feat(orchestrator): barrel index — expose slice 1.1 public surface
EOF
)"

git push -u origin feat/phase-2-1-orchestrator-foundation
```

---

## Task 8: 创建 PR

**Files:** 无（仅 git / gh 操作）

- [ ] **Step 1: 确认分支状态干净**

```bash
git status
git log --oneline origin/main..HEAD
```

Expected: 无 unstaged 变更；显示 7-8 条 commit（Task 1 到 Task 7）。

- [ ] **Step 2: 核对 diff 摘要**

```bash
git diff origin/main...HEAD --stat
```

Expected: 仅 `packages/orchestrator/` 内文件变更（约 13 个文件，780 行）。

- [ ] **Step 3: 开 PR**

```bash
gh pr create \
  --title "feat(orchestrator): slice 1.1 — FSM skeleton + error classes" \
  --body "$(cat <<'EOF'
## Summary

- 将 \`@honeyai/orchestrator\` 从 Phase 1 占位 \`export {}\` 转为实建（切片 1.1）
- 实现 8 类 \`OrchestratorError\` 子类 + \`RETRY_POLICY\` 常量（spec 05 §4.1 + Q6 拍板）
- 实现 \`reduceRun\` / \`reduceNode\` exhaustive switch reducer（ADR-027，spec 05 §10.1/10.2）
- 实现 \`assertNever\` exhaustive helper（编译期 + 运行时双重保障）
- 添加 TS fixture factories \`makeRun\` / \`makeNode\` / \`makeArtifact\`（Q2 拍板）
- 不含 Gate / Redis / BullMQ / Reconcile（切片 1.2-1.4 范围）

## Test plan

- [ ] \`pnpm --filter @honeyai/orchestrator test\` — 全部绿色
- [ ] \`pnpm --filter @honeyai/orchestrator typecheck\` — 无 TS 报错
- [ ] \`pnpm --filter @honeyai/orchestrator lint\` — 无 ESLint error
- [ ] \`pnpm ac:coverage\` — 不退步（切片 1.1 无新种子 AC）
- [ ] Run reducer happy path：\`created→scheduling→running→completed\` 链条
- [ ] Node reducer auto-retry：\`llm_rate_limited\` retryCount < 3 继续 running
- [ ] Node reducer exhausted：retryCount >= max → failed + failureClass 保留
- [ ] Node reducer manual-only：\`sandbox_oom\` 立即 failed（不消耗 auto retry）
- [ ] assertNever 运行时 throw 验证
EOF
)"
```

Expected: PR URL 输出。

---

## 附录: 关键 spec 对齐速查

### Run FSM 事件 → 转移映射（spec 05 §10.1 对照）

| event.type               | from                      | to             | 备注                         |
| ------------------------ | ------------------------- | -------------- | ---------------------------- |
| SCHEDULE_RUN             | created                   | scheduling     | enqueue worker               |
| SANDBOX_READY            | scheduling                | running        | INSERT first node            |
| SANDBOX_PENDING_TIMEOUT  | scheduling                | failed         | failureClass=sandbox_timeout |
| NODE_FINISHED_LAST       | running                   | completed      | 最后节点 success             |
| NODE_FINISHED_GATE       | running                   | paused_at_gate | Gate 节点结束                |
| NODE_RETRY_EXHAUSTED     | running                   | failed         | 带 failureClass + message    |
| PASS_GATE                | paused_at_gate            | running        | enqueue advanceRun           |
| CANCEL_RUN               | running \| paused_at_gate | cancelled      | kubectl delete Job           |
| RECONCILE_SWEEP_ORPHANED | (any non-terminal)        | failed         | failureClass=sandbox_died    |

### Node FSM 事件 → 转移映射（spec 05 §10.2 对照）

| event.type                       | from               | to      | 备注              |
| -------------------------------- | ------------------ | ------- | ----------------- |
| START_NODE                       | pending            | running | kubectl exec      |
| NODE_SUCCESS                     | running            | success | INSERT artifact   |
| NODE_FAILURE(auto, count < max)  | running            | running | retryCount++      |
| NODE_FAILURE(auto, count >= max) | running            | failed  | 传播至 Run        |
| NODE_FAILURE(manual-only)        | running            | failed  | 暴露重试按钮      |
| RETRY_NODE_MANUAL                | failed             | running | acquire job_locks |
| CANCEL_RUN                       | (any non-terminal) | skipped | 清理 finishedAt   |
