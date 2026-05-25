import { describe, it, expect } from 'vitest'
import { tsCols, softDelete } from './_helpers.js'

type WithConfig = { config: { name: string } }

describe('schema/_helpers', () => {
  it('exposes createdAt / updatedAt with timestamp + tz + defaultNow', () => {
    expect(tsCols.createdAt).toBeDefined()
    expect(tsCols.updatedAt).toBeDefined()
    expect((tsCols.createdAt as unknown as WithConfig).config.name).toBe('created_at')
    expect((tsCols.updatedAt as unknown as WithConfig).config.name).toBe('updated_at')
  })

  it('exposes softDelete.deletedAt as nullable timestamp', () => {
    expect(softDelete.deletedAt).toBeDefined()
    expect((softDelete.deletedAt as unknown as WithConfig).config.name).toBe('deleted_at')
  })
})
