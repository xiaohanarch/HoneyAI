import { pathToFileURL } from 'node:url'
import { logger } from '@honeyai/core'

/**
 * Phase 1 seed is a no-op. Phase 2+ business seed
 * (pricing_book rows, official prompt assets, demo tenants, ...) will
 * land here. The shell entry remains stable so the `db:seed` npm script
 * keeps working unchanged.
 */
export async function runSeed(): Promise<void> {
  logger.info('seed: no-op in Phase 1 (db migration already covered table creation)')
}

// CLI entry — runs only when executed directly (`tsx src/seed/index.ts`),
// not when imported. `pathToFileURL` handles Windows path normalization that
// a hand-rolled `file://` template would miss.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runSeed()
}
