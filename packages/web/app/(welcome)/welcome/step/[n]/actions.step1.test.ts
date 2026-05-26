// packages/web/app/(welcome)/welcome/step/[n]/actions.step1.test.ts
// TDD: write tests before implementation.
// AC-01-05: invalid key format rejected
// AC-01-10: bootstrap-already-complete rejected

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

// Bootstrap reader mock
const mockGetTenantBootstrap = vi.fn()
vi.mock('@/lib/bootstrap/read', () => ({
  getTenantBootstrap: (...args: unknown[]) => mockGetTenantBootstrap(...args),
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

// core encryption mock
vi.mock('@honeyai/core', () => ({
  encryptAnthropicKey: (key: string) => `v1:${Buffer.from(key).toString('base64')}`,
}))

import { submitStep1 } from './actions'
import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

const AUTHENTICATED_SESSION = {
  user: {
    id: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'alice',
  },
  expires: '2099-01-01',
}

const VALID_KEY = 'sk-ant-api03-AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH'

describe('submitStep1 server action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(AUTHENTICATED_SESSION)
    mockGetTenantBootstrap.mockResolvedValue({ slug: 'alice', bootstrap: null })
    mockUpdate.mockResolvedValue([])
  })

  describe('AC-01-05: invalid key format rejection', () => {
    it('AC-01-05: returns INVALID_KEY_FORMAT when key is missing', async () => {
      const fd = new FormData()
      const result = await submitStep1({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'INVALID_KEY_FORMAT', field: 'key' })
    })

    it('AC-01-05: returns INVALID_KEY_FORMAT when key does not start with sk-ant-', async () => {
      const fd = new FormData()
      fd.set('key', 'sk-openai-AAABBBCCCDDDEEEFFF')
      const result = await submitStep1({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'INVALID_KEY_FORMAT', field: 'key' })
    })

    it('AC-01-05: returns INVALID_KEY_FORMAT when key is too short', async () => {
      const fd = new FormData()
      fd.set('key', 'sk-ant-tooshort')
      const result = await submitStep1({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'INVALID_KEY_FORMAT', field: 'key' })
    })
  })

  describe('AC-01-10: bootstrap-already-complete rejection', () => {
    it('AC-01-10: returns BOOTSTRAP_ALREADY_COMPLETE when completedAt is set', async () => {
      mockGetTenantBootstrap.mockResolvedValue({
        slug: 'alice',
        bootstrap: { completedAt: '2026-01-01T00:00:00Z' },
      })
      const fd = new FormData()
      fd.set('key', VALID_KEY)
      const result = await submitStep1({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' })
    })
  })

  describe('happy path: valid key + incomplete bootstrap → redirect', () => {
    it('AC-01-05: redirects to /welcome/step/2 on success', async () => {
      mockUpdate.mockResolvedValue([])
      const fd = new FormData()
      fd.set('key', VALID_KEY)
      await expect(submitStep1({ ok: true } as WelcomeActionResult, fd)).rejects.toThrow(
        'REDIRECT:/welcome/step/2',
      )
    })

    it('AC-01-05: calls patchBootstrap with encrypted key', async () => {
      const fd = new FormData()
      fd.set('key', VALID_KEY)
      await expect(submitStep1({ ok: true } as WelcomeActionResult, fd)).rejects.toThrow(
        'REDIRECT:/welcome/step/2',
      )
      expect(mockUpdate).toHaveBeenCalledOnce()
    })
  })

  describe('UNAUTHENTICATED', () => {
    it('returns UNAUTHENTICATED when session is missing', async () => {
      mockGetSession.mockResolvedValue(null)
      const fd = new FormData()
      fd.set('key', VALID_KEY)
      const result = await submitStep1({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED' })
    })

    it('returns UNAUTHENTICATED when tenantId is missing from session', async () => {
      mockGetSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2099-01-01' })
      const fd = new FormData()
      fd.set('key', VALID_KEY)
      const result = await submitStep1({ ok: true } as WelcomeActionResult, fd)
      expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED' })
    })
  })
})
