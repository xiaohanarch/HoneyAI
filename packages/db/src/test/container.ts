import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Client } from 'pg'
import { randomBytes } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export type TestPgHandle = {
  container: StartedPostgreSqlContainer
  adminUrl: string
  templateName: string
  stop: () => Promise<void>
}

const TEMPLATE_NAME = 'template_honeyai'

function migrationsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '../../drizzle')
}

function hasMigrations(dir: string): boolean {
  if (!existsSync(dir)) return false
  return readdirSync(dir).some((f) => f.endsWith('.sql'))
}

export async function startTestPostgres(): Promise<TestPgHandle> {
  const container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('postgres')
    .withUsername('honeyai')
    .withPassword('honeyai_test')
    .start()

  const adminUrl = container.getConnectionUri()

  // 创建 template 库
  const admin = new Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${TEMPLATE_NAME}`)
  await admin.end()

  // 仅在 drizzle/ 有 migration 文件时执行 migrate（Phase 1 早期为空）
  const dir = migrationsDir()
  if (hasMigrations(dir)) {
    const templateUrl = adminUrl.replace(/\/postgres(\?|$)/, `/${TEMPLATE_NAME}$1`)
    const client = new Client({ connectionString: templateUrl })
    await client.connect()
    const db = drizzle(client)
    await migrate(db, { migrationsFolder: dir })
    await client.end()
  }

  // 标记 template 为只读 + 允许作为 TEMPLATE
  const lock = new Client({ connectionString: adminUrl })
  await lock.connect()
  await lock.query(`ALTER DATABASE ${TEMPLATE_NAME} IS_TEMPLATE true`)
  await lock.end()

  return {
    container,
    adminUrl,
    templateName: TEMPLATE_NAME,
    stop: async () => {
      await container.stop()
    },
  }
}

export async function createTestDatabase(handle: TestPgHandle): Promise<string> {
  const name = `test_${randomBytes(8).toString('hex')}`
  const admin = new Client({ connectionString: handle.adminUrl })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${name} TEMPLATE ${handle.templateName}`)
  await admin.end()
  return name
}

export async function dropTestDatabase(handle: TestPgHandle, name: string): Promise<void> {
  const admin = new Client({ connectionString: handle.adminUrl })
  await admin.connect()
  // 不用 WITH (FORCE)：FORCE 会向 pool.end() 刚 await 完但 socket 尚未完成 FIN 的
  // 后端发 FATAL 57P01,race 触发 pg 客户端 unhandled 'error' → vitest 非零退出。
  // 调用方契约:先 await pool.end() 再 dropTestDatabase。残留连接时显式失败更可靠。
  await admin.query(`DROP DATABASE IF EXISTS ${name}`)
  await admin.end()
}

export function testDatabaseUrl(handle: TestPgHandle, name: string): string {
  return handle.adminUrl.replace(/\/postgres(\?|$)/, `/${name}$1`)
}
