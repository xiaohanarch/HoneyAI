// packages/github/src/types.ts

/** Configuration required to initialise the GitHub App singleton. */
export interface GitHubAppConfig {
  appId: number | string
  privateKey: string // PEM string
  clientId: string // OAuth app client ID
  clientSecret: string // OAuth app client secret
  webhookSecret?: string
}

/** Minimal repo metadata returned by listUserRepos / getRepo. */
export interface RepoInfo {
  id: number
  owner: string
  name: string
  fullName: string
  defaultBranch: string
  htmlUrl: string
  isPrivate: boolean
}

/** Parameters for createPR. */
export interface CreatePRParams {
  /** Octokit instance authenticated as the installation */
  octokit: OctokitLike
  owner: string
  repo: string
  /** Branch that the new head branch is forked from */
  baseBranch: string
  /** New branch to create with the commits */
  headBranch: string
  /** PR title shown on GitHub */
  title: string
  /** Files to add/update in the commit */
  files: Array<{ path: string; content: string }>
  /** HoneyAI Run UUID — embedded in PR body */
  runId: string
  /** One-sentence summary of the stage, embedded in PR body */
  stageSummary: string
}

/** Return value of createPR. */
export interface PRResult {
  prNumber: number
  prUrl: string
  /** Fully-qualified head branch name (e.g. honeyai/run-<id>) */
  branchName: string
  /** Commit SHA of the new commit */
  sha: string
}

/** Raw octokit-like interface used for dependency injection in tests. */
export type OctokitLike = {
  request: (route: string, params?: Record<string, unknown>) => Promise<{ data: unknown }>
  auth: (opts: { type: string }) => Promise<{ token: string }>
}
