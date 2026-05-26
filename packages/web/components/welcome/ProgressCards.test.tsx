import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProgressCards } from './ProgressCards'

describe('ProgressCards (ADR-044/045)', () => {
  it('renders 4 cards (Anthropic / GitHub App / Repo / Skills)', () => {
    render(<ProgressCards currentStep={1} completed={[]} />)
    expect(screen.getByText(/Anthropic/)).toBeInTheDocument()
    expect(screen.getByText(/GitHub App/)).toBeInTheDocument()
    expect(screen.getByText(/仓库|Repo/)).toBeInTheDocument()
    expect(screen.getByText(/Skills/)).toBeInTheDocument()
  })

  it('current step has data-state="running"', () => {
    render(<ProgressCards currentStep={2} completed={[1]} />)
    const cards = screen.getAllByRole('listitem')
    expect(cards[1]?.getAttribute('data-state')).toBe('running')
  })

  it('completed steps have data-state="done"', () => {
    render(<ProgressCards currentStep={3} completed={[1, 2]} />)
    const cards = screen.getAllByRole('listitem')
    expect(cards[0]?.getAttribute('data-state')).toBe('done')
    expect(cards[1]?.getAttribute('data-state')).toBe('done')
  })

  it('upcoming steps have data-state="idle"', () => {
    render(<ProgressCards currentStep={1} completed={[]} />)
    const cards = screen.getAllByRole('listitem')
    expect(cards[3]?.getAttribute('data-state')).toBe('idle')
  })

  it('running step exposes aria-current="step" (a11y)', () => {
    render(<ProgressCards currentStep={2} completed={[1]} />)
    const cards = screen.getAllByRole('listitem')
    expect(cards[1]?.getAttribute('aria-current')).toBe('step')
    expect(cards[0]?.getAttribute('aria-current')).toBeNull()
    expect(cards[2]?.getAttribute('aria-current')).toBeNull()
  })
})
