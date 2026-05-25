import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  type TestPgHandle,
} from './container.js'

describe('testcontainers harness', () => {
  let handle: TestPgHandle

  beforeAll(async () => {
    handle = await startTestPostgres()
  }, 60_000)

  afterAll(async () => {
    await handle.stop()
  })

  it('can create a database from template_honeyai in < 1s', async () => {
    const start = Date.now()
    const name = await createTestDatabase(handle)
    const elapsed = Date.now() - start
    expect(name).toMatch(/^test_[0-9a-f]+$/)
    expect(elapsed).toBeLessThan(1000)
    await dropTestDatabase(handle, name)
  })

  it('parallel createTestDatabase calls produce unique names', async () => {
    const names = await Promise.all([
      createTestDatabase(handle),
      createTestDatabase(handle),
      createTestDatabase(handle),
    ])
    expect(new Set(names).size).toBe(3)
    await Promise.all(names.map((n) => dropTestDatabase(handle, n)))
  })
})
