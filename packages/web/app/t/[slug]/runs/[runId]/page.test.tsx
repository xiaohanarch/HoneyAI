import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/runs/queries', () => ({ getRunWithNodes: vi.fn() }))
vi.mock('@/components/run/RunStatusBadge', () => ({
  RunStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}))
// Mock the client component entirely — it uses hooks not available in RSC tests
vi.mock('./RunDetailClient', () => ({
  RunDetailClient: ({ runId }: { runId: string }) => (
    <div data-testid="run-detail-client">{runId}</div>
  ),
}))

import RunDetailPage from './page'
import { auth } from '@/lib/auth'
import { getRunWithNodes } from '@/lib/runs/queries'

const fakeRun = {
  id: 'r1',
  title: 'My task',
  status: 'running' as const,
  createdAt: new Date(),
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

describe('RunDetailPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('AC-07-10: redirects when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    await expect(
      RunDetailPage({ params: Promise.resolve({ slug: 'alice', runId: 'r1' }) }),
    ).rejects.toThrow('REDIRECT:/login')
  })

  it('AC-07-10: throws notFound when run does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' },
    } as never)
    vi.mocked(getRunWithNodes).mockResolvedValue(null)
    await expect(
      RunDetailPage({ params: Promise.resolve({ slug: 'alice', runId: 'no-such' }) }),
    ).rejects.toThrow('NOT_FOUND')
  })

  it('AC-07-10: renders run title', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' },
    } as never)
    vi.mocked(getRunWithNodes).mockResolvedValue({ run: fakeRun as never, nodes: [] })
    const jsx = await RunDetailPage({ params: Promise.resolve({ slug: 'alice', runId: 'r1' }) })
    const { getByText } = render(jsx)
    expect(getByText('My task')).toBeTruthy()
  })

  it('AC-07-10: renders RunDetailClient with runId', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' },
    } as never)
    vi.mocked(getRunWithNodes).mockResolvedValue({ run: fakeRun as never, nodes: [] })
    const jsx = await RunDetailPage({ params: Promise.resolve({ slug: 'alice', runId: 'r1' }) })
    const { getByTestId } = render(jsx)
    expect(getByTestId('run-detail-client').textContent).toBe('r1')
  })
})
