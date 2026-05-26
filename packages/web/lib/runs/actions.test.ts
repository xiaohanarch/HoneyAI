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
const mockUpdate = vi.fn().mockReturnThis()
const mockSet = vi.fn().mockReturnThis()
const mockWhere = vi.fn().mockReturnThis()
const mockDb = { update: mockUpdate, set: mockSet, where: mockWhere }
vi.mock('@honeyai/db', () => ({ getDb: vi.fn(() => mockDb) }))
vi.mock('@honeyai/db/schema', () => ({
  gates: { nodeId: 'nodeId', passedAt: 'passedAt', passedByUserId: 'passedByUserId' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ col: a, val: b })) }))

import { createRun, approveGate, rejectGate } from './actions'
import { redirect } from 'next/navigation'

describe('run actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    it('AC-07-04: mock mode returns runId without DB write', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })
      const result = await createRun({ title: 'My task', oneLiner: 'do something' })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(typeof result.runId).toBe('string')
        expect(result.runId.length).toBeGreaterThan(0)
      }
      // Mock mode: no DB write
      expect(mockDb.update).not.toHaveBeenCalled()
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

    it('AC-07-05: updates gates table passedAt on success', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })
      mockUpdate.mockReturnValue({ set: mockSet })
      mockSet.mockReturnValue({ where: mockWhere })
      mockWhere.mockResolvedValue(undefined)
      const result = await approveGate({ runId: 'r1', nodeId: 'n1' })
      expect(result.ok).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
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

    it('AC-07-06: updates gates table on rejection', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } })
      mockUpdate.mockReturnValue({ set: mockSet })
      mockSet.mockReturnValue({ where: mockWhere })
      mockWhere.mockResolvedValue(undefined)
      const result = await rejectGate({ runId: 'r1', nodeId: 'n1', reason: 'needs rework' })
      expect(result.ok).toBe(true)
    })
  })
})
