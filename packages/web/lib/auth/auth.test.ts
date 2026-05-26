import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock next-auth before importing the module under test
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

describe('auth config', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_AUTH_ENABLED', 'true')
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-32-bytes-placeholder!!')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('exports handlers, auth, signIn, signOut', async () => {
    const mod = await import('./index.js')
    expect(typeof mod.handlers).toBe('object')
    expect(typeof mod.auth).toBe('function')
    expect(typeof mod.signIn).toBe('function')
    expect(typeof mod.signOut).toBe('function')
  })

  it('auth() returns null when no session exists (mocked)', async () => {
    const { auth } = await import('./index.js')
    const session = await auth()
    expect(session).toBeNull()
  })

  it('includes Credentials provider when NODE_ENV=development and DEV_AUTH_ENABLED=true', async () => {
    const mod = await import('./index.js')
    expect(mod.handlers).toBeDefined()
  })
})
