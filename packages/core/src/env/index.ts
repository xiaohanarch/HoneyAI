import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export function loadEnv(source: Record<string, string | undefined> = process.env) {
  return createEnv({
    server: {
      DATABASE_URL: z
        .string()
        .url()
        .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
          message: 'DATABASE_URL must be a postgres URL',
        }),
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    },
    runtimeEnv: source,
    emptyStringAsUndefined: true,
    onValidationError: (error) => {
      const detail = error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')
      throw new Error(`Invalid environment variables: ${detail}`)
    },
  })
}

export type Env = ReturnType<typeof loadEnv>
