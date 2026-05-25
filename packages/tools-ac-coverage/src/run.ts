import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { scanSpec } from './scan-spec.js'
import { scanTests } from './scan-tests.js'
import { report, type ReportResult } from './report.js'

/** Phase-1 seed ACs that MUST be covered (drives non-zero exit). */
export const SEED_AC = ['AC-03-01', 'AC-03-02', 'AC-03-03'] as const

export interface RunOptions {
  /** Working directory; all relative paths resolve against this. Defaults to `process.cwd()`. */
  cwd?: string
  /** Spec markdown root relative to `cwd`. Default: `docs/V1-SPEC`. */
  specDir?: string
  /** Test files root relative to `cwd`. Default: `packages`. */
  testDir?: string
  /** Seed ACs to gate exit code on. Default: `SEED_AC`. */
  seed?: readonly string[]
  /** Output directory for `ac.json`, relative to `cwd`. Default: `coverage`. */
  outDir?: string
}

/**
 * Runs the full AC-coverage pipeline: scan spec markdown + scan vitest titles,
 * produce a 3-state join report, write JSON to `<cwd>/<outDir>/ac.json`, and
 * return the result. Caller is responsible for `process.exit(result.exitCode)`.
 */
export async function run(options: RunOptions = {}): Promise<ReportResult> {
  const cwd = options.cwd ?? process.cwd()
  const specDir = path.resolve(cwd, options.specDir ?? 'docs/V1-SPEC')
  const testDir = path.resolve(cwd, options.testDir ?? 'packages')
  const outDir = path.resolve(cwd, options.outDir ?? 'coverage')
  const seed = [...(options.seed ?? SEED_AC)]

  const [spec, tests] = await Promise.all([scanSpec(specDir), scanTests(testDir)])
  const result = report({ spec, tests, seed })

  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, 'ac.json'), JSON.stringify(result.json, null, 2))

  return result
}
