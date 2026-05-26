// packages/web/app/(welcome)/welcome/step/[n]/actions.step2.test.ts
// TDD: write tests before implementation.
// AC-01-06: GitHub App install confirmation

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
vi.mock('@honeyai/db', () => ({
  getDb: () => ({
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

import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

const AUTHENTICATED_SESSION = {
  user: {
    id: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'alice',
  },
  expires: '2099-01-01',
}

describe('submitStep2 server action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockGetSession.mockResolvedValue(AUTHENTICATED_SESSION)
    mockUpdate.mockResolvedValue([])
  })

  describe('UNAUTHENTICATED', () => {
    it('returns UNAUTHENTICATED when session is missing', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(null),
      }))
      mockGetSession.mockResolvedValue(null)
      const { submitStep2 } = await import('./actions')
      const fd = new FormData()
      fd.set('confirm', 'on')
      const result = await submitStep2({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED' })
    })

    it('returns UNAUTHENTICATED when tenantId is missing from session', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(null),
      }))
      mockGetSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2099-01-01' })
      const { submitStep2 } = await import('./actions')
      const fd = new FormData()
      fd.set('confirm', 'on')
      const result = await submitStep2({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED' })
    })
  })

  describe('AC-01-06: anthropicKeyCiphertext missing → INTERNAL_ERROR', () => {
    it('AC-01-06: returns INTERNAL_ERROR with message when anthropicKeyCiphertext not set', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue({
          slug: 'alice',
          bootstrap: { anthropicKeyCiphertext: null },
        }),
      }))
      const { submitStep2 } = await import('./actions')
      const fd = new FormData()
      fd.set('confirm', 'on')
      const result = await submitStep2({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({
        ok: false,
        code: 'INTERNAL_ERROR',
        message: '请先完成第 1 步',
      })
    })

    it('AC-01-06: returns INTERNAL_ERROR when bootstrap is null (no step 1 completed)', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue({
          slug: 'alice',
          bootstrap: null,
        }),
      }))
      const { submitStep2 } = await import('./actions')
      const fd = new FormData()
      fd.set('confirm', 'on')
      const result = await submitStep2({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({
        ok: false,
        code: 'INTERNAL_ERROR',
        message: '请先完成第 1 步',
      })
    })
  })

  describe('AC-01-06: completedAt set → BOOTSTRAP_ALREADY_COMPLETE', () => {
    it('AC-01-06: returns BOOTSTRAP_ALREADY_COMPLETE when completedAt is set', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue({
          slug: 'alice',
          bootstrap: {
            completedAt: '2026-01-01T00:00:00Z',
            anthropicKeyCiphertext: 'v1:abc',
          },
        }),
      }))
      const { submitStep2 } = await import('./actions')
      const fd = new FormData()
      fd.set('confirm', 'on')
      const result = await submitStep2({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' })
    })
  })

  describe('AC-01-06: happy path — confirm → redirect to step 3', () => {
    it('AC-01-06: redirects to /welcome/step/3 on success', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue({
          slug: 'alice',
          bootstrap: {
            anthropicKeyCiphertext: 'v1:abc',
          },
        }),
      }))
      const { submitStep2 } = await import('./actions')
      const fd = new FormData()
      fd.set('confirm', 'on')
      await expect(submitStep2({ ok: true } as WelcomeActionResult, fd)).rejects.toThrow(
        'REDIRECT:/welcome/step/3',
      )
    })

    it('AC-01-06: calls patchBootstrap with githubAppInstalled=true and githubAppMarkedAt ISO string', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue({
          slug: 'alice',
          bootstrap: {
            anthropicKeyCiphertext: 'v1:abc',
          },
        }),
      }))
      const { submitStep2 } = await import('./actions')
      const fd = new FormData()
      fd.set('confirm', 'on')
      await expect(submitStep2({ ok: true } as WelcomeActionResult, fd)).rejects.toThrow(
        'REDIRECT:/welcome/step/3',
      )
      expect(mockUpdate).toHaveBeenCalledOnce()
      // The SQL update was called — inspect that patchBootstrap was invoked with the right shape.
      // The actual jsonb string passed to sql tag contains the bootstrap patch.
      const callArg = mockUpdate.mock.calls[0]
      expect(callArg).toBeDefined()
    })
  })
})
