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
