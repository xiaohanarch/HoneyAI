import { readFileSync } from 'node:fs'
import { z } from 'zod'

// ─── Schema ───────────────────────────────────────────────────────────────────

export const LlmEngineSchema = z.enum(['claude', 'opencode'])
export type LlmEngine = z.infer<typeof LlmEngineSchema>

const WorkerConfigFileSchema = z.object({
  llm: z
    .object({
      engine: LlmEngineSchema.default('claude'),
      model: z.string().optional(),
    })
    .default({}),
})

// ─── Public types ─────────────────────────────────────────────────────────────

export interface WorkerLlmConfig {
  engine: LlmEngine
  model: string | undefined
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load LLM engine config from honeyai.config.json (project root by default).
 *
 * Priority (highest → lowest):
 *   1. LLM_ENGINE / LLM_MODEL environment variables
 *   2. honeyai.config.json  llm.engine / llm.model fields
 *   3. Hardcoded default: engine=claude, model=undefined
 *
 * The config file is optional — missing file silently falls back to defaults.
 * A present but malformed file throws immediately (fail-fast).
 */
export function loadWorkerConfig(configPath?: string): WorkerLlmConfig {
  const path = configPath ?? defaultConfigPath()
  const fileConfig = readConfigFile(path)

  // env vars override config file
  const envEngine = process.env['LLM_ENGINE']
  const envModel = process.env['LLM_MODEL']

  const engine = envEngine ? LlmEngineSchema.parse(envEngine) : fileConfig.llm.engine
  const model = envModel ?? fileConfig.llm.model

  return { engine, model }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultConfigPath(): string {
  // process.cwd() is the monorepo root when the worker is launched via
  // `pnpm --filter @honeyai/worker start` or `tsx packages/worker/src/start.ts`
  return `${process.cwd()}/honeyai.config.json`
}

function readConfigFile(path: string): z.infer<typeof WorkerConfigFileSchema> {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // config file is optional — use schema defaults
      return WorkerConfigFileSchema.parse({})
    }
    throw new Error(
      `honeyai.config.json parse error: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  return WorkerConfigFileSchema.parse(raw)
}
