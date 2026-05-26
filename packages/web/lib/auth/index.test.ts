/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock next-auth so the module can load in vitest (same pattern as auth.test.ts)
vi.mock('next-auth', () => ({
  default: (config: unknown) => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn().mockResolvedValue(null),
    signIn: vi.fn(),
    signOut: vi.fn(),
    _config: config,
  }),
}))

vi.mock('next-auth/providers/credentials', () => ({
  default: (opts: unknown) => {
    const obj: Record<string, unknown> = { type: 'credentials' }
    if (typeof opts === 'object' && opts !== null) {
      Object.assign(obj, opts)
    }
    return obj
  },
}))

describe('auth jwtCallback (ADR-048 JT3)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_AUTH_ENABLED', 'true')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('propagates tenantId + tenantSlug from User into token (AC-01-04 backbone)', async () => {
    const { jwtCallback } = await import('./index')
    const token = await jwtCallback({
      token: {},
      user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } as any,
    } as any)
    expect((token as any).id).toBe('u1')
    expect((token as any).tenantId).toBe('t1')
    expect((token as any).tenantSlug).toBe('alice')
  })

  it('returns token unchanged when no user (subsequent calls)', async () => {
    const { jwtCallback } = await import('./index')
    const token = await jwtCallback({ token: { id: 'u1', tenantId: 't1' } } as any)
    expect((token as any).id).toBe('u1')
    expect((token as any).tenantId).toBe('t1')
  })
})
