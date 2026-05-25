import { v7 as uuidv7 } from 'uuid'

let seq = 0
const next = () => ++seq

export type TenantInput = {
  id: string
  slug: string
  name: string
  kind: 'personal' | 'team'
}

export type UserInput = {
  id: string
  githubId: number
  githubLogin: string
}

export type RepoInput = {
  id: string
  tenantId: string
  installationId: string
  githubRepoId: number
  owner: string
  name: string
}

export type RunInput = {
  id: string
  tenantId: string
  repositoryId: string
  createdByUserId: string
  title: string
  oneLiner: string
}

export type NodeInput = {
  id: string
  runId: string
  stage: number
  ordinal: number
  name: string
  kind: 'agent' | 'gate' | 'merge' | 'deploy'
}

export function makeTenant(overrides: Partial<TenantInput> = {}): TenantInput {
  const n = next()
  return {
    id: uuidv7(),
    slug: `tenant-${n}`,
    name: `Tenant ${n}`,
    kind: 'personal',
    ...overrides,
  }
}

export function makeUser(overrides: Partial<UserInput> = {}): UserInput {
  const n = next()
  return {
    id: uuidv7(),
    githubId: 1000 + n,
    githubLogin: `user-${n}`,
    ...overrides,
  }
}

export function makeRepository(overrides: Partial<RepoInput> = {}): RepoInput {
  const n = next()
  return {
    id: uuidv7(),
    tenantId: uuidv7(),
    installationId: uuidv7(),
    githubRepoId: 2000 + n,
    owner: 'org',
    name: `repo-${n}`,
    ...overrides,
  }
}

export function makeRun(overrides: Partial<RunInput> = {}): RunInput {
  const n = next()
  return {
    id: uuidv7(),
    tenantId: uuidv7(),
    repositoryId: uuidv7(),
    createdByUserId: uuidv7(),
    title: `Run ${n}`,
    oneLiner: 'do something',
    ...overrides,
  }
}

export function makeNode(overrides: Partial<NodeInput> = {}): NodeInput {
  const n = next()
  return {
    id: uuidv7(),
    runId: uuidv7(),
    stage: 1,
    ordinal: 1,
    name: `node-${n}`,
    kind: 'agent',
    ...overrides,
  }
}
