import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

// Mock next/cache
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Mock auth
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

// Mock DB
const mockInsert = vi.fn()
const mockUpdate = vi.fn().mockReturnThis()
const mockSet = vi.fn().mockReturnThis()
const mockWhere = vi.fn().mockReturnThis()
const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined)
const mockSelect = vi.fn()

const mockDb = {
  update: mockUpdate,
  set: mockSet,
  where: mockWhere,
  insert: mockInsert,
  select: mockSelect,
}
vi.mock('@honeyai/db', () => ({ getDb: vi.fn(() => mockDb) }))
vi.mock('@honeyai/db/schema', () => ({
  gates: { nodeId: 'nodeId', passedAt: 'passedAt', passedByUserId: 'passedByUserId' },
  runs: {},
  artifacts: {},
  artifactBlobs: {},
  tenants: {},
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ col: a, val: b })) }))

// Mock orchestrator
const mockPassGate = vi.fn()
const mockResumeFromGate = vi.fn()
vi.mock('@honeyai/orchestrator', () => ({
  passGate: (...args: unknown[]) => mockPassGate(...args),
  resumeFromGate: (...args: unknown[]) => mockResumeFromGate(...args),
}))

// Mock bullmq Queue — the factory must not reference outer variables (hoisting).
// We create a stable add/close pair that gets reused per-instance via the factory.
const _queueAdd = vi.fn().mockResolvedValue(undefined)
const _queueClose = vi.fn().mockResolvedValue(undefined)
vi.mock('bullmq', () => {
  const addFn = vi.fn().mockResolvedValue(undefined)
  const closeFn = vi.fn().mockResolvedValue(undefined)
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: addFn,
      close: closeFn,
    })),
    // expose fns so tests can check them
    __addFn: addFn,
    __closeFn: closeFn,
  }
})

// Mock @honeyai/worker queue constants
vi.mock('@honeyai/worker', () => ({
  SCHEDULE_RUN_QUEUE: 'schedule-run',
  ADVANCE_RUN_QUEUE: 'advance-run',
}))

// Mock @honeyai/core decryptAnthropicKey
const mockDecryptAnthropicKey = vi.fn().mockReturnValue('sk-ant-real-key')
vi.mock('@honeyai/core', () => ({
  decryptAnthropicKey: (...args: unknown[]) => mockDecryptAnthropicKey(...args),
}))

import { createRun, approveGate, rejectGate } from './actions'
import { Queue } from 'bullmq'

describe('run actions', () => {
  // Capture the stable add/close mocks from the bullmq module after import
  // Queue is a vi.fn() constructor — each new Queue() returns the same mock instance
  let mockQueueInstance: { add: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    // Re-provision default resolved values after clearAllMocks
    mockDecryptAnthropicKey.mockReturnValue('sk-ant-real-key')
    // Set up a fresh queue instance mock for each test
    const addFn = vi.fn().mockResolvedValue(undefined)
    const closeFn = vi.fn().mockResolvedValue(undefined)
    mockQueueInstance = { add: addFn, close: closeFn }
    ;(Queue as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockQueueInstance)
  })

  describe('createRun', () => {
    it('AC-07-04: returns error when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const result = await createRun({ title: 'test', oneLiner: 'a test' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHENTICATED')
      }
    })

    it('AC-07-04: returns error when no tenantId', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: null, tenantSlug: null } })
      const result = await createRun({ title: 'test', oneLiner: 'a test' })
      expect(result.ok).toBe(false)
    })

    it('AC-02-01: createRun inserts run row and enqueues scheduleRun job', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })

      // Mock tenant SELECT returning tenant with defaultRepoId + anthropicKeyCiphertext
      const tenantRow = {
        id: 't1',
        defaultRepoId: 'repo-1',
        settings: { bootstrap: { anthropicKeyCiphertext: 'v1:c2stYW50LXJlYWwta2V5' } },
      }
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([tenantRow]),
        }),
      })

      // Mock insert chaining for all three insert calls
      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: mockOnConflictDoNothing,
        }),
      })

      const result = await createRun({ title: 'My task', oneLiner: 'do something' })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(typeof result.runId).toBe('string')
        expect(result.runId.length).toBeGreaterThan(0)
      }
      // DB insert should have been called (runs, artifactBlobs, artifacts)
      expect(mockDb.insert).toHaveBeenCalled()
      // Queue.add should have been called with scheduleRun job
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'scheduleRun',
        expect.objectContaining({ tenantId: 't1' }),
      )
    })

    it('AC-02-02: createRun returns NO_DEFAULT_REPO when tenant has no defaultRepoId', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })

      const tenantRow = {
        id: 't1',
        defaultRepoId: null,
        settings: { bootstrap: { anthropicKeyCiphertext: 'v1:c2stYW50LXJlYWwta2V5' } },
      }
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([tenantRow]),
        }),
      })

      const result = await createRun({ title: 'test', oneLiner: 'do something' })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('NO_DEFAULT_REPO')
      }
    })

    it('AC-02-03: createRun returns NO_ANTHROPIC_KEY when settings missing', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })

      const tenantRow = {
        id: 't1',
        defaultRepoId: 'repo-1',
        settings: {},
      }
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([tenantRow]),
        }),
      })

      const result = await createRun({ title: 'test', oneLiner: 'do something' })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('NO_ANTHROPIC_KEY')
      }
    })
  })

  describe('approveGate', () => {
    it('AC-07-05: returns error when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const result = await approveGate({ runId: 'r1', nodeId: 'n1' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHENTICATED')
      }
    })

    it('AC-02-04: approveGate calls passGate and enqueues advanceRun job', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })
      mockPassGate.mockResolvedValue({ ok: true })

      const result = await approveGate({ runId: 'r1', nodeId: 'n1' })

      expect(result.ok).toBe(true)
      expect(mockPassGate).toHaveBeenCalledWith(mockDb, 'n1', 'u1')
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'advanceRun',
        expect.objectContaining({ runId: 'r1', tenantId: 't1', completedNodeId: 'n1' }),
      )
    })

    it('AC-02-05: approveGate returns GATE_NOT_VIEWED when gate not viewed', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })
      mockPassGate.mockResolvedValue({ ok: false, reason: 'not_viewed' })

      const result = await approveGate({ runId: 'r1', nodeId: 'n1' })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('GATE_NOT_VIEWED')
      }
    })
  })

  describe('rejectGate', () => {
    it('AC-07-06: returns error when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const result = await rejectGate({ runId: 'r1', nodeId: 'n1', reason: 'not good' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHENTICATED')
      }
    })

    it('AC-02-06: rejectGate calls resumeFromGate with reject decision', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })
      mockResumeFromGate.mockResolvedValue(undefined)

      const result = await rejectGate({ runId: 'r1', nodeId: 'n1', reason: 'needs rework' })

      expect(result.ok).toBe(true)
      expect(mockResumeFromGate).toHaveBeenCalledWith(mockDb, 'r1', 'n1', 'u1', 'reject')
    })
  })
})
