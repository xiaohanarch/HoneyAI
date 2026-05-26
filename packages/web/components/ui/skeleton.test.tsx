import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from './skeleton'

describe('Skeleton (shadcn primitive smoke)', () => {
  it('renders a div with animate-pulse class', () => {
    const { container } = render(<Skeleton data-testid="sk" className="h-8 w-32" />)
    const el = container.querySelector('[data-testid="sk"]')
    expect(el).not.toBeNull()
    expect(el?.className).toContain('animate-pulse')
  })
})
