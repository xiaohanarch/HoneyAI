import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeStatusIcon } from './NodeStatusIcon'

describe('NodeStatusIcon', () => {
  it('renders pending icon', () => {
    const { container } = render(<NodeStatusIcon status="pending" kind="agent" />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders running icon with pulse class', () => {
    const { container } = render(<NodeStatusIcon status="running" kind="agent" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('pulse-run')
  })

  it('renders success icon', () => {
    const { container } = render(<NodeStatusIcon status="success" kind="agent" />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders failed icon', () => {
    const { container } = render(<NodeStatusIcon status="failed" kind="agent" />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders gate kind differently', () => {
    const { container } = render(<NodeStatusIcon status="pending" kind="gate" />)
    expect(container.firstChild).toBeTruthy()
  })
})
