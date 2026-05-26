import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import RootLayout from './layout.js'

// Mock next/font to avoid network calls in tests
vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-inter', className: 'mock-inter' }),
}))

describe('RootLayout', () => {
  it('renders children inside the layout', () => {
    const { container } = render(
      <RootLayout>
        <span>test-child-content</span>
      </RootLayout>,
    )
    expect(container.textContent).toContain('test-child-content')
  })

  it('sets lang="zh-CN" on the html element', () => {
    render(
      <RootLayout>
        <span>child</span>
      </RootLayout>,
    )
    const html = document.querySelector('html')
    expect(html?.getAttribute('lang')).toBe('zh-CN')
  })
})
