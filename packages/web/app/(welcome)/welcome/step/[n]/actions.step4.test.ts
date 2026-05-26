// packages/web/app/(welcome)/welcome/step/[n]/actions.step4.test.ts
// TDD: write tests before implementation.
// AC-01-08: Default skills import / skip

import { beforeEach, describe, it, expect, vi } from 'vitest'

// Mock next/navigation (redirect throws so we can assert it)
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  revalidatePath: vi.fn(),
}))

// Mock next/cache (revalidatePath is a no-op in tests)
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Auth mock — returns callable so mockResolvedValue works
const mockGetSession = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockGetSession(),
}))

// DB mock — we don't exercise the actual DB write in unit tests
const mockUpdate = vi.fn()
const mockTransaction = vi.fn()
vi.mock('@honeyai/db', () => ({
  getDb: () => ({
    transaction: mockTransaction,
    update: () => ({
      set: () => ({
        where: mockUpdate,
      }),
    }),
  }),
  tenants: {},
}))

// drizzle-orm: preserve all real exports, only override sql tag for test isolation
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => ({ _sql: strings, _values: values }),
      actual.sql,
    ),
  }
})

// core encryption mock (needed because actions.ts imports encryptAnthropicKey at module level)
vi.mock('@honeyai/core', () => ({
  encryptAnthropicKey: (key: string) => `v1:${Buffer.from(key).toString('base64')}`,
}))

// Mock the default-skills seed module so importDefaultSkills is a vi.fn()
const mockImportDefaultSkills = vi.fn()
vi.mock('@/lib/seeds/default-skills', () => ({
  importDefaultSkills: (...args: unknown[]) => mockImportDefaultSkills(...args),
}))

import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

const AUTHENTICATED_SESSION = {
  user: {
    id: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'alice',
  },
  expires: '2099-01-01',
}

const BOOTSTRAP_WITH_REPO = {
  slug: 'alice',
  bootstrap: {
    anthropicKeyCiphertext: 'v1:abc',
    githubAppInstalled: true,
    githubAppMarkedAt: '2026-01-01T00:00:00Z',
    pendingRepoOwnerName: 'myorg/my-repo',
  },
}

describe('submitStep4 server action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockGetSession.mockResolvedValue(AUTHENTICATED_SESSION)
    mockUpdate.mockResolvedValue([])
    // Default transaction implementation: run the callback with a mock tx object
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue([]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      return cb(mockTx)
    })
  })

  describe('UNAUTHENTICATED', () => {
    it('returns UNAUTHENTICATED when session is missing', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(null),
      }))
      mockGetSession.mockResolvedValue(null)
      const { submitStep4 } = await import('./actions')
      const fd = new FormData()
      fd.set('action', 'import')
      const result = await submitStep4({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED' })
    })

    it('returns UNAUTHENTICATED when tenantId is missing from session', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(null),
      }))
      mockGetSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2099-01-01' })
      const { submitStep4 } = await import('./actions')
      const fd = new FormData()
      fd.set('action', 'import')
      const result = await submitStep4({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED' })
    })
  })

  describe('AC-01-08: step 3 not done — pendingRepoOwnerName missing → INTERNAL_ERROR', () => {
    it('AC-01-08: returns INTERNAL_ERROR with message when pendingRepoOwnerName is not set', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue({
          slug: 'alice',
          bootstrap: {
            anthropicKeyCiphertext: 'v1:abc',
            githubAppInstalled: true,
          },
        }),
      }))
      const { submitStep4 } = await import('./actions')
      const fd = new FormData()
      fd.set('action', 'import')
      const result = await submitStep4({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({
        ok: false,
        code: 'INTERNAL_ERROR',
        message: '请先完成第 3 步',
      })
    })
  })

  describe('AC-01-08: completedAt set → BOOTSTRAP_ALREADY_COMPLETE', () => {
    it('AC-01-08: returns BOOTSTRAP_ALREADY_COMPLETE when completedAt is set', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue({
          slug: 'alice',
          bootstrap: {
            anthropicKeyCiphertext: 'v1:abc',
            githubAppInstalled: true,
            pendingRepoOwnerName: 'myorg/my-repo',
            completedAt: '2026-01-01T00:00:00Z',
          },
        }),
      }))
      const { submitStep4 } = await import('./actions')
      const fd = new FormData()
      fd.set('action', 'import')
      const result = await submitStep4({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' })
    })
  })

  describe('AC-01-08: happy path — import → redirect to /t/alice', () => {
    it('AC-01-08: redirects to /t/alice on import action', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(BOOTSTRAP_WITH_REPO),
      }))
      const { submitStep4 } = await import('./actions')
      const fd = new FormData()
      fd.set('action', 'import')
      await expect(submitStep4({ ok: true } as WelcomeActionResult, fd)).rejects.toThrow(
        'REDIRECT:/t/alice',
      )
    })

    it('AC-01-08: calls db.transaction on import action', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(BOOTSTRAP_WITH_REPO),
      }))
      const { submitStep4 } = await import('./actions')
      const fd = new FormData()
      fd.set('action', 'import')
      await expect(submitStep4({ ok: true } as WelcomeActionResult, fd)).rejects.toThrow(
        'REDIRECT:/t/alice',
      )
      expect(mockTransaction).toHaveBeenCalledOnce()
    })
  })

  describe('AC-01-08: happy path — skip → redirect to /t/alice', () => {
    it('AC-01-08: redirects to /t/alice on skip action', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(BOOTSTRAP_WITH_REPO),
      }))
      const { submitStep4 } = await import('./actions')
      const fd = new FormData()
      fd.set('action', 'skip')
      await expect(submitStep4({ ok: true } as WelcomeActionResult, fd)).rejects.toThrow(
        'REDIRECT:/t/alice',
      )
    })

    it('AC-01-08: calls db.transaction on skip action', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(BOOTSTRAP_WITH_REPO),
      }))
      const { submitStep4 } = await import('./actions')
      const fd = new FormData()
      fd.set('action', 'skip')
      await expect(submitStep4({ ok: true } as WelcomeActionResult, fd)).rejects.toThrow(
        'REDIRECT:/t/alice',
      )
      expect(mockTransaction).toHaveBeenCalledOnce()
    })
  })
})
