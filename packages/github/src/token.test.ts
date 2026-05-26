// packages/github/src/token.test.ts
import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken } from './token'

describe('encryptToken / decryptToken', () => {
  // AC-02-09: round-trip preserves plaintext
  it('AC-02-09: decryptToken(encryptToken(plain)) === plain', () => {
    const plain = 'gho_oauth_token_abc123'
    expect(decryptToken(encryptToken(plain))).toBe(plain)
  })

  it('AC-02-09: encryptToken output starts with v1:', () => {
    expect(encryptToken('anything')).toMatch(/^v1:/)
  })

  it('AC-02-09: throws on unrecognised cipher prefix', () => {
    expect(() => decryptToken('v9:invalid')).toThrow('Unsupported token cipher version')
  })

  it('AC-02-09: encryptToken is deterministic for the same input', () => {
    const token = 'gho_same_input'
    expect(encryptToken(token)).toBe(encryptToken(token))
  })
})
