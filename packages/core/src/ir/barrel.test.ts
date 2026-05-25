import { describe, it, expect } from 'vitest'
import {
  RequirementIRSchema,
  DesignIRSchema,
  ImplementationIRSchema,
  parseRequirementIR,
  parseDesignIR,
  parseImplementationIR,
  stringifyRequirementIR,
  stringifyDesignIR,
  stringifyImplementationIR,
  PrioritySchema,
  ComplexitySchema,
  RiskLevelSchema,
  FindingSeveritySchema,
  REQUIRED_REQUIREMENT_SECTIONS,
} from './index.js'

describe('IR barrel', () => {
  it('re-exports all 3 schemas + 3 parse + 3 stringify + 4 shared enums + required-sections const', () => {
    expect(RequirementIRSchema).toBeDefined()
    expect(DesignIRSchema).toBeDefined()
    expect(ImplementationIRSchema).toBeDefined()
    expect(typeof parseRequirementIR).toBe('function')
    expect(typeof parseDesignIR).toBe('function')
    expect(typeof parseImplementationIR).toBe('function')
    expect(typeof stringifyRequirementIR).toBe('function')
    expect(typeof stringifyDesignIR).toBe('function')
    expect(typeof stringifyImplementationIR).toBe('function')
    expect(PrioritySchema).toBeDefined()
    expect(ComplexitySchema).toBeDefined()
    expect(RiskLevelSchema).toBeDefined()
    expect(FindingSeveritySchema).toBeDefined()
    expect(REQUIRED_REQUIREMENT_SECTIONS).toHaveLength(4)
  })
})
