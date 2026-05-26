// packages/web/app/t/[slug]/layout.test.tsx
import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

vi.mock('@/lib/auth', () => ({
  auth: () => mockGetSession(),
}))

vi.mock('@/lib/bootstrap/guard', () => ({
  requireBootstrapComplete: vi.fn(),
}))

vi.mock('@/lib/bootstrap/read', () => ({
  getTenantBootstrap: vi.fn(),
}))

const mockGetSession = vi.fn()

import TenantLayout from './layout'
import { requireBootstrapComplete } from '@/lib/bootstrap/guard'
import { getTenantBootstrap } from '@/lib/bootstrap/read'

describe('TenantLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireBootstrapComplete).mockResolvedValue(undefined)
  })

  it('redirects to /login when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(
      TenantLayout({ children: null, params: Promise.resolve({ slug: 'alice' }) }),
    ).rejects.toThrow('REDIRECT:/login')
  })

  it('AC-01-04: incomplete bootstrap redirects to /welcome', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', tenantId: 'tenant-1' },
      expires: '2099-01-01',
    })
    vi.mocked(requireBootstrapComplete).mockRejectedValue(new Error('REDIRECT:/welcome'))
    await expect(
      TenantLayout({ children: null, params: Promise.resolve({ slug: 'alice' }) }),
    ).rejects.toThrow('REDIRECT:/welcome')
  })

  it('throws notFound when tenant not found', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', tenantId: 'tenant-1' },
      expires: '2099-01-01',
    })
    vi.mocked(getTenantBootstrap).mockResolvedValue(null)
    await expect(
      TenantLayout({ children: null, params: Promise.resolve({ slug: 'alice' }) }),
    ).rejects.toThrow('NOT_FOUND')
  })

  it('AC-01-12: slug mismatch redirects to canonical slug', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', tenantId: 'tenant-1' },
      expires: '2099-01-01',
    })
    vi.mocked(getTenantBootstrap).mockResolvedValue({
      slug: 'alice',
      bootstrap: { completedAt: '2026-01-01T00:00:00Z' },
    })
    await expect(
      TenantLayout({ children: null, params: Promise.resolve({ slug: 'wrong-slug' }) }),
    ).rejects.toThrow('REDIRECT:/t/alice')
  })

  it('AC-01-12: matching slug renders children', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', tenantId: 'tenant-1' },
      expires: '2099-01-01',
    })
    vi.mocked(getTenantBootstrap).mockResolvedValue({
      slug: 'alice',
      bootstrap: { completedAt: '2026-01-01T00:00:00Z' },
    })
    const result = await TenantLayout({
      children: 'hello' as unknown as React.ReactNode,
      params: Promise.resolve({ slug: 'alice' }),
    })
    expect(result).toBeTruthy()
  })
})
