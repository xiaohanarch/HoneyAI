import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { getTableName } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from './index.js'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'
import { withTestDb } from '../test/push-schema.js'
import { tenants, users } from './identity.js'
import { githubInstallations, repositories } from './github.js'
import { runs } from './runs.js'
import { costKindEnum, pricingBook, costEvents } from './cost.js'

type Db = NodePgDatabase<typeof schema>

async function seedTenant(db: Db) {
  const tenantId = uuidv7()
  const userId = uuidv7()
  const installationRowId = uuidv7()
  const repoId = uuidv7()
  const runId = uuidv7()
  await db.insert(tenants).values({ id: tenantId, slug: 't', name: 'T' })
  await db.insert(users).values({ id: userId, githubId: 1, githubLogin: 'u' })
  await db.insert(githubInstallations).values({
    id: installationRowId,
    installationId: 1,
    accountLogin: 't',
    accountType: 'User',
  })
  await db.insert(repositories).values({
    id: repoId,
    tenantId,
    installationId: installationRowId,
    githubRepoId: 1,
    owner: 't',
    name: 'r',
  })
  await db.insert(runs).values({
    id: runId,
    tenantId,
    repositoryId: repoId,
    createdByUserId: userId,
    title: 't',
    oneLiner: 't',
  })
  return { tenantId, runId }
}

describe('schema/cost — metadata', () => {
  it('cost_kind enum has 6 values', () => {
    expect(costKindEnum.enumValues).toEqual([
      'llm_tokens',
      'github_api',
      'sandbox_compute',
      'storage_write',
      'storage_stored',
      'egress_bytes',
    ])
  })

  it('table names', () => {
    expect(getTableName(pricingBook)).toBe('pricing_book')
    expect(getTableName(costEvents)).toBe('cost_events')
  })
})

describe('schema/cost — round-trip', () => {
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

  it('inserts a pricing_book row with bigint unitCost', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      await db.insert(pricingBook).values({
        id: uuidv7(),
        kind: 'llm_tokens',
        provider: 'anthropic',
        sku: 'claude-opus-4-6-input',
        unitCostMicroUsd: 15n,
        unit: 'token',
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      })
      const rows = await db.select().from(pricingBook)
      expect(rows).toHaveLength(1)
      expect(typeof rows[0]?.unitCostMicroUsd).toBe('bigint')
      expect(rows[0]?.unitCostMicroUsd).toBe(15n)
    })
  })

  it('pricing_book uniq (kind, provider, sku, effectiveFrom)', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const eff = new Date('2026-01-01T00:00:00Z')
      await db.insert(pricingBook).values({
        id: uuidv7(),
        kind: 'llm_tokens',
        provider: 'anthropic',
        sku: 'foo',
        unitCostMicroUsd: 1n,
        unit: 'token',
        effectiveFrom: eff,
      })
      await expect(
        db.insert(pricingBook).values({
          id: uuidv7(),
          kind: 'llm_tokens',
          provider: 'anthropic',
          sku: 'foo',
          unitCostMicroUsd: 2n,
          unit: 'token',
          effectiveFrom: eff,
        }),
      ).rejects.toThrow(/unique|duplicate/i)
    })
  })

  it('inserts a cost_events row with numeric quantity and bigint totals', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const { tenantId, runId } = await seedTenant(db)
      await db.insert(costEvents).values({
        id: uuidv7(),
        tenantId,
        runId,
        kind: 'llm_tokens',
        provider: 'anthropic',
        sku: 'claude-opus-4-6-input',
        quantity: '1234.5000',
        unitCostMicroUsd: 15n,
        totalMicroUsd: 18518n,
      })
      const rows = await db.select().from(costEvents)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.quantity).toBe('1234.5000')
      expect(rows[0]?.totalMicroUsd).toBe(18518n)
      expect(rows[0]?.metadata).toEqual({})
    })
  })
})
