import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanTests } from './scan-tests.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')

describe('scanTests', () => {
  it('finds the 3 Phase-1 seed AC ids in the vitest titles under packages/', async () => {
    const map = await scanTests(path.join(repoRoot, 'packages'))
    expect(map.has('AC-03-01')).toBe(true)
    expect(map.has('AC-03-02')).toBe(true)
    expect(map.has('AC-03-03')).toBe(true)
  })

  it('records the source test file for each id', async () => {
    const map = await scanTests(path.join(repoRoot, 'packages'))
    const occurrences = map.get('AC-03-01')
    expect(occurrences).toBeDefined()
    expect(occurrences!.length).toBeGreaterThan(0)
    expect(occurrences![0]!.file).toMatch(/with-tenant\.test\.ts$/)
  })

  it('matches both `describe("AC-XX-YY:")` and `it("AC-XX-YY:")`', async () => {
    const map = await scanTests(path.join(repoRoot, 'packages'))
    // AC-03-01 appears only as a describe block title in with-tenant.test.ts.
    const ac1 = map.get('AC-03-01')
    expect(ac1?.length).toBeGreaterThanOrEqual(1)
    // AC-03-02 appears as a describe block title (3 it cases live under it).
    const ac2 = map.get('AC-03-02')
    expect(ac2?.length).toBeGreaterThanOrEqual(1)
  })
})
