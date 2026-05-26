import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { tenants, users, tenantMembers } from '@honeyai/db/schema'
import { withTestDb } from './test/db'
import { seedDevTenants } from './dev-seed'

describe('seedDevTenants', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_AUTH_ENABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('inserts 4 tenants + 4 users + 4 memberships when DEV_AUTH_ENABLED=true', async () => {
    await withTestDb(async (db) => {
      await seedDevTenants(db, { devAuthEnabled: true })
      expect(await db.select().from(tenants)).toHaveLength(4)
      expect(await db.select().from(users)).toHaveLength(4)
      expect(await db.select().from(tenantMembers)).toHaveLength(4)
    })
  }, 120_000)

  it('is idempotent on re-run (ID3 onConflictDoNothing)', async () => {
    await withTestDb(async (db) => {
      await seedDevTenants(db, { devAuthEnabled: true })
      await seedDevTenants(db, { devAuthEnabled: true })
      expect(await db.select().from(tenants)).toHaveLength(4)
    })
  }, 120_000)

  it('no-op when devAuthEnabled=false', async () => {
    await withTestDb(async (db) => {
      await seedDevTenants(db, { devAuthEnabled: false })
      expect(await db.select().from(tenants)).toHaveLength(0)
    })
  }, 120_000)
})
