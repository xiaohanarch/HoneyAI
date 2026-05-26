// packages/web/app/(welcome)/welcome/step/[n]/Step2GithubAppForm.test.tsx
// TDD: write tests before implementation.

import { describe, it, expect, vi, beforeEach } from 'vitest'
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
}))

// Stub auth to avoid next-auth/next server resolution in test env
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import * as React from 'react'
import { Step2GithubAppForm } from './Step2GithubAppForm'
import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

function setupActionState(state: WelcomeActionResult) {
  vi.mocked(React.useActionState).mockReturnValue([
    state,
    vi.fn() as unknown as React.DispatchWithoutAction,
    false,
  ])
}

const TEST_INSTALL_URL = 'https://github.com/apps/test-app/installations/new'

describe('Step2GithubAppForm', () => {
  beforeEach(() => {
    // Set the env var before each test
    process.env['NEXT_PUBLIC_GITHUB_APP_INSTALL_URL'] = TEST_INSTALL_URL
  })

  it('renders step 2 title', () => {
    setupActionState({ ok: true })
    render(<Step2GithubAppForm />)
    expect(screen.getByText(/第 2 步：安装 GitHub App/)).toBeInTheDocument()
  })

  it('renders install link with href from env var', () => {
    setupActionState({ ok: true })
    render(<Step2GithubAppForm />)
    const link = screen.getByRole('link', { name: /前往 GitHub 安装/ })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', TEST_INSTALL_URL)
  })

  it('install link opens in new tab with rel=noopener noreferrer', () => {
    setupActionState({ ok: true })
    render(<Step2GithubAppForm />)
    const link = screen.getByRole('link', { name: /前往 GitHub 安装/ })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders confirm submit button', () => {
    setupActionState({ ok: true })
    render(<Step2GithubAppForm />)
    expect(screen.getByRole('button', { name: /我已完成安装/ })).toBeInTheDocument()
  })

  it('renders hidden confirm input with value "on"', () => {
    setupActionState({ ok: true })
    render(<Step2GithubAppForm />)
    const input = document.querySelector('input[name="confirm"]') as HTMLInputElement | null
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'hidden')
    expect(input?.value).toBe('on')
  })

  it('shows banner alert when state has error', () => {
    setupActionState({ ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' })
    render(<Step2GithubAppForm />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows custom message from state when available', () => {
    setupActionState({ ok: false, code: 'INTERNAL_ERROR', message: '请先完成第 1 步' })
    render(<Step2GithubAppForm />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('请先完成第 1 步')).toBeInTheDocument()
  })

  it('falls back to # when env var is not set', () => {
    delete process.env['NEXT_PUBLIC_GITHUB_APP_INSTALL_URL']
    setupActionState({ ok: true })
    render(<Step2GithubAppForm />)
    const link = screen.getByRole('link', { name: /前往 GitHub 安装/ })
    expect(link).toHaveAttribute('href', '#')
  })
})
