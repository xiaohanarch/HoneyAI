import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
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

describe('AC-03-01: withTenant auto-injects tenant_id WHERE clause', () => {
  it('select(runs) returns only rows of the bound tenant', async () => {
    // Arrange — 2 tenants, 1 user, 1 installation, 2 repos, 2 runs
    const tenantA = { id: uuidv7(), slug: 'tenant-a', name: 'Tenant A', kind: 'personal' as const }
    const tenantB = { id: uuidv7(), slug: 'tenant-b', name: 'Tenant B', kind: 'personal' as const }
    await rawDb.insert(tenants).values([tenantA, tenantB])

    const user = { id: uuidv7(), githubId: 1001, githubLogin: 'user-a' }
    await rawDb.insert(users).values(user)

    const inst = {
      id: uuidv7(),
      installationId: 9001,
      accountLogin: 'acme',
      accountType: 'Organization' as const,
    }
    await rawDb.insert(githubInstallations).values(inst)

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
    await rawDb.insert(repositories).values([repoA, repoB])

    await rawDb.insert(runs).values([
      {
        id: uuidv7(),
        tenantId: tenantA.id,
        repositoryId: repoA.id,
        createdByUserId: user.id,
        title: 'Run A',
        oneLiner: 'do A',
      },
      {
        id: uuidv7(),
        tenantId: tenantB.id,
        repositoryId: repoB.id,
        createdByUserId: user.id,
        title: 'Run B',
        oneLiner: 'do B',
      },
    ])

    // Act
    const scoped = withTenant(rawDb, tenantA.id)
    const rows = await scoped.select().from(runs)

    // Assert
    expect(rows).toHaveLength(1)
    const [row] = rows
    expect(row).toBeDefined()
    expect(row!.tenantId).toBe(tenantA.id)
    expect(row!.title).toBe('Run A')
  })
})
