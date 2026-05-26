// packages/web/lib/errors/welcome-errors.ts
// Discriminated union types for welcome wizard error handling.

export type WelcomeErrorCode =
  | 'INVALID_KEY_FORMAT'
  | 'INVALID_REPO_FORMAT'
  | 'BOOTSTRAP_ALREADY_COMPLETE'
  | 'UNAUTHENTICATED'
  | 'TENANT_NOT_FOUND'
  | 'INTERNAL_ERROR'

export type WelcomeActionResult =
  | { ok: true }
  | { ok: false; code: WelcomeErrorCode; field?: string; message?: string }
