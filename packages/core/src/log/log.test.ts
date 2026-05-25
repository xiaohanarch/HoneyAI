import { describe, it, expect } from 'vitest'
import { logger } from './index.js'

describe('logger', () => {
  it('exposes pino-compatible methods', () => {
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  it('.child({ traceId, tenantId }) returns a logger with the same shape', () => {
    const child = logger.child({ traceId: 't-123', tenantId: 'ten-a' })
    expect(typeof child.info).toBe('function')
    expect(child).not.toBe(logger)
  })
})
