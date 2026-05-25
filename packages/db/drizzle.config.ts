import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://honeyai:honeyai_dev@localhost:55432/honeyai',
  },
  strict: true,
  verbose: true,
})
