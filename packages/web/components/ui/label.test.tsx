import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Label } from './label'

describe('Label (shadcn primitive smoke)', () => {
  it('renders with text and htmlFor attribute', () => {
    render(<Label htmlFor="f">L</Label>)
    const el = screen.getByText('L')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('for', 'f')
  })
})
