// packages/github/src/pr.ts
import type { CreatePRParams, PRResult } from './types'

/**
 * Builds the PR body markdown string.
 * AC-02-08
 */
function buildPRBody(runId: string, stageSummary: string): string {
  return [
    '## HoneyAI DevPipeline',
    '',
    '> 本 PR 由 HoneyAI 自动生成。',
    '',
    '### Run 信息',
    '',
    '| 字段 | 值 |',
    '|---|---|',
    `| Run ID | \`${runId}\` |`,
    `| 阶段摘要 | ${stageSummary} |`,
    '',
    '---',
    '',
    '_如有问题，请在对应 Run 详情页操作重试或联系管理员。_',
  ].join('\n')
}

/**
 * Creates a branch, commits files, and opens a GitHub PR.
 * AC-02-07, AC-02-08
 */
export async function createPR(params: CreatePRParams): Promise<PRResult> {
  const { octokit, owner, repo, baseBranch, headBranch, title, files, runId, stageSummary } = params

  // 1. Get base branch SHA
  const { data: refData } = (await octokit.request(
    'GET /repos/{owner}/{repo}/git/refs/heads/{branch}',
    { owner, repo, branch: baseBranch },
  )) as { data: { object: { sha: string } } }
  const baseSha = refData.object.sha

  // 2. Create head branch
  await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
    owner,
    repo,
    ref: `refs/heads/${headBranch}`,
    sha: baseSha,
  })

  // 3. Create blobs for each file
  const blobShas = await Promise.all(
    files.map(async (f) => {
      const { data: blob } = (await octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
        owner,
        repo,
        content: Buffer.from(f.content).toString('base64'),
        encoding: 'base64',
      })) as { data: { sha: string } }
      return { path: f.path, sha: blob.sha }
    }),
  )

  // 4. Get base tree SHA
  const { data: baseTree } = (await octokit.request(
    'GET /repos/{owner}/{repo}/git/trees/{tree_sha}',
    { owner, repo, tree_sha: baseSha },
  )) as { data: { sha: string } }

  // 5. Create new tree
  const { data: newTree } = (await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
    owner,
    repo,
    base_tree: baseTree.sha,
    tree: blobShas.map(({ path, sha }) => ({
      path,
      mode: '100644',
      type: 'blob',
      sha,
    })),
  })) as { data: { sha: string } }

  // 6. Create commit
  const { data: commit } = (await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
    owner,
    repo,
    message: `feat: ${title}\n\n[honeyai-run:${runId}]`,
    tree: newTree.sha,
    parents: [baseSha],
  })) as { data: { sha: string } }

  // 7. Update head branch ref
  await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}', {
    owner,
    repo,
    branch: headBranch,
    sha: commit.sha,
    force: false,
  })

  // 8. Open PR
  const { data: pr } = (await octokit.request('POST /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    title,
    body: buildPRBody(runId, stageSummary),
    head: headBranch,
    base: baseBranch,
  })) as { data: { number: number; html_url: string } }

  return {
    prNumber: pr.number,
    prUrl: pr.html_url,
    branchName: headBranch,
    sha: commit.sha,
  }
}
