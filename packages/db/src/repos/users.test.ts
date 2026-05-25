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
import { users } from '../schema/identity.js'
import { createUser } from './users.js'

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

describe('createUser', () => {
  it('creates a user with auto-generated uuidv7 id', async () => {
    const row = await createUser(db, { githubId: 12345, githubLogin: 'octocat' })

    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(row.githubId).toBe(12345)
    expect(row.githubLogin).toBe('octocat')
    expect(row.isPlatformAdmin).toBe(false) // default
  })

  it('accepts optional email and name', async () => {
    const row = await createUser(db, {
      githubId: 67890,
      githubLogin: 'mona',
      email: 'mona@example.com',
      name: 'Mona Lisa',
    })
    expect(row.email).toBe('mona@example.com')
    expect(row.name).toBe('Mona Lisa')
  })

  it('persists the row visible to a subsequent SELECT', async () => {
    const row = await createUser(db, { githubId: 999, githubLogin: 'ghost' })
    const [found] = await db.select().from(users).where(eq(users.id, row.id))
    expect(found).toBeDefined()
    expect(found!.githubLogin).toBe('ghost')
  })
})
