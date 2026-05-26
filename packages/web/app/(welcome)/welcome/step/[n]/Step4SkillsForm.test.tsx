// packages/web/app/(welcome)/welcome/step/[n]/Step4SkillsForm.test.tsx
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
  submitStep4: vi.fn(),
}))

// Stub auth to avoid next-auth/next server resolution in test env
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import * as React from 'react'
import { Step4SkillsForm } from './Step4SkillsForm'
import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

function setupActionState(state: WelcomeActionResult) {
  vi.mocked(React.useActionState).mockReturnValue([
    state,
    vi.fn() as unknown as React.DispatchWithoutAction,
    false,
  ])
}

describe('Step4SkillsForm', () => {
  it('renders step 4 title', () => {
    setupActionState({ ok: true })
    render(<Step4SkillsForm />)
    expect(screen.getByText(/第 4 步：导入默认 Skills/)).toBeInTheDocument()
  })

  it('renders import button', () => {
    setupActionState({ ok: true })
    render(<Step4SkillsForm />)
    expect(screen.getByRole('button', { name: /导入 5 个默认/ })).toBeInTheDocument()
  })

  it('renders skip button', () => {
    setupActionState({ ok: true })
    render(<Step4SkillsForm />)
    expect(screen.getByRole('button', { name: /跳过/ })).toBeInTheDocument()
  })

  it('import button has name="action" and value="import"', () => {
    setupActionState({ ok: true })
    render(<Step4SkillsForm />)
    const btn = screen.getByRole('button', { name: /导入 5 个默认/ })
    expect(btn).toHaveAttribute('name', 'action')
    expect(btn).toHaveAttribute('value', 'import')
  })

  it('skip button has name="action" and value="skip"', () => {
    setupActionState({ ok: true })
    render(<Step4SkillsForm />)
    const btn = screen.getByRole('button', { name: /跳过/ })
    expect(btn).toHaveAttribute('name', 'action')
    expect(btn).toHaveAttribute('value', 'skip')
  })

  it('shows banner error alert when state has error', () => {
    setupActionState({ ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' })
    render(<Step4SkillsForm />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows custom message from state when state has INTERNAL_ERROR with message', () => {
    setupActionState({ ok: false, code: 'INTERNAL_ERROR', message: '请先完成第 3 步' })
    render(<Step4SkillsForm />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('请先完成第 3 步')).toBeInTheDocument()
  })
})
