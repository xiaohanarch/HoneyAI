// packages/web/lib/bootstrap/cross-tenant.test.ts
// AC-01-11: cross-tenant bootstrap isolation — alice cannot read bob.settings.bootstrap.
//
// Isolation is enforced at the application layer: getTenantBootstrap(tenantId)
// always filters by the supplied tenantId. Server actions are gated by
// requireWritableBootstrap() which derives tenantId exclusively from the
// signed session JWT — user-supplied FormData cannot inject a foreign tenantId.
//
// This test verifies the SELECT-level isolation: querying with aliceId returns
// alice's row only, even when a neighbouring tenant (bob) has a richer bootstrap.

import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { v7 as uuidv7 } from 'uuid'
import { tenants } from '@honeyai/db/schema'
import { withTestDb } from '../test/db'

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@honeyai/db')
})

it('AC-01-11: getTenantBootstrap(aliceId) returns only alice data, not bob.settings.bootstrap', async () => {
  await withTestDb(async (db) => {
    vi.doMock('@honeyai/db', async () => {
      const actual = await vi.importActual<typeof import('@honeyai/db')>('@honeyai/db')
      return { ...actual, getDb: () => db }
    })
    const { getTenantBootstrap } = await import('./read')

    const aliceId = uuidv7()
    const bobId = uuidv7()
    const aliceSlug = `alice-${aliceId.slice(0, 8)}`
    const bobSlug = `bob-${bobId.slice(0, 8)}`

    await db.insert(tenants).values([
      { id: aliceId, slug: aliceSlug, name: 'Alice', kind: 'personal' },
      {
        id: bobId,
        slug: bobSlug,
        name: 'Bob',
        kind: 'personal',
        settings: {
          bootstrap: {
            anthropicKeyCiphertext: 'v1:bob-key',
            githubAppInstalled: true,
            completedAt: '2026-01-01T00:00:00Z',
          },
        },
      },
    ])

    // Alice calling getTenantBootstrap with her own ID must not see bob's bootstrap
    const result = await getTenantBootstrap(aliceId)
    expect(result).not.toBeNull()
    expect(result!.slug).toBe(aliceSlug)
    expect(result!.bootstrap).toBeNull() // alice has no bootstrap

    // Sanity: bob's own data is readable with bob's ID
    const bobResult = await getTenantBootstrap(bobId)
    expect(bobResult!.bootstrap?.completedAt).toBe('2026-01-01T00:00:00Z')
  })
}, 120_000)
