import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/core',
  'packages/db',
  'packages/github',
  'packages/adapter-claude',
])
