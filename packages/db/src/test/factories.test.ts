import { describe, it, expect } from 'vitest'
import { makeTenant, makeUser, makeRepository, makeRun, makeNode } from './factories.js'

describe('test factories', () => {
  it('makeTenant returns valid insert payload with defaults', () => {
    const t = makeTenant()
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(t.slug).toBeTruthy()
    expect(t.name).toBeTruthy()
    expect(t.kind).toBe('personal')
  })

  it('makeUser returns valid insert payload with sequential githubId', () => {
    const u1 = makeUser()
    const u2 = makeUser()
    expect(u1.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(u1.githubLogin).toBeTruthy()
    expect(u2.githubId).not.toBe(u1.githubId)
  })

  it('makeRun ties to provided tenant + user + repo', () => {
    const tenantId = makeTenant().id
    const userId = makeUser().id
    const repoId = makeRepository({ tenantId }).id
    const run = makeRun({ tenantId, createdByUserId: userId, repositoryId: repoId })
    expect(run.tenantId).toBe(tenantId)
    expect(run.createdByUserId).toBe(userId)
    expect(run.repositoryId).toBe(repoId)
  })

  it('makeNode ties to provided runId; default kind="agent"', () => {
    const runId = makeRun().id
    const node = makeNode({ runId })
    expect(node.runId).toBe(runId)
    expect(node.kind).toBe('agent')
    expect(node.stage).toBe(1)
  })

  it('overrides win over defaults', () => {
    const t = makeTenant({ slug: 'custom' })
    expect(t.slug).toBe('custom')
    const u = makeUser({ githubLogin: 'alice' })
    expect(u.githubLogin).toBe('alice')
  })
})
