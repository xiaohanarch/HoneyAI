# Phase 2 — 切片 4.1: `@honeyai/web` Next.js 骨架 + Auth + tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `@honeyai/web` from a placeholder (`export {}`) into a working Next.js 15 App Router application skeleton with NextAuth v5 Credentials dev provider, a fully spec-compliant `tokens.css` (verbatim from spec `07-frontend.md §10`), Tailwind v4 wired to CSS vars, shadcn/ui initialized, and Vitest unit tests covering the auth logic, layout rendering, and login page field existence.

**Architecture:** `@honeyai/web` is a unified Next.js 15 App Router application (ADR-003) running on Node runtime — no Edge runtime. Data fetching uses RSC + Server Actions only, no tRPC / TanStack Query (ADR-031). Authentication uses NextAuth v5 Credentials provider in development only (ADR-029), with a module-level guard that throws if `NODE_ENV !== 'development'` or `DEV_AUTH_ENABLED !== 'true'`. CSS design tokens live in `styles/tokens.css`, sourced verbatim from spec `07-frontend.md §10`; Tailwind v4 consumes them via arbitrary-value syntax `bg-[var(--xxx)]` (Q4). The app directory follows a feature-based route group layout (Q1): `app/(auth)/login/`, `app/(welcome)/`, `app/t/[slug]/` — route groups `(welcome)` and `app/t/[slug]/` are created as empty stubs in this slice only (the Welcome 4-step guide and Run list land in 4.3/4.4 respectively). `middleware.ts` is a passthrough stub — multi-tenant slug parsing lands in 4.5.

**Tech Stack:**

- Node `>=22.11.0` (ADR-017)
- Next.js `15.x` (spec 02 + ADR-003; installs React 19.x as peer)
- NextAuth `5.0.0-beta.x` (v5; v4 not compatible with App Router full server-side helpers)
- Tailwind CSS `4.x` + `@tailwindcss/postcss`
- shadcn/ui CLI (`shadcn@latest`) — `components.json` only in this slice; component code lands in 4.2
- Vitest `2.1.8` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` — no Playwright (Q11)
- `@honeyai/core` `workspace:*` — env helper pattern
- `@honeyai/db` — NOT imported in 4.1 (no db queries in this slice; db import arrives in 4.4)
- TypeScript `5.7.2`, `tsconfig` extends `../../tsconfig.base.json`, `jsx: "preserve"`, `moduleResolution: "Bundler"`

**Reference docs read before starting:**

- `docs/V1-SPEC/07-frontend.md` — tokens.css §10, route structure §2, component sketches §11
- `docs/V1-SPEC/decisions/phase-2-4-open-questions.md` — Q1/Q2/Q3/Q4/Q10/Q11/Q12 拍板
- `docs/V1-SPEC/ADRs/ADR-029-nextauth-credentials-dev.md` — auth strategy
- `docs/V1-SPEC/ADRs/ADR-031-web-rsc-server-action-no-trpc.md` — data layer
- `docs/V1-SPEC/ADRs/ADR-003-unified-nextjs.md` — unified Next.js
- `docs/V1-SPEC/ADRs/ADR-006-bootstrap-ux.md` — Welcome layout must leave space

**Branch:** `feat/phase-2-4-1-web-skeleton`

**Acceptance:**

- `pnpm --filter @honeyai/web test` 100% green
- `pnpm --filter @honeyai/web typecheck` green
- `pnpm --filter @honeyai/web lint` green
- `pnpm --filter @honeyai/web build` exits 0 (Next.js standalone)
- `pnpm dev` (in `packages/web`) renders `/` and `/login` without runtime errors
- `pnpm ac:coverage` does not regress (this slice introduces no seed AC-prefixed tests)
- ADRs 029, 030, 031 already present in repo (opened in the `docs/phase-2-1-and-4-prep` PR)

---

## File Structure

| Path                                               | Responsibility                                                                                                                                                                                                                       | Est. Lines |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `packages/web/package.json`                        | Real deps: next, react, react-dom, next-auth, tailwindcss, @tailwindcss/postcss, @testing-library/react, @testing-library/jest-dom, @vitejs/plugin-react, vitest, jsdom                                                              | 50         |
| `packages/web/tsconfig.json`                       | Extends base, adds `jsx: "preserve"`, path alias `@/*` → `./src/*`, includes `next-env.d.ts`                                                                                                                                         | 20         |
| `packages/web/next.config.mjs`                     | `output: "standalone"`, `experimental: { serverComponentsExternalPackages: ['pg'] }`                                                                                                                                                 | 20         |
| `packages/web/postcss.config.mjs`                  | `@tailwindcss/postcss` plugin                                                                                                                                                                                                        | 10         |
| `packages/web/next-env.d.ts`                       | Generated by Next.js; reference `@types/next` types                                                                                                                                                                                  | 5          |
| `packages/web/vitest.config.ts`                    | Vitest jsdom + React plugin + alias `@/` resolving to `src/`                                                                                                                                                                         | 20         |
| `packages/web/components.json`                     | shadcn init config: `style: "default"`, `rsc: true`, `tsx: true`, `tailwind.config`, `aliases`                                                                                                                                       | 30         |
| `packages/web/styles/tokens.css`                   | Full OKLCH design tokens verbatim from spec 07 §10: surfaces / text / status / agent palette / typography vars / font-size scale / spacing / radius / shadow / motion + `.bg-atmosphere` + `.grain::before` + `@keyframes pulse-run` | 100        |
| `packages/web/styles/globals.css`                  | Tailwind v4 `@import "tailwindcss"` + `@import "./tokens.css"` + minimal global reset (box-sizing, font smoothing)                                                                                                                   | 25         |
| `packages/web/app/layout.tsx`                      | Root RSC layout: `<html lang="zh-CN">`, imports `globals.css`, sets `metadata` title/description, renders `{children}`                                                                                                               | 35         |
| `packages/web/app/page.tsx`                        | Root page: RSC, simple welcome message "欢迎使用 HoneyAI", link to `/login`, uses `--bg-atmosphere` class                                                                                                                            | 25         |
| `packages/web/app/(auth)/login/page.tsx`           | Login page: RSC with a `<LoginForm />` Client Component wrapper — email + password fields, submit triggers `signIn('credentials')` Server Action                                                                                     | 60         |
| `packages/web/app/(auth)/login/LoginForm.tsx`      | `'use client'` component — `<form>` with username/password inputs + submit button; calls `signIn('credentials', { username, password, redirectTo: '/' })` via import from `next-auth/react`                                          | 60         |
| `packages/web/app/(welcome)/layout.tsx`            | Stub layout for welcome route group — renders `{children}` only                                                                                                                                                                      | 10         |
| `packages/web/app/t/[slug]/layout.tsx`             | Stub layout for tenant route group — renders `{children}` only (tenant auth/middleware lands in 4.5)                                                                                                                                 | 10         |
| `packages/web/app/api/auth/[...nextauth]/route.ts` | NextAuth v5 route handler: `export { GET, POST } from '@/lib/auth/index.js'`                                                                                                                                                         | 5          |
| `packages/web/lib/auth/index.ts`                   | NextAuth v5 config: `providers` (conditionally includes Credentials in dev), `session: { strategy: 'jwt' }`, `callbacks.jwt` (embed userId + tenantId placeholder), exports `{ handlers, auth, signIn, signOut }`                    | 80         |
| `packages/web/lib/auth/dev-credentials.ts`         | Module-level guard (throws if not dev + DEV_AUTH_ENABLED), exports `DEV_USERS` fixture array + `CredentialsConfig` object                                                                                                            | 50         |
| `packages/web/lib/auth/types.ts`                   | `Session` + `JWT` type augmentation via `next-auth` module augmentation; adds `userId: string`, `tenantId: string \| null`                                                                                                           | 30         |
| `packages/web/lib/strings/zh.ts`                   | All UI strings for this slice: login page labels, welcome text, error messages (Q10)                                                                                                                                                 | 30         |
| `packages/web/middleware.ts`                       | Passthrough stub: exports `config.matcher`; actual tenant parsing lands in 4.5                                                                                                                                                       | 15         |
| `packages/web/lib/auth/dev-credentials.test.ts`    | TDD: guard throws in non-dev, DEV_USERS has expected shape, credential check happy + wrong-password failure                                                                                                                          | 50         |
| `packages/web/lib/auth/auth.test.ts`               | TDD: `auth()` returns null when no session (mock NextAuth), session shape has `userId` + `tenantId` fields                                                                                                                           | 40         |
| `packages/web/app/layout.test.tsx`                 | Vitest + jsdom: renders layout, asserts `<html lang="zh-CN">` attribute, asserts children rendered                                                                                                                                   | 35         |
| `packages/web/app/(auth)/login/page.test.tsx`      | Vitest + jsdom: renders login page, asserts username field + password field + submit button exist                                                                                                                                    | 35         |
| `.env.example`                                     | Append `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DEV_AUTH_ENABLED` with comments                                                                                                                                                           | +6 lines   |

**Total estimated lines: ~850** (excluding generated `pnpm-lock.yaml` diff)

---

## Task 1: Branch + `package.json` — real Next.js 15 dependencies

**Files:**

- Modify: `packages/web/package.json`
- Modify: `packages/web/tsconfig.json`

- [ ] **Step 1: Create branch from main**

```bash
cd /d/code/ai-devops
git checkout main
git pull --ff-only
git checkout -b feat/phase-2-4-1-web-skeleton
```

- [ ] **Step 2: Replace `packages/web/package.json` with real dependencies**

Replace the entire file with:

```json
{
  "name": "@honeyai/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src app lib styles middleware.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@honeyai/core": "workspace:*",
    "next": "15.3.2",
    "next-auth": "5.0.0-beta.25",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.1.6",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.3.0",
    "@types/node": "22.15.0",
    "@types/react": "19.1.0",
    "@types/react-dom": "19.1.0",
    "@vitejs/plugin-react": "4.4.1",
    "eslint": "9.17.0",
    "jsdom": "26.1.0",
    "tailwindcss": "4.1.6",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  },
  "engines": {
    "node": ">=22.11.0"
  }
}
```

- [ ] **Step 3: Update `packages/web/tsconfig.json` for Next.js App Router**

Replace the entire file with:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "Bundler",
    "allowJs": true,
    "paths": {
      "@/*": ["./*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Note: `rootDir` is NOT set — Next.js App Router places `app/` at the package root (not under `src/`). `@/` alias maps to `./` (package root).

- [ ] **Step 4: Install dependencies**

```bash
cd /d/code/ai-devops
pnpm install
```

Expected: lock file updated; no peer-dependency errors. Next.js 15 ships React 19 as a peer — both `react` and `react-dom` 19.x in `dependencies` satisfy this.

- [ ] **Step 5: Verify Next.js CLI is reachable**

```bash
pnpm --filter @honeyai/web exec next --version
```

Expected output (example): `Next.js 15.3.2`

- [ ] **Step 6: Commit**

```bash
git add packages/web/package.json packages/web/tsconfig.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(web): add next 15 + nextauth v5 + tailwind v4 dependencies

Converts @honeyai/web from placeholder to real Next.js 15 package.
Pins react 19.1.0 to match Next.js 15 peer requirement.
EOF
)"
```

---

## Task 2: `next.config.mjs` + `postcss.config.mjs` + `vitest.config.ts`

**Files:**

- Create: `packages/web/next.config.mjs`
- Create: `packages/web/postcss.config.mjs`
- Create: `packages/web/vitest.config.ts`
- Create: `packages/web/next-env.d.ts`

- [ ] **Step 1: Create `next.config.mjs`**

```js
// packages/web/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // pg native bindings require external package handling
    serverComponentsExternalPackages: ['pg', 'pg-native'],
  },
}

export default nextConfig
```

- [ ] **Step 2: Create `postcss.config.mjs`**

```js
// packages/web/postcss.config.mjs
/** @type {import('postcss').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

- [ ] **Step 3: Create `packages/web/vitest.config.ts`**

```ts
// packages/web/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 4: Create `packages/web/vitest.setup.ts`**

```ts
// packages/web/vitest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create `packages/web/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 6: Verify vitest can find the config**

```bash
pnpm --filter @honeyai/web exec vitest --version
```

Expected output: vitest version string (e.g. `2.1.8`)

- [ ] **Step 7: Commit**

```bash
git add packages/web/next.config.mjs packages/web/postcss.config.mjs packages/web/vitest.config.ts packages/web/vitest.setup.ts packages/web/next-env.d.ts
git commit -m "$(cat <<'EOF'
feat(web): add next.config, postcss (tailwind v4), vitest jsdom config
EOF
)"
```

---

## Task 3: `styles/tokens.css` + `styles/globals.css` — full spec token verbatim copy

**Files:**

- Create: `packages/web/styles/tokens.css`
- Create: `packages/web/styles/globals.css`

> This task has no TDD loop (pure CSS). Verification is via `next build` and manual `dev` server inspection in Task 10.

- [ ] **Step 1: Create `packages/web/styles/tokens.css`**

Copy verbatim from `docs/V1-SPEC/07-frontend.md §10`. Every variable listed below is present in the spec — no additions, no omissions.

```css
/* packages/web/styles/tokens.css */
/* Design tokens — source of truth: docs/V1-SPEC/07-frontend.md §10 */
:root {
  /* Surfaces (OKLCH) */
  --bg-base: oklch(98% 0.005 90);
  --bg-card: oklch(99% 0.003 90);
  --bg-elev: oklch(100% 0 0);
  --bg-deep: oklch(94% 0.008 90);

  /* Text scale */
  --text-strong: oklch(18% 0.01 250);
  --text-body: oklch(28% 0.01 250);
  --text-muted: oklch(48% 0.008 250);
  --text-faint: oklch(65% 0.005 250);

  /* Status */
  --status-done: oklch(68% 0.14 145);
  --status-run: oklch(72% 0.16 60);
  --status-review: oklch(74% 0.12 270);
  --status-idle-soft: oklch(78% 0.02 250);
  --status-halt: oklch(60% 0.22 25);

  /* Agent identity palette */
  --a-req: oklch(70% 0.14 30);
  --a-graph: oklch(70% 0.14 90);
  --a-arch: oklch(70% 0.14 150);
  --a-dev: oklch(70% 0.14 210);
  --a-sec: oklch(70% 0.14 270);
  --a-perf: oklch(70% 0.14 330);
  --a-test: oklch(70% 0.14 60);

  /* Typography */
  --font-ui: 'Inter', system-ui, sans-serif;
  --font-display: 'Instrument Serif', 'Songti SC', serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Font-size scale (fluid) */
  --text-xs: clamp(0.75rem, 0.72rem + 0.1vw, 0.8125rem);
  --text-sm: clamp(0.875rem, 0.84rem + 0.15vw, 0.9375rem);
  --text-base: clamp(1rem, 0.96rem + 0.2vw, 1.0625rem);
  --text-lg: clamp(1.125rem, 1.06rem + 0.3vw, 1.25rem);
  --text-xl: clamp(1.375rem, 1.25rem + 0.5vw, 1.625rem);
  --text-2xl: clamp(1.75rem, 1.5rem + 1vw, 2.25rem);
  --text-3xl: clamp(2.25rem, 1.75rem + 2vw, 3.5rem);
  --text-hero: clamp(3rem, 1rem + 7vw, 8rem);

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-section: clamp(4rem, 3rem + 5vw, 10rem);

  /* Radius */
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 16px;
  --r-xl: 24px;

  /* Shadow */
  --shadow-soft: 0 1px 2px oklch(0% 0 0 / 0.04), 0 4px 12px oklch(0% 0 0 / 0.04);
  --shadow-elev: 0 2px 8px oklch(0% 0 0 / 0.06), 0 12px 32px oklch(0% 0 0 / 0.08);

  /* Motion */
  --dur-fast: 150ms;
  --dur-normal: 300ms;
  --dur-slow: 500ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Atmosphere (signature look) */
.bg-atmosphere {
  background: radial-gradient(ellipse 80% 50% at 70% 0%, oklch(95% 0.05 60 / 0.4), transparent 60%),
    radial-gradient(ellipse 60% 60% at 20% 100%, oklch(95% 0.04 270 / 0.3), transparent 70%),
    var(--bg-base);
}

.grain::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 100;
  background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity: 0.08;
  mix-blend-mode: multiply;
}

/* Motion utilities */
@keyframes pulse-run {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--status-run);
    opacity: 1;
  }
  50% {
    box-shadow: 0 0 0 8px transparent;
    opacity: 0.7;
  }
}
.pulse-run {
  animation: pulse-run 2s var(--ease-in-out) infinite;
}
```

Token count: 4 surface colors + 4 text colors + 5 status colors + 7 agent colors = **20 color vars**; 8 font-size vars + 3 font-family vars = **11 typography vars**; 8 spacing vars + 4 radius vars + 2 shadow vars + 5 motion vars = **19 structural vars**. Total: **50 CSS custom properties** + 2 utility classes + 1 keyframe.

- [ ] **Step 2: Create `packages/web/styles/globals.css`**

```css
/* packages/web/styles/globals.css */
@import 'tailwindcss';
@import './tokens.css';

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--bg-base);
  color: var(--text-body);
  font-family: var(--font-ui);
  font-size: var(--text-base);
  line-height: 1.6;
  margin: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/styles/tokens.css packages/web/styles/globals.css
git commit -m "$(cat <<'EOF'
feat(web): add tokens.css (50 CSS vars verbatim from spec 07) + globals.css
EOF
)"
```

---

## Task 4: `lib/auth/types.ts` + `lib/auth/dev-credentials.ts` — TDD red → green

**Files:**

- Create: `packages/web/lib/auth/types.ts`
- Create: `packages/web/lib/auth/dev-credentials.ts`
- Create: `packages/web/lib/auth/dev-credentials.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/lib/auth/dev-credentials.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('dev-credentials guard', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws when NODE_ENV is not development', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DEV_AUTH_ENABLED'] = 'true'
    await expect(import('./dev-credentials.js')).rejects.toThrow(
      'DEV_CREDENTIALS: only available in development with DEV_AUTH_ENABLED=true',
    )
  })

  it('throws when DEV_AUTH_ENABLED is not "true"', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['DEV_AUTH_ENABLED'] = 'false'
    await expect(import('./dev-credentials.js')).rejects.toThrow(
      'DEV_CREDENTIALS: only available in development with DEV_AUTH_ENABLED=true',
    )
  })

  it('throws when DEV_AUTH_ENABLED is absent', async () => {
    process.env['NODE_ENV'] = 'development'
    delete process.env['DEV_AUTH_ENABLED']
    await expect(import('./dev-credentials.js')).rejects.toThrow(
      'DEV_CREDENTIALS: only available in development with DEV_AUTH_ENABLED=true',
    )
  })

  it('exports DEV_USERS array with at least 4 fixture users when guard passes', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['DEV_AUTH_ENABLED'] = 'true'
    const mod = await import('./dev-credentials.js')
    expect(Array.isArray(mod.DEV_USERS)).toBe(true)
    expect(mod.DEV_USERS.length).toBeGreaterThanOrEqual(4)
  })

  it('each fixture user has username and password fields', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['DEV_AUTH_ENABLED'] = 'true'
    const { DEV_USERS } = await import('./dev-credentials.js')
    for (const user of DEV_USERS) {
      expect(typeof user['username']).toBe('string')
      expect(typeof user['password']).toBe('string')
      expect(typeof user['id']).toBe('string')
      expect(typeof user['name']).toBe('string')
    }
  })

  it('authorizeDevCredentials returns user on correct credentials', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['DEV_AUTH_ENABLED'] = 'true'
    const { authorizeDevCredentials } = await import('./dev-credentials.js')
    const result = await authorizeDevCredentials({ username: 'alice', password: 'dev-alice' })
    expect(result).not.toBeNull()
    expect(result?.name).toBe('alice')
  })

  it('authorizeDevCredentials returns null on wrong password', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['DEV_AUTH_ENABLED'] = 'true'
    const { authorizeDevCredentials } = await import('./dev-credentials.js')
    const result = await authorizeDevCredentials({ username: 'alice', password: 'wrong' })
    expect(result).toBeNull()
  })

  it('authorizeDevCredentials returns null on unknown user', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['DEV_AUTH_ENABLED'] = 'true'
    const { authorizeDevCredentials } = await import('./dev-credentials.js')
    const result = await authorizeDevCredentials({ username: 'nobody', password: 'dev-nobody' })
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails (RED)**

```bash
pnpm --filter @honeyai/web test -- dev-credentials
```

Expected: FAIL — `Cannot find module './dev-credentials.js'`.

- [ ] **Step 3: Create `packages/web/lib/auth/types.ts`**

```ts
// packages/web/lib/auth/types.ts
// NextAuth v5 module augmentation — adds userId and tenantId to Session + JWT.
// See: https://authjs.dev/getting-started/typescript

import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      tenantId: string | null
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    tenantId: string | null
  }
}

export type {}
```

- [ ] **Step 4: Create `packages/web/lib/auth/dev-credentials.ts`**

The module-level guard runs at import time. Convention: passwords follow pattern `dev-<username>` (no real secrets — these are documented dev fixtures only, not production credentials).

```ts
// packages/web/lib/auth/dev-credentials.ts
// Dev-only fixture users for NextAuth v5 Credentials provider (ADR-029).
// GUARD: this module throws at import time outside development.
// In production, NODE_ENV=production + DEV_AUTH_ENABLED absent ensures this
// module is NEVER imported — the auth config conditionally omits the provider.

if (process.env['NODE_ENV'] !== 'development' || process.env['DEV_AUTH_ENABLED'] !== 'true') {
  throw new Error('DEV_CREDENTIALS: only available in development with DEV_AUTH_ENABLED=true')
}

export type DevUser = {
  id: string
  username: string
  password: string
  name: string
  email: string
}

// Fixture users — alice / bob / carol / dave.
// Passwords are non-secret dev values; documented in .env.example.
export const DEV_USERS: DevUser[] = [
  {
    id: 'dev-user-alice',
    username: 'alice',
    password: 'dev-alice',
    name: 'alice',
    email: 'alice@dev.local',
  },
  {
    id: 'dev-user-bob',
    username: 'bob',
    password: 'dev-bob',
    name: 'bob',
    email: 'bob@dev.local',
  },
  {
    id: 'dev-user-carol',
    username: 'carol',
    password: 'dev-carol',
    name: 'carol',
    email: 'carol@dev.local',
  },
  {
    id: 'dev-user-dave',
    username: 'dave',
    password: 'dev-dave',
    name: 'dave',
    email: 'dave@dev.local',
  },
]

/**
 * Authorize function for NextAuth v5 Credentials provider.
 * Plain-text comparison is acceptable for dev-only fixture data (no real users).
 * Returns a user object compatible with NextAuth's `User` type, or null on mismatch.
 */
export async function authorizeDevCredentials(
  credentials: Record<string, string> | undefined,
): Promise<{ id: string; name: string; email: string } | null> {
  if (!credentials) return null
  const { username, password } = credentials
  const found = DEV_USERS.find((u) => u.username === username && u.password === password)
  if (!found) return null
  return { id: found.id, name: found.name, email: found.email }
}
```

- [ ] **Step 5: Run test to verify it passes (GREEN)**

```bash
pnpm --filter @honeyai/web test -- dev-credentials
```

Expected: all 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/lib/auth/types.ts packages/web/lib/auth/dev-credentials.ts packages/web/lib/auth/dev-credentials.test.ts
git commit -m "$(cat <<'EOF'
feat(web/auth): dev-credentials fixture users + module-level guard (ADR-029)
EOF
)"
```

---

## Task 5: `lib/auth/index.ts` — NextAuth v5 config + `auth()` helper TDD

**Files:**

- Create: `packages/web/lib/auth/index.ts`
- Create: `packages/web/lib/auth/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web/lib/auth/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next-auth before importing the module under test
vi.mock('next-auth', () => ({
  default: (config: unknown) => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn().mockResolvedValue(null),
    signIn: vi.fn(),
    signOut: vi.fn(),
    _config: config,
  }),
}))

vi.mock('next-auth/providers/credentials', () => ({
  default: (opts: unknown) => ({ type: 'credentials', ...opts }),
}))

describe('auth config', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env['NODE_ENV'] = 'development'
    process.env['DEV_AUTH_ENABLED'] = 'true'
    process.env['NEXTAUTH_SECRET'] = 'test-secret-32-bytes-placeholder!!'
  })

  it('exports handlers, auth, signIn, signOut', async () => {
    const mod = await import('./index.js')
    expect(typeof mod.handlers).toBe('object')
    expect(typeof mod.auth).toBe('function')
    expect(typeof mod.signIn).toBe('function')
    expect(typeof mod.signOut).toBe('function')
  })

  it('auth() returns null when no session exists (mocked)', async () => {
    const { auth } = await import('./index.js')
    const session = await auth()
    expect(session).toBeNull()
  })

  it('includes Credentials provider when NODE_ENV=development and DEV_AUTH_ENABLED=true', async () => {
    const mod = await import('./index.js')
    // The internal NextAuth call receives config with providers array
    // We verify the module loads without throwing (guard satisfied)
    expect(mod.handlers).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails (RED)**

```bash
pnpm --filter @honeyai/web test -- auth.test
```

Expected: FAIL — `Cannot find module './index.js'`.

- [ ] **Step 3: Create `packages/web/lib/auth/index.ts`**

```ts
// packages/web/lib/auth/index.ts
// NextAuth v5 configuration — unified entry point (ADR-029).
// Exports: { handlers, auth, signIn, signOut }
// Strategy: JWT (no DB session table — consistent with GitHub OAuth provider in slice 3)
// Credentials provider is conditionally included in development only.

import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import './types.js'

// Conditionally load dev credentials — throws in production (guard in dev-credentials.ts)
async function buildProviders() {
  if (process.env['NODE_ENV'] === 'development' && process.env['DEV_AUTH_ENABLED'] === 'true') {
    const Credentials = (await import('next-auth/providers/credentials')).default
    const { authorizeDevCredentials } = await import('./dev-credentials.js')
    return [
      Credentials({
        name: 'Dev Credentials',
        credentials: {
          username: { label: 'Username', type: 'text' },
          password: { label: 'Password', type: 'password' },
        },
        authorize: authorizeDevCredentials,
      }),
    ]
  }
  // Production: GitHub OAuth provider will be added in slice 3 (ADR-029 §consequences)
  return []
}

const config: NextAuthConfig = {
  providers: await buildProviders(),
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // user.id is set by Credentials authorize return value
        token['id'] = user.id ?? ''
        // tenantId: null in slice 4.1; resolved in slice 4.5 when middleware parses slug
        token['tenantId'] = null
      }
      return token
    },
    session({ session, token }) {
      session.user.id = String(token['id'] ?? '')
      session.user.tenantId = (token['tenantId'] as string | null) ?? null
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)
```

- [ ] **Step 4: Run test to verify it passes (GREEN)**

```bash
pnpm --filter @honeyai/web test -- auth.test
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Create `packages/web/app/api/auth/[...nextauth]/route.ts`**

```ts
// packages/web/app/api/auth/[...nextauth]/route.ts
export { GET, POST } from '@/lib/auth/index.js'
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/lib/auth/index.ts packages/web/lib/auth/auth.test.ts packages/web/app/api/auth/[...nextauth]/route.ts
git commit -m "$(cat <<'EOF'
feat(web/auth): nextauth v5 config + jwt callbacks + route handler (ADR-029)
EOF
)"
```

---

## Task 6: `lib/strings/zh.ts` + `middleware.ts` passthrough stub

**Files:**

- Create: `packages/web/lib/strings/zh.ts`
- Create: `packages/web/middleware.ts`

> No TDD loop — pure data file and passthrough stub. Verification: typecheck + lint.

- [ ] **Step 1: Create `packages/web/lib/strings/zh.ts`**

All UI text for slice 4.1 is centralized here (Q10). Keys added incrementally as components are built.

```ts
// packages/web/lib/strings/zh.ts
// All zh-CN UI strings for @honeyai/web (Q10 — no next-intl, V1 single language).
// Add keys as new components are built; do NOT scatter hardcoded strings in JSX.

export const zh = {
  common: {
    appName: 'HoneyAI',
    loading: '加载中…',
    error: '出错了，请稍后再试',
  },
  login: {
    title: '登录 HoneyAI',
    usernamePlaceholder: '用户名',
    passwordPlaceholder: '密码',
    submitLabel: '登录',
    errorInvalid: '用户名或密码错误',
    errorUnknown: '登录失败，请稍后再试',
  },
  welcome: {
    heading: '欢迎使用 HoneyAI',
    subheading: '多智能体 AI 数字研发产线',
    loginLink: '去登录',
  },
} as const

export type ZhStrings = typeof zh
```

- [ ] **Step 2: Create `packages/web/middleware.ts`**

Passthrough stub. Multi-tenant slug parsing (reading `params.slug`, calling `withTenant`) lands in slice 4.5.

```ts
// packages/web/middleware.ts
// Passthrough middleware stub — multi-tenant slug parsing lands in slice 4.5.
// Matcher covers all routes except Next.js internals and static files.
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(_request: NextRequest): NextResponse {
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm --filter @honeyai/web typecheck
```

Expected: exits 0, no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web/lib/strings/zh.ts packages/web/middleware.ts
git commit -m "$(cat <<'EOF'
feat(web): zh strings table (Q10) + passthrough middleware stub (4.5 todo)
EOF
)"
```

---

## Task 7: App Router pages — `app/layout.tsx`, `app/page.tsx`, stub route groups

**Files:**

- Create: `packages/web/app/layout.tsx`
- Create: `packages/web/app/page.tsx`
- Create: `packages/web/app/(welcome)/layout.tsx`
- Create: `packages/web/app/t/[slug]/layout.tsx`
- Create: `packages/web/app/layout.test.tsx`

- [ ] **Step 1: Write the failing layout test (RED)**

Create `packages/web/app/layout.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import RootLayout from './layout.js'

// Mock next/font to avoid network calls in tests
vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-inter', className: 'mock-inter' }),
}))

describe('RootLayout', () => {
  it('renders children inside the layout', () => {
    const { getByText } = render(
      <RootLayout>
        <span>test-child-content</span>
      </RootLayout>,
    )
    expect(getByText('test-child-content')).toBeInTheDocument()
  })

  it('sets lang="zh-CN" on the html element', () => {
    render(
      <RootLayout>
        <span>child</span>
      </RootLayout>,
    )
    expect(document.documentElement.getAttribute('lang')).toBe('zh-CN')
  })
})
```

- [ ] **Step 2: Run test to verify it fails (RED)**

```bash
pnpm --filter @honeyai/web test -- layout.test
```

Expected: FAIL — `Cannot find module './layout.js'`.

- [ ] **Step 3: Create `packages/web/app/layout.tsx`**

```tsx
// packages/web/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'HoneyAI — 多智能体 AI 研发产线',
  description: '一句话需求经 3 阶段 + 人在回路 Gate 自动产出 GitHub PR',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Run test to verify it passes (GREEN)**

```bash
pnpm --filter @honeyai/web test -- layout.test
```

Expected: both tests PASS.

- [ ] **Step 5: Create `packages/web/app/page.tsx`**

Root page — simple welcome screen with a link to `/login`. No data fetching in this slice.

```tsx
// packages/web/app/page.tsx
import Link from 'next/link'
import { zh } from '@/lib/strings/zh.js'

export default function HomePage() {
  return (
    <main className="bg-atmosphere grain min-h-screen flex flex-col items-center justify-center gap-[var(--space-8)]">
      <div className="text-center space-y-[var(--space-4)]">
        <h1
          className="font-display text-[var(--text-3xl)] text-[var(--text-strong)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {zh.welcome.heading}
        </h1>
        <p className="text-[var(--text-body)] text-[var(--text-lg)]">{zh.welcome.subheading}</p>
      </div>
      <Link
        href="/login"
        className="px-[var(--space-6)] py-[var(--space-3)] rounded-[var(--r-md)] bg-[var(--text-strong)] text-[var(--bg-elev)] text-[var(--text-sm)] font-medium transition-opacity duration-[var(--dur-fast)] hover:opacity-80"
      >
        {zh.welcome.loginLink}
      </Link>
    </main>
  )
}
```

- [ ] **Step 6: Create route group stub layouts**

Create `packages/web/app/(welcome)/layout.tsx`:

```tsx
// packages/web/app/(welcome)/layout.tsx
// Welcome route group — layout stub. Welcome 4-step guide lands in slice 4.3.
export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

Create `packages/web/app/t/[slug]/layout.tsx`:

```tsx
// packages/web/app/t/[slug]/layout.tsx
// Tenant route group — layout stub. Tenant auth check + withTenant lands in slice 4.5.
export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/web/app/layout.tsx packages/web/app/page.tsx packages/web/app/layout.test.tsx packages/web/app/'(welcome)'/layout.tsx packages/web/app/t/'[slug]'/layout.tsx
git commit -m "$(cat <<'EOF'
feat(web): root layout + welcome home page + route group stubs
EOF
)"
```

---

## Task 8: Login page + `LoginForm` client component — TDD

**Files:**

- Create: `packages/web/app/(auth)/login/page.tsx`
- Create: `packages/web/app/(auth)/login/LoginForm.tsx`
- Create: `packages/web/app/(auth)/login/page.test.tsx`

- [ ] **Step 1: Write the failing test (RED)**

Create `packages/web/app/(auth)/login/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next-auth/react signIn to avoid real network calls
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}))

// Mock next/navigation to avoid router context requirement
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  redirect: vi.fn(),
}))

// Import the client LoginForm directly (the page wraps it)
import LoginForm from './LoginForm.js'

describe('LoginForm', () => {
  it('renders a username input field', () => {
    render(<LoginForm />)
    const input = screen.getByPlaceholderText('用户名')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
  })

  it('renders a password input field', () => {
    render(<LoginForm />)
    const input = screen.getByPlaceholderText('密码')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'password')
  })

  it('renders a submit button with correct label', () => {
    render(<LoginForm />)
    const button = screen.getByRole('button', { name: '登录' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('submit button is present and enabled by default', () => {
    render(<LoginForm />)
    const button = screen.getByRole('button', { name: '登录' })
    expect(button).not.toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails (RED)**

```bash
pnpm --filter @honeyai/web test -- login
```

Expected: FAIL — `Cannot find module './LoginForm.js'`.

- [ ] **Step 3: Create `packages/web/app/(auth)/login/LoginForm.tsx`**

```tsx
// packages/web/app/(auth)/login/LoginForm.tsx
'use client'

import { useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'
import { zh } from '@/lib/strings/zh.js'

export default function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })
      if (result?.error) {
        setError(zh.login.errorInvalid)
      } else {
        // Redirect to root on success; middleware / tenant routing handles the rest
        window.location.href = '/'
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)] w-full max-w-sm">
      <div className="flex flex-col gap-[var(--space-2)]">
        <input
          id="username"
          type="text"
          name="username"
          placeholder={zh.login.usernamePlaceholder}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          className="w-full px-[var(--space-4)] py-[var(--space-3)] rounded-[var(--r-md)] border border-[var(--text-faint)] bg-[var(--bg-card)] text-[var(--text-body)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--status-review)]"
        />
      </div>
      <div className="flex flex-col gap-[var(--space-2)]">
        <input
          id="password"
          type="password"
          name="password"
          placeholder={zh.login.passwordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full px-[var(--space-4)] py-[var(--space-3)] rounded-[var(--r-md)] border border-[var(--text-faint)] bg-[var(--bg-card)] text-[var(--text-body)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--status-review)]"
        />
      </div>
      {error != null && (
        <p className="text-[var(--status-halt)] text-[var(--text-sm)]" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-[var(--space-3)] rounded-[var(--r-md)] bg-[var(--text-strong)] text-[var(--bg-elev)] text-[var(--text-sm)] font-medium transition-opacity duration-[var(--dur-fast)] hover:opacity-80 disabled:opacity-40"
      >
        {isPending ? zh.common.loading : zh.login.submitLabel}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Create `packages/web/app/(auth)/login/page.tsx`**

```tsx
// packages/web/app/(auth)/login/page.tsx
import type { Metadata } from 'next'
import LoginForm from './LoginForm.js'
import { zh } from '@/lib/strings/zh.js'

export const metadata: Metadata = {
  title: `${zh.login.title} — HoneyAI`,
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-atmosphere grain flex items-center justify-center p-[var(--space-6)]">
      <div
        className="w-full max-w-sm bg-[var(--bg-card)] rounded-[var(--r-xl)] p-[var(--space-8)] flex flex-col gap-[var(--space-6)]"
        style={{ boxShadow: 'var(--shadow-elev)' }}
      >
        <div className="text-center">
          <h1 className="text-[var(--text-xl)] font-semibold text-[var(--text-strong)]">
            {zh.login.title}
          </h1>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes (GREEN)**

```bash
pnpm --filter @honeyai/web test -- login
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add "packages/web/app/(auth)/login/LoginForm.tsx" "packages/web/app/(auth)/login/page.tsx" "packages/web/app/(auth)/login/page.test.tsx"
git commit -m "$(cat <<'EOF'
feat(web): login page + credentials form (ADR-029) with vitest assertions
EOF
)"
```

---

## Task 9: `components.json` (shadcn init) + `.env.example` entries

**Files:**

- Create: `packages/web/components.json`
- Modify: `.env.example` (repo root)

> No TDD loop — configuration files. Verification: shadcn CLI can read the config; env file is audited.

- [ ] **Step 1: Create `packages/web/components.json`**

This is the shadcn initialization manifest. Component source code (Button, Card, etc.) is NOT added in this slice — that lands in 4.2. The file only configures the shadcn CLI so it knows where to install future components.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

Note: `tailwind.config` is an empty string because Tailwind v4 uses `postcss.config.mjs` rather than a separate `tailwind.config.ts`. shadcn CLI v0.9+ accepts this pattern.

- [ ] **Step 2: Create `packages/web/lib/utils.ts`** (shadcn `cn` utility expected by components.json alias)

```ts
// packages/web/lib/utils.ts
// shadcn/ui `cn` utility — class-name merger using clsx + tailwind-merge.
// Installed here so aliased path @/lib/utils resolves for future shadcn component installs.
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

Add `clsx` and `tailwind-merge` to `packages/web/package.json` `dependencies`:

```json
"clsx": "2.1.1",
"tailwind-merge": "2.6.0"
```

Then run:

```bash
pnpm install
```

- [ ] **Step 3: Append env vars to `.env.example` at repo root**

Read the existing `.env.example` first; append the following block at the end. Do not duplicate existing keys.

```bash
# --- @honeyai/web (NextAuth v5) ---
# Required: 32+ random bytes (generate: openssl rand -base64 32)
NEXTAUTH_SECRET=

# Required: full URL of the deployed web app (e.g. http://localhost:3000 for local dev)
NEXTAUTH_URL=http://localhost:3000

# Set to "true" ONLY in development to enable the Credentials dev provider (ADR-029).
# Must be absent or "false" in production. Enforced by module-level guard in
# packages/web/lib/auth/dev-credentials.ts
DEV_AUTH_ENABLED=false
```

Generate secret reminder — include this in PR description:

```bash
openssl rand -base64 32
# Copy output → paste as NEXTAUTH_SECRET value in your local .env file
```

- [ ] **Step 4: Verify shadcn can parse the config**

```bash
cd /d/code/ai-devops/packages/web
pnpm dlx shadcn@latest --help
```

Expected: shadcn CLI prints help text (verifies CLI is reachable). Do NOT run `shadcn init` — `components.json` is already present.

- [ ] **Step 5: Verify typecheck after cn utility**

```bash
pnpm --filter @honeyai/web typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/web/components.json packages/web/lib/utils.ts .env.example packages/web/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(web): shadcn components.json + cn util (clsx+tw-merge) + env.example entries
EOF
)"
```

---

## Task 10: Full test pass + `next build` smoke test

**Files:**

- No new files — verification pass only.

- [ ] **Step 1: Run all web package tests**

```bash
pnpm --filter @honeyai/web test
```

Expected output (all green):

```
 ✓ lib/auth/dev-credentials.test.ts (8 tests)
 ✓ lib/auth/auth.test.ts (3 tests)
 ✓ app/layout.test.tsx (2 tests)
 ✓ app/(auth)/login/page.test.tsx (4 tests)

 Test Files  4 passed (4)
 Tests       17 passed (17)
```

If any test fails: diagnose and fix the implementation (do NOT change the test assertions). If the same test fails across 2 consecutive fix attempts, stop and report to the user.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @honeyai/web typecheck
```

Expected: exits 0, zero errors.

- [ ] **Step 3: Lint**

```bash
pnpm --filter @honeyai/web lint
```

Expected: exits 0, zero errors. If ESLint is not yet configured in `packages/web`, create a minimal `packages/web/eslint.config.mjs`:

```js
// packages/web/eslint.config.mjs
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

export default [...compat.extends('next/core-web-vitals', 'next/typescript')]
```

Add `"eslint-config-next": "15.3.2"` to `devDependencies` in `packages/web/package.json`, then run `pnpm install`.

- [ ] **Step 4: Next.js build smoke test**

```bash
pnpm --filter @honeyai/web build
```

Expected: Next.js build completes without errors. Presence of `packages/web/.next/` confirms success.

Note: `next build` requires `NEXTAUTH_SECRET` to be set. Run with env override:

```bash
NEXTAUTH_SECRET="$(openssl rand -base64 32)" NEXTAUTH_URL="http://localhost:3000" NODE_ENV=production pnpm --filter @honeyai/web build
```

If build fails with a missing `NEXTAUTH_SECRET` error: the env is correctly enforced. Set the env as shown above.

- [ ] **Step 5: Dev server smoke test (manual)**

```bash
cd /d/code/ai-devops/packages/web
NEXTAUTH_SECRET="local-dev-secret-32-chars-padding" NEXTAUTH_URL="http://localhost:3000" NODE_ENV=development DEV_AUTH_ENABLED=true pnpm dev
```

Open browser at `http://localhost:3000` — verify:

- Root `/` renders "欢迎使用 HoneyAI" heading and "去登录" link
- Clicking "去登录" navigates to `/login`
- `/login` renders username input, password input, and "登录" button
- `/login` → enter `alice` / `dev-alice` → submit → redirects to `/`
- `/login` → wrong password → error message "用户名或密码错误" appears

Stop the dev server (`Ctrl+C`) after verification.

- [ ] **Step 6: AC coverage regression check**

```bash
pnpm ac:coverage
```

Expected: exits 0, seed AC-03-01/02/03 remain 100% (no regressions). This slice introduces no `AC-XX-YY:` prefixed tests.

- [ ] **Step 7: Turbo pipeline check**

```bash
cd /d/code/ai-devops
pnpm turbo typecheck lint
```

Expected: exits 0 across all packages including `@honeyai/web`.

- [ ] **Step 8: Commit verification artifacts**

```bash
git add -A
git status
```

Confirm no untracked files remain. Then commit if any staged changes remain from eslint config:

```bash
git commit -m "$(cat <<'EOF'
feat(web): eslint next config + full test/typecheck/build verification pass
EOF
)"
```

---

## Task 11: CI impact analysis + CHANGELOG entry

**Files:**

- Read: `.github/workflows/ci.yml` — already done; analysis below
- Modify: `docs/V1-SPEC/CHANGELOG.md`

- [ ] **Step 1: CI impact analysis**

After reading `.github/workflows/ci.yml`, the current CI jobs are:

| Job                         | Command                  | Impact of this slice                                                     |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `parallel[lint]`            | `pnpm lint` (turbo)      | `@honeyai/web lint` now runs — must pass                                 |
| `parallel[typecheck]`       | `pnpm typecheck` (turbo) | `@honeyai/web typecheck` now runs — must pass                            |
| `parallel[migration-check]` | migration script         | No change — db package unchanged                                         |
| `test`                      | `pnpm test` (turbo)      | `@honeyai/web test` now runs — 17 new tests, no DB/testcontainers needed |
| `ac-coverage`               | `pnpm ac:coverage`       | No regression — no new AC-prefixed test titles                           |

The CI workflow runs `pnpm lint`, `pnpm typecheck`, and `pnpm test` at the workspace root via Turborepo. The `turbo.json` `build` task has `"outputs": [".next/**"]` which already covers `@honeyai/web`. The web package `build` script (`next build`) is NOT in the current CI matrix — there is no explicit `parallel[build]` job. This is acceptable for this slice: `next build` is validated in Step 4 of Task 10 (local smoke test). A dedicated CI `build` job should be added in slice 4.2 or when CI build verification becomes critical path.

**Conclusion: no changes to `.github/workflows/ci.yml` required for this slice.**

- [ ] **Step 2: Add CHANGELOG entry**

Append to `docs/V1-SPEC/CHANGELOG.md` at the top (newest first):

```markdown
## v0.7.0 — 2026-05-26

### 切片 4.1: `@honeyai/web` Next.js 骨架 + Auth + tokens

**Added**

- `@honeyai/web` converted from Phase 1 placeholder to real Next.js 15.x App Router package
- `styles/tokens.css` — 50 CSS custom properties verbatim from spec §10: 4 surface + 4 text + 5 status + 7 agent = 20 OKLCH color vars; 8 font-size + 3 font-family = 11 typography vars; 8 spacing + 4 radius + 2 shadow + 5 motion = 19 structural vars; `.bg-atmosphere` + `.grain::before` + `@keyframes pulse-run`
- `styles/globals.css` — Tailwind v4 `@import` directives + global reset
- NextAuth v5 Credentials provider (dev-only) with module-level guard (ADR-029)
- Fixture users: alice / bob / carol / dave with `authorizeDevCredentials` function
- `lib/auth/index.ts` — NextAuth config with JWT strategy + `userId` / `tenantId` JWT callbacks
- `app/(auth)/login/` — login page + `LoginForm` client component
- `app/page.tsx` — root welcome page referencing token CSS vars
- `app/layout.tsx` — root RSC layout with `lang="zh-CN"` and globals.css import
- `app/(welcome)/layout.tsx`, `app/t/[slug]/layout.tsx` — route group stubs for 4.3/4.5
- `middleware.ts` — passthrough stub (tenant routing in 4.5)
- `lib/strings/zh.ts` — centralized zh-CN strings (Q10)
- `components.json` + `lib/utils.ts` (cn) — shadcn scaffold for 4.2
- `.env.example` — `NEXTAUTH_SECRET` / `NEXTAUTH_URL` / `DEV_AUTH_ENABLED` entries
- 17 Vitest + jsdom unit tests (100% green)

**ADRs referenced**: ADR-029 (Credentials dev), ADR-031 (RSC+SA no tRPC), ADR-003 (unified Next.js), ADR-006 (Welcome layout stub)
```

- [ ] **Step 3: Commit CHANGELOG**

```bash
git add docs/V1-SPEC/CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs(changelog): v0.7.0 entry for slice 4.1 web skeleton
EOF
)"
```

---

## Task 12: Open PR

**Files:**

- No new files.

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/phase-2-4-1-web-skeleton
```

- [ ] **Step 2: Create PR**

```bash
gh pr create \
  --title "feat(web): slice 4.1 — Next.js 15 skeleton + NextAuth Credentials + tokens.css" \
  --base main \
  --body "$(cat <<'EOF'
## Summary

- Converts `@honeyai/web` from Phase 1 placeholder (`export {}`) to a working Next.js 15 App Router package
- Implements NextAuth v5 Credentials dev provider with fixture users (alice/bob/carol/dave) and module-level production guard (ADR-029)
- Adds `styles/tokens.css` with 50 CSS custom properties verbatim from spec `07-frontend.md §10` (OKLCH colors, typography scale, spacing, radius, shadow, motion)
- Scaffolds App Router directory: `app/(auth)/login/`, `app/page.tsx`, `app/layout.tsx`, route group stubs for 4.3/4.5
- Tailwind v4 via `@tailwindcss/postcss`, shadcn `components.json` initialized (component code in 4.2)
- 17 Vitest + jsdom unit tests, all green

## Test plan

- [ ] `pnpm --filter @honeyai/web test` → 17 tests pass
- [ ] `pnpm --filter @honeyai/web typecheck` → exits 0
- [ ] `pnpm --filter @honeyai/web lint` → exits 0
- [ ] `pnpm --filter @honeyai/web build` (with NEXTAUTH_SECRET set) → exits 0
- [ ] Manual: `pnpm dev` → `/` renders welcome + `/login` renders form fields + `alice`/`dev-alice` logs in successfully
- [ ] `pnpm ac:coverage` → no regression (seed AC-03-01/02/03 remain 100%)
- [ ] CI `parallel[lint,typecheck]` and `test` jobs green
EOF
)"
```

- [ ] **Step 3: Verify PR URL returned**

Copy PR URL from `gh pr create` output and report to user.

---

## Spec Gaps and Ambiguities Found During Plan Writing

The following items were identified during required reading. Each requires a user decision before or during implementation — **do not self-decide**.

### Gap 1: spec `07-frontend.md §1` lists `Auth.js v5 + DrizzleAdapter (DB session)` — contradicts ADR-029 JWT strategy

**Location:** `docs/V1-SPEC/07-frontend.md §1` line: `Auth.js v5 + DrizzleAdapter（DB session）`

**Contradiction:** ADR-029 explicitly chooses `session: { strategy: 'jwt' }` to avoid the DB session table dependency in slice 4. The spec 07 §1 says `DrizzleAdapter (DB session)`.

**Impact:** If `DrizzleAdapter` is required, we need to import `@honeyai/db` in this slice (against the 4.1 scope) and configure session table access. If JWT is correct (per ADR-029), the spec §1 text is stale.

**Recommendation:** ADR-029 was approved 2026-05-26 (more recent than spec freeze) and explicitly addresses this — JWT strategy for slice 4, DrizzleAdapter deferred to slice 3 (GitHub OAuth). The plan uses JWT per ADR-029. **However, please confirm this reading is correct before implementation begins.**

### Gap 2: spec `07-frontend.md §1` lists `TanStack Query` — contradicts ADR-031

**Location:** `docs/V1-SPEC/07-frontend.md §1`: `TanStack Query（V1 仅用于 client-fetched 非关键数据，主路径走 RSC）`

**Contradiction:** ADR-031 (approved 2026-05-26) explicitly bans TanStack Query: "不引 tRPC / TanStack Query / SWR".

**Impact:** Slice 4.1 does not use TanStack Query, so there is no immediate conflict. But the plan does not add it to `dependencies`. If a later slice re-introduces it, an ADR revision is needed.

**Recommendation:** Plan follows ADR-031 (no TanStack Query). Spec §1 text is superseded by ADR-031. No immediate blocker for 4.1. **Flagging for awareness.**

### Gap 3: `next build` requires `NEXTAUTH_SECRET` — spec does not define minimum length

**Location:** ADR-029 mentions `NEXTAUTH_SECRET` without specifying length.

**Plan resolution:** The plan uses `openssl rand -base64 32` (produces 44-char base64 string, representing 32 random bytes) as the generation command. This is the standard recommendation from the Auth.js documentation. **No user decision required — this is a safe default.**

### TBD-spec-07-undefined: `--shadow-sm` not defined in spec 07

**Location:** `docs/V1-SPEC/07-frontend.md §10` defines `--shadow-soft` and `--shadow-elev` only. Many shadcn components (in slice 4.2) internally reference `--shadow-sm` in their default styles.

**Impact:** None in slice 4.1 (no shadcn components are installed). In slice 4.2, when shadcn `Button` / `Card` are copied in, their default CSS may reference an undefined `--shadow-sm` var. **Stop and ask the user in Task 1 of slice 4.2 whether to add `--shadow-sm` to `tokens.css` or whether to override shadcn component CSS to use `--shadow-soft`.**
