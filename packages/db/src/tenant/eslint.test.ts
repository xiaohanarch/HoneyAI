import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../..')

/**
 * G5 — Business packages (web/orchestrator/worker/...) MUST NOT import the
 * raw drizzle client (`rawDb` / `systemDb`) from `@honeyai/db/client`.
 *
 * The only legitimate entry-point for query execution is `withTenant(db, id)`,
 * which auto-injects `WHERE tenant_id = ?` and audits cross-tenant attempts.
 *
 * This is enforced by an `eslint` `no-restricted-imports` rule whose scope is
 * everything *except* `packages/db/**` (the db package itself is allowed to
 * export and use the raw client internally).
 *
 * NOTE: The `@honeyai/db/client` sub-path does not need to physically exist
 * yet — `no-restricted-imports` is purely syntactic, so it acts as a forward
 * guardrail for when `client.ts` is added in a later phase.
 */
describe('G5: ESLint forbids importing rawDb/systemDb from @honeyai/db/client outside @honeyai/db', () => {
  it('flags `import { rawDb } from "@honeyai/db/client"` in a non-db package', async () => {
    const linter = new ESLint({
      cwd: repoRoot,
      overrideConfigFile: path.join(repoRoot, 'eslint.config.mjs'),
    })

    const code = `import { rawDb } from '@honeyai/db/client'\nexport const x = rawDb\n`
    const fakePath = path.join(repoRoot, 'packages/web/src/leak.ts')
    const [result] = await linter.lintText(code, { filePath: fakePath })

    expect(result).toBeDefined()
    const messages = result!.messages
    const restricted = messages.find((m) => m.ruleId === 'no-restricted-imports')
    expect(restricted, JSON.stringify(messages, null, 2)).toBeDefined()
    expect(restricted!.message).toMatch(/rawDb|@honeyai\/db\/client/)
  })

  it('flags `import { systemDb } from "@honeyai/db/client"` in a non-db package', async () => {
    const linter = new ESLint({
      cwd: repoRoot,
      overrideConfigFile: path.join(repoRoot, 'eslint.config.mjs'),
    })

    const code = `import { systemDb } from '@honeyai/db/client'\nexport const x = systemDb\n`
    const fakePath = path.join(repoRoot, 'packages/orchestrator/src/leak.ts')
    const [result] = await linter.lintText(code, { filePath: fakePath })

    expect(result).toBeDefined()
    const restricted = result!.messages.find((m) => m.ruleId === 'no-restricted-imports')
    expect(restricted).toBeDefined()
    expect(restricted!.message).toMatch(/systemDb|@honeyai\/db\/client/)
  })

  it('does NOT flag the same import when used inside packages/db/**', async () => {
    const linter = new ESLint({
      cwd: repoRoot,
      overrideConfigFile: path.join(repoRoot, 'eslint.config.mjs'),
    })

    const code = `import { rawDb } from '@honeyai/db/client'\nexport const x = rawDb\n`
    const fakePath = path.join(repoRoot, 'packages/db/src/internal/uses-raw.ts')
    const [result] = await linter.lintText(code, { filePath: fakePath })

    expect(result).toBeDefined()
    const restricted = result!.messages.find((m) => m.ruleId === 'no-restricted-imports')
    expect(restricted).toBeUndefined()
  })

  it('does NOT flag `import { withTenant } from "@honeyai/db"` (the legitimate API)', async () => {
    const linter = new ESLint({
      cwd: repoRoot,
      overrideConfigFile: path.join(repoRoot, 'eslint.config.mjs'),
    })

    const code = `import { withTenant } from '@honeyai/db'\nexport const x = withTenant\n`
    const fakePath = path.join(repoRoot, 'packages/web/src/ok.ts')
    const [result] = await linter.lintText(code, { filePath: fakePath })

    expect(result).toBeDefined()
    const restricted = result!.messages.find((m) => m.ruleId === 'no-restricted-imports')
    expect(restricted).toBeUndefined()
  })
})
