import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GatePanel } from './GatePanel'

// Mock Server Actions
vi.mock('@/lib/runs/actions', () => ({
  approveGate: vi.fn().mockResolvedValue({ ok: true }),
  rejectGate: vi.fn().mockResolvedValue({ ok: true }),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { approveGate, rejectGate } from '@/lib/runs/actions'

describe('GatePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders approve and reject buttons', () => {
    render(<GatePanel runId="r1" nodeId="n1" tenantSlug="alice" />)
    expect(screen.getByText('通过 Gate ✓')).toBeTruthy()
    expect(screen.getByText('拒绝 Gate ✗')).toBeTruthy()
  })

  it('calls approveGate when approve clicked', async () => {
    const user = userEvent.setup()
    render(<GatePanel runId="r1" nodeId="n1" tenantSlug="alice" />)
    await user.click(screen.getByText('通过 Gate ✓'))
    expect(approveGate).toHaveBeenCalledWith({ runId: 'r1', nodeId: 'n1' })
  })

  it('shows reject reason form when reject clicked', async () => {
    const user = userEvent.setup()
    render(<GatePanel runId="r1" nodeId="n1" tenantSlug="alice" />)
    await user.click(screen.getByText('拒绝 Gate ✗'))
    expect(screen.getByPlaceholderText(/拒绝原因/)).toBeTruthy()
  })

  it('calls rejectGate with reason on confirm', async () => {
    const user = userEvent.setup()
    render(<GatePanel runId="r1" nodeId="n1" tenantSlug="alice" />)
    await user.click(screen.getByText('拒绝 Gate ✗'))
    await user.type(screen.getByPlaceholderText(/拒绝原因/), '质量不达标')
    await user.click(screen.getByText('确认拒绝'))
    expect(rejectGate).toHaveBeenCalledWith({ runId: 'r1', nodeId: 'n1', reason: '质量不达标' })
  })
})
