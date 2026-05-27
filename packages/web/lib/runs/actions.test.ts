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
// mockValues returns a thenable that also has .onConflictDoNothing(), so it satisfies
// both direct-await inserts (runs, artifacts) and chained inserts (artifactBlobs).
const mockValues = vi.fn().mockImplementation(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = Promise.resolve(undefined) as any
  result.onConflictDoNothing = vi.fn().mockResolvedValue(undefined)
  return result
})
const mockInsert = vi.fn().mockReturnValue({ values: mockValues })
const mockSelect = vi.fn()

// db.transaction executes the callback with a tx that has the same insert/select shape
const mockTransaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
  await cb({ insert: mockInsert, select: mockSelect })
})

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  transaction: mockTransaction,
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

// Mock bullmq Queue — factory must be self-contained (hoisting constraint)
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}))

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
  // Fresh Queue instance mock rebuilt each test so clearAllMocks doesn't orphan references
  let mockQueueInstance: { add: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure REDIS_URL is present for happy-path tests; individual tests override as needed
    process.env['REDIS_URL'] = 'redis://localhost:6379'
    // Re-provision defaults cleared by clearAllMocks
    mockDecryptAnthropicKey.mockReturnValue('sk-ant-real-key')
    mockValues.mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = Promise.resolve(undefined) as any
      result.onConflictDoNothing = vi.fn().mockResolvedValue(undefined)
      return result
    })
    mockInsert.mockReturnValue({ values: mockValues })
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({ insert: mockInsert, select: mockSelect })
    })
    // Fresh queue instance for each test
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

      const result = await createRun({ title: 'My task', oneLiner: 'do something' })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(typeof result.runId).toBe('string')
        expect(result.runId.length).toBeGreaterThan(0)
      }
      // Transaction should have been used for DB inserts
      expect(mockDb.transaction).toHaveBeenCalled()
      // Queue.add called with scheduleRun job
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'scheduleRun',
        expect.objectContaining({ tenantId: 't1' }),
      )
      // Queue.close must be called (try/finally guarantee)
      expect(mockQueueInstance.close).toHaveBeenCalled()
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

    it('AC-02-03b: createRun returns NO_ANTHROPIC_KEY when decryptAnthropicKey throws', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })
      mockDecryptAnthropicKey.mockImplementation(() => {
        throw new Error('decryptAnthropicKey: malformed envelope')
      })

      const tenantRow = {
        id: 't1',
        defaultRepoId: 'repo-1',
        settings: { bootstrap: { anthropicKeyCiphertext: 'bad-ciphertext' } },
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

    it('AC-02-07: createRun returns error when REDIS_URL not configured', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })

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

      const savedRedisUrl = process.env['REDIS_URL']
      delete process.env['REDIS_URL']

      try {
        const result = await createRun({ title: 'test', oneLiner: 'do something' })
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.code).toBe('REDIS_NOT_CONFIGURED')
        }
      } finally {
        if (savedRedisUrl !== undefined) {
          process.env['REDIS_URL'] = savedRedisUrl
        }
      }
    })

    it('AC-02-20: createRun returns INVALID_INPUT for empty title', async () => {
      mockAuth.mockResolvedValue({
        user: { tenantId: 'tenant-1', id: 'user-1', tenantSlug: 'acme' },
      })
      const result = await createRun({ title: '   ', oneLiner: 'valid requirement' })
      expect(result).toEqual({ ok: false, code: 'INVALID_INPUT' })
    })

    it('AC-02-21: createRun returns INVALID_INPUT for empty oneLiner', async () => {
      mockAuth.mockResolvedValue({
        user: { tenantId: 'tenant-1', id: 'user-1', tenantSlug: 'acme' },
      })
      const result = await createRun({ title: 'valid title', oneLiner: '' })
      expect(result).toEqual({ ok: false, code: 'INVALID_INPUT' })
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

      const runId = '11111111-1111-1111-1111-111111111111'
      const nodeId = '22222222-2222-2222-2222-222222222222'
      const result = await approveGate({ runId, nodeId })

      expect(result.ok).toBe(true)
      expect(mockPassGate).toHaveBeenCalledWith(mockDb, nodeId, 'u1')
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'advanceRun',
        expect.objectContaining({ runId, tenantId: 't1', completedNodeId: nodeId }),
      )
      // Queue.close must be called (try/finally guarantee)
      expect(mockQueueInstance.close).toHaveBeenCalled()
    })

    it('AC-02-05: approveGate returns GATE_NOT_VIEWED when gate not viewed', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })
      mockPassGate.mockResolvedValue({ ok: false, reason: 'not_viewed' })

      const result = await approveGate({
        runId: '11111111-1111-1111-1111-111111111111',
        nodeId: '22222222-2222-2222-2222-222222222222',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('GATE_NOT_VIEWED')
      }
    })

    it('AC-02-22: approveGate returns INVALID_INPUT for non-UUID nodeId', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })
      const result = await approveGate({ runId: 'not-a-uuid', nodeId: 'also-not-a-uuid' })
      expect(result).toEqual({ ok: false, code: 'INVALID_INPUT' })
    })
  })

  describe('rejectGate', () => {
    it('AC-07-06: returns error when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const result = await rejectGate({ runId: 'r1', nodeId: 'n1' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('UNAUTHENTICATED')
      }
    })

    it('AC-02-06: rejectGate calls resumeFromGate with reject decision', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })
      mockResumeFromGate.mockResolvedValue(undefined)

      const runId = '11111111-1111-1111-1111-111111111111'
      const nodeId = '22222222-2222-2222-2222-222222222222'
      const result = await rejectGate({ runId, nodeId })

      expect(result.ok).toBe(true)
      expect(mockResumeFromGate).toHaveBeenCalledWith(mockDb, runId, nodeId, 'u1', 'reject')
    })

    it('AC-02-06b: rejectGate returns REJECT_FAILED when resumeFromGate throws', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })
      mockResumeFromGate.mockRejectedValue(new Error('DB error'))

      const result = await rejectGate({
        runId: '11111111-1111-1111-1111-111111111111',
        nodeId: '22222222-2222-2222-2222-222222222222',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('REJECT_FAILED')
      }
    })
  })
})
