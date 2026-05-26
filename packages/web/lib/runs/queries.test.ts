import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DB
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockOrderBy = vi.fn()
const mockLimit = vi.fn()
const mockOffset = vi.fn()

const mockDb = {
  select: vi.fn(() => ({ from: mockFrom })),
}
mockFrom.mockReturnValue({ where: mockWhere })
mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
mockOrderBy.mockReturnValue({ limit: mockLimit })
mockLimit.mockReturnValue({ offset: mockOffset })
mockOffset.mockResolvedValue([])

vi.mock('@honeyai/db', () => ({
  getDb: vi.fn(() => mockDb),
  repos: {
    listRunsByTenant: vi.fn(),
    getRun: vi.fn(),
  },
}))
vi.mock('@honeyai/db/schema', () => ({
  nodes: { runId: 'run_id' },
  runs: { id: 'id' },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ col: a, val: b })),
  desc: vi.fn((col) => ({ desc: col })),
}))

import { listRuns, getRunWithNodes } from './queries'
import { repos, getDb } from '@honeyai/db'

describe('run queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    mockOrderBy.mockReturnValue({ limit: mockLimit })
    mockLimit.mockReturnValue({ offset: mockOffset })
    mockOffset.mockResolvedValue([])
  })

  describe('listRuns', () => {
    it('calls listRunsByTenant with tenantId and options', async () => {
      vi.mocked(repos.listRunsByTenant).mockResolvedValue([])
      const result = await listRuns('tenant-1')
      expect(repos.listRunsByTenant).toHaveBeenCalledWith(
        expect.anything(),
        'tenant-1',
        expect.anything(),
      )
      expect(result).toEqual([])
    })

    it('passes limit and offset options', async () => {
      vi.mocked(repos.listRunsByTenant).mockResolvedValue([])
      await listRuns('tenant-1', { limit: 10, offset: 20 })
      expect(repos.listRunsByTenant).toHaveBeenCalledWith(expect.anything(), 'tenant-1', {
        limit: 10,
        offset: 20,
      })
    })
  })

  describe('getRunWithNodes', () => {
    it('returns null when run not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      const result = await getRunWithNodes('no-such-run')
      expect(result).toBeNull()
    })

    it('returns run with nodes when found', async () => {
      const mockRun = {
        id: 'run-1',
        status: 'running',
        tenantId: 't1',
        title: 'test',
        oneLiner: 'do it',
        repositoryId: 'r1',
        createdByUserId: 'u1',
        targetBranch: 'main',
        failureClass: null,
        failureMessage: null,
        runtime: 'claude_code',
        startedAt: null,
        finishedAt: null,
        totalCostMicroUsd: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never
      const mockNode = {
        id: 'n1',
        runId: 'run-1',
        name: 'Stage 1',
        kind: 'agent',
        status: 'pending',
        stage: 1,
        ordinal: 0,
      } as never

      // First select call returns run, second returns nodes
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockRun]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockNode]),
          }),
        })

      const result = await getRunWithNodes('run-1')
      expect(result).not.toBeNull()
      expect(result?.run.id).toBe('run-1')
      expect(result?.nodes).toHaveLength(1)
    })
  })
})
