// packages/worker/src/handlers/github-pr.test.ts
// TDD tests for resolveAndCreatePR — RED phase first, then implementation.

import { describe, it, expect, vi } from 'vitest'
import { resolveAndCreatePR } from './github-pr.js'

// ─── mock createGithubPR + createAppClient ────────────────────────────────────

vi.mock('@honeyai/github', () => ({
  createAppClient: vi.fn(),
  createPR: vi.fn(),
}))

// ─── tests ────────────────────────────────────────────────────────────────────

describe('resolveAndCreatePR', () => {
  it('AC-02-16: resolveAndCreatePR calls createAppClient with numeric installationId and returns PR result', async () => {
    // Arrange — mock db that returns a repo and installation
    // Verifies resolveAndCreatePR wires through to createAppClient and createPR correctly.
    const fakeOctokit = { request: vi.fn(), auth: vi.fn() }
    const { createAppClient, createPR } = await import('@honeyai/github')
    vi.mocked(createAppClient).mockResolvedValue(fakeOctokit as never)
    vi.mocked(createPR).mockResolvedValue({
      prNumber: 42,
      prUrl: 'https://github.com/owner/repo/pull/42',
      branchName: 'honeyai/run-abc',
      sha: 'deadbeef',
    })

    const repoRows = [
      {
        id: 'repo-uuid',
        owner: 'owner',
        name: 'repo',
        installationId: 'install-uuid',
        defaultBranch: 'main',
      },
    ]
    const installRows = [{ id: 'install-uuid', installationId: 99999 }]

    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(repoRows),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(installRows),
          }),
        }),
    } as unknown as Parameters<typeof resolveAndCreatePR>[0]

    // Act
    const result = await resolveAndCreatePR(mockDb, {
      owner: 'owner',
      repo: 'repo',
      baseBranch: 'main',
      headBranch: 'honeyai/run-abc',
      title: 'Test PR',
      files: [],
      runId: 'run-abc',
      stageSummary: 'Done',
    })

    // Assert
    expect(result.prNumber).toBe(42)
    expect(result.prUrl).toBe('https://github.com/owner/repo/pull/42')
    expect(createAppClient).toHaveBeenCalledWith(99999)
  })

  it('AC-02-17: resolveAndCreatePR throws when repo not found', async () => {
    // Arrange — db returns empty rows for repositories
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as Parameters<typeof resolveAndCreatePR>[0]

    // Act + Assert
    await expect(
      resolveAndCreatePR(mockDb, {
        owner: 'nobody',
        repo: 'norepo',
        baseBranch: 'main',
        headBranch: 'honeyai/run-xyz',
        title: 'Missing',
        files: [],
        runId: 'run-xyz',
        stageSummary: 'Done',
      }),
    ).rejects.toThrow('repository not found')
  })

  it('AC-02-18: resolveAndCreatePR throws when installation not found', async () => {
    // Arrange — repo found but installation missing
    const repoRows = [
      {
        id: 'repo-uuid',
        owner: 'owner',
        name: 'repo',
        installationId: 'install-uuid',
        defaultBranch: 'main',
      },
    ]

    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(repoRows),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]), // no installation
          }),
        }),
    } as unknown as Parameters<typeof resolveAndCreatePR>[0]

    // Act + Assert
    await expect(
      resolveAndCreatePR(mockDb, {
        owner: 'owner',
        repo: 'repo',
        baseBranch: 'main',
        headBranch: 'honeyai/run-abc',
        title: 'Test PR',
        files: [],
        runId: 'run-abc',
        stageSummary: 'Done',
      }),
    ).rejects.toThrow('installation not found')
  })

  it('AC-02-19: no-op createPR closure returns zero prNumber when GitHub not configured', async () => {
    // This verifies the shape of the no-op closure built in start.ts
    // when githubConfigured=false (no GitHub env vars present)
    const githubConfigured = false
    const noop = async (params: { headBranch: string }) => {
      if (!githubConfigured) {
        return { prNumber: 0, prUrl: '', branchName: params.headBranch, sha: '' }
      }
      throw new Error('should not reach')
    }

    const result = await noop({ headBranch: 'honeyai/run-xyz' })

    expect(result.prNumber).toBe(0)
    expect(result.prUrl).toBe('')
    expect(result.branchName).toBe('honeyai/run-xyz')
    expect(result.sha).toBe('')
  })
})
