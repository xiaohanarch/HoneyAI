// packages/github/src/app-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── mock @octokit/app ─────────────────────────────────────────────────────────
const mockGetInstallationOctokit = vi.fn()
const mockAuth = vi.fn()
vi.mock('@octokit/app', () => ({
  App: vi.fn().mockImplementation(() => ({
    getInstallationOctokit: mockGetInstallationOctokit,
  })),
}))

// Import after mocks
import { initGitHubApp, createAppClient, getInstallationToken, resetGitHubApp } from './app-client'
import type { GitHubAppConfig } from './types'

const FAKE_CONFIG: GitHubAppConfig = {
  appId: 12345,
  privateKey: '-----BEGIN RSA PRIVATE KEY-----\nFAKE\n-----END RSA PRIVATE KEY-----',
  clientId: 'Iv1.abc123',
  clientSecret: 'secret_abc',
  webhookSecret: 'wh_secret',
}

describe('initGitHubApp + createAppClient + getInstallationToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the singleton between tests
    initGitHubApp(FAKE_CONFIG)
  })

  // AC-02-03: createAppClient returns an authenticated Octokit-like instance
  describe('AC-02-03: createAppClient(installationId) returns Octokit instance', () => {
    it('AC-02-03: returns the octokit instance from app.getInstallationOctokit', async () => {
      const fakeOctokit = { request: vi.fn(), auth: mockAuth }
      mockGetInstallationOctokit.mockResolvedValue(fakeOctokit)

      const result = await createAppClient(42)

      expect(mockGetInstallationOctokit).toHaveBeenCalledOnce()
      expect(mockGetInstallationOctokit).toHaveBeenCalledWith(42)
      expect(result).toBe(fakeOctokit)
    })

    it('AC-02-03: throws if app not yet initialised', async () => {
      resetGitHubApp()
      await expect(createAppClient(42)).rejects.toThrow('GitHub App not initialised')
    })
  })

  // AC-02-04: getInstallationToken returns a short-lived token string
  describe('AC-02-04: getInstallationToken(installationId) returns token string', () => {
    it('AC-02-04: returns the token from octokit.auth({ type: "installation" })', async () => {
      const fakeToken = 'ghs_short_lived_token_abc'
      mockAuth.mockResolvedValue({ token: fakeToken })
      const fakeOctokit = { request: vi.fn(), auth: mockAuth }
      mockGetInstallationOctokit.mockResolvedValue(fakeOctokit)

      const token = await getInstallationToken(99)

      expect(token).toBe(fakeToken)
      expect(mockAuth).toHaveBeenCalledWith({ type: 'installation' })
    })

    it('AC-02-04: throws if octokit.auth does not return a token', async () => {
      mockAuth.mockResolvedValue({})
      const fakeOctokit = { request: vi.fn(), auth: mockAuth }
      mockGetInstallationOctokit.mockResolvedValue(fakeOctokit)

      await expect(getInstallationToken(99)).rejects.toThrow('installation token')
    })
  })
})
