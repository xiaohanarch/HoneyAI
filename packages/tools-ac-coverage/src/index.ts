#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
import { run } from './run.js'

export { run, SEED_AC, type RunOptions } from './run.js'
export { scanSpec, type SpecAC } from './scan-spec.js'
export { scanTests, type TestAC } from './scan-tests.js'
export { report, type ReportResult, type CoverageJson } from './report.js'

async function main(): Promise<void> {
  const [, , specArg, testArg] = process.argv
  const result = await run({
    specDir: specArg,
    testDir: testArg,
  })
   
  console.log(result.markdown)
  process.exit(result.exitCode)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
