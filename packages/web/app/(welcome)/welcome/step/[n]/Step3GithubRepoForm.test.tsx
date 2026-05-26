// packages/web/app/(welcome)/welcome/step/[n]/Step3GithubRepoForm.test.tsx
// TDD: write tests before implementation.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Stub useActionState so we can inject state without a real server action
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useActionState: vi.fn(),
  }
})

// Stub the server action so the form can import without triggering server-side modules
vi.mock('./actions', () => ({
  submitStep1: vi.fn(),
  submitStep2: vi.fn(),
  submitStep3: vi.fn(),
}))

// Stub auth to avoid next-auth/next server resolution in test env
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import * as React from 'react'
import { Step3GithubRepoForm } from './Step3GithubRepoForm'
import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

function setupActionState(state: WelcomeActionResult) {
  vi.mocked(React.useActionState).mockReturnValue([
    state,
    vi.fn() as unknown as React.DispatchWithoutAction,
    false,
  ])
}

describe('Step3GithubRepoForm', () => {
  it('renders step 3 title', () => {
    setupActionState({ ok: true })
    render(<Step3GithubRepoForm />)
    expect(screen.getByText(/第 3 步：选择 GitHub 仓库/)).toBeInTheDocument()
  })

  it('renders repo label and input', () => {
    setupActionState({ ok: true })
    render(<Step3GithubRepoForm />)
    expect(screen.getByLabelText(/仓库/)).toBeInTheDocument()
    expect(document.querySelector('input[name="repo"]')).toBeInTheDocument()
  })

  it('renders submit button with correct label', () => {
    setupActionState({ ok: true })
    render(<Step3GithubRepoForm />)
    expect(screen.getByRole('button', { name: /保存并继续/ })).toBeInTheDocument()
  })

  it('input has placeholder owner/repo', () => {
    setupActionState({ ok: true })
    render(<Step3GithubRepoForm />)
    const input = document.querySelector('input[name="repo"]')
    expect(input).toHaveAttribute('placeholder', 'owner/repo')
  })

  it('shows field-level error with aria-invalid when state has field=repo error', () => {
    setupActionState({ ok: false, code: 'INVALID_REPO_FORMAT', field: 'repo' })
    render(<Step3GithubRepoForm />)
    const input = document.querySelector('input[name="repo"]')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    // Error message text is visible
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows banner error (no aria-invalid on input) for non-field errors', () => {
    setupActionState({ ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' })
    render(<Step3GithubRepoForm />)
    const input = document.querySelector('input[name="repo"]')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows banner alert with custom message from state', () => {
    setupActionState({ ok: false, code: 'INTERNAL_ERROR', message: '请先完成第 2 步' })
    render(<Step3GithubRepoForm />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('请先完成第 2 步')).toBeInTheDocument()
  })
})
