import pg from 'pg'
const { Pool } = pg
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema/index.js'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (_db) return _db
  const url = process.env['DATABASE_URL']
  if (!url) throw new Error('getDb: DATABASE_URL is not set')
  const pool = new Pool({ connectionString: url })
  _db = drizzle(pool, { schema })
  return _db
}

export type DrizzleDb = ReturnType<typeof getDb>
