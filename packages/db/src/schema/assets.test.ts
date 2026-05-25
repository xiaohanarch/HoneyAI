import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { getTableName } from 'drizzle-orm'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'
import { withTestDb } from '../test/push-schema.js'
import { tenants } from './identity.js'
import { assetKindEnum, assetSyncModeEnum, assetSources, assets, assetVersions } from './assets.js'

describe('schema/assets — metadata', () => {
  it('asset_kind enum has 8 values', () => {
    expect(assetKindEnum.enumValues).toEqual([
      'skill',
      'rule',
      'command',
      'script',
      'hook',
      'hint',
      'template',
      'context',
    ])
  })

  it('asset_sync_mode enum has 3 values', () => {
    expect(assetSyncModeEnum.enumValues).toEqual(['manual', 'mirror', 'import-once'])
  })

  it('table names', () => {
    expect(getTableName(assetSources)).toBe('asset_sources')
    expect(getTableName(assets)).toBe('assets')
    expect(getTableName(assetVersions)).toBe('asset_versions')
  })
})

describe('schema/assets — round-trip', () => {
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

  it('inserts an asset with tenant scope and default isEnabled=true', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const tenantId = uuidv7()
      await db.insert(tenants).values({ id: tenantId, slug: 'co', name: 'Co' })
      const assetId = uuidv7()
      await db.insert(assets).values({
        id: assetId,
        tenantId,
        name: 'pytest-runner',
        kind: 'skill',
      })
      const rows = await db.select().from(assets)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.isEnabled).toBe(true)
      expect(rows[0]?.metadata).toEqual({})
    })
  })

  it('enforces uniq (tenantId, kind, name) on assets', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const tenantId = uuidv7()
      await db.insert(tenants).values({ id: tenantId, slug: 't', name: 'T' })
      await db.insert(assets).values({
        id: uuidv7(),
        tenantId,
        name: 'lint',
        kind: 'rule',
      })
      await expect(
        db.insert(assets).values({ id: uuidv7(), tenantId, name: 'lint', kind: 'rule' }),
      ).rejects.toThrow(/unique|duplicate/i)
    })
  })

  it('inserts asset_versions and enforces uniq (assetId, version)', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const tenantId = uuidv7()
      const assetId = uuidv7()
      await db.insert(tenants).values({ id: tenantId, slug: 't', name: 'T' })
      await db.insert(assets).values({ id: assetId, tenantId, name: 'a', kind: 'command' })
      await db.insert(assetVersions).values({
        id: uuidv7(),
        assetId,
        version: 1,
        content: 'echo 1',
        authorKind: 'user',
      })
      await expect(
        db.insert(assetVersions).values({
          id: uuidv7(),
          assetId,
          version: 1,
          content: 'echo dup',
          authorKind: 'user',
        }),
      ).rejects.toThrow(/unique|duplicate/i)
    })
  })

  it('asset_sources accepts global scope (tenantId null)', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      const id = uuidv7()
      await db.insert(assetSources).values({
        id,
        kind: 'github_repo',
        repoUrl: 'https://github.com/honeyai/official-assets',
        syncMode: 'mirror',
      })
      const rows = await db.select().from(assetSources)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.tenantId).toBeNull()
      expect(rows[0]?.branch).toBe('main')
      expect(rows[0]?.subPath).toBe('')
    })
  })
})
