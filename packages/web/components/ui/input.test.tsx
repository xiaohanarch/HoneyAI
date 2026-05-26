import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from './input'

describe('Input (shadcn primitive smoke)', () => {
  it('renders input element with placeholder', () => {
    render(<Input placeholder="x" />)
    expect(screen.getByPlaceholderText('x')).toBeInTheDocument()
  })
})
