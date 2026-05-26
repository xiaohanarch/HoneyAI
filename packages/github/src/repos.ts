// packages/github/src/repos.ts
import type { OctokitLike, RepoInfo } from './types'

interface GitHubRepo {
  id: number
  owner: { login: string }
  name: string
  full_name: string
  default_branch: string
  html_url: string
  private: boolean
}

function mapRepo(r: GitHubRepo): RepoInfo {
  return {
    id: r.id,
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
    isPrivate: r.private,
  }
}

/**
 * Lists all repositories accessible to the given installation Octokit.
 * AC-02-05
 */
export async function listUserRepos(octokit: OctokitLike): Promise<RepoInfo[]> {
  const { data } = (await octokit.request('GET /installation/repositories')) as {
    data: { repositories: GitHubRepo[] }
  }
  return (data.repositories ?? []).map(mapRepo)
}

/**
 * Fetches a single repository by owner and name.
 * AC-02-06
 */
export async function getRepo(
  octokit: OctokitLike,
  owner: string,
  repo: string,
): Promise<RepoInfo> {
  const { data } = (await octokit.request('GET /repos/{owner}/{repo}', {
    owner,
    repo,
  })) as { data: GitHubRepo }
  return mapRepo(data)
}
