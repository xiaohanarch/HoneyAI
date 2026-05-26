import { describe, it, expect } from 'vitest'
import { encryptAnthropicKey, decryptAnthropicKey } from './anthropic-key.js'

describe('anthropic-key crypto stub (ADR-034)', () => {
  it('encrypts to non-plaintext base64 envelope', () => {
    const key = 'sk-ant-' + 'a'.repeat(40)
    const cipher = encryptAnthropicKey(key)
    expect(cipher).not.toBe(key)
    expect(cipher).toMatch(/^v1:/)
  })

  it('round-trips encrypt -> decrypt', () => {
    const key = 'sk-ant-' + 'b'.repeat(40)
    expect(decryptAnthropicKey(encryptAnthropicKey(key))).toBe(key)
  })

  it('throws on malformed ciphertext', () => {
    expect(() => decryptAnthropicKey('not-a-valid-envelope')).toThrow(/malformed/i)
  })

  it('is deterministic for v1 stub (same plaintext -> same ciphertext)', () => {
    const k = 'sk-ant-' + 'c'.repeat(40)
    expect(encryptAnthropicKey(k)).toBe(encryptAnthropicKey(k))
  })
})
