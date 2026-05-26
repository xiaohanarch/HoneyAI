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

describe('dev-credentials uuid + tenantId (ADR-048 U1 / JT3)', () => {
  beforeEach(() => {
    // resetModules MUST come before stubEnv so the dynamic import() in each
    // test body loads a fresh module against the already-stubbed environment.
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_AUTH_ENABLED', 'true')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('all 4 dev users have uuid v7-shaped ids', async () => {
    const { DEV_USERS } = await import('./dev-credentials')
    for (const u of DEV_USERS) {
      expect(u.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(u.tenantId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(u.tenantSlug).toMatch(/^[a-z]+$/)
    }
  })

  it('authorize returns tenantId + tenantSlug for matching credentials', async () => {
    const { authorizeDevUser, DEV_USERS } = await import('./dev-credentials')
    const u = await authorizeDevUser({ username: 'alice', password: 'dev-alice' })
    expect(u).toBeTruthy()
    expect(u!.tenantId).toBe(DEV_USERS[0]!.tenantId)
    expect(u!.tenantSlug).toBe('alice')
  })

  it('alice / bob / carol / dave have distinct tenant ids', async () => {
    const { DEV_USERS } = await import('./dev-credentials')
    const ids = new Set(DEV_USERS.map((u) => u.tenantId))
    expect(ids.size).toBe(4)
  })
})
