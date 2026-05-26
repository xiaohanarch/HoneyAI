// packages/web/app/(welcome)/welcome/page.test.tsx
// TDD: write tests before implementation (RED → GREEN → IMPROVE).

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation — redirect throws so we can assert it
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

// Auth mock — factory so vi.fn() call can be swapped per test
const mockGetSession = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockGetSession(),
}))

// Bootstrap mock — swapped per test
const mockGetBootstrap = vi.fn()
vi.mock('@/lib/bootstrap/read', () => ({
  getTenantBootstrap: (...args: unknown[]) => mockGetBootstrap(...args),
}))

import WelcomeIndexPage from './page'

const SESSION = (tenantId = 'tenant-1') => ({
  user: { id: 'user-1', tenantId },
  expires: '2099-01-01',
})

describe('WelcomeIndexPage routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /login when session is missing', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(WelcomeIndexPage()).rejects.toThrow('REDIRECT:/login')
  })

  it('redirects to /login when session has no tenantId', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2099-01-01' })
    await expect(WelcomeIndexPage()).rejects.toThrow('REDIRECT:/login')
  })

  it('redirects to /t/<slug> when completedAt is set', async () => {
    mockGetSession.mockResolvedValue(SESSION())
    mockGetBootstrap.mockResolvedValue({
      slug: 'alice',
      bootstrap: { completedAt: '2026-01-01T00:00:00Z' },
    })
    await expect(WelcomeIndexPage()).rejects.toThrow('REDIRECT:/t/alice')
  })

  it('redirects to /welcome/step/1 when bootstrap is null', async () => {
    mockGetSession.mockResolvedValue(SESSION())
    mockGetBootstrap.mockResolvedValue({ slug: 'alice', bootstrap: null })
    await expect(WelcomeIndexPage()).rejects.toThrow('REDIRECT:/welcome/step/1')
  })

  it('redirects to /welcome/step/1 when getTenantBootstrap returns null', async () => {
    mockGetSession.mockResolvedValue(SESSION())
    mockGetBootstrap.mockResolvedValue(null)
    await expect(WelcomeIndexPage()).rejects.toThrow('REDIRECT:/welcome/step/1')
  })

  it('redirects to /welcome/step/2 when key is set but no github', async () => {
    mockGetSession.mockResolvedValue(SESSION())
    mockGetBootstrap.mockResolvedValue({
      slug: 'alice',
      bootstrap: { anthropicKeyCiphertext: 'v1:abc' },
    })
    await expect(WelcomeIndexPage()).rejects.toThrow('REDIRECT:/welcome/step/2')
  })

  it('redirects to /welcome/step/3 when key + github set but no repo', async () => {
    mockGetSession.mockResolvedValue(SESSION())
    mockGetBootstrap.mockResolvedValue({
      slug: 'alice',
      bootstrap: {
        anthropicKeyCiphertext: 'v1:abc',
        githubAppInstalled: true,
      },
    })
    await expect(WelcomeIndexPage()).rejects.toThrow('REDIRECT:/welcome/step/3')
  })

  it('redirects to /welcome/step/4 when all 3 steps done', async () => {
    mockGetSession.mockResolvedValue(SESSION())
    mockGetBootstrap.mockResolvedValue({
      slug: 'alice',
      bootstrap: {
        anthropicKeyCiphertext: 'v1:abc',
        githubAppInstalled: true,
        pendingRepoOwnerName: 'alice',
      },
    })
    await expect(WelcomeIndexPage()).rejects.toThrow('REDIRECT:/welcome/step/4')
  })
})
