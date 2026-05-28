import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'
const level = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info')

// pino-pretty uses worker_threads which cannot be resolved inside the Next.js
// webpack bundle. Skip it when running in any Next.js server runtime.
const usesPretty = isDev && !process.env.NEXT_RUNTIME

export const logger = pino({
  level,
  transport: usesPretty
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
})

export type Logger = typeof logger
