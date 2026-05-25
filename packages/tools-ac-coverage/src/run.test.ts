import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { run } from './run.js'

describe('run (CLI)', () => {
  let workDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'ac-coverage-'))
    await mkdir(path.join(workDir, 'spec'), { recursive: true })
    await mkdir(path.join(workDir, 'tests'), { recursive: true })
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  it('writes coverage/ac.json and returns exitCode=0 when all seed ACs covered', async () => {
    await writeFile(path.join(workDir, 'spec', '03.md'), '# AC-03-01\n# AC-03-02\n# AC-03-03\n')
    await writeFile(
      path.join(workDir, 'tests', 'a.test.ts'),
      [
        "describe('AC-03-01: x', () => {})",
        "describe('AC-03-02: y', () => {})",
        "describe('AC-03-03: z', () => {})",
      ].join('\n'),
    )

    const result = await run({
      cwd: workDir,
      specDir: 'spec',
      testDir: 'tests',
      seed: ['AC-03-01', 'AC-03-02', 'AC-03-03'],
    })

    expect(result.exitCode).toBe(0)

    const jsonText = await readFile(path.join(workDir, 'coverage', 'ac.json'), 'utf8')
    const parsed = JSON.parse(jsonText)
    expect(parsed.covered.sort()).toEqual(['AC-03-01', 'AC-03-02', 'AC-03-03'])
    expect(parsed.seedMissing).toEqual([])
  })

  it('returns exitCode=1 when a seed AC has no matching test', async () => {
    await writeFile(path.join(workDir, 'spec', '03.md'), '# AC-03-01\n# AC-03-02\n')
    await writeFile(
      path.join(workDir, 'tests', 'a.test.ts'),
      "describe('AC-03-01: only one covered', () => {})",
    )

    const result = await run({
      cwd: workDir,
      specDir: 'spec',
      testDir: 'tests',
      seed: ['AC-03-01', 'AC-03-02'],
    })

    expect(result.exitCode).toBe(1)
    expect(result.json.seedMissing).toEqual(['AC-03-02'])
  })

  it('uses defaults docs/V1-SPEC + packages when only cwd is given', async () => {
    // Default paths layout under cwd
    await mkdir(path.join(workDir, 'docs/V1-SPEC'), { recursive: true })
    await mkdir(path.join(workDir, 'packages'), { recursive: true })
    await writeFile(path.join(workDir, 'docs/V1-SPEC/01.md'), '# AC-01-01\n')
    await writeFile(path.join(workDir, 'packages/a.test.ts'), "it('AC-01-01: ok', () => {})")

    const result = await run({ cwd: workDir, seed: ['AC-01-01'] })
    expect(result.exitCode).toBe(0)
    expect(result.json.covered).toEqual(['AC-01-01'])
  })
})
