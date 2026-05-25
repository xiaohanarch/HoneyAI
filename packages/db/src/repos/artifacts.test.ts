import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { v7 as uuidv7 } from 'uuid'
import {
  startTestPostgres,
  createTestDatabase,
  dropTestDatabase,
  testDatabaseUrl,
  type TestPgHandle,
} from '../test/container.js'
import * as schema from '../schema/index.js'
import { githubInstallations, repositories } from '../schema/github.js'
import { nodes } from '../schema/runs.js'
import { artifactBlobs } from '../schema/artifacts.js'
import { createTenant } from './tenants.js'
import { createUser } from './users.js'
import { createRun } from './runs.js'
import { insertArtifactIdempotent, listArtifactsByNode } from './artifacts.js'

let handle: TestPgHandle
let dbName: string
let pool: Pool
let db: NodePgDatabase<typeof schema>

beforeAll(async () => {
  handle = await startTestPostgres()
}, 90_000)

afterAll(async () => {
  await handle.stop()
})

beforeEach(async () => {
  dbName = await createTestDatabase(handle)
  pool = new Pool({ connectionString: testDatabaseUrl(handle, dbName) })
  db = drizzle(pool, { schema })
})

afterEach(async () => {
  await pool.end()
  await dropTestDatabase(handle, dbName)
})

let seq = 0
const uniq = () => `${Date.now()}-${++seq}`

async function seedRunAndNode(d: NodePgDatabase<typeof schema>) {
  const tag = uniq()
  const tenant = await createTenant(d, { slug: `t-${tag}`, name: 'T' })
  const user = await createUser(d, { githubId: ++seq + 2_000_000, githubLogin: `u-${tag}` })
  const inst = {
    id: uuidv7(),
    installationId: ++seq + 8_000_000,
    accountLogin: 'acme',
    accountType: 'Organization' as const,
  }
  await d.insert(githubInstallations).values(inst)
  const repo = {
    id: uuidv7(),
    tenantId: tenant.id,
    installationId: inst.id,
    githubRepoId: ++seq + 6_000_000,
    owner: 'acme',
    name: `r-${tag}`,
  }
  await d.insert(repositories).values(repo)
  const run = await createRun(d, {
    tenantId: tenant.id,
    repositoryId: repo.id,
    createdByUserId: user.id,
    title: 'T',
    oneLiner: 't',
  })
  const node = {
    id: uuidv7(),
    runId: run.id,
    stage: 2,
    ordinal: 1,
    name: 'design',
    kind: 'agent' as const,
  }
  await d.insert(nodes).values(node)
  return { tenant, run, node }
}

async function seedBlob(d: NodePgDatabase<typeof schema>, tenantId: string) {
  const sha = uuidv7().replace(/-/g, '').padEnd(64, '0')
  await d.insert(artifactBlobs).values({
    sha256: sha,
    byteSize: 42n,
    ossKey: `${tenantId}/blobs/${sha.slice(0, 2)}/${sha.slice(2)}`,
  })
  return sha
}

describe('insertArtifactIdempotent', () => {
  it('first call inserts a row and returns { created: true }', async () => {
    const { tenant, run, node } = await seedRunAndNode(db)
    const sha = await seedBlob(db, tenant.id)

    const result = await insertArtifactIdempotent(db, {
      tenantId: tenant.id,
      runId: run.id,
      nodeId: node.id,
      attempt: 1,
      kind: 'design_ir',
      blobSha256: sha,
      authorKind: 'agent',
    })

    expect(result.created).toBe(true)
    expect(result.row.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(result.row.kind).toBe('design_ir')
  })

  it('second call with same (run,node,attempt,kind) returns { created: false } + same row', async () => {
    const { tenant, run, node } = await seedRunAndNode(db)
    const sha = await seedBlob(db, tenant.id)

    const payload = {
      tenantId: tenant.id,
      runId: run.id,
      nodeId: node.id,
      attempt: 1,
      kind: 'design_ir' as const,
      blobSha256: sha,
      authorKind: 'agent' as const,
    }

    const first = await insertArtifactIdempotent(db, payload)
    const second = await insertArtifactIdempotent(db, payload)

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.row.id).toBe(first.row.id)
  })

  it('different attempt produces a distinct row', async () => {
    const { tenant, run, node } = await seedRunAndNode(db)
    const sha = await seedBlob(db, tenant.id)

    const a1 = await insertArtifactIdempotent(db, {
      tenantId: tenant.id,
      runId: run.id,
      nodeId: node.id,
      attempt: 1,
      kind: 'design_ir',
      blobSha256: sha,
      authorKind: 'agent',
    })
    const a2 = await insertArtifactIdempotent(db, {
      tenantId: tenant.id,
      runId: run.id,
      nodeId: node.id,
      attempt: 2,
      kind: 'design_ir',
      blobSha256: sha,
      authorKind: 'agent',
    })

    expect(a1.created).toBe(true)
    expect(a2.created).toBe(true)
    expect(a2.row.id).not.toBe(a1.row.id)
  })
})

describe('listArtifactsByNode', () => {
  it('returns all artifacts for a node ordered by attempt asc', async () => {
    const { tenant, run, node } = await seedRunAndNode(db)
    const sha = await seedBlob(db, tenant.id)

    // Insert attempts 1 and 2 in reverse order to verify ordering
    await insertArtifactIdempotent(db, {
      tenantId: tenant.id,
      runId: run.id,
      nodeId: node.id,
      attempt: 2,
      kind: 'design_ir',
      blobSha256: sha,
      authorKind: 'agent',
    })
    await insertArtifactIdempotent(db, {
      tenantId: tenant.id,
      runId: run.id,
      nodeId: node.id,
      attempt: 1,
      kind: 'design_ir',
      blobSha256: sha,
      authorKind: 'agent',
    })

    const rows = await listArtifactsByNode(db, node.id)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.attempt).toBe(1)
    expect(rows[1]!.attempt).toBe(2)
  })

  it('returns empty array for a node with no artifacts', async () => {
    const { node } = await seedRunAndNode(db)
    const rows = await listArtifactsByNode(db, node.id)
    expect(rows).toEqual([])
  })
})
