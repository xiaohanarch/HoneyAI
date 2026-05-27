import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './prompts.js'

describe('buildSystemPrompt', () => {
  it('AC-06-14: enrich kind prompt mentions RequirementIR', () => {
    const prompt = buildSystemPrompt('enrich', 'some input')
    expect(prompt).toContain('RequirementIR')
  })

  it('AC-06-15: design kind prompt mentions DesignIR', () => {
    const prompt = buildSystemPrompt('design', 'some input')
    expect(prompt).toContain('DesignIR')
  })

  it('AC-06-16: implement kind prompt mentions ImplementationIR', () => {
    const prompt = buildSystemPrompt('implement', 'some input')
    expect(prompt).toContain('ImplementationIR')
  })

  it('AC-06-17: prompt includes the irInput content', () => {
    const prompt = buildSystemPrompt('enrich', 'UNIQUE_IR_CONTENT_123')
    expect(prompt).toContain('UNIQUE_IR_CONTENT_123')
  })
})
