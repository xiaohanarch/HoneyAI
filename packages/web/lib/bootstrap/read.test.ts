import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { tenants } from '@honeyai/db/schema'
import { withTestDb } from '../test/db'

describe('getTenantBootstrap', () => {
  beforeEach(() => {
    // resetModules MUST come before vi.doMock so the dynamic import below
    // loads a fresh `./read` module against the freshly-mocked '@honeyai/db'.
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('@honeyai/db')
  })

  it('returns null when tenant missing', async () => {
    await withTestDb(async (db) => {
      vi.doMock('@honeyai/db', async () => {
        const actual = await vi.importActual<typeof import('@honeyai/db')>('@honeyai/db')
        return { ...actual, getDb: () => db }
      })
      const { getTenantBootstrap } = await import('./read')
      const r = await getTenantBootstrap(uuidv7())
      expect(r).toBeNull()
    })
  }, 120_000)

  it('returns { slug, bootstrap: state } when tenant has bootstrap', async () => {
    await withTestDb(async (db) => {
      vi.doMock('@honeyai/db', async () => {
        const actual = await vi.importActual<typeof import('@honeyai/db')>('@honeyai/db')
        return { ...actual, getDb: () => db }
      })
      const { getTenantBootstrap } = await import('./read')
      const id = uuidv7()
      await db.insert(tenants).values({
        id,
        slug: 'alice',
        name: 'alice',
        kind: 'personal',
        settings: { bootstrap: { completedAt: '2026-01-01T00:00:00Z' } },
      })
      const r = await getTenantBootstrap(id)
      expect(r).toEqual({
        slug: 'alice',
        bootstrap: { completedAt: '2026-01-01T00:00:00Z' },
      })
    })
  }, 120_000)

  it('returns { slug, bootstrap: null } when settings has no bootstrap key', async () => {
    await withTestDb(async (db) => {
      vi.doMock('@honeyai/db', async () => {
        const actual = await vi.importActual<typeof import('@honeyai/db')>('@honeyai/db')
        return { ...actual, getDb: () => db }
      })
      const { getTenantBootstrap } = await import('./read')
      const id = uuidv7()
      await db.insert(tenants).values({ id, slug: 'alice', name: 'alice', kind: 'personal' })
      const r = await getTenantBootstrap(id)
      expect(r).toEqual({ slug: 'alice', bootstrap: null })
    })
  }, 120_000)
})
