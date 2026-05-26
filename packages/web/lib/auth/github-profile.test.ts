// packages/web/lib/auth/github-profile.test.ts
import { beforeEach, describe, it, expect, vi } from 'vitest'

// Mock getDb from @honeyai/db
const mockOnConflictDoUpdate = vi.fn()
const mockValues = vi.fn()
vi.mock('@honeyai/db', () => ({
  getDb: () => ({
    insert: () => ({
      values: (v: unknown) => {
        mockValues(v)
        return {
          onConflictDoUpdate: mockOnConflictDoUpdate,
        }
      },
    }),
  }),
}))

// Mock @honeyai/db/schema
vi.mock('@honeyai/db/schema', () => ({
  users: { githubId: 'github_id_col_ref' },
}))

// Mock drizzle-orm
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual }
})

// Mock uuid
vi.mock('uuid', () => ({
  v7: () => 'mock-uuid-v7',
}))

import { upsertGitHubUser } from './github-profile'
import type { GitHubUserProfile } from './github-profile'

const PROFILE: GitHubUserProfile = {
  githubId: 12345,
  githubLogin: 'alice',
  name: 'Alice Smith',
  email: 'alice@example.com',
  avatarUrl: 'https://avatars.githubusercontent.com/alice',
}

describe('upsertGitHubUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnConflictDoUpdate.mockResolvedValue(undefined)
  })

  // AC-07-03: upsert inserts new user on first GitHub sign-in
  it('AC-07-03: calls db.insert(users).values() with mapped profile fields', async () => {
    await upsertGitHubUser(PROFILE)

    expect(mockValues).toHaveBeenCalledOnce()
    const inserted = mockValues.mock.calls[0]![0] as Record<string, unknown>
    expect(inserted).toMatchObject({
      githubId: 12345,
      githubLogin: 'alice',
      name: 'Alice Smith',
      email: 'alice@example.com',
      avatarUrl: 'https://avatars.githubusercontent.com/alice',
    })
  })

  // AC-07-04: upsert updates existing user on re-login
  it('AC-07-04: calls onConflictDoUpdate to handle existing github_id', async () => {
    await upsertGitHubUser(PROFILE)
    expect(mockOnConflictDoUpdate).toHaveBeenCalledOnce()
  })

  it('AC-07-04: upserted fields include githubLogin and avatarUrl for name/avatar refresh', async () => {
    await upsertGitHubUser(PROFILE)
    const conflictArg = mockOnConflictDoUpdate.mock.calls[0]![0] as {
      set: Record<string, unknown>
    }
    expect(conflictArg.set).toMatchObject({
      githubLogin: 'alice',
      avatarUrl: 'https://avatars.githubusercontent.com/alice',
    })
  })
})
