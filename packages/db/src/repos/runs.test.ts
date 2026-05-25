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
import { githubInstallations, repositories } from '../schema/github.js'
import { createTenant } from './tenants.js'
import { createUser } from './users.js'
import { createRun, getRun, listRunsByTenant } from './runs.js'

let handle: TestPgHandle
let dbName: string
let pool: Pool
let db: NodePgDatabase<typeof schema>

beforeAll(async () => {
  handle = await startTestPostgres()
}, 90_000)

afterAll(async () => {
  await handle.stop()
})

beforeEach(async () => {
  dbName = await createTestDatabase(handle)
  pool = new Pool({ connectionString: testDatabaseUrl(handle, dbName) })
  db = drizzle(pool, { schema })
})

afterEach(async () => {
  await pool.end()
  await dropTestDatabase(handle, dbName)
})

let seq = 0
const uniq = () => `${Date.now()}-${++seq}`

async function seedTenantUserRepo(d: NodePgDatabase<typeof schema>) {
  const tag = uniq()
  const tenant = await createTenant(d, { slug: `t-${tag}`, name: 'T' })
  const user = await createUser(d, {
    githubId: ++seq + 1_000_000,
    githubLogin: `u-${tag}`,
  })
  const inst = {
    id: uuidv7(),
    installationId: ++seq + 9_000_000,
    accountLogin: 'acme',
    accountType: 'Organization' as const,
  }
  await d.insert(githubInstallations).values(inst)
  const repo = {
    id: uuidv7(),
    tenantId: tenant.id,
    installationId: inst.id,
    githubRepoId: ++seq + 5_000_000,
    owner: 'acme',
    name: `r-${tag}`,
  }
  await d.insert(repositories).values(repo)
  return { tenant, user, repo }
}

describe('createRun', () => {
  it('stores a run with auto-generated id + default status="created"', async () => {
    const { tenant, user, repo } = await seedTenantUserRepo(db)

    const row = await createRun(db, {
      tenantId: tenant.id,
      repositoryId: repo.id,
      createdByUserId: user.id,
      title: 'Ship feature X',
      oneLiner: 'do the thing',
    })

    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(row.title).toBe('Ship feature X')
    expect(row.status).toBe('created')
    expect(row.targetBranch).toBe('main')
  })
})

describe('getRun', () => {
  it('returns the row by id', async () => {
    const { tenant, user, repo } = await seedTenantUserRepo(db)
    const created = await createRun(db, {
      tenantId: tenant.id,
      repositoryId: repo.id,
      createdByUserId: user.id,
      title: 'A',
      oneLiner: 'a',
    })

    const found = await getRun(db, created.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(created.id)
    expect(found!.title).toBe('A')
  })

  it('returns undefined for a non-existent id', async () => {
    const ghost = uuidv7()
    const found = await getRun(db, ghost)
    expect(found).toBeUndefined()
  })
})

describe('listRunsByTenant', () => {
  it('returns only rows of the given tenant, newest first, respecting limit', async () => {
    const { tenant: tA, user, repo: rA } = await seedTenantUserRepo(db)
    const { tenant: tB, repo: rB } = await seedTenantUserRepo(db)

    // Tenant A: 3 runs in known order
    const a1 = await createRun(db, {
      tenantId: tA.id,
      repositoryId: rA.id,
      createdByUserId: user.id,
      title: 'A1',
      oneLiner: 'a',
    })
    const a2 = await createRun(db, {
      tenantId: tA.id,
      repositoryId: rA.id,
      createdByUserId: user.id,
      title: 'A2',
      oneLiner: 'a',
    })
    const a3 = await createRun(db, {
      tenantId: tA.id,
      repositoryId: rA.id,
      createdByUserId: user.id,
      title: 'A3',
      oneLiner: 'a',
    })
    // Tenant B: 1 run that must not leak into A's list
    await createRun(db, {
      tenantId: tB.id,
      repositoryId: rB.id,
      createdByUserId: user.id,
      title: 'B1',
      oneLiner: 'b',
    })

    const top2 = await listRunsByTenant(db, tA.id, { limit: 2 })
    expect(top2).toHaveLength(2)
    // newest first
    expect(top2[0]!.id).toBe(a3.id)
    expect(top2[1]!.id).toBe(a2.id)

    const all = await listRunsByTenant(db, tA.id, { limit: 50 })
    expect(all).toHaveLength(3)
    expect(all.map((r) => r.id)).toEqual([a3.id, a2.id, a1.id])
  })

  it('default limit caps at 20 and offset paginates', async () => {
    const { tenant, user, repo } = await seedTenantUserRepo(db)
    // Insert 25 runs
    for (let i = 0; i < 25; i++) {
      await createRun(db, {
        tenantId: tenant.id,
        repositoryId: repo.id,
        createdByUserId: user.id,
        title: `R${i}`,
        oneLiner: 'x',
      })
    }
    const page1 = await listRunsByTenant(db, tenant.id)
    expect(page1).toHaveLength(20)

    const page2 = await listRunsByTenant(db, tenant.id, { limit: 20, offset: 20 })
    expect(page2).toHaveLength(5)
  })
})
