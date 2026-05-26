// packages/web/app/(welcome)/welcome/step/[n]/actions.step3.test.ts
// TDD: write tests before implementation.
// AC-01-07: GitHub repo selection

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

const BOOTSTRAP_WITH_GITHUB = {
  slug: 'alice',
  bootstrap: {
    anthropicKeyCiphertext: 'v1:abc',
    githubAppInstalled: true,
    githubAppMarkedAt: '2026-01-01T00:00:00Z',
  },
}

describe('submitStep3 server action', () => {
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
      const { submitStep3 } = await import('./actions')
      const fd = new FormData()
      fd.set('repo', 'owner/repo')
      const result = await submitStep3({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED' })
    })

    it('returns UNAUTHENTICATED when tenantId is missing from session', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(null),
      }))
      mockGetSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2099-01-01' })
      const { submitStep3 } = await import('./actions')
      const fd = new FormData()
      fd.set('repo', 'owner/repo')
      const result = await submitStep3({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED' })
    })
  })

  describe('AC-01-07: step 2 not done — githubAppInstalled missing → INTERNAL_ERROR', () => {
    it('AC-01-07: returns INTERNAL_ERROR with message when githubAppInstalled is not set', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue({
          slug: 'alice',
          bootstrap: { anthropicKeyCiphertext: 'v1:abc' },
        }),
      }))
      const { submitStep3 } = await import('./actions')
      const fd = new FormData()
      fd.set('repo', 'owner/repo')
      const result = await submitStep3({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({
        ok: false,
        code: 'INTERNAL_ERROR',
        message: '请先完成第 2 步',
      })
    })

    it('AC-01-07: returns INTERNAL_ERROR when bootstrap is null (no steps completed)', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue({
          slug: 'alice',
          bootstrap: null,
        }),
      }))
      const { submitStep3 } = await import('./actions')
      const fd = new FormData()
      fd.set('repo', 'owner/repo')
      const result = await submitStep3({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({
        ok: false,
        code: 'INTERNAL_ERROR',
        message: '请先完成第 2 步',
      })
    })
  })

  describe('AC-01-07: malformed repo format → INVALID_REPO_FORMAT', () => {
    it('AC-01-07: returns INVALID_REPO_FORMAT when repo is missing', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(BOOTSTRAP_WITH_GITHUB),
      }))
      const { submitStep3 } = await import('./actions')
      const fd = new FormData()
      const result = await submitStep3({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'INVALID_REPO_FORMAT', field: 'repo' })
    })

    it('AC-01-07: returns INVALID_REPO_FORMAT when repo has no slash', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(BOOTSTRAP_WITH_GITHUB),
      }))
      const { submitStep3 } = await import('./actions')
      const fd = new FormData()
      fd.set('repo', 'justareponame')
      const result = await submitStep3({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'INVALID_REPO_FORMAT', field: 'repo' })
    })

    it('AC-01-07: returns INVALID_REPO_FORMAT when repo has invalid chars', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(BOOTSTRAP_WITH_GITHUB),
      }))
      const { submitStep3 } = await import('./actions')
      const fd = new FormData()
      fd.set('repo', 'owner/repo name with spaces')
      const result = await submitStep3({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'INVALID_REPO_FORMAT', field: 'repo' })
    })
  })

  describe('AC-01-07: completedAt set → BOOTSTRAP_ALREADY_COMPLETE', () => {
    it('AC-01-07: returns BOOTSTRAP_ALREADY_COMPLETE when completedAt is set', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue({
          slug: 'alice',
          bootstrap: {
            anthropicKeyCiphertext: 'v1:abc',
            githubAppInstalled: true,
            completedAt: '2026-01-01T00:00:00Z',
          },
        }),
      }))
      const { submitStep3 } = await import('./actions')
      const fd = new FormData()
      fd.set('repo', 'owner/repo')
      const result = await submitStep3({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' })
    })
  })

  describe('AC-01-07: happy path — valid repo → redirect to step 4', () => {
    it('AC-01-07: redirects to /welcome/step/4 on success', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(BOOTSTRAP_WITH_GITHUB),
      }))
      const { submitStep3 } = await import('./actions')
      const fd = new FormData()
      fd.set('repo', 'myorg/my-repo')
      await expect(submitStep3({ ok: true } as WelcomeActionResult, fd)).rejects.toThrow(
        'REDIRECT:/welcome/step/4',
      )
    })

    it('AC-01-07: calls patchBootstrap with pendingRepoOwnerName', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(BOOTSTRAP_WITH_GITHUB),
      }))
      const { submitStep3 } = await import('./actions')
      const fd = new FormData()
      fd.set('repo', 'myorg/my-repo')
      await expect(submitStep3({ ok: true } as WelcomeActionResult, fd)).rejects.toThrow(
        'REDIRECT:/welcome/step/4',
      )
      expect(mockUpdate).toHaveBeenCalledOnce()
    })

    it('AC-01-07: accepts repo with dots and hyphens', async () => {
      vi.doMock('@/lib/bootstrap/read', () => ({
        getTenantBootstrap: vi.fn().mockResolvedValue(BOOTSTRAP_WITH_GITHUB),
      }))
      const { submitStep3 } = await import('./actions')
      const fd = new FormData()
      fd.set('repo', 'my.org/my-repo.name')
      await expect(submitStep3({ ok: true } as WelcomeActionResult, fd)).rejects.toThrow(
        'REDIRECT:/welcome/step/4',
      )
    })
  })
})
