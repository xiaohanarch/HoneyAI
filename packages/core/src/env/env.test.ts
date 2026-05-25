import { describe, it, expect } from 'vitest'
import { loadEnv } from './index.js'

describe('loadEnv', () => {
  it('parses valid env', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://u:p@h:5432/d',
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
    })
    expect(env.DATABASE_URL).toBe('postgresql://u:p@h:5432/d')
    expect(env.NODE_ENV).toBe('development')
    expect(env.LOG_LEVEL).toBe('debug')
  })

  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadEnv({ NODE_ENV: 'development', LOG_LEVEL: 'info' })).toThrow(/DATABASE_URL/)
  })

  it('throws when DATABASE_URL is not a postgres URL', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: 'mysql://u:p@h/d',
        NODE_ENV: 'development',
        LOG_LEVEL: 'info',
      }),
    ).toThrow(/postgres/i)
  })
})
