import { describe, it, expect } from 'vitest'
import * as C from './index.js'

describe('constants', () => {
  it('exports DEFAULT_TARGET_BRANCH = "main"', () => {
    expect(C.DEFAULT_TARGET_BRANCH).toBe('main')
  })
  it('exports MAX_RUN_DURATION_MS = 30min', () => {
    expect(C.MAX_RUN_DURATION_MS).toBe(30 * 60 * 1000)
  })
  it('exports COST_MICRO_USD_PER_USD = 1_000_000', () => {
    expect(C.COST_MICRO_USD_PER_USD).toBe(1_000_000)
  })
})
