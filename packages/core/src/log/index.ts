import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'
const level = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info')

export const logger = pino({
  level,
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
})

export type Logger = typeof logger
