import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { v7 as uuidv7 } from 'uuid'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'
import * as schema from '../schema/index.js'
import { withTenant } from './with-tenant.js'
import { tenants, users } from '../schema/identity.js'
import { githubInstallations, repositories } from '../schema/github.js'
import { runs } from '../schema/runs.js'
import { auditLog } from '../schema/audit.js'

let handle: TestPgHandle
let dbName: string
let pool: Pool
let rawDb: NodePgDatabase<typeof schema>

beforeAll(async () => {
  handle = await startTestPostgres()
}, 90_000)

afterAll(async () => {
  await handle.stop()
})

beforeEach(async () => {
  dbName = await createTestDatabase(handle)
  pool = new Pool({ connectionString: testDatabaseUrl(handle, dbName) })
  rawDb = drizzle(pool, { schema })
})

afterEach(async () => {
  await pool.end()
  await dropTestDatabase(handle, dbName)
})

/**
 * Seed 2 tenants + 1 user + 1 installation + 2 repos + 1 run per tenant.
 * Returns ids needed by AC-03-01/02 tests.
 */
async function seedTwoTenants(db: NodePgDatabase<typeof schema>) {
  const tenantA = { id: uuidv7(), slug: 'tenant-a', name: 'Tenant A', kind: 'personal' as const }
  const tenantB = { id: uuidv7(), slug: 'tenant-b', name: 'Tenant B', kind: 'personal' as const }
  await db.insert(tenants).values([tenantA, tenantB])

  const user = { id: uuidv7(), githubId: 1001, githubLogin: 'user-a' }
  await db.insert(users).values(user)

  const inst = {
    id: uuidv7(),
    installationId: 9001,
    accountLogin: 'acme',
    accountType: 'Organization' as const,
  }
  await db.insert(githubInstallations).values(inst)

  const repoA = {
    id: uuidv7(),
    tenantId: tenantA.id,
    installationId: inst.id,
    githubRepoId: 1,
    owner: 'acme',
    name: 'repo-a',
  }
  const repoB = {
    id: uuidv7(),
    tenantId: tenantB.id,
    installationId: inst.id,
    githubRepoId: 2,
    owner: 'acme',
    name: 'repo-b',
  }
  await db.insert(repositories).values([repoA, repoB])

  const runA = {
    id: uuidv7(),
    tenantId: tenantA.id,
    repositoryId: repoA.id,
    createdByUserId: user.id,
    title: 'Run A',
    oneLiner: 'do A',
  }
  const runB = {
    id: uuidv7(),
    tenantId: tenantB.id,
    repositoryId: repoB.id,
    createdByUserId: user.id,
    title: 'Run B',
    oneLiner: 'do B',
  }
  await db.insert(runs).values([runA, runB])

  return { tenantA, tenantB, user, runA, runB }
}

describe('AC-03-01: withTenant auto-injects tenant_id WHERE clause', () => {
  it('select(runs) returns only rows of the bound tenant', async () => {
    const { tenantA } = await seedTwoTenants(rawDb)

    const scoped = withTenant(rawDb, tenantA.id)
    const rows = await scoped.select().from(runs)

    expect(rows).toHaveLength(1)
    const [row] = rows
    expect(row).toBeDefined()
    expect(row!.tenantId).toBe(tenantA.id)
    expect(row!.title).toBe('Run A')
  })
})

describe('AC-03-02: cross-tenant access returns 0 rows + writes audit_log', () => {
  it('querying tenant B run from tenant A scope yields empty array', async () => {
    const { tenantA, runB } = await seedTwoTenants(rawDb)

    const scoped = withTenant(rawDb, tenantA.id)
    const rows = await scoped.select().from(runs).where(eq(runs.id, runB.id))

    expect(rows).toHaveLength(0)
  })

  it('writes one audit_log row of action=cross_tenant_attempt for tenant A', async () => {
    const { tenantA, runB } = await seedTwoTenants(rawDb)

    const scoped = withTenant(rawDb, tenantA.id)
    await scoped.select().from(runs).where(eq(runs.id, runB.id))

    const logs = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'cross_tenant_attempt'))
    expect(logs.length).toBeGreaterThanOrEqual(1)
    const [log] = logs
    expect(log).toBeDefined()
    expect(log!.tenantId).toBe(tenantA.id)
    expect(log!.targetKind).toBe('runs')
  })

  it('does NOT log audit when query genuinely returns 0 rows (no row exists)', async () => {
    const { tenantA } = await seedTwoTenants(rawDb)

    const scoped = withTenant(rawDb, tenantA.id)
    // Use a random non-existent id — no row exists in any tenant
    const ghostId = uuidv7()
    await scoped.select().from(runs).where(eq(runs.id, ghostId))

    const logs = await rawDb
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'cross_tenant_attempt'))
    expect(logs).toHaveLength(0)
  })
})
