import { describe, it, expect } from 'vitest'
import * as schema from './index.js'

describe('schema/relations + drizzle-zod', () => {
  it('exposes relations objects for runs / users / tenants', () => {
    expect(schema.usersRelations).toBeDefined()
    expect(schema.tenantsRelations).toBeDefined()
    expect(schema.runsRelations).toBeDefined()
  })

  it('exposes insertSchema / selectSchema for each table', () => {
    expect(schema.insertUsersSchema).toBeDefined()
    expect(schema.selectUsersSchema).toBeDefined()
    expect(schema.insertRunsSchema).toBeDefined()
    expect(schema.insertArtifactsSchema).toBeDefined()
    expect(schema.insertIrDocumentsSchema).toBeDefined()
    expect(schema.insertJobsSchema).toBeDefined()
    expect(schema.insertDataEncryptionKeysSchema).toBeDefined()
  })

  it('insertUsersSchema validates required fields', () => {
    const valid = schema.insertUsersSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000001',
      githubId: 1,
      githubLogin: 'x',
    })
    expect(valid.success).toBe(true)
    const invalid = schema.insertUsersSchema.safeParse({ id: 'not-uuid' })
    expect(invalid.success).toBe(false)
  })
})
