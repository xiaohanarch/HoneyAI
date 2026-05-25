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
import { dataEncryptionKeys } from './encryption.js'

describe('schema/encryption — metadata', () => {
  it('table is named "data_encryption_keys"', () => {
    expect(getTableName(dataEncryptionKeys)).toBe('data_encryption_keys')
  })
})

describe('schema/encryption — round-trip', () => {
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

  it('default algorithm is "AES-256-GCM"', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      await db.insert(dataEncryptionKeys).values({
        id: uuidv7(),
        kekVersion: 1,
        encryptedDek: 'ZW5jcnlwdGVkLWRlay1ieXRlcw==',
      })
      const rows = await db.select().from(dataEncryptionKeys)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.algorithm).toBe('AES-256-GCM')
      expect(rows[0]?.kekVersion).toBe(1)
      expect(rows[0]?.rotatedAt).toBeNull()
    })
  })

  it('rejects null kekVersion (NOT NULL constraint)', async () => {
    const url = testDatabaseUrl(handle, dbName)
    await withTestDb(url, async (db) => {
      await expect(
        db.insert(dataEncryptionKeys).values({
          id: uuidv7(),
          // @ts-expect-error — intentionally violating NOT NULL
          kekVersion: null,
          encryptedDek: 'x',
        }),
      ).rejects.toThrow(/not.null|null value/i)
    })
  })
})
