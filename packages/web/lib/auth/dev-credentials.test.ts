import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('dev-credentials guard', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws when NODE_ENV is not development', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEV_AUTH_ENABLED', 'true')
    await expect(import('./dev-credentials')).rejects.toThrow(
      'DEV_CREDENTIALS: only available in development with DEV_AUTH_ENABLED=true',
    )
  })

  it('throws when DEV_AUTH_ENABLED is not "true"', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_AUTH_ENABLED', 'false')
    await expect(import('./dev-credentials')).rejects.toThrow(
      'DEV_CREDENTIALS: only available in development with DEV_AUTH_ENABLED=true',
    )
  })

  it('throws when DEV_AUTH_ENABLED is absent', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_AUTH_ENABLED', '')
    await expect(import('./dev-credentials')).rejects.toThrow(
      'DEV_CREDENTIALS: only available in development with DEV_AUTH_ENABLED=true',
    )
  })

  it('exports DEV_USERS array with at least 4 fixture users when guard passes', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_AUTH_ENABLED', 'true')
    const mod = await import('./dev-credentials')
    expect(Array.isArray(mod.DEV_USERS)).toBe(true)
    expect(mod.DEV_USERS.length).toBeGreaterThanOrEqual(4)
  })

  it('each fixture user has username and password fields', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_AUTH_ENABLED', 'true')
    const { DEV_USERS } = await import('./dev-credentials')
    for (const user of DEV_USERS) {
      expect(typeof user['username']).toBe('string')
      expect(typeof user['password']).toBe('string')
      expect(typeof user['id']).toBe('string')
      expect(typeof user['name']).toBe('string')
    }
  })

  it('authorizeDevCredentials returns user on correct credentials', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_AUTH_ENABLED', 'true')
    const { authorizeDevCredentials } = await import('./dev-credentials')
    const result = await authorizeDevCredentials({ username: 'alice', password: 'dev-alice' })
    expect(result).not.toBeNull()
    expect(result?.name).toBe('alice')
  })

  it('authorizeDevCredentials returns null on wrong password', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_AUTH_ENABLED', 'true')
    const { authorizeDevCredentials } = await import('./dev-credentials')
    const result = await authorizeDevCredentials({ username: 'alice', password: 'wrong' })
    expect(result).toBeNull()
  })

  it('authorizeDevCredentials returns null on unknown user', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_AUTH_ENABLED', 'true')
    const { authorizeDevCredentials } = await import('./dev-credentials')
    const result = await authorizeDevCredentials({ username: 'nobody', password: 'dev-nobody' })
    expect(result).toBeNull()
  })
})
