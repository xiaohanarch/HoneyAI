// packages/web/lib/seeds/default-skills.ts
// Default skill/rule/command seeds imported for a new tenant during welcome step 4.

import { v7 as uuidv7 } from 'uuid'
import type { assetKindEnum } from '@honeyai/db/schema'

type AssetKind = (typeof assetKindEnum.enumValues)[number]

export type DefaultSkillSeed = {
  kind: AssetKind
  name: string
  body: string
  metadata: Record<string, unknown>
}

export const DEFAULT_SKILL_SEEDS: DefaultSkillSeed[] = [
  {
    kind: 'skill',
    name: 'code-review-assistant',
    body: '# Code Review Assistant\n\nReview diffs for clarity, errors, security.\n',
    metadata: { source: 'honeyai-default-v1', category: 'review' },
  },
  {
    kind: 'rule',
    name: 'no-pii-in-logs',
    body: 'Never log raw email, phone, SSN, or API keys. Redact with `***`.\n',
    metadata: { source: 'honeyai-default-v1', severity: 'high' },
  },
  {
    kind: 'command',
    name: 'run-tests',
    body: 'pnpm test\n',
    metadata: { source: 'honeyai-default-v1' },
  },
  {
    kind: 'hint',
    name: 'prefer-server-components',
    body: 'Default to React Server Components. Use "use client" only for interactivity.\n',
    metadata: { source: 'honeyai-default-v1' },
  },
  {
    kind: 'hook',
    name: 'pre-commit-format',
    body: 'pnpm prettier --write . && pnpm lint --fix\n',
    metadata: { source: 'honeyai-default-v1', stage: 'pre-commit' },
  },
]

type DrizzleTx = Parameters<Parameters<import('@honeyai/db').DrizzleDb['transaction']>[0]>[0]

export async function importDefaultSkills(tx: DrizzleTx, tenantId: string): Promise<void> {
  const { assets } = await import('@honeyai/db/schema')
  for (const seed of DEFAULT_SKILL_SEEDS) {
    await tx
      .insert(assets)
      .values({
        id: uuidv7(),
        tenantId,
        kind: seed.kind,
        name: seed.name,
        description: seed.body,
        metadata: seed.metadata,
        isEnabled: true,
      })
      .onConflictDoNothing()
  }
}
