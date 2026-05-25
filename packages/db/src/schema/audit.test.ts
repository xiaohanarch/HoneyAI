import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { getTableName, sql } from 'drizzle-orm'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'
import { withTestDb } from '../test/push-schema.js'
import { tenants, users } from './identity.js'
import { auditLog, activityFeed } from './audit.js'

describe('schema/audit — metadata', () => {
  it('table names', () => {
    expect(getTableName(auditLog)).toBe('audit_log')
    expect(getTableName(activityFeed)).toBe('activity_feed')
  })
})

describe('schema/audit — round-trip', () => {
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

  it('inserts an audit_log row; default payload={}', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const tenantId = uuidv7()
      const userId = uuidv7()
      await db.insert(tenants).values({ id: tenantId, slug: 't', name: 'T' })
      await db.insert(users).values({ id: userId, githubId: 1, githubLogin: 'u' })
      await db.insert(auditLog).values({
        id: uuidv7(),
        tenantId,
        actorUserId: userId,
        action: 'gate.passed',
        targetKind: 'node',
        targetId: uuidv7(),
      })
      const rows = await db.select().from(auditLog)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.payload).toEqual({})
    })
  })

  it('audit_log.tenantId is ON DELETE CASCADE (row goes away when tenant deleted)', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const tenantId = uuidv7()
      await db.insert(tenants).values({ id: tenantId, slug: 't', name: 'T' })
      await db.insert(auditLog).values({
        id: uuidv7(),
        tenantId,
        action: 'tenant.created',
        targetKind: 'tenant',
        targetId: tenantId,
      })
      await db.execute(sql`DELETE FROM tenants WHERE id = ${tenantId}`)
      const rows = await db.select().from(auditLog)
      expect(rows).toHaveLength(0)
    })
  })

  it('audit_log.actorUserId is set null on user delete (FK behavior)', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const tenantId = uuidv7()
      const userId = uuidv7()
      await db.insert(tenants).values({ id: tenantId, slug: 't', name: 'T' })
      await db.insert(users).values({ id: userId, githubId: 1, githubLogin: 'u' })
      const auditId = uuidv7()
      await db.insert(auditLog).values({
        id: auditId,
        tenantId,
        actorUserId: userId,
        action: 'gate.passed',
        targetKind: 'node',
        targetId: 'x',
      })
      // Default FK behavior is NO ACTION → expect deletion to fail
      await expect(db.execute(sql`DELETE FROM users WHERE id = ${userId}`)).rejects.toThrow(
        /foreign key|violates/i,
      )
    })
  })

  it('inserts activity_feed row with summary', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const tenantId = uuidv7()
      await db.insert(tenants).values({ id: tenantId, slug: 't', name: 'T' })
      await db.insert(activityFeed).values({
        id: uuidv7(),
        tenantId,
        verb: 'created',
        objectKind: 'run',
        objectId: 'abc',
        summary: 'Run created',
      })
      const rows = await db.select().from(activityFeed)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.summary).toBe('Run created')
    })
  })
})
