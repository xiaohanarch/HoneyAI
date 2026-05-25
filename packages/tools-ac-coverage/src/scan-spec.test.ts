import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanSpec } from './scan-spec.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const specDir = path.join(repoRoot, 'docs/V1-SPEC')

describe('scanSpec', () => {
  it('extracts the 3 Phase-1 seed AC ids from V1-SPEC markdown', async () => {
    const map = await scanSpec(specDir)
    expect(map.has('AC-03-01')).toBe(true)
    expect(map.has('AC-03-02')).toBe(true)
    expect(map.has('AC-03-03')).toBe(true)
  })

  it('records the source file + line + context for each id', async () => {
    const map = await scanSpec(specDir)
    const ac = map.get('AC-03-01')
    expect(ac).toBeDefined()
    expect(ac!.id).toBe('AC-03-01')
    expect(ac!.file).toMatch(/03-data-model\.md$/)
    expect(ac!.line).toBeGreaterThan(0)
    expect(ac!.context.length).toBeGreaterThan(0)
  })

  it('returns an empty map when given a directory with no markdown', async () => {
    const map = await scanSpec(path.join(repoRoot, 'packages/core/src/log'))
    expect(map.size).toBe(0)
  })
})
