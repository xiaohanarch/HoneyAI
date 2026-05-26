import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('getDb', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws "DATABASE_URL is not set" when env unset', async () => {
    // Use vi.stubEnv('', '') instead of `delete process.env[...]` so cleanup
    // is handled by afterEach(vi.unstubAllEnvs). Empty string is falsy so the
    // `if (!url)` guard in getDb still throws. Matches dev-credentials.test.ts
    // pattern; future-proofs against any singleFork pool change in this pkg.
    vi.stubEnv('DATABASE_URL', '')
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
