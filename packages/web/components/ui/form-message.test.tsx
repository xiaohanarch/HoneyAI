import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormMessage } from './form-message'

describe('FormMessage (smoke)', () => {
  it('renders children with role="alert" when children provided', () => {
    render(<FormMessage>Error text</FormMessage>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Error text')).toBeInTheDocument()
  })

  it('renders nothing when children are undefined', () => {
    render(<FormMessage />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
