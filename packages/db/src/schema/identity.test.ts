import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { eq, getTableName } from 'drizzle-orm'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'
import { withTestDb } from '../test/push-schema.js'
import { users, tenants, tenantMembers, tenantRoleEnum } from './identity.js'

describe('schema/identity — metadata', () => {
  it('tenant_role enum has values [owner, member]', () => {
    expect(tenantRoleEnum.enumValues).toEqual(['owner', 'member'])
  })

  it('users table is named "users"', () => {
    expect(getTableName(users)).toBe('users')
  })

  it('tenants table is named "tenants"', () => {
    expect(getTableName(tenants)).toBe('tenants')
  })

  it('tenantMembers table is named "tenant_members"', () => {
    expect(getTableName(tenantMembers)).toBe('tenant_members')
  })
})

describe('schema/identity — round-trip', () => {
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

  it('inserts and selects a users row with default isPlatformAdmin=false', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const id = uuidv7()
      await db.insert(users).values({
        id,
        githubId: 12345,
        githubLogin: 'octocat',
      })
      const rows = await db.select().from(users).where(eq(users.id, id))
      expect(rows).toHaveLength(1)
      expect(rows[0]?.githubLogin).toBe('octocat')
      expect(rows[0]?.isPlatformAdmin).toBe(false)
    })
  })

  it('rejects duplicate githubId via UNIQUE constraint', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      await db.insert(users).values({ id: uuidv7(), githubId: 99, githubLogin: 'a' })
      await expect(
        db.insert(users).values({ id: uuidv7(), githubId: 99, githubLogin: 'b' }),
      ).rejects.toThrow(/unique|duplicate/i)
    })
  })

  it('rejects duplicate tenants.slug via UNIQUE constraint', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      await db.insert(tenants).values({ id: uuidv7(), slug: 'acme', name: 'Acme' })
      await expect(
        db.insert(tenants).values({ id: uuidv7(), slug: 'acme', name: 'Acme 2' }),
      ).rejects.toThrow(/unique|duplicate/i)
    })
  })

  it('tenantMembers composite PK (tenantId, userId) prevents duplicate membership', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const tenantId = uuidv7()
      const userId = uuidv7()
      await db.insert(tenants).values({ id: tenantId, slug: 'co', name: 'Co' })
      await db.insert(users).values({ id: userId, githubId: 7, githubLogin: 'u' })
      await db.insert(tenantMembers).values({ tenantId, userId, role: 'owner' })
      await expect(
        db.insert(tenantMembers).values({ tenantId, userId, role: 'member' }),
      ).rejects.toThrow(/duplicate|unique|primary/i)
    })
  })
})
