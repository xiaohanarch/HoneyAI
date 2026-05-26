// packages/web/instrumentation.ts
// Next.js 15 server-boot hook. Called once per server process.
// See ADR-048.

export async function register() {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return
  if (process.env['DEV_AUTH_ENABLED'] !== 'true') return

  const { getDb } = await import('@honeyai/db')
  const { seedDevTenants } = await import('./lib/dev-seed')
  await seedDevTenants(getDb(), { devAuthEnabled: true })
}
