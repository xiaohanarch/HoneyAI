import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('./read', () => ({
  getTenantBootstrap: vi.fn(),
}))

import { redirect } from 'next/navigation'
import { getTenantBootstrap } from './read'
import { requireBootstrapComplete, requireBootstrapIncomplete } from './guard'

describe('AC-01-04: bootstrap guard redirect matrix', () => {
  it('AC-01-04: requireBootstrapComplete passes when completedAt set', async () => {
    vi.mocked(getTenantBootstrap).mockResolvedValue({
      slug: 'alice',
      bootstrap: { completedAt: '2026-01-01T00:00:00Z' },
    })
    await expect(requireBootstrapComplete('t1')).resolves.toBeUndefined()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('AC-01-04: requireBootstrapComplete redirects to /welcome when incomplete', async () => {
    vi.mocked(getTenantBootstrap).mockResolvedValue({ slug: 'alice', bootstrap: null })
    await expect(requireBootstrapComplete('t1')).rejects.toThrow('REDIRECT:/welcome')
  })

  it('AC-01-04: requireBootstrapIncomplete passes when bootstrap is null', async () => {
    vi.mocked(getTenantBootstrap).mockResolvedValue({ slug: 'alice', bootstrap: null })
    await expect(requireBootstrapIncomplete('t1')).resolves.toBeUndefined()
  })

  it('AC-01-04: requireBootstrapIncomplete redirects to /t/[slug] when complete', async () => {
    vi.mocked(getTenantBootstrap).mockResolvedValue({
      slug: 'alice',
      bootstrap: { completedAt: '2026-01-01T00:00:00Z' },
    })
    await expect(requireBootstrapIncomplete('t1')).rejects.toThrow('REDIRECT:/t/alice')
  })
})
