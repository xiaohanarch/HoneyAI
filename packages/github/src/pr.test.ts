// packages/github/src/pr.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createPR } from './pr'
import type { CreatePRParams, OctokitLike } from './types'

/** Build a mock Octokit that returns canned responses for each API route. */
function makeOctokit(overrides: Partial<Record<string, unknown>> = {}): OctokitLike {
  const defaults: Record<string, unknown> = {
    'GET /repos/{owner}/{repo}/git/refs/heads/{branch}': { object: { sha: 'base_sha_abc' } },
    'POST /repos/{owner}/{repo}/git/refs': { ref: 'refs/heads/honeyai/run-run-1' },
    'POST /repos/{owner}/{repo}/git/blobs': { sha: 'blob_sha_abc' },
    'GET /repos/{owner}/{repo}/git/trees/{tree_sha}': {
      sha: 'base_tree_sha',
      tree: [],
    },
    'POST /repos/{owner}/{repo}/git/trees': { sha: 'new_tree_sha' },
    'POST /repos/{owner}/{repo}/git/commits': { sha: 'commit_sha_abc' },
    'PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}': {},
    'POST /repos/{owner}/{repo}/pulls': {
      number: 42,
      html_url: 'https://github.com/myorg/backend/pull/42',
    },
    ...overrides,
  }
  return {
    request: vi.fn().mockImplementation(async (route: string) => {
      const key = Object.keys(defaults).find((k) => k === route)
      if (key) return { data: defaults[key] }
      throw new Error(`Unexpected route in test: ${route}`)
    }),
    auth: vi.fn().mockResolvedValue({ token: '' }),
  }
}

const BASE_PARAMS: Omit<CreatePRParams, 'octokit'> = {
  owner: 'myorg',
  repo: 'backend',
  baseBranch: 'main',
  headBranch: 'honeyai/run-run-1',
  title: 'HoneyAI: implement feature X',
  files: [
    { path: 'src/feature.ts', content: 'export const x = 1' },
    { path: 'src/feature.test.ts', content: 'test("x", () => {})' },
  ],
  runId: 'run-1',
  stageSummary: 'Stage 3: Coding + UT for feature X',
}

describe('createPR', () => {
  // AC-02-07: createPR creates branch + commits files + opens PR
  describe('AC-02-07: happy path — branch created, files committed, PR opened', () => {
    it('AC-02-07: returns PRResult with prNumber, prUrl, branchName, sha', async () => {
      const octokit = makeOctokit()
      const result = await createPR({ ...BASE_PARAMS, octokit })

      expect(result.prNumber).toBe(42)
      expect(result.prUrl).toBe('https://github.com/myorg/backend/pull/42')
      expect(result.branchName).toBe('honeyai/run-run-1')
      expect(result.sha).toBe('commit_sha_abc')
    })

    it('AC-02-07: calls POST /repos/{owner}/{repo}/pulls with correct title and branches', async () => {
      const octokit = makeOctokit()
      await createPR({ ...BASE_PARAMS, octokit })

      const requestMock = octokit.request as ReturnType<typeof vi.fn>
      const pullsCall = requestMock.mock.calls.find(
        ([route]: [string]) => route === 'POST /repos/{owner}/{repo}/pulls',
      )
      expect(pullsCall).toBeDefined()
      expect(pullsCall![1]).toMatchObject({
        title: 'HoneyAI: implement feature X',
        head: 'honeyai/run-run-1',
        base: 'main',
      })
    })
  })

  // AC-02-08: PR body contains Run ID and Stage summary
  describe('AC-02-08: PR body contains Run ID and stage summary', () => {
    it('AC-02-08: PR body includes run ID', async () => {
      const octokit = makeOctokit()
      await createPR({ ...BASE_PARAMS, octokit })

      const requestMock = octokit.request as ReturnType<typeof vi.fn>
      const pullsCall = requestMock.mock.calls.find(
        ([route]: [string]) => route === 'POST /repos/{owner}/{repo}/pulls',
      )
      const body: string = pullsCall![1].body as string
      expect(body).toContain('run-1')
      expect(body).toContain('Stage 3: Coding + UT for feature X')
    })

    it('AC-02-08: PR body has HoneyAI attribution section', async () => {
      const octokit = makeOctokit()
      await createPR({ ...BASE_PARAMS, octokit })

      const requestMock = octokit.request as ReturnType<typeof vi.fn>
      const pullsCall = requestMock.mock.calls.find(
        ([route]: [string]) => route === 'POST /repos/{owner}/{repo}/pulls',
      )
      const body: string = pullsCall![1].body as string
      expect(body).toContain('HoneyAI')
    })
  })
})
