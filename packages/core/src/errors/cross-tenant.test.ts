import { describe, it, expect } from 'vitest'
import { CrossTenantAccessError, HoneyAIError } from './index.js'

describe('CrossTenantAccessError', () => {
  it('has code CROSS_TENANT_ACCESS and httpStatus 403', () => {
    const err = new CrossTenantAccessError({
      attemptedTenantId: 't-a',
      actualTenantId: 't-b',
    })
    expect(err).toBeInstanceOf(HoneyAIError)
    expect(err.code).toBe('CROSS_TENANT_ACCESS')
    expect(err.httpStatus).toBe(403)
    expect(err.attemptedTenantId).toBe('t-a')
    expect(err.actualTenantId).toBe('t-b')
    expect(err.userMessage).toMatch(/access denied/i)
  })
})
