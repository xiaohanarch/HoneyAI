import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSSE } from './sse'
import { useRunStore } from './store'

// Mock EventSource globally
class MockEventSource {
  url: string
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  close = vi.fn()
  constructor(url: string) {
    this.url = url
  }
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}

let mockES: MockEventSource
vi.stubGlobal(
  'EventSource',
  vi.fn((url: string) => {
    mockES = new MockEventSource(url)
    return mockES
  }),
)

describe('useSSE', () => {
  beforeEach(() => {
    useRunStore.setState({ runs: {} })
    vi.clearAllMocks()
  })

  it('opens EventSource for runId', () => {
    renderHook(() => useSSE('run-123'))
    expect(EventSource).toHaveBeenCalledWith('/api/runs/run-123/stream')
  })

  it('dispatches node_status event to RunStore', () => {
    renderHook(() => useSSE('run-1'))
    useRunStore.getState().initRun('run-1', 'running', [])
    mockES.simulateMessage({
      type: 'node_status',
      nodeId: 'n1',
      nodeName: 'Stage 1',
      nodeKind: 'agent',
      nodeStage: 1,
      status: 'running',
      ts: Date.now(),
    })
    expect(useRunStore.getState().runs['run-1']?.nodes[0]?.status).toBe('running')
  })

  it('dispatches run_status event to RunStore', () => {
    useRunStore.getState().initRun('run-1', 'running', [])
    renderHook(() => useSSE('run-1'))
    mockES.simulateMessage({ type: 'run_status', status: 'completed', ts: Date.now() })
    expect(useRunStore.getState().runs['run-1']?.status).toBe('completed')
  })

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useSSE('run-1'))
    unmount()
    expect(mockES.close).toHaveBeenCalled()
  })
})
