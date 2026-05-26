import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/runs/actions', () => ({
  createRun: vi.fn().mockResolvedValue({ ok: true, runId: 'new-run-id' }),
}))
vi.mock('./NewRunForm', () => ({
  NewRunForm: ({ tenantSlug }: { tenantSlug: string }) => (
    <form>
      <input name="title" type="text" />
      <textarea name="oneLiner" />
      <button type="submit">创建并启动</button>
      <span data-testid="slug">{tenantSlug}</span>
    </form>
  ),
}))

import NewRunPage from './page'
import { auth } from '@/lib/auth'

describe('NewRunPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('AC-07-09: redirects when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    await expect(NewRunPage({ params: Promise.resolve({ slug: 'alice' }) })).rejects.toThrow(
      'REDIRECT:/login',
    )
  })

  it('AC-07-09: renders title input field', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' },
    } as never)
    const jsx = await NewRunPage({ params: Promise.resolve({ slug: 'alice' }) })
    const { container } = render(jsx)
    expect(container.querySelector('input[name="title"]')).toBeTruthy()
  })

  it('AC-07-09: renders oneLiner textarea', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' },
    } as never)
    const jsx = await NewRunPage({ params: Promise.resolve({ slug: 'alice' }) })
    const { container } = render(jsx)
    expect(container.querySelector('textarea[name="oneLiner"]')).toBeTruthy()
  })

  it('AC-07-09: renders submit button', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' },
    } as never)
    const jsx = await NewRunPage({ params: Promise.resolve({ slug: 'alice' }) })
    const { getByText } = render(jsx)
    expect(getByText(/创建并启动/)).toBeTruthy()
  })
})
