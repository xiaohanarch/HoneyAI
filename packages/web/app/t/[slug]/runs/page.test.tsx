import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/runs/queries', () => ({ listRuns: vi.fn() }))
vi.mock('@/components/run/RunStatusBadge', () => ({
  RunStatusBadge: ({ status }: { status: string }) => <span data-testid="badge">{status}</span>,
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import RunsPage from './page'
import { auth } from '@/lib/auth'
import { listRuns } from '@/lib/runs/queries'

const fakeRun = {
  id: 'r1',
  title: 'My task',
  status: 'running' as const,
  createdAt: new Date('2026-01-01'),
  oneLiner: 'do it',
  tenantId: 't1',
  repositoryId: 'repo1',
  createdByUserId: 'u1',
  targetBranch: 'main',
  failureClass: null,
  failureMessage: null,
  runtime: 'claude_code' as const,
  startedAt: null,
  finishedAt: null,
  totalCostMicroUsd: BigInt(0),
  updatedAt: new Date(),
}

describe('RunsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('AC-07-08: redirects when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    await expect(RunsPage({ params: Promise.resolve({ slug: 'alice' }) })).rejects.toThrow(
      'REDIRECT:/login',
    )
  })

  it('AC-07-08: shows empty state when no runs', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' },
    } as never)
    vi.mocked(listRuns).mockResolvedValue([])
    const jsx = await RunsPage({ params: Promise.resolve({ slug: 'alice' }) })
    const { getByText } = render(jsx)
    expect(getByText(/暂无 Run/)).toBeTruthy()
  })

  it('AC-07-08: renders run titles and status badges', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' },
    } as never)
    vi.mocked(listRuns).mockResolvedValue([fakeRun] as never)
    const jsx = await RunsPage({ params: Promise.resolve({ slug: 'alice' }) })
    const { getByText } = render(jsx)
    expect(getByText('My task')).toBeTruthy()
    expect(getByText('running')).toBeTruthy()
  })
})
