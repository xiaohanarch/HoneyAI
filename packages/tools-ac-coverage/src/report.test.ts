import { describe, it, expect } from 'vitest'
import { report } from './report.js'
import type { SpecAC } from './scan-spec.js'
import type { TestAC } from './scan-tests.js'

const specEntry = (id: string): SpecAC => ({
  id,
  file: `docs/V1-SPEC/03-data-model.md`,
  line: 1,
  context: `- ${id}: dummy`,
})

const testEntry = (id: string): TestAC => ({
  id,
  file: `packages/db/src/tenant/with-tenant.test.ts`,
  line: 1,
  context: `describe('${id}: foo', () => {`,
  kind: 'describe',
})

describe('report', () => {
  it('classifies covered / missing / orphan correctly', () => {
    const spec = new Map([
      ['AC-03-01', specEntry('AC-03-01')],
      ['AC-03-02', specEntry('AC-03-02')],
    ])
    const tests = new Map([
      ['AC-03-01', [testEntry('AC-03-01')]],
      ['AC-99-99', [testEntry('AC-99-99')]],
    ])
    const r = report({ spec, tests, seed: ['AC-03-01', 'AC-03-02'] })
    expect(r.json.covered).toEqual(['AC-03-01'])
    expect(r.json.missing).toEqual(['AC-03-02'])
    expect(r.json.orphan).toEqual(['AC-99-99'])
  })

  it('returns exitCode=1 when any seed AC is missing a test', () => {
    const spec = new Map([['AC-03-01', specEntry('AC-03-01')]])
    const tests = new Map<string, TestAC[]>()
    const r = report({ spec, tests, seed: ['AC-03-01'] })
    expect(r.exitCode).toBe(1)
    expect(r.json.seedMissing).toEqual(['AC-03-01'])
  })

  it('returns exitCode=0 when all seed AC are covered', () => {
    const spec = new Map([
      ['AC-03-01', specEntry('AC-03-01')],
      ['AC-03-02', specEntry('AC-03-02')],
      ['AC-03-03', specEntry('AC-03-03')],
    ])
    const tests = new Map([
      ['AC-03-01', [testEntry('AC-03-01')]],
      ['AC-03-02', [testEntry('AC-03-02')]],
      ['AC-03-03', [testEntry('AC-03-03')]],
    ])
    const r = report({
      spec,
      tests,
      seed: ['AC-03-01', 'AC-03-02', 'AC-03-03'],
    })
    expect(r.exitCode).toBe(0)
    expect(r.json.seedMissing).toEqual([])
  })

  it('renders a markdown table with covered/missing/orphan sections', () => {
    const spec = new Map([
      ['AC-03-01', specEntry('AC-03-01')],
      ['AC-03-02', specEntry('AC-03-02')],
    ])
    const tests = new Map([
      ['AC-03-01', [testEntry('AC-03-01')]],
      ['AC-99-99', [testEntry('AC-99-99')]],
    ])
    const r = report({ spec, tests, seed: ['AC-03-01', 'AC-03-02'] })
    expect(r.markdown).toContain('AC-03-01')
    expect(r.markdown).toContain('AC-03-02')
    expect(r.markdown).toContain('AC-99-99')
    expect(r.markdown.toLowerCase()).toContain('covered')
    expect(r.markdown.toLowerCase()).toContain('missing')
    expect(r.markdown.toLowerCase()).toContain('orphan')
  })

  it('sorts ids alphabetically within each category', () => {
    const spec = new Map([
      ['AC-05-02', specEntry('AC-05-02')],
      ['AC-03-01', specEntry('AC-03-01')],
      ['AC-04-01', specEntry('AC-04-01')],
    ])
    const tests = new Map<string, TestAC[]>()
    const r = report({ spec, tests, seed: [] })
    expect(r.json.missing).toEqual(['AC-03-01', 'AC-04-01', 'AC-05-02'])
  })
})
