import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('getDb', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws "DATABASE_URL is not set" when env unset', async () => {
    delete process.env['DATABASE_URL']
    const { getDb } = await import('./client.js')
    expect(() => getDb()).toThrow('getDb: DATABASE_URL is not set')
  })

  it('returns same instance on second call (singleton)', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://x:y@localhost:1/db')
    const { getDb } = await import('./client.js')
    const db1 = getDb()
    const db2 = getDb()
    expect(db1).toBe(db2)
  })
})
