// packages/github/src/token.ts
// ⚠️ V1 stub: base64 envelope — NOT production encryption.
// Replace with AES-GCM in Phase 2.2 (same pattern as ADR-034 for Anthropic key).

/** Encode a GitHub OAuth / installation token for storage. */
export function encryptToken(plain: string): string {
  return `v1:${Buffer.from(plain).toString('base64')}`
}

/** Decode a stored token. */
export function decryptToken(cipher: string): string {
  if (!cipher.startsWith('v1:')) {
    throw new Error(`Unsupported token cipher version: "${cipher.slice(0, 3)}"`)
  }
  return Buffer.from(cipher.slice(3), 'base64').toString('utf8')
}
