// packages/web/app/(welcome)/welcome/step/[n]/Step1AnthropicKeyForm.test.tsx
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
}))

// Stub auth to avoid next-auth/next server resolution in test env
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import * as React from 'react'
import { Step1AnthropicKeyForm } from './Step1AnthropicKeyForm'
import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

function setupActionState(state: WelcomeActionResult) {
  vi.mocked(React.useActionState).mockReturnValue([
    state,
    vi.fn() as unknown as React.DispatchWithoutAction,
    false,
  ])
}

describe('Step1AnthropicKeyForm', () => {
  it('renders API key label and input', () => {
    setupActionState({ ok: true })
    render(<Step1AnthropicKeyForm />)
    expect(screen.getByLabelText(/API Key/)).toBeInTheDocument()
    // password input is present (queried by name since it has no textbox role)
    expect(document.querySelector('input[name="key"]')).toBeInTheDocument()
  })

  it('renders submit button with correct label', () => {
    setupActionState({ ok: true })
    render(<Step1AnthropicKeyForm />)
    expect(screen.getByRole('button', { name: /保存并继续/ })).toBeInTheDocument()
  })

  it('shows field-level error with aria-invalid when state has field=key error', () => {
    setupActionState({ ok: false, code: 'INVALID_KEY_FORMAT', field: 'key' })
    render(<Step1AnthropicKeyForm />)
    // password inputs don't have role="textbox", query by name attribute
    const input = document.querySelector('input[name="key"]')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    // Error message text is visible (FormMessage has role="alert")
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows banner error (no aria-invalid on input) for non-field errors', () => {
    setupActionState({ ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' })
    render(<Step1AnthropicKeyForm />)
    const input = document.querySelector('input[name="key"]')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
    // Banner alert is present (Alert component has role="alert")
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('input has type="password" to mask the key', () => {
    setupActionState({ ok: true })
    render(<Step1AnthropicKeyForm />)
    // Input should be password type to avoid key exposure in screen readers
    const input = document.querySelector('input[name="key"]')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'password')
  })
})
