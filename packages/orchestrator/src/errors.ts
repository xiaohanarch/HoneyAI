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
