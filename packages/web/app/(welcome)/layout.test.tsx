// packages/web/app/(welcome)/layout.test.tsx
import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('@/lib/auth', () => ({
  auth: () => mockGetSession(),
}))

vi.mock('@/lib/bootstrap/guard', () => ({
  requireBootstrapIncomplete: vi.fn(),
}))

const mockGetSession = vi.fn()

import WelcomeLayout from './layout'
import { requireBootstrapIncomplete } from '@/lib/bootstrap/guard'

describe('WelcomeLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /login when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(WelcomeLayout({ children: null })).rejects.toThrow('REDIRECT:/login')
  })

  it('redirects to /login when tenantId missing', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' }, expires: '2099-01-01' })
    await expect(WelcomeLayout({ children: null })).rejects.toThrow('REDIRECT:/login')
  })

  it('calls requireBootstrapIncomplete with tenantId', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', tenantId: 'tenant-1' },
      expires: '2099-01-01',
    })
    vi.mocked(requireBootstrapIncomplete).mockResolvedValue(undefined)
    await WelcomeLayout({ children: null })
    expect(requireBootstrapIncomplete).toHaveBeenCalledWith('tenant-1')
  })

  it('AC-01-04: bootstrap-complete user visiting welcome → redirects to /t/alice', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', tenantId: 'tenant-1' },
      expires: '2099-01-01',
    })
    vi.mocked(requireBootstrapIncomplete).mockRejectedValue(new Error('REDIRECT:/t/alice'))
    await expect(WelcomeLayout({ children: null })).rejects.toThrow('REDIRECT:/t/alice')
  })
})
