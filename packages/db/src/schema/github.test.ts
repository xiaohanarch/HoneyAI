import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { getTableName } from 'drizzle-orm'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'
import { withTestDb } from '../test/push-schema.js'
import { users, tenants } from './identity.js'
import { githubInstallations, repositories, githubTokens } from './github.js'

describe('schema/github — metadata', () => {
  it('githubInstallations table is named "github_installations"', () => {
    expect(getTableName(githubInstallations)).toBe('github_installations')
  })

  it('repositories table is named "repositories"', () => {
    expect(getTableName(repositories)).toBe('repositories')
  })

  it('githubTokens table is named "github_tokens"', () => {
    expect(getTableName(githubTokens)).toBe('github_tokens')
  })
})

describe('schema/github — round-trip', () => {
  let handle: TestPgHandle
  let dbName: string

  beforeAll(async () => {
    handle = await startTestPostgres()
  }, 90_000)
  afterAll(async () => {
    await handle.stop()
  })
  beforeEach(async () => {
    dbName = await createTestDatabase(handle)
  })
  afterEach(async () => {
    await dropTestDatabase(handle, dbName)
  })

  it('inserts a github_installations row with accountType="Organization"', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const id = uuidv7()
      await db.insert(githubInstallations).values({
        id,
        installationId: 42,
        accountLogin: 'acme',
        accountType: 'Organization',
      })
      const rows = await db.select().from(githubInstallations)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.accountType).toBe('Organization')
      expect(rows[0]?.suspendedAt).toBeNull()
    })
  })

  it('rejects duplicate githubInstallations.installationId via UNIQUE', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      await db.insert(githubInstallations).values({
        id: uuidv7(),
        installationId: 1,
        accountLogin: 'a',
        accountType: 'User',
      })
      await expect(
        db.insert(githubInstallations).values({
          id: uuidv7(),
          installationId: 1,
          accountLogin: 'b',
          accountType: 'User',
        }),
      ).rejects.toThrow(/unique|duplicate/i)
    })
  })

  it('repositories defaults: defaultBranch="main", isEnabled=true', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const tenantId = uuidv7()
      const installationRowId = uuidv7()
      await db.insert(tenants).values({ id: tenantId, slug: 'co', name: 'Co' })
      await db.insert(githubInstallations).values({
        id: installationRowId,
        installationId: 7,
        accountLogin: 'co',
        accountType: 'Organization',
      })
      const repoId = uuidv7()
      await db.insert(repositories).values({
        id: repoId,
        tenantId,
        installationId: installationRowId,
        githubRepoId: 1001,
        owner: 'co',
        name: 'app',
      })
      const rows = await db.select().from(repositories)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.defaultBranch).toBe('main')
      expect(rows[0]?.isEnabled).toBe(true)
    })
  })

  it('repositories enforces uniq (tenantId, githubRepoId)', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const tenantId = uuidv7()
      const installationRowId = uuidv7()
      await db.insert(tenants).values({ id: tenantId, slug: 't', name: 'T' })
      await db.insert(githubInstallations).values({
        id: installationRowId,
        installationId: 8,
        accountLogin: 't',
        accountType: 'User',
      })
      await db.insert(repositories).values({
        id: uuidv7(),
        tenantId,
        installationId: installationRowId,
        githubRepoId: 2002,
        owner: 't',
        name: 'r1',
      })
      await expect(
        db.insert(repositories).values({
          id: uuidv7(),
          tenantId,
          installationId: installationRowId,
          githubRepoId: 2002,
          owner: 't',
          name: 'r2',
        }),
      ).rejects.toThrow(/unique|duplicate/i)
    })
  })

  it('githubTokens uses userId as primary key (rejects duplicate userId)', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const userId = uuidv7()
      await db.insert(users).values({ id: userId, githubId: 555, githubLogin: 'u' })
      await db.insert(githubTokens).values({
        userId,
        encryptedToken: 'aGVsbG8=',
        dekId: uuidv7(),
        scope: 'repo',
      })
      await expect(
        db.insert(githubTokens).values({
          userId,
          encryptedToken: 'd29ybGQ=',
          dekId: uuidv7(),
          scope: 'repo',
        }),
      ).rejects.toThrow(/unique|duplicate|primary/i)
    })
  })
})
