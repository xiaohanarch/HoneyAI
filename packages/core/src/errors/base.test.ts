import { describe, it, expect } from 'vitest'
import { HoneyAIError } from './base.js'

describe('HoneyAIError', () => {
  it('carries code / userMessage / httpStatus and is instanceof Error', () => {
    const cause = new Error('upstream')
    const err = new HoneyAIError({
      code: 'TEST_CODE',
      message: 'internal',
      userMessage: 'something went wrong',
      httpStatus: 500,
      cause,
    })
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(HoneyAIError)
    expect(err.code).toBe('TEST_CODE')
    expect(err.userMessage).toBe('something went wrong')
    expect(err.httpStatus).toBe(500)
    expect(err.cause).toBe(cause)
    expect(err.name).toBe('HoneyAIError')
  })

  it('subclass inherits name from constructor', () => {
    class Sub extends HoneyAIError {
      constructor() {
        super({ code: 'SUB', message: 'sub', userMessage: 'sub', httpStatus: 400 })
      }
    }
    expect(new Sub().name).toBe('Sub')
  })
})
