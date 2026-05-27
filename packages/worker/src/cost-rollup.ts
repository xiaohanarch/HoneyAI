import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>

/**
 * runCostRollup — SUM cost_events per run → UPDATE runs.total_cost_micro_usd.
 * Called every 5 minutes by the worker process.
 */
export async function runCostRollup(db: AnyDb): Promise<void> {
  // Use a single UPDATE ... FROM subquery for efficiency
  await db.execute(sql`
    UPDATE runs r
    SET total_cost_micro_usd = COALESCE(sub.total, 0)
    FROM (
      SELECT run_id, SUM(total_micro_usd) AS total
      FROM cost_events
      WHERE run_id IS NOT NULL
      GROUP BY run_id
    ) sub
    WHERE r.id = sub.run_id
      AND r.total_cost_micro_usd IS DISTINCT FROM COALESCE(sub.total, 0)
  `)
}
