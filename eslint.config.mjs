import tseslint from 'typescript-eslint'
import eslint from '@eslint/js'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/drizzle/**',
      'prototype/**',
      'docs/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{cjs,js}'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
  },
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  // G5: Forbid business packages from importing the raw drizzle client.
  // The only legitimate entry-point for query execution is `withTenant()`.
  // `packages/db/**` itself is whitelisted via the override block below.
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@honeyai/db/client',
              importNames: ['rawDb', 'systemDb'],
              message:
                'Do not import rawDb / systemDb directly. Use `withTenant(db, tenantId)` from @honeyai/db so tenant scoping and audit logging are enforced.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/db/**'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
)
