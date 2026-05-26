import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunTimeline } from './RunTimeline'
import { useRunStore } from '@/lib/runs/store'

// Mock NodeStatusIcon to keep tests simple
vi.mock('@/components/run/NodeStatusIcon', () => ({
  NodeStatusIcon: ({ status }: { status: string }) => (
    <span data-testid="status-icon" data-status={status} />
  ),
}))

describe('RunTimeline', () => {
  beforeEach(() => {
    useRunStore.setState({ runs: {} })
  })

  it('renders empty state when no nodes', () => {
    useRunStore.setState({ runs: { 'run-1': { runId: 'run-1', status: 'running', nodes: [] } } })
    const { container } = render(<RunTimeline runId="run-1" />)
    const list = container.querySelector('ol')
    expect(list?.children.length).toBe(0)
  })

  it('renders all nodes with names', () => {
    useRunStore.setState({
      runs: {
        'run-1': {
          runId: 'run-1',
          status: 'running',
          nodes: [
            { id: 'n1', name: 'Stage 1', kind: 'agent', status: 'success', stage: 1 },
            { id: 'n2', name: 'Gate 1', kind: 'gate', status: 'running', stage: 1 },
          ],
        },
      },
    })
    render(<RunTimeline runId="run-1" />)
    expect(screen.getByText('Stage 1')).toBeTruthy()
    expect(screen.getByText('Gate 1')).toBeTruthy()
  })

  it('renders NodeStatusIcon for each node', () => {
    useRunStore.setState({
      runs: {
        'run-1': {
          runId: 'run-1',
          status: 'running',
          nodes: [{ id: 'n1', name: 'Stage 1', kind: 'agent', status: 'running', stage: 1 }],
        },
      },
    })
    render(<RunTimeline runId="run-1" />)
    const icon = screen.getByTestId('status-icon')
    expect(icon.getAttribute('data-status')).toBe('running')
  })
})
