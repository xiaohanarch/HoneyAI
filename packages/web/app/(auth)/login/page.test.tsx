import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next-auth/react to avoid real network calls
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}))

// Mock next/navigation to avoid router context requirement
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  redirect: vi.fn(),
}))

// Import the client LoginForm directly (the page wraps it)
import LoginForm from './LoginForm.js'

describe('LoginForm', () => {
  it('renders a username input field', () => {
    render(<LoginForm />)
    const input = screen.getByPlaceholderText('用户名')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
  })

  it('renders a password input field', () => {
    render(<LoginForm />)
    const input = screen.getByPlaceholderText('密码')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'password')
  })

  it('renders a submit button with correct label', () => {
    render(<LoginForm />)
    const button = screen.getByRole('button', { name: '登录' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('submit button is present and enabled by default', () => {
    render(<LoginForm />)
    const button = screen.getByRole('button', { name: '登录' })
    expect(button).not.toBeDisabled()
  })
})
