// V1 stub — base64 envelope only. Real AES-GCM with KMS lands in Phase 3.
// See ADR-034.

const ENVELOPE_PREFIX = 'v1:'

export function encryptAnthropicKey(plaintext: string): string {
  if (!plaintext) throw new Error('encryptAnthropicKey: empty plaintext')
  const b64 = Buffer.from(plaintext, 'utf8').toString('base64')
  return ENVELOPE_PREFIX + b64
}

export function decryptAnthropicKey(ciphertext: string): string {
  if (!ciphertext.startsWith(ENVELOPE_PREFIX)) {
    throw new Error('decryptAnthropicKey: malformed envelope')
  }
  const b64 = ciphertext.slice(ENVELOPE_PREFIX.length)
  try {
    return Buffer.from(b64, 'base64').toString('utf8')
  } catch {
    throw new Error('decryptAnthropicKey: malformed base64')
  }
}
