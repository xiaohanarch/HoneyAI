// packages/github/src/repos.test.ts
import { describe, it, expect, vi } from 'vitest'
import { listUserRepos, getRepo } from './repos'
import type { OctokitLike } from './types'

function makeOctokit(responses: Record<string, unknown>): OctokitLike {
  return {
    request: vi.fn().mockImplementation(async (route: string) => {
      if (route in responses) return { data: responses[route] }
      throw new Error(`Unexpected route: ${route}`)
    }),
    auth: vi.fn().mockResolvedValue({ token: '' }),
  }
}

// GitHub API fixture for installation repositories
const INSTALLATION_REPOS_RESPONSE = {
  total_count: 2,
  repositories: [
    {
      id: 1,
      owner: { login: 'myorg' },
      name: 'backend',
      full_name: 'myorg/backend',
      default_branch: 'main',
      html_url: 'https://github.com/myorg/backend',
      private: false,
    },
    {
      id: 2,
      owner: { login: 'myorg' },
      name: 'frontend',
      full_name: 'myorg/frontend',
      default_branch: 'main',
      html_url: 'https://github.com/myorg/frontend',
      private: true,
    },
  ],
}

const SINGLE_REPO_RESPONSE = {
  id: 1,
  owner: { login: 'myorg' },
  name: 'backend',
  full_name: 'myorg/backend',
  default_branch: 'main',
  html_url: 'https://github.com/myorg/backend',
  private: false,
}

describe('listUserRepos', () => {
  // AC-02-05: listUserRepos returns mapped RepoInfo array
  it('AC-02-05: maps GitHub API response to RepoInfo[]', async () => {
    const octokit = makeOctokit({ 'GET /installation/repositories': INSTALLATION_REPOS_RESPONSE })

    const repos = await listUserRepos(octokit)

    expect(repos).toHaveLength(2)
    expect(repos[0]).toEqual({
      id: 1,
      owner: 'myorg',
      name: 'backend',
      fullName: 'myorg/backend',
      defaultBranch: 'main',
      htmlUrl: 'https://github.com/myorg/backend',
      isPrivate: false,
    })
    expect(repos[1]?.isPrivate).toBe(true)
  })

  it('AC-02-05: returns empty array when installation has no repos', async () => {
    const octokit = makeOctokit({
      'GET /installation/repositories': { total_count: 0, repositories: [] },
    })
    const repos = await listUserRepos(octokit)
    expect(repos).toEqual([])
  })

  it('AC-02-05: throws when GitHub API returns an error', async () => {
    const octokit: OctokitLike = {
      request: vi.fn().mockRejectedValue(new Error('HTTP 401')),
      auth: vi.fn().mockResolvedValue({ token: '' }),
    }
    await expect(listUserRepos(octokit)).rejects.toThrow('HTTP 401')
  })
})

describe('getRepo', () => {
  // AC-02-06: getRepo returns a single RepoInfo
  it('AC-02-06: returns mapped RepoInfo for valid owner/repo', async () => {
    const octokit = makeOctokit({ 'GET /repos/{owner}/{repo}': SINGLE_REPO_RESPONSE })

    const repo = await getRepo(octokit, 'myorg', 'backend')

    expect(repo).toEqual({
      id: 1,
      owner: 'myorg',
      name: 'backend',
      fullName: 'myorg/backend',
      defaultBranch: 'main',
      htmlUrl: 'https://github.com/myorg/backend',
      isPrivate: false,
    })
  })

  it('AC-02-06: throws when repo not found', async () => {
    const octokit: OctokitLike = {
      request: vi.fn().mockRejectedValue(new Error('HTTP 404')),
      auth: vi.fn().mockResolvedValue({ token: '' }),
    }
    await expect(getRepo(octokit, 'myorg', 'missing')).rejects.toThrow('HTTP 404')
  })
})
