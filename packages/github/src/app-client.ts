// packages/github/src/app-client.ts
import { App } from '@octokit/app'
import type { GitHubAppConfig, OctokitLike } from './types'

let _app: App | null = null

/** Initialise (or re-initialise) the singleton GitHub App instance. */
export function initGitHubApp(config: GitHubAppConfig): App {
  _app = new App({
    appId: config.appId,
    privateKey: config.privateKey,
    oauth: { clientId: config.clientId, clientSecret: config.clientSecret },
    ...(config.webhookSecret ? { webhooks: { secret: config.webhookSecret } } : {}),
  })
  return _app
}

/** Reset singleton — used in tests only. */
export function resetGitHubApp(): void {
  _app = null
}

function requireApp(): App {
  if (!_app) throw new Error('GitHub App not initialised. Call initGitHubApp first.')
  return _app
}

/**
 * Returns an Octokit instance authenticated as the given installation.
 * AC-02-03
 */
export async function createAppClient(installationId: number): Promise<OctokitLike> {
  const app = requireApp()
  return app.getInstallationOctokit(installationId) as unknown as OctokitLike
}

/**
 * Retrieves the short-lived installation token string.
 * AC-02-04
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const octokit = await createAppClient(installationId)
  const authResult = (await octokit.auth({ type: 'installation' })) as { token?: string }
  if (!authResult.token) {
    throw new Error('Failed to obtain installation token: auth() returned no token')
  }
  return authResult.token
}
