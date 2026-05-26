// packages/web/lib/test/db.ts
// 1-arg wrapper around @honeyai/db's testcontainer helpers.
// Manages container (module-singleton) + per-call db creation/drop.
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  withTestDb as withDbPkgTestDb,
  type TestPgHandle,
} from '@honeyai/db/test'

let _handle: TestPgHandle | null = null
let _startPromise: Promise<TestPgHandle> | null = null

async function getHandle(): Promise<TestPgHandle> {
  if (_handle) return _handle
  if (!_startPromise) _startPromise = startTestPostgres()
  _handle = await _startPromise
  return _handle
}

// Note: not auto-stopping container — tests rely on vitest pool process exit.
export async function withTestDb<T>(
  fn: (db: import('@honeyai/db').DrizzleDb) => Promise<T>,
): Promise<T> {
  const handle = await getHandle()
  const dbName = await createTestDatabase(handle)
  try {
    const url = testDatabaseUrl(handle, dbName)
    return await withDbPkgTestDb(url, fn as never)
  } finally {
    await dropTestDatabase(handle, dbName)
  }
}
