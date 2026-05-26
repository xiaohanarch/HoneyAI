import { describe, it, expect } from 'vitest'
import { assertNever } from './assertNever.js'

describe('assertNever', () => {
  it('throws at runtime when called with any value', () => {
    // 运行时守卫（编译期不会走到这里 — 测试中故意 cast）
    const badValue = 'UNKNOWN_STATE' as never
    expect(() => assertNever(badValue)).toThrow('Unexpected value in assertNever: "UNKNOWN_STATE"')
  })

  it('throws with number value', () => {
    expect(() => assertNever(42 as never)).toThrow('42')
  })
})
