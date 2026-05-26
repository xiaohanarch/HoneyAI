import { describe, it, expect, beforeEach } from 'vitest'
import { useRunStore } from './store'

describe('RunStore', () => {
  beforeEach(() => {
    useRunStore.setState({ runs: {} })
  })

  it('AC-07-03: initRun sets run state with nodes', () => {
    const nodes = [
      { id: 'n1', name: 'Stage 1', kind: 'agent' as const, status: 'pending' as const, stage: 1 },
    ]
    useRunStore.getState().initRun('run-1', 'running', nodes)
    const run = useRunStore.getState().runs['run-1']
    expect(run?.status).toBe('running')
    expect(run?.nodes).toHaveLength(1)
    expect(run?.nodes[0]?.id).toBe('n1')
  })

  it('AC-07-03: upsertNode inserts new node', () => {
    useRunStore.getState().initRun('run-1', 'running', [])
    useRunStore
      .getState()
      .upsertNode('run-1', {
        id: 'n1',
        name: 'Stage 1',
        kind: 'agent',
        status: 'running',
        stage: 1,
      })
    expect(useRunStore.getState().runs['run-1']?.nodes).toHaveLength(1)
  })

  it('AC-07-03: upsertNode updates existing node', () => {
    useRunStore
      .getState()
      .initRun('run-1', 'running', [
        { id: 'n1', name: 'Stage 1', kind: 'agent', status: 'pending', stage: 1 },
      ])
    useRunStore
      .getState()
      .upsertNode('run-1', {
        id: 'n1',
        name: 'Stage 1',
        kind: 'agent',
        status: 'success',
        stage: 1,
      })
    expect(useRunStore.getState().runs['run-1']?.nodes[0]?.status).toBe('success')
  })

  it('AC-07-03: setRunStatus updates run status', () => {
    useRunStore.getState().initRun('run-1', 'running', [])
    useRunStore.getState().setRunStatus('run-1', 'completed')
    expect(useRunStore.getState().runs['run-1']?.status).toBe('completed')
  })
})
