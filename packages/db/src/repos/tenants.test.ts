import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq } from 'drizzle-orm'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'
import * as schema from '../schema/index.js'
import { tenants } from '../schema/identity.js'
import { createTenant } from './tenants.js'

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

describe('createTenant', () => {
  it('creates a tenant with auto-generated uuidv7 id and returns the full row', async () => {
    const row = await createTenant(db, { slug: 'acme', name: 'Acme Inc' })

    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(row.slug).toBe('acme')
    expect(row.name).toBe('Acme Inc')
    expect(row.kind).toBe('personal') // default
  })

  it('accepts explicit kind=team', async () => {
    const row = await createTenant(db, { slug: 'team-1', name: 'Team 1', kind: 'team' })
    expect(row.kind).toBe('team')
  })

  it('persists the row visible to a subsequent SELECT', async () => {
    const row = await createTenant(db, { slug: 'persist', name: 'Persist' })
    const [found] = await db.select().from(tenants).where(eq(tenants.id, row.id))
    expect(found).toBeDefined()
    expect(found!.slug).toBe('persist')
  })
})
