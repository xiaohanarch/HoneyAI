// packages/web/lib/seeds/default-skills.test.ts
// AC-01-09: importDefaultSkills is idempotent
// Uses testcontainers (real Postgres 17) — requires Docker.

import { describe, it, expect } from 'vitest'
import { withTestDb } from '../test/db'
import { assets, tenants } from '@honeyai/db/schema'
import { importDefaultSkills, DEFAULT_SKILL_SEEDS } from './default-skills'
import { v7 as uuidv7 } from 'uuid'
import { eq } from 'drizzle-orm'

describe('importDefaultSkills (AC-01-09)', () => {
  it('AC-01-09: importDefaultSkills is idempotent — second call does not duplicate rows', async () => {
    await withTestDb(async (db) => {
      const id = uuidv7()
      await db
        .insert(tenants)
        .values({ id, slug: `t-${id.slice(0, 8)}`, name: 't', kind: 'personal' })
      await db.transaction((tx) => importDefaultSkills(tx, id))
      await db.transaction((tx) => importDefaultSkills(tx, id))
      const rows = await db.select().from(assets).where(eq(assets.tenantId, id))
      expect(rows).toHaveLength(DEFAULT_SKILL_SEEDS.length)
    })
  }, 60_000) // testcontainer warmup
})
