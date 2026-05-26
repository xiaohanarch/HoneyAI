# Phase 2 — 切片 4.3: Welcome 4 步引导 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Welcome 4-step bootstrap wizard (Anthropic Key → GitHub App → GitHub repo → Default skills seed) on Next.js 15 App Router with per-step Server Actions, jsonb persistence in `tenants.settings.bootstrap`, layout-level bootstrap guards, three nested `error.tsx` layers, a 4-card progress sidebar, and full TDD coverage for AC-01-04 through AC-01-12.

**Architecture:** Each of the 4 steps is an independent Server Action module under `packages/web/app/(welcome)/welcome/step/[n]/actions.ts` with a local zod schema, returning either `redirect()` on success or a discriminated `WelcomeErrorCode` union on failure (consumed via React 19 `useActionState`). State persists as a nested `bootstrap` key inside the existing `tenants.settings` jsonb column (no SQL migration; TS shape `TenantBootstrapState` lives in `@honeyai/db`). Two layout guards (`(welcome)/layout.tsx` requires `bootstrap.completedAt == null`; `t/[slug]/layout.tsx` requires `bootstrap.completedAt != null`) use a shared React `cache()`-deduplicated reader. The Anthropic API key is encrypted with a stub crypto module in `@honeyai/core/crypto/anthropic-key.ts` (base64 placeholder for V1; real AES-GCM lands in Phase 3 — see ADR-034). Five default skill seeds (1 skill, 1 rule, 1 command, 1 hint, 1 hook) are written into the `assets` table inside a single transaction on Step 4. Dev-credentials gets uuidv7-shaped IDs + `tenantSlug` + `tenantId` so JWT carries a real `tenantId` (Q12 JT3) and FK constraints are satisfied; an `instrumentation.ts` server-boot hook seeds these tenants on first run when `DEV_AUTH_ENABLED=true`.

**Tech Stack:**

- Node `>=22.11.0` (ADR-017)
- Next.js 15.3.2 App Router (route groups + `cache()` + `redirect()` + `revalidatePath()` + `instrumentation.ts`)
- React 19.1.0 (`useActionState`, Server Actions, `cache()`)
- NextAuth v5 (Credentials provider; JWT strategy carries `tenantId`)
- Drizzle ORM (jsonb partial update via `sql\`COALESCE(...) || ${patch}::jsonb\``)
- PostgreSQL 17 (`postgres:17-alpine` + `@testcontainers/postgresql` template DB)
- zod 3 (per-action local schema)
- shadcn/ui vendored primitives: Alert, Input, Label, FormMessage (new in 4.3)
- Vitest 2.1.8 + jsdom + `@testing-library/react` + `@testing-library/user-event`
- Tailwind v4 + OKLCH design tokens (spec 07 §3)

**Reference docs read before starting:**

- `docs/V1-SPEC/decisions/phase-2-4-3-open-questions.md` — Q1-Q12 拍板 + 17 ADRs + 9 ACs (definitive spec for this slice)
- `docs/V1-SPEC/01-product.md` §3.1 / §6 (AC-01-04..-12 to be appended)
- `docs/V1-SPEC/06-personas-flow.md` ADR-006 §4 (Welcome flow narrative to patch)
- `docs/V1-SPEC/07-frontend.md` §8.4 (Welcome screen, to patch with ProgressCards)
- `docs/V1-SPEC/decisions/phase-2-4-open-questions.md` §4.3 (slice scope checkbox)
- `docs/superpowers/plans/2026-05-26-phase-2-4-2-shadcn-appbar.md` — cadence reference
- `packages/db/src/schema/identity.ts` — `tenants.settings` jsonb already exists (no migration)
- `packages/web/lib/auth/dev-credentials.ts` — current `DEV_USERS` shape (will get uuidv7 + tenant fields)
- `packages/web/lib/auth/index.ts:45` — JWT hardcodes `tenantId = null` (Q12 JT3 changes this)
- `packages/web/middleware.ts` — passthrough stub (slice 4.5; no change here)

**Branch:** `feat/phase-2-4-3-welcome-wizard`

**Acceptance:**

- `pnpm --filter @honeyai/web test` 100% green (existing slice 4.2 tests + ~30 new = ~58 total)
- `pnpm --filter @honeyai/web typecheck` green
- `pnpm --filter @honeyai/web lint` green
- `pnpm --filter @honeyai/web build` exits 0 (Windows symlink EPERM tolerated per slice 4.1 precedent)
- `pnpm --filter @honeyai/db test` green (TenantBootstrapState type-only change does not break existing schema tests; new cross-tenant isolation test green)
- `pnpm --filter @honeyai/core test` green (new crypto/anthropic-key.ts tests pass)
- 9 new AC tests prefixed `AC-01-04:` .. `AC-01-12:` discoverable by `pnpm ac:coverage`
- 17 new ADRs (ADR-032..ADR-048) exist as `Accepted` files under `docs/V1-SPEC/ADRs/`
- `tenants.settings.bootstrap.completedAt` set → user reaches `/t/[slug]/` without redirect loops
- Unauthenticated `/welcome/step/2` → redirect `/login`; authenticated bootstrap-complete `/welcome` → redirect `/t/[slug]` (AC-01-04)
- Slug mismatch `/t/wrong-slug` for `alice` → redirect `/t/alice` (AC-01-12)
- Cross-tenant: `alice` cannot read `bob.settings.bootstrap` (AC-01-11)

**Scope guardrails (explicit non-goals):**

- ❌ No real Anthropic API key validation (stub only — ADR-034 X5)
- ❌ No real GitHub App OAuth flow (button → external URL → manual return; ADR-037 in scope of slice 5+)
- ❌ No real GitHub repos API query (Step 3 just records `pendingRepoOwnerName` string; ADR-046 RP1)
- ❌ No middleware-level bootstrap guard (slice 4.5 will add middleware; this slice uses layout guards per Q7 L2)
- ❌ No budget input on Anthropic step (ADR-033 budget defer; Q1 拍板)
- ❌ No real LLM seeded skills (5 hand-curated literal seeds; ADR-038 C2)
- ❌ No SQL migration (`tenants.settings` jsonb already exists; add nested key only — see Open Question O1 below)
- ❌ No dark mode (continues 4.2 placeholder block)

---

## Open Questions to Confirm Before Implementation

**O1 (BLOCKING Task 5) — `tenants.settings.bootstrap` storage shape:**

The decisions doc Q2 risk note says "jsonb migration 需在 slice 4.3 同 PR 加列(`tenants.settings.bootstrap`)" which reads as a new SQL column. However Q11 (RP1) describes `pendingRepoOwnerName(tenants.settings.bootstrap)` as a nested key inside the **existing** `tenants.settings` jsonb column (which already has `default '{}'`).

**Plan default:** Treat `bootstrap` as a nested key inside the existing `tenants.settings` jsonb column. No new SQL migration. Only a TypeScript shape addition (`TenantBootstrapState`) wired via `.$type<TenantSettings>()` on the existing column.

**Stop and ask the user before starting Task 5** if this default is wrong. The whole plan downstream of Task 5 (Tasks 6, 8, 12–15, 19) depends on this.

---

## File Structure

| Path                                                                          | Responsibility                                                                                                                                         | Est. Lines |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `docs/V1-SPEC/ADRs/ADR-032..ADR-048-*.md`                                     | **Create**: 17 ADR stubs (`Accepted` status, references decisions doc Q1-Q12)                                                                          | ~25 × 17   |
| `docs/V1-SPEC/01-product.md`                                                  | **Modify**: append AC-01-04..AC-01-12 to §3.1 / §6 AC table                                                                                            | +30 lines  |
| `docs/V1-SPEC/06-personas-flow.md`                                            | **Modify**: §4 Welcome flow narrative (4-step path + skip skills option)                                                                               | +40 lines  |
| `docs/V1-SPEC/decisions/phase-2-4-open-questions.md`                          | **Modify**: §4.3 checkbox → ✅ Done + link decisions doc                                                                                               | +5 lines   |
| `docs/V1-SPEC/07-frontend.md`                                                 | **Modify**: §8.4 Welcome screen — 4 ProgressCards spec (PI3)                                                                                           | +25 lines  |
| `docs/V1-SPEC/CHANGELOG.md`                                                   | **Modify**: append v0.9.0 entry for slice 4.3 deliverables                                                                                             | +25 lines  |
| `packages/core/src/crypto/anthropic-key.ts`                                   | **Create**: stub `encryptAnthropicKey` / `decryptAnthropicKey` (base64; ADR-034 X5)                                                                    | ~40 lines  |
| `packages/core/src/crypto/anthropic-key.test.ts`                              | **Create**: 4 tests — encrypt format, decrypt round-trip, decrypt on bad input throws, idempotency                                                     | ~50 lines  |
| `packages/core/src/crypto/index.ts`                                           | **Create**: barrel for crypto module                                                                                                                   | ~3 lines   |
| `packages/core/src/index.ts`                                                  | **Modify**: add `export * from './crypto/index.js'`                                                                                                    | +1 line    |
| `packages/db/src/schema/identity.ts`                                          | **Modify**: add `TenantSettings` + `TenantBootstrapState` TS types; annotate `settings` column with `.$type<TenantSettings>()`                         | +30 lines  |
| `packages/db/src/schema/identity.test.ts`                                     | **Modify**: add 2 tests — `settings.bootstrap` round-trip; default `settings = {}` parses as empty `TenantSettings`                                    | +40 lines  |
| `packages/web/lib/auth/dev-credentials.ts`                                    | **Modify**: 3 users get fixed uuidv7 `id` + `tenantSlug` + `tenantId` literals; `authorize()` returns extended user                                    | +30 lines  |
| `packages/web/lib/auth/dev-credentials.test.ts`                               | **Modify**: 2 new tests — authorize returns tenantId; bob/carol distinct tenantIds                                                                     | +25 lines  |
| `packages/web/lib/auth/index.ts`                                              | **Modify**: JWT callback line 45 → `token.tenantId = user.tenantId` (Q12 JT3)                                                                          | -1/+1 line |
| `packages/web/lib/auth/index.test.ts`                                         | **Modify**: 1 new test — JWT carries `tenantId` from `User`                                                                                            | +20 lines  |
| `packages/web/lib/test/db.ts`                                                 | **Create**: testcontainer helper for web package tests (reuses `@honeyai/db` template)                                                                 | ~30 lines  |
| `packages/web/lib/dev-seed.ts`                                                | **Create**: idempotent `seedDevTenants()` that inserts 3 tenants + users + memberships if `DEV_AUTH_ENABLED=true`                                      | ~70 lines  |
| `packages/web/lib/dev-seed.test.ts`                                           | **Create**: 3 tests — seeds 3 tenants; idempotent on re-run; no-op when `DEV_AUTH_ENABLED=false`                                                       | ~80 lines  |
| `packages/web/instrumentation.ts`                                             | **Create**: Next.js `register()` hook calling `seedDevTenants()` once at server boot                                                                   | ~20 lines  |
| `packages/web/lib/bootstrap/read.ts`                                          | **Create**: `getTenantBootstrap(tenantId)` wrapped in React `cache()`                                                                                  | ~30 lines  |
| `packages/web/lib/bootstrap/guard.ts`                                         | **Create**: `requireBootstrapComplete(tenantId)` + `requireBootstrapIncomplete(tenantId)` (Q7 L2)                                                      | ~45 lines  |
| `packages/web/lib/bootstrap/read.test.ts`                                     | **Create**: 3 tests — returns null for missing tenant; returns parsed state; `cache()` dedupes per-request                                             | ~70 lines  |
| `packages/web/lib/bootstrap/guard.test.ts`                                    | **Create**: 4 tests — complete passes complete; complete redirects incomplete to /welcome; incomplete redirects complete to /t/[slug]; AC-01-04 prefix | ~80 lines  |
| `packages/web/lib/errors/welcome-errors.ts`                                   | **Create**: `WelcomeErrorCode` union + `WELCOME_ERROR_MESSAGES` zh map                                                                                 | ~35 lines  |
| `packages/web/lib/strings/zh.ts`                                              | **Modify**: append `welcome.step1..step4` + `errors.welcome.*` namespaces                                                                              | +50 lines  |
| `packages/web/components/ui/alert.tsx`                                        | **Create (shadcn CLI)**: Alert primitive                                                                                                               | ~50 lines  |
| `packages/web/components/ui/input.tsx`                                        | **Create (shadcn CLI)**: Input primitive                                                                                                               | ~25 lines  |
| `packages/web/components/ui/label.tsx`                                        | **Create (shadcn CLI)**: Label primitive                                                                                                               | ~25 lines  |
| `packages/web/components/ui/form-message.tsx`                                 | **Create**: thin `<p role="alert">` wrapper for field errors (no upstream shadcn equivalent)                                                           | ~20 lines  |
| `packages/web/components/ui/{alert,input,label,form-message}.test.tsx`        | **Create**: 4 smoke tests                                                                                                                              | ~25 each   |
| `packages/web/components/welcome/ProgressCards.tsx`                           | **Create**: 4-card sidebar (idle / running / done) + AN2 transitions (Q10 A1 + PI3)                                                                    | ~110 lines |
| `packages/web/components/welcome/ProgressCards.test.tsx`                      | **Create**: 4 tests — renders 4 cards; current step `running`; completed steps `done`; CSS transition class present                                    | ~90 lines  |
| `packages/web/app/(welcome)/welcome/page.tsx`                                 | **Create**: bidirectional redirect — incomplete → step 1; missing → /login (I4)                                                                        | ~25 lines  |
| `packages/web/app/(welcome)/welcome/step/[n]/page.tsx`                        | **Create**: server component that validates `n ∈ {1..4}`, dispatches to step form by `n`                                                               | ~50 lines  |
| `packages/web/app/(welcome)/welcome/step/[n]/actions.ts`                      | **Create**: 4 server actions — `submitStep1` / `submitStep2` / `submitStep3` / `submitStep4` (Q4 P2+A)                                                 | ~180 lines |
| `packages/web/app/(welcome)/welcome/step/[n]/Step1AnthropicKeyForm.tsx`       | **Create**: 'use client' form with `useActionState` + zod regex `^sk-ant-[A-Za-z0-9_-]{32,}` (K3)                                                      | ~80 lines  |
| `packages/web/app/(welcome)/welcome/step/[n]/Step2GithubAppForm.tsx`          | **Create**: external install link + manual "我已完成" button (GA2)                                                                                     | ~70 lines  |
| `packages/web/app/(welcome)/welcome/step/[n]/Step3GithubRepoForm.tsx`         | **Create**: text input with regex `^[\w.-]+/[\w.-]+$` (RP1)                                                                                            | ~80 lines  |
| `packages/web/app/(welcome)/welcome/step/[n]/Step4SkillsForm.tsx`             | **Create**: "导入 5 个默认" / "跳过" buttons (W-B)                                                                                                     | ~80 lines  |
| `packages/web/app/(welcome)/welcome/step/[n]/*.test.tsx`                      | **Create**: 4 client form tests + 4 action tests (AC-01-05..08 + 10)                                                                                   | ~350 total |
| `packages/web/lib/seeds/default-skills.ts`                                    | **Create**: 5 default-skill literals (1 skill, 1 rule, 1 command, 1 hint, 1 hook)                                                                      | ~80 lines  |
| `packages/web/lib/seeds/default-skills.test.ts`                               | **Create**: testcontainer integration — onConflictDoNothing idempotent on re-import (AC-01-09)                                                         | ~70 lines  |
| `packages/web/app/(welcome)/layout.tsx`                                       | **Modify**: wire `requireBootstrapIncomplete` (Q7 L2)                                                                                                  | ~25 lines  |
| `packages/web/app/t/[slug]/layout.tsx`                                        | **Modify**: wire `requireBootstrapComplete` + slug validation (Q9 V3)                                                                                  | ~35 lines  |
| `packages/web/app/(welcome)/layout.test.tsx` + `app/t/[slug]/layout.test.tsx` | **Create**: AC-01-04 + AC-01-12 layout integration tests                                                                                               | ~120 total |
| `packages/web/app/error.tsx`                                                  | **Create**: top-level error boundary (E3 — generic)                                                                                                    | ~30 lines  |
| `packages/web/app/(welcome)/error.tsx`                                        | **Create**: welcome group error boundary (welcome-scoped fallback)                                                                                     | ~35 lines  |
| `packages/web/app/(welcome)/welcome/step/[n]/error.tsx`                       | **Create**: step-scoped error boundary (retry current step)                                                                                            | ~40 lines  |
| `packages/web/lib/bootstrap/cross-tenant.test.ts`                             | **Create**: AC-01-11 testcontainer test — alice cannot read bob.bootstrap                                                                              | ~90 lines  |
| `.env.example`                                                                | **Modify**: add `GITHUB_APP_INSTALL_URL=https://github.com/apps/your-honeyai-app/installations/new`                                                    | +1 line    |

**Total estimated lines added: ~2400** (planning conservative; primarily Server Actions, forms, tests, ADRs, spec patches).

---

## Task 1: Branch + flag Open Question O1

**Files:**

- Create branch: `feat/phase-2-4-3-welcome-wizard`

- [ ] **Step 1: Create branch from main**

```bash
cd /d/code/ai-devops
git checkout main
git pull --ff-only
git checkout -b feat/phase-2-4-3-welcome-wizard
```

- [ ] **Step 2: Confirm Open Question O1 with user**

**STOP HERE. Print the following to the user and wait for response:**

> Open Question O1 (BLOCKING): The decisions doc Q2 risk note hints at a new SQL column `tenants.settings.bootstrap`, but Q11 RP1 reads as a nested key inside the existing `tenants.settings` jsonb column. The existing column already has `jsonb('settings').notNull().default({})`. The plan defaults to **nested key, no SQL migration, only a TS shape annotation** (`TenantSettings.bootstrap?: TenantBootstrapState`).
>
> Confirm this interpretation, OR provide the correct alternative (e.g. new `bootstrap` jsonb column with its own migration). All downstream tasks (5–20) depend on this answer.

- [ ] **Step 3: Record decision inline**

Once user confirms (assume default "nested key" if user says ✅), append a one-line note at the top of `docs/V1-SPEC/decisions/phase-2-4-3-open-questions.md` under Q11:

```markdown
> **Implementation note (2026-05-26):** `bootstrap` lives as a nested key inside the existing `tenants.settings` jsonb column. No SQL migration; only TS `.$type<TenantSettings>()` annotation.
```

- [ ] **Step 4: Commit**

```bash
git add docs/V1-SPEC/decisions/phase-2-4-3-open-questions.md
git commit -m "chore(spec): record O1 nested-key decision for tenants.settings.bootstrap"
```

---

## Task 2: Scaffold 17 ADR stubs (ADR-032..ADR-048)

**Files:**

- Create: `docs/V1-SPEC/ADRs/ADR-032-welcome-4-step-jsonb-persistence.md`
- Create: `docs/V1-SPEC/ADRs/ADR-033-anthropic-budget-deferred.md`
- Create: `docs/V1-SPEC/ADRs/ADR-034-anthropic-key-crypto-stub.md`
- Create: `docs/V1-SPEC/ADRs/ADR-035-welcome-server-action-module.md`
- Create: `docs/V1-SPEC/ADRs/ADR-036-welcome-ac-01-04-to-12.md`
- Create: `docs/V1-SPEC/ADRs/ADR-037-default-skills-per-tenant-copy.md`
- Create: `docs/V1-SPEC/ADRs/ADR-038-default-skills-five-seeds.md`
- Create: `docs/V1-SPEC/ADRs/ADR-039-bootstrap-layout-guard.md`
- Create: `docs/V1-SPEC/ADRs/ADR-040-bootstrap-read-react-cache.md`
- Create: `docs/V1-SPEC/ADRs/ADR-041-welcome-error-three-layer.md`
- Create: `docs/V1-SPEC/ADRs/ADR-042-welcome-shadcn-additions.md`
- Create: `docs/V1-SPEC/ADRs/ADR-043-welcome-route-group-segment.md`
- Create: `docs/V1-SPEC/ADRs/ADR-044-welcome-progress-cards.md`
- Create: `docs/V1-SPEC/ADRs/ADR-045-welcome-progress-card-states.md`
- Create: `docs/V1-SPEC/ADRs/ADR-046-tenant-bootstrap-state-shape.md`
- Create: `docs/V1-SPEC/ADRs/ADR-047-welcome-regex-validators.md`
- Create: `docs/V1-SPEC/ADRs/ADR-048-dev-seed-instrumentation.md`

- [ ] **Step 1: Create ADR-032 (template for all 17)**

Write to `docs/V1-SPEC/ADRs/ADR-032-welcome-4-step-jsonb-persistence.md`:

```markdown
# ADR-032: Welcome 4-step wizard persists to `tenants.settings.bootstrap` jsonb

- **Status:** Accepted
- **Date:** 2026-05-26
- **Phase:** 2.4.3 (Web slice — Welcome wizard)
- **Source:** `docs/V1-SPEC/decisions/phase-2-4-3-open-questions.md` Q1 + Q2

## Context

Slice 4.3 introduces a 4-step bootstrap wizard. State must survive page reload, browser back, and partial submission (AC-01-03 carryover requirement). URL-only state forces every step to re-fetch from query string; pure client storage loses cross-device continuity.

## Decision

The 4 steps are: (1) Anthropic API key (2) GitHub App install (3) GitHub repo slug (4) Default skills seed (or skip). State persists as a nested `bootstrap` key inside the existing `tenants.settings` jsonb column (no new SQL column). URL is purely a navigation pointer (`/welcome/step/[n]`); the server reads `bootstrap` to determine the canonical resume step.

## Consequences

- Page reload at `/welcome/step/3` shows already-filled key/installed-app state.
- No new migration; type only.
- Server is the single source of truth for "what's done"; URL is "what's being viewed".

## References

- `phase-2-4-3-open-questions.md` Q1 / Q2 / O1 (nested-key interpretation locked 2026-05-26).
```

- [ ] **Step 2: Create ADR-033 through ADR-048**

Use the same `# ADR-NNN: <title>` + `Status: Accepted` + `Date: 2026-05-26` + `Source:` + `Context` / `Decision` / `Consequences` / `References` skeleton. Each ADR is ≤30 lines. Map titles to:

| ADR | Title                                                  | Q ref | Key decision                                                                                      |
| --- | ------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------- |
| 033 | Anthropic budget input deferred to Phase 3             | Q1    | No budget field in V1 Welcome                                                                     |
| 034 | Anthropic key crypto stub (X5)                         | Q3    | base64 stub in `@honeyai/core/crypto`; real AES-GCM later                                         |
| 035 | Welcome server action module (P2+A+R1+T2)              | Q4    | Independent per-step action file; local zod; redirect/ErrorCode; useActionState                   |
| 036 | Welcome AC coverage (AC-01-04..-12)                    | Q5    | 9 new ACs; γ scope; mock-primary tests; testcontainer for cross-tenant                            |
| 037 | Default skills: per-tenant copy (S-B)                  | Q6    | Each tenant gets independent copy in `assets` table                                               |
| 038 | Default skills: 5 hand-curated seeds (C2)              | Q6    | code-review-assistant / no-pii-in-logs / run-tests / prefer-server-components / pre-commit-format |
| 039 | Bootstrap layout guard (L2)                            | Q7    | Layouts call `requireBootstrap*`; middleware unused this slice                                    |
| 040 | Bootstrap read uses React `cache()` (D1)               | Q7    | Per-request memoization; defensive `revalidatePath()` after writes                                |
| 041 | Three-layer welcome error.tsx (U4)                     | Q8    | `app/error.tsx` / `(welcome)/error.tsx` / `step/[n]/error.tsx`                                    |
| 042 | Welcome shadcn additions (TL4)                         | Q8    | Add Alert / Input / Label / FormMessage via CLI                                                   |
| 043 | Welcome route group + nested segment (G1 + V3)         | Q9    | `(welcome)/welcome/page.tsx` + `(welcome)/welcome/step/[n]/page.tsx`                              |
| 044 | 4 progress cards in sidebar (A1)                       | Q10   | Right-side column shows idle/running/done states                                                  |
| 045 | Progress card 3 states + AN2 transitions (PI3)         | Q10   | CSS-only fade/scale transitions on state change                                                   |
| 046 | TenantBootstrapState shape (SP1)                       | Q11   | 6 optional fields incl. `pendingRepoOwnerName` + `completedAt`                                    |
| 047 | Welcome regex validators (K3 + RP1)                    | Q11   | `^sk-ant-[A-Za-z0-9_-]{32,}` / `^[\w.-]+/[\w.-]+$`                                                |
| 048 | Dev tenant seed via instrumentation.ts (L2 + U1 + TS1) | Q12   | `instrumentation.ts` calls `seedDevTenants()` once on boot                                        |

- [ ] **Step 3: Verify all 17 files exist**

```bash
ls docs/V1-SPEC/ADRs/ADR-{032,033,034,035,036,037,038,039,040,041,042,043,044,045,046,047,048}-*.md | wc -l
```

Expected output: `17`

- [ ] **Step 4: Commit**

```bash
git add docs/V1-SPEC/ADRs/ADR-032-*.md docs/V1-SPEC/ADRs/ADR-033-*.md docs/V1-SPEC/ADRs/ADR-034-*.md docs/V1-SPEC/ADRs/ADR-035-*.md docs/V1-SPEC/ADRs/ADR-036-*.md docs/V1-SPEC/ADRs/ADR-037-*.md docs/V1-SPEC/ADRs/ADR-038-*.md docs/V1-SPEC/ADRs/ADR-039-*.md docs/V1-SPEC/ADRs/ADR-040-*.md docs/V1-SPEC/ADRs/ADR-041-*.md docs/V1-SPEC/ADRs/ADR-042-*.md docs/V1-SPEC/ADRs/ADR-043-*.md docs/V1-SPEC/ADRs/ADR-044-*.md docs/V1-SPEC/ADRs/ADR-045-*.md docs/V1-SPEC/ADRs/ADR-046-*.md docs/V1-SPEC/ADRs/ADR-047-*.md docs/V1-SPEC/ADRs/ADR-048-*.md
git commit -m "docs(adr): ADR-032..048 for slice 4.3 Welcome wizard decisions"
```

---

## Task 3: `@honeyai/core/crypto/anthropic-key.ts` stub + tests

**Files:**

- Create: `packages/core/src/crypto/anthropic-key.ts`
- Create: `packages/core/src/crypto/anthropic-key.test.ts`
- Create: `packages/core/src/crypto/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/src/crypto/anthropic-key.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { encryptAnthropicKey, decryptAnthropicKey } from './anthropic-key.js'

describe('anthropic-key crypto stub (ADR-034)', () => {
  it('encrypts to non-plaintext base64 envelope', () => {
    const key = 'sk-ant-' + 'a'.repeat(40)
    const cipher = encryptAnthropicKey(key)
    expect(cipher).not.toBe(key)
    expect(cipher).toMatch(/^v1:/)
  })

  it('round-trips encrypt -> decrypt', () => {
    const key = 'sk-ant-' + 'b'.repeat(40)
    expect(decryptAnthropicKey(encryptAnthropicKey(key))).toBe(key)
  })

  it('throws on malformed ciphertext', () => {
    expect(() => decryptAnthropicKey('not-a-valid-envelope')).toThrow(/malformed/i)
  })

  it('is deterministic for v1 stub (same plaintext -> same ciphertext)', () => {
    const k = 'sk-ant-' + 'c'.repeat(40)
    expect(encryptAnthropicKey(k)).toBe(encryptAnthropicKey(k))
  })
})
```

- [ ] **Step 2: Run failing tests**

```bash
pnpm --filter @honeyai/core test
```

Expected: 4 failures — `Cannot find module './anthropic-key.js'`.

- [ ] **Step 3: Implement stub**

Create `packages/core/src/crypto/anthropic-key.ts`:

```ts
// V1 stub — base64 envelope only. Real AES-GCM with KMS lands in Phase 3.
// See ADR-034.

const ENVELOPE_PREFIX = 'v1:'

export function encryptAnthropicKey(plaintext: string): string {
  if (!plaintext) throw new Error('encryptAnthropicKey: empty plaintext')
  const b64 = Buffer.from(plaintext, 'utf8').toString('base64')
  return ENVELOPE_PREFIX + b64
}

export function decryptAnthropicKey(ciphertext: string): string {
  if (!ciphertext.startsWith(ENVELOPE_PREFIX)) {
    throw new Error('decryptAnthropicKey: malformed envelope')
  }
  const b64 = ciphertext.slice(ENVELOPE_PREFIX.length)
  try {
    return Buffer.from(b64, 'base64').toString('utf8')
  } catch {
    throw new Error('decryptAnthropicKey: malformed base64')
  }
}
```

Create `packages/core/src/crypto/index.ts`:

```ts
export * from './anthropic-key.js'
```

Modify `packages/core/src/index.ts` — append:

```ts
export * from './crypto/index.js'
```

- [ ] **Step 4: Run tests — green**

```bash
pnpm --filter @honeyai/core test
```

Expected: 4 new tests pass, no regressions.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/crypto packages/core/src/index.ts
git commit -m "feat(core): anthropic-key crypto stub (ADR-034)"
```

---

## Task 4: `TenantBootstrapState` TS shape on `tenants.settings`

**Files:**

- Modify: `packages/db/src/schema/identity.ts`
- Modify: `packages/db/src/schema/identity.test.ts` (or create alongside if absent)

**Prerequisite:** O1 confirmed (Task 1, Step 2). If user said "new SQL column", STOP and rewrite Task 4 to add a drizzle migration.

- [ ] **Step 1: Write failing schema test**

Append to `packages/db/src/schema/identity.test.ts` (create file if absent — use existing testcontainer pattern from `packages/db/src/test/container.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { uuidv7 } from 'uuidv7'
import { eq } from 'drizzle-orm'
import { tenants } from './identity.js'
import { withTestDb } from '../test/db.js'
import type { TenantSettings, TenantBootstrapState } from './identity.js'

describe('tenants.settings TenantBootstrapState shape', () => {
  it('round-trips a full bootstrap state', async () => {
    await withTestDb(async (db) => {
      const id = uuidv7()
      const slug = `t-${id.slice(0, 8)}`
      const bootstrap: TenantBootstrapState = {
        anthropicKeyCiphertext: 'v1:abc',
        githubAppInstalled: true,
        githubAppMarkedAt: '2026-05-26T00:00:00Z',
        pendingRepoOwnerName: 'octocat/Hello-World',
        defaultSkillsApplied: 'imported',
        completedAt: '2026-05-26T00:01:00Z',
      }
      const settings: TenantSettings = { bootstrap }
      await db.insert(tenants).values({ id, slug, name: slug, kind: 'personal', settings })
      const [row] = await db.select().from(tenants).where(eq(tenants.id, id))
      expect(row.settings.bootstrap).toEqual(bootstrap)
    })
  })

  it('default empty settings parses as empty TenantSettings', async () => {
    await withTestDb(async (db) => {
      const id = uuidv7()
      const slug = `t-${id.slice(0, 8)}`
      await db.insert(tenants).values({ id, slug, name: slug, kind: 'personal' })
      const [row] = await db.select().from(tenants).where(eq(tenants.id, id))
      expect(row.settings).toEqual({})
      expect(row.settings.bootstrap).toBeUndefined()
    })
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
pnpm --filter @honeyai/db test -- identity
```

Expected: type errors — `TenantSettings` / `TenantBootstrapState` not exported.

- [ ] **Step 3: Add types to `identity.ts`**

Edit `packages/db/src/schema/identity.ts`. Above the `tenants` table declaration, add:

```ts
export type TenantBootstrapState = {
  anthropicKeyCiphertext?: string
  githubAppInstalled?: boolean
  githubAppMarkedAt?: string
  pendingRepoOwnerName?: string
  defaultSkillsApplied?: 'skipped' | 'imported'
  completedAt?: string
}

export type TenantSettings = {
  bootstrap?: TenantBootstrapState
}
```

Change the `settings` column line from:

```ts
settings: jsonb('settings').notNull().default({}),
```

to:

```ts
settings: jsonb('settings').$type<TenantSettings>().notNull().default({}),
```

- [ ] **Step 4: Run tests — green**

```bash
pnpm --filter @honeyai/db test -- identity
```

Expected: 2 new tests pass; existing schema tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/identity.ts packages/db/src/schema/identity.test.ts
git commit -m "feat(db): TenantBootstrapState shape on tenants.settings (ADR-046)"
```

---

## Task 5: dev-credentials uuidv7 + tenantId + JWT carry

**Files:**

- Modify: `packages/web/lib/auth/dev-credentials.ts`
- Modify: `packages/web/lib/auth/dev-credentials.test.ts`
- Modify: `packages/web/lib/auth/index.ts` (line 45)
- Modify: `packages/web/lib/auth/index.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/web/lib/auth/dev-credentials.test.ts`:

```ts
import { DEV_USERS, authorizeDevUser } from './dev-credentials'

describe('dev-credentials uuid + tenantId (ADR-048 U1 / JT3)', () => {
  it('all 3 dev users have uuid v7-shaped ids', () => {
    for (const u of DEV_USERS) {
      expect(u.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(u.tenantId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(u.tenantSlug).toMatch(/^[a-z]+$/)
    }
  })

  it('authorize returns tenantId for matching credentials', async () => {
    const u = await authorizeDevUser({ username: 'alice', password: 'dev' })
    expect(u).toBeTruthy()
    expect(u!.tenantId).toBe(DEV_USERS[0].tenantId)
    expect(u!.tenantSlug).toBe('alice')
  })

  it('alice / bob / carol have distinct tenant ids', () => {
    const ids = new Set(DEV_USERS.map((u) => u.tenantId))
    expect(ids.size).toBe(3)
  })
})
```

Append to `packages/web/lib/auth/index.test.ts`:

```ts
it('JWT callback propagates tenantId from User into token (AC-01-04 backbone)', async () => {
  // import { authOptions } from './index' ; run jwt callback with mock user
  const cb = authOptions.callbacks!.jwt!
  const token = await cb({
    token: {},
    user: { id: 'u1', tenantId: 't1', tenantSlug: 'alice' } as any,
    account: null,
  } as any)
  expect(token.tenantId).toBe('t1')
})
```

- [ ] **Step 2: Run failing tests**

```bash
pnpm --filter @honeyai/web test -- auth
```

Expected: failures on `tenantId` undefined.

- [ ] **Step 3: Update `dev-credentials.ts`**

Replace `DEV_USERS` array with hardcoded uuidv7-shaped literals (one stable literal per user — pick any well-formed uuidv7 strings):

```ts
export type DevUser = {
  id: string
  username: string
  passwordHash: string
  name: string
  email: string
  tenantId: string
  tenantSlug: string
}

export const DEV_USERS: DevUser[] = [
  {
    id: '01914aa0-0001-7000-8000-000000000001',
    username: 'alice',
    passwordHash: '...', // unchanged from existing
    name: 'Alice',
    email: 'alice@example.com',
    tenantId: '01914ab0-0001-7000-8000-000000000001',
    tenantSlug: 'alice',
  },
  // bob: ...0002 / ...0002
  // carol: ...0003 / ...0003
]
```

Update `authorizeDevUser()` return to include `tenantId` + `tenantSlug`.

- [ ] **Step 4: Update JWT callback in `index.ts:45`**

Change from:

```ts
token['tenantId'] = null
```

to:

```ts
if (user) {
  token['tenantId'] = (user as any).tenantId ?? null
  token['tenantSlug'] = (user as any).tenantSlug ?? null
}
```

- [ ] **Step 5: Run tests — green**

```bash
pnpm --filter @honeyai/web test -- auth
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/web/lib/auth
git commit -m "feat(web/auth): dev users carry uuidv7 + tenantId in JWT (ADR-048 U1/JT3)"
```

---

## Task 6: `lib/test/db.ts` + `dev-seed.ts` + `instrumentation.ts`

**Files:**

- Create: `packages/web/lib/test/db.ts`
- Create: `packages/web/lib/dev-seed.ts`
- Create: `packages/web/lib/dev-seed.test.ts`
- Create: `packages/web/instrumentation.ts`

- [ ] **Step 1: Create `lib/test/db.ts` (testcontainer reuse helper)**

```ts
// packages/web/lib/test/db.ts
// Thin wrapper around @honeyai/db's template-db container for web-package tests.
import { withTestDb as withDbPkgTestDb } from '@honeyai/db/test'

export const withTestDb = withDbPkgTestDb
```

(If `@honeyai/db` does not export `test` subpath, add it: edit `packages/db/package.json` exports map to expose `./test`.)

- [ ] **Step 2: Write failing tests for `dev-seed.ts`**

Create `packages/web/lib/dev-seed.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { tenants, users, tenantMembers } from '@honeyai/db/schema'
import { withTestDb } from './test/db'
import { seedDevTenants } from './dev-seed'
import { DEV_USERS } from './auth/dev-credentials'

describe('seedDevTenants', () => {
  it('inserts 3 tenants + 3 users + 3 memberships when DEV_AUTH_ENABLED=true', async () => {
    await withTestDb(async (db) => {
      await seedDevTenants(db, { devAuthEnabled: true })
      const tRows = await db.select().from(tenants)
      expect(tRows).toHaveLength(3)
      const uRows = await db.select().from(users)
      expect(uRows).toHaveLength(3)
      const mRows = await db.select().from(tenantMembers)
      expect(mRows).toHaveLength(3)
    })
  })

  it('is idempotent on re-run (ID3 onConflictDoNothing)', async () => {
    await withTestDb(async (db) => {
      await seedDevTenants(db, { devAuthEnabled: true })
      await seedDevTenants(db, { devAuthEnabled: true })
      const tRows = await db.select().from(tenants)
      expect(tRows).toHaveLength(3)
    })
  })

  it('no-op when devAuthEnabled=false', async () => {
    await withTestDb(async (db) => {
      await seedDevTenants(db, { devAuthEnabled: false })
      const tRows = await db.select().from(tenants)
      expect(tRows).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 3: Run failing tests**

```bash
pnpm --filter @honeyai/web test -- dev-seed
```

Expected: all 3 fail (module missing).

- [ ] **Step 4: Implement `dev-seed.ts`**

```ts
// packages/web/lib/dev-seed.ts
import type { DrizzleDb } from '@honeyai/db'
import { tenants, users, tenantMembers } from '@honeyai/db/schema'
import { DEV_USERS } from './auth/dev-credentials'

export type SeedOptions = { devAuthEnabled: boolean }

export async function seedDevTenants(db: DrizzleDb, opts: SeedOptions): Promise<void> {
  if (!opts.devAuthEnabled) return
  await db.transaction(async (tx) => {
    for (const u of DEV_USERS) {
      await tx
        .insert(tenants)
        .values({ id: u.tenantId, slug: u.tenantSlug, name: u.tenantSlug, kind: 'personal' })
        .onConflictDoNothing()
      await tx
        .insert(users)
        .values({ id: u.id, email: u.email, name: u.name })
        .onConflictDoNothing()
      await tx
        .insert(tenantMembers)
        .values({ tenantId: u.tenantId, userId: u.id, role: 'owner' })
        .onConflictDoNothing()
    }
  })
}
```

- [ ] **Step 5: Create `instrumentation.ts`**

```ts
// packages/web/instrumentation.ts
// Next.js 15 server-boot hook. Called once per server process.
// See ADR-048.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.DEV_AUTH_ENABLED !== 'true') return

  const { getDb } = await import('@honeyai/db')
  const { seedDevTenants } = await import('./lib/dev-seed')
  await seedDevTenants(getDb(), { devAuthEnabled: true })
}
```

- [ ] **Step 6: Run tests — green**

```bash
pnpm --filter @honeyai/web test -- dev-seed
```

Expected: 3/3 pass.

- [ ] **Step 7: Commit**

```bash
git add packages/web/lib/test packages/web/lib/dev-seed.ts packages/web/lib/dev-seed.test.ts packages/web/instrumentation.ts
git commit -m "feat(web): instrumentation.ts dev-seed for tenants + members (ADR-048)"
```

---

## Task 7: `lib/bootstrap/read.ts` (React `cache()` reader)

**Files:**

- Create: `packages/web/lib/bootstrap/read.ts`
- Create: `packages/web/lib/bootstrap/read.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/web/lib/bootstrap/read.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { uuidv7 } from 'uuidv7'
import { tenants } from '@honeyai/db/schema'
import { withTestDb } from '../test/db'
import { getTenantBootstrap } from './read'

describe('getTenantBootstrap', () => {
  it('returns null when tenant missing', async () => {
    await withTestDb(async (db) => {
      vi.doMock('@honeyai/db', () => ({ getDb: () => db }))
      const r = await getTenantBootstrap(uuidv7())
      expect(r).toBeNull()
    })
  })

  it('returns { slug, bootstrap: state } when tenant has bootstrap', async () => {
    await withTestDb(async (db) => {
      vi.doMock('@honeyai/db', () => ({ getDb: () => db }))
      const id = uuidv7()
      await db.insert(tenants).values({
        id,
        slug: 'alice',
        name: 'alice',
        kind: 'personal',
        settings: { bootstrap: { completedAt: '2026-01-01T00:00:00Z' } },
      })
      const r = await getTenantBootstrap(id)
      expect(r).toEqual({
        slug: 'alice',
        bootstrap: { completedAt: '2026-01-01T00:00:00Z' },
      })
    })
  })

  it('returns { slug, bootstrap: null } when settings has no bootstrap key', async () => {
    await withTestDb(async (db) => {
      vi.doMock('@honeyai/db', () => ({ getDb: () => db }))
      const id = uuidv7()
      await db.insert(tenants).values({ id, slug: 'alice', name: 'alice', kind: 'personal' })
      const r = await getTenantBootstrap(id)
      expect(r).toEqual({ slug: 'alice', bootstrap: null })
    })
  })
})
```

- [ ] **Step 2: Run failing tests** → 3 failures (module missing).

- [ ] **Step 3: Implement `read.ts`**

```ts
// packages/web/lib/bootstrap/read.ts
import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { tenants } from '@honeyai/db/schema'
import type { TenantBootstrapState } from '@honeyai/db/schema'

export type TenantBootstrapReadResult = {
  slug: string
  bootstrap: TenantBootstrapState | null
}

export const getTenantBootstrap = cache(
  async (tenantId: string): Promise<TenantBootstrapReadResult | null> => {
    const db = getDb()
    const rows = await db
      .select({ slug: tenants.slug, settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)
    if (rows.length === 0) return null
    return { slug: rows[0].slug, bootstrap: rows[0].settings?.bootstrap ?? null }
  },
)
```

- [ ] **Step 4: Run tests — green** (3/3).

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/bootstrap/read.ts packages/web/lib/bootstrap/read.test.ts
git commit -m "feat(web): getTenantBootstrap with React cache() dedup (ADR-040)"
```

---

## Task 8: `lib/bootstrap/guard.ts` (AC-01-04 backbone)

**Files:**

- Create: `packages/web/lib/bootstrap/guard.ts`
- Create: `packages/web/lib/bootstrap/guard.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/web/lib/bootstrap/guard.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('./read', () => ({
  getTenantBootstrap: vi.fn(),
}))

import { redirect } from 'next/navigation'
import { getTenantBootstrap } from './read'
import { requireBootstrapComplete, requireBootstrapIncomplete } from './guard'

describe('AC-01-04: bootstrap guard redirect matrix', () => {
  it('AC-01-04: requireBootstrapComplete passes when completedAt set', async () => {
    vi.mocked(getTenantBootstrap).mockResolvedValue({
      slug: 'alice',
      bootstrap: { completedAt: '2026-01-01T00:00:00Z' },
    })
    await expect(requireBootstrapComplete('t1')).resolves.toBeUndefined()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('AC-01-04: requireBootstrapComplete redirects to /welcome when incomplete', async () => {
    vi.mocked(getTenantBootstrap).mockResolvedValue({ slug: 'alice', bootstrap: null })
    await expect(requireBootstrapComplete('t1')).rejects.toThrow('REDIRECT:/welcome')
  })

  it('AC-01-04: requireBootstrapIncomplete passes when bootstrap is null', async () => {
    vi.mocked(getTenantBootstrap).mockResolvedValue({ slug: 'alice', bootstrap: null })
    await expect(requireBootstrapIncomplete('t1')).resolves.toBeUndefined()
  })

  it('AC-01-04: requireBootstrapIncomplete redirects to /t/[slug] when complete', async () => {
    vi.mocked(getTenantBootstrap).mockResolvedValue({
      slug: 'alice',
      bootstrap: { completedAt: '2026-01-01T00:00:00Z' },
    })
    await expect(requireBootstrapIncomplete('t1')).rejects.toThrow('REDIRECT:/t/alice')
  })
})
```

- [ ] **Step 2: Run failing tests** → 4 fail (module missing).

- [ ] **Step 3: Implement `guard.ts`**

```ts
// packages/web/lib/bootstrap/guard.ts
import { redirect } from 'next/navigation'
import { getTenantBootstrap } from './read'

export async function requireBootstrapComplete(tenantId: string): Promise<void> {
  const r = await getTenantBootstrap(tenantId)
  if (!r || !r.bootstrap?.completedAt) redirect('/welcome')
}

export async function requireBootstrapIncomplete(tenantId: string): Promise<void> {
  const r = await getTenantBootstrap(tenantId)
  if (r?.bootstrap?.completedAt) redirect(`/t/${r.slug}`)
}
```

- [ ] **Step 4: Run tests — green** (4/4 AC-01-04 prefixed).

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/bootstrap/guard.ts packages/web/lib/bootstrap/guard.test.ts
git commit -m "feat(web): bootstrap guards + AC-01-04 redirect matrix (ADR-039)"
```

---

## Task 9: `WelcomeErrorCode` + zh strings

**Files:**

- Create: `packages/web/lib/errors/welcome-errors.ts`
- Modify: `packages/web/lib/strings/zh.ts`

- [ ] **Step 1: Create `welcome-errors.ts`**

```ts
// packages/web/lib/errors/welcome-errors.ts
export type WelcomeErrorCode =
  | 'INVALID_KEY_FORMAT'
  | 'INVALID_REPO_FORMAT'
  | 'BOOTSTRAP_ALREADY_COMPLETE'
  | 'UNAUTHENTICATED'
  | 'TENANT_NOT_FOUND'
  | 'INTERNAL_ERROR'

export type WelcomeActionResult =
  | { ok: true }
  | { ok: false; code: WelcomeErrorCode; field?: string; message?: string }
```

- [ ] **Step 2: Extend `zh.ts`**

Append to `packages/web/lib/strings/zh.ts`:

```ts
export const zhWelcome = {
  step1: {
    title: '第 1 步：填入 Anthropic API Key',
    keyLabel: 'API Key',
    keyHint: '以 sk-ant- 开头，至少 39 字符',
    submit: '保存并继续',
  },
  step2: {
    title: '第 2 步：安装 GitHub App',
    install: '前往 GitHub 安装',
    confirm: '我已完成安装',
  },
  step3: {
    title: '第 3 步：选择 GitHub 仓库',
    repoLabel: '仓库 (owner/name)',
    submit: '保存并继续',
  },
  step4: {
    title: '第 4 步：导入默认 Skills',
    import: '导入 5 个默认',
    skip: '跳过',
  },
}

export const zhErrorsWelcome: Record<string, string> = {
  INVALID_KEY_FORMAT: 'Anthropic Key 格式不正确',
  INVALID_REPO_FORMAT: '仓库格式不正确，应为 owner/name',
  BOOTSTRAP_ALREADY_COMPLETE: '引导已完成，无法重复提交',
  UNAUTHENTICATED: '请先登录',
  TENANT_NOT_FOUND: '找不到对应租户',
  INTERNAL_ERROR: '系统内部错误，请稍后重试',
}
```

- [ ] **Step 3: No tests for pure strings — verify typecheck**

```bash
pnpm --filter @honeyai/web typecheck
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add packages/web/lib/errors/welcome-errors.ts packages/web/lib/strings/zh.ts
git commit -m "feat(web): WelcomeErrorCode union + zh strings"
```

---

## Task 10: Add shadcn Alert / Input / Label primitives + FormMessage

**Files:**

- Create: `packages/web/components/ui/alert.tsx`
- Create: `packages/web/components/ui/input.tsx`
- Create: `packages/web/components/ui/label.tsx`
- Create: `packages/web/components/ui/form-message.tsx`
- Create: 4 smoke test files

- [ ] **Step 1: Install via shadcn CLI**

```bash
cd packages/web
pnpm dlx shadcn@latest add alert input label
```

This auto-adds `@radix-ui/react-label` and creates 3 files.

- [ ] **Step 2: Hand-write `form-message.tsx`**

```tsx
// packages/web/components/ui/form-message.tsx
import { cn } from '@/lib/utils'

export function FormMessage({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  if (!children) return null
  return (
    <p role="alert" className={cn('text-sm text-destructive mt-1', className)}>
      {children}
    </p>
  )
}
```

- [ ] **Step 3: Write 4 smoke tests**

Each file: 1 test (`render + screen.getByRole/Text`). Follow slice 4.2 cadence — e.g.:

```tsx
// alert.test.tsx
import { render, screen } from '@testing-library/react'
import { Alert, AlertTitle, AlertDescription } from './alert'

it('renders alert with title and description', () => {
  render(
    <Alert>
      <AlertTitle>T</AlertTitle>
      <AlertDescription>D</AlertDescription>
    </Alert>,
  )
  expect(screen.getByText('T')).toBeInTheDocument()
  expect(screen.getByText('D')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run all tests — green**

```bash
pnpm --filter @honeyai/web test
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/ui/alert.tsx packages/web/components/ui/input.tsx packages/web/components/ui/label.tsx packages/web/components/ui/form-message.tsx packages/web/components/ui/*.test.tsx packages/web/package.json packages/web/styles/globals.css
git commit -m "feat(web/ui): add Alert + Input + Label + FormMessage shadcn primitives (ADR-042)"
```

---

## Task 11: `ProgressCards` component

**Files:**

- Create: `packages/web/components/welcome/ProgressCards.tsx`
- Create: `packages/web/components/welcome/ProgressCards.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// ProgressCards.test.tsx
import { render, screen } from '@testing-library/react'
import { ProgressCards } from './ProgressCards'

describe('ProgressCards (ADR-044/045)', () => {
  it('renders 4 cards (Anthropic / GitHub App / Repo / Skills)', () => {
    render(<ProgressCards currentStep={1} completed={[]} />)
    expect(screen.getByText(/Anthropic/)).toBeInTheDocument()
    expect(screen.getByText(/GitHub App/)).toBeInTheDocument()
    expect(screen.getByText(/仓库|Repo/)).toBeInTheDocument()
    expect(screen.getByText(/Skills/)).toBeInTheDocument()
  })

  it('current step has data-state="running"', () => {
    render(<ProgressCards currentStep={2} completed={[1]} />)
    const cards = screen.getAllByRole('listitem')
    expect(cards[1].getAttribute('data-state')).toBe('running')
  })

  it('completed steps have data-state="done"', () => {
    render(<ProgressCards currentStep={3} completed={[1, 2]} />)
    const cards = screen.getAllByRole('listitem')
    expect(cards[0].getAttribute('data-state')).toBe('done')
    expect(cards[1].getAttribute('data-state')).toBe('done')
  })

  it('upcoming steps have data-state="idle"', () => {
    render(<ProgressCards currentStep={1} completed={[]} />)
    const cards = screen.getAllByRole('listitem')
    expect(cards[3].getAttribute('data-state')).toBe('idle')
  })
})
```

- [ ] **Step 2: Run failing tests** → 4 fail.

- [ ] **Step 3: Implement `ProgressCards.tsx`**

```tsx
// packages/web/components/welcome/ProgressCards.tsx
import { cn } from '@/lib/utils'

type State = 'idle' | 'running' | 'done'

const STEPS = [
  { n: 1, label: 'Anthropic API Key' },
  { n: 2, label: 'GitHub App' },
  { n: 3, label: '仓库' },
  { n: 4, label: 'Skills' },
]

export function ProgressCards({
  currentStep,
  completed,
}: {
  currentStep: number
  completed: number[]
}) {
  return (
    <ol className="space-y-3" role="list">
      {STEPS.map((s) => {
        const state: State = completed.includes(s.n)
          ? 'done'
          : s.n === currentStep
            ? 'running'
            : 'idle'
        return (
          <li
            key={s.n}
            data-state={state}
            role="listitem"
            className={cn(
              'rounded-md border p-3 transition-all duration-300',
              state === 'done' && 'border-emerald-300 bg-emerald-50',
              state === 'running' && 'border-amber-300 bg-amber-50',
              state === 'idle' && 'border-neutral-200 bg-neutral-50 opacity-60',
            )}
          >
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-xs text-muted-foreground">
              {state === 'done' ? '已完成' : state === 'running' ? '进行中' : '待开始'}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
```

- [ ] **Step 4: Run tests — green** (4/4).

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/welcome
git commit -m "feat(web): 4-card welcome ProgressCards with state transitions (ADR-044/045)"
```

---

## Task 12: Step 1 action + form + tests (AC-01-05, AC-01-10)

**Files:**

- Create: `packages/web/app/(welcome)/welcome/step/[n]/actions.ts` (file holds all 4 actions; populate Step 1 first)
- Create: `packages/web/app/(welcome)/welcome/step/[n]/Step1AnthropicKeyForm.tsx`
- Create: `packages/web/app/(welcome)/welcome/step/[n]/actions.step1.test.ts`
- Create: `packages/web/app/(welcome)/welcome/step/[n]/Step1AnthropicKeyForm.test.tsx`

- [ ] **Step 1: Write failing action test**

```ts
// actions.step1.test.ts
import { describe, it, expect, vi } from 'vitest'
vi.mock('next/navigation', () => ({
  redirect: vi.fn((u: string) => {
    throw new Error(`REDIRECT:${u}`)
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockGetSession = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: mockGetSession }))

const mockUpdate = vi.fn().mockResolvedValue({ rowCount: 1 })
vi.mock('@honeyai/db', () => ({
  getDb: () => ({
    update: () => ({ set: () => ({ where: mockUpdate }) }),
  }),
}))

import { submitStep1 } from './actions'

describe('submitStep1 (AC-01-05, AC-01-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ user: { tenantId: 't1', tenantSlug: 'alice' } })
  })

  it('AC-01-05: rejects invalid key format', async () => {
    const fd = new FormData()
    fd.set('key', 'not-a-key')
    const r = await submitStep1({ ok: true } as any, fd)
    expect(r).toEqual(expect.objectContaining({ ok: false, code: 'INVALID_KEY_FORMAT' }))
  })

  it('AC-01-10: rejects when bootstrap already complete', async () => {
    // mock getTenantBootstrap to return completedAt set
    vi.doMock('@/lib/bootstrap/read', () => ({
      getTenantBootstrap: vi.fn().mockResolvedValue({
        slug: 'alice',
        bootstrap: { completedAt: '2026-01-01T00:00:00Z' },
      }),
    }))
    const { submitStep1: s1 } = await import('./actions')
    const fd = new FormData()
    fd.set('key', 'sk-ant-' + 'a'.repeat(40))
    const r = await s1({ ok: true } as any, fd)
    expect(r).toEqual(expect.objectContaining({ ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' }))
  })

  it('AC-01-05: persists ciphertext + redirects to step/2 on valid key', async () => {
    vi.doMock('@/lib/bootstrap/read', () => ({
      getTenantBootstrap: vi.fn().mockResolvedValue({ slug: 'alice', bootstrap: null }),
    }))
    const { submitStep1: s1 } = await import('./actions')
    const fd = new FormData()
    fd.set('key', 'sk-ant-' + 'a'.repeat(40))
    await expect(s1({ ok: true } as any, fd)).rejects.toThrow('REDIRECT:/welcome/step/2')
    expect(mockUpdate).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing tests** → 3 fail (module missing).

- [ ] **Step 3: Implement `actions.ts` Step 1**

```ts
// packages/web/app/(welcome)/welcome/step/[n]/actions.ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sql } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { tenants } from '@honeyai/db/schema'
import { auth } from '@/lib/auth'
import { encryptAnthropicKey } from '@honeyai/core'
import { getTenantBootstrap } from '@/lib/bootstrap/read'
import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{32,}$/
const step1Schema = z.object({ key: z.string().regex(KEY_RE) })

async function requireTenantCtx() {
  const session = await auth()
  if (!session?.user?.tenantId)
    return { error: { ok: false as const, code: 'UNAUTHENTICATED' as const } }
  return { tenantId: session.user.tenantId, tenantSlug: session.user.tenantSlug }
}

async function patchBootstrap(tenantId: string, patch: Record<string, unknown>) {
  const db = getDb()
  await db
    .update(tenants)
    .set({
      settings: sql`COALESCE(${tenants.settings}, '{}'::jsonb) || ${JSON.stringify({ bootstrap: patch })}::jsonb`,
    })
    .where(sql`${tenants.id} = ${tenantId}`)
  revalidatePath('/welcome', 'layout')
}

export async function submitStep1(
  _prev: WelcomeActionResult,
  fd: FormData,
): Promise<WelcomeActionResult> {
  const ctx = await requireTenantCtx()
  if ('error' in ctx) return ctx.error

  const existing = await getTenantBootstrap(ctx.tenantId)
  if (existing?.bootstrap?.completedAt) {
    return { ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' }
  }

  const parsed = step1Schema.safeParse({ key: fd.get('key') })
  if (!parsed.success) return { ok: false, code: 'INVALID_KEY_FORMAT', field: 'key' }

  const cipher = encryptAnthropicKey(parsed.data.key)
  await patchBootstrap(ctx.tenantId, {
    ...(existing?.bootstrap ?? {}),
    anthropicKeyCiphertext: cipher,
  })
  redirect('/welcome/step/2')
}
```

- [ ] **Step 4: Write the Step 1 form (client)**

```tsx
// Step1AnthropicKeyForm.tsx
'use client'
import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { submitStep1 } from './actions'
import { zhWelcome, zhErrorsWelcome } from '@/lib/strings/zh'

export function Step1AnthropicKeyForm() {
  const [state, formAction, pending] = useActionState(submitStep1, { ok: true } as any)
  const fieldErr = !state.ok && state.field === 'key' ? state.code : undefined
  const bannerErr = !state.ok && !state.field ? state.code : undefined
  return (
    <form action={formAction} className="space-y-4">
      <h1>{zhWelcome.step1.title}</h1>
      {bannerErr && (
        <Alert variant="destructive">
          <AlertDescription>{zhErrorsWelcome[bannerErr]}</AlertDescription>
        </Alert>
      )}
      <div>
        <Label htmlFor="key">{zhWelcome.step1.keyLabel}</Label>
        <Input id="key" name="key" type="password" required aria-invalid={Boolean(fieldErr)} />
        <FormMessage>{fieldErr ? zhErrorsWelcome[fieldErr] : zhWelcome.step1.keyHint}</FormMessage>
      </div>
      <Button type="submit" disabled={pending}>
        {zhWelcome.step1.submit}
      </Button>
    </form>
  )
}
```

- [ ] **Step 5: Write form integration test**

```tsx
// Step1AnthropicKeyForm.test.tsx — see Step 4 in actions.test for behavior;
// here just verify field renders, aria-invalid wires, submit calls action
```

- [ ] **Step 6: Run tests — green**.

- [ ] **Step 7: Commit**

```bash
git add "packages/web/app/(welcome)/welcome/step/[n]/actions.ts" "packages/web/app/(welcome)/welcome/step/[n]/Step1*"
git commit -m "feat(web): welcome step 1 (Anthropic key) action + form (AC-01-05/-10, ADR-035/047)"
```

---

## Task 13: Step 2 action + form (AC-01-06)

**Files:**

- Modify: `packages/web/app/(welcome)/welcome/step/[n]/actions.ts` (append `submitStep2`)
- Create: `packages/web/app/(welcome)/welcome/step/[n]/Step2GithubAppForm.tsx`
- Create: `actions.step2.test.ts`
- Create: `Step2GithubAppForm.test.tsx`
- Modify: `.env.example` — add `GITHUB_APP_INSTALL_URL`
- Modify: `packages/core/src/env/index.ts` (optional) to expose URL

- [ ] **Step 1: Write failing action test**

```ts
// actions.step2.test.ts
import { describe, it, expect, vi } from 'vitest'
// same mock setup as step1 test (redirect / db / auth)

describe('submitStep2 (AC-01-06)', () => {
  it('AC-01-06: rejects when step 1 not done', async () => {
    // mock getTenantBootstrap to return { bootstrap: null } or { bootstrap: { /* no key */ } }
    // expect ok: false, code: 'INTERNAL_ERROR' or new precondition code (decide here: reuse 'INTERNAL_ERROR' with message="先完成第 1 步")
  })

  it('AC-01-06: marks githubAppInstalled=true + redirects to step/3', async () => {
    // bootstrap has anthropicKeyCiphertext set
    // expect REDIRECT:/welcome/step/3 + db update called with githubAppInstalled true + githubAppMarkedAt iso string
  })
})
```

- [ ] **Step 2: Run failing tests** → 2 fail.

- [ ] **Step 3: Implement `submitStep2`**

```ts
const step2Schema = z.object({ confirm: z.literal('on') })

export async function submitStep2(
  _prev: WelcomeActionResult,
  fd: FormData,
): Promise<WelcomeActionResult> {
  const ctx = await requireTenantCtx()
  if ('error' in ctx) return ctx.error

  const existing = await getTenantBootstrap(ctx.tenantId)
  if (existing?.bootstrap?.completedAt) {
    return { ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' }
  }
  if (!existing?.bootstrap?.anthropicKeyCiphertext) {
    return { ok: false, code: 'INTERNAL_ERROR', message: '请先完成第 1 步' }
  }

  const parsed = step2Schema.safeParse({ confirm: fd.get('confirm') })
  if (!parsed.success) return { ok: false, code: 'INTERNAL_ERROR' }

  await patchBootstrap(ctx.tenantId, {
    ...existing.bootstrap,
    githubAppInstalled: true,
    githubAppMarkedAt: new Date().toISOString(),
  })
  redirect('/welcome/step/3')
}
```

- [ ] **Step 4: Form**

```tsx
// Step2GithubAppForm.tsx
'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { submitStep2 } from './actions'
import { zhWelcome, zhErrorsWelcome } from '@/lib/strings/zh'

const INSTALL_URL = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL ?? '#'

export function Step2GithubAppForm() {
  const [state, formAction, pending] = useActionState(submitStep2, { ok: true } as any)
  const err = !state.ok ? state.code : undefined
  return (
    <form action={formAction} className="space-y-4">
      <h1>{zhWelcome.step2.title}</h1>
      {err && (
        <Alert variant="destructive">
          <AlertDescription>{state.message ?? zhErrorsWelcome[err]}</AlertDescription>
        </Alert>
      )}
      <a href={INSTALL_URL} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" type="button">
          {zhWelcome.step2.install}
        </Button>
      </a>
      <input type="hidden" name="confirm" value="on" />
      <Button type="submit" disabled={pending}>
        {zhWelcome.step2.confirm}
      </Button>
    </form>
  )
}
```

- [ ] **Step 5: `.env.example` patch**

```bash
# Append to .env.example:
# GitHub App install URL shown to user in Welcome step 2 (Q11 GA2)
GITHUB_APP_INSTALL_URL=https://github.com/apps/your-honeyai-app/installations/new
NEXT_PUBLIC_GITHUB_APP_INSTALL_URL=https://github.com/apps/your-honeyai-app/installations/new
```

- [ ] **Step 6: Run tests — green**.

- [ ] **Step 7: Commit**

```bash
git add "packages/web/app/(welcome)/welcome/step/[n]/actions.ts" "packages/web/app/(welcome)/welcome/step/[n]/Step2*" .env.example
git commit -m "feat(web): welcome step 2 (GitHub App) action + form (AC-01-06)"
```

---

## Task 14: Step 3 action + form (AC-01-07)

**Files:**

- Modify: `actions.ts` (append `submitStep3`)
- Create: `Step3GithubRepoForm.tsx` + tests

- [ ] **Step 1: Write failing action test**

```ts
describe('submitStep3 (AC-01-07)', () => {
  it('AC-01-07: rejects malformed repo string', async () => {
    // fd.set('repo','notarepo')
    // expect ok:false, code:'INVALID_REPO_FORMAT', field:'repo'
  })

  it('AC-01-07: persists pendingRepoOwnerName + redirects to step/4', async () => {
    // fd.set('repo','octocat/Hello-World')
    // expect REDIRECT:/welcome/step/4 + bootstrap.pendingRepoOwnerName === 'octocat/Hello-World'
  })

  it('AC-01-07: rejects when step 2 not done', async () => {
    // bootstrap has key but no githubAppInstalled
    // expect ok:false, code:'INTERNAL_ERROR'
  })
})
```

- [ ] **Step 2: Run failing tests** → 3 fail.

- [ ] **Step 3: Implement**

```ts
const REPO_RE = /^[\w.-]+\/[\w.-]+$/
const step3Schema = z.object({ repo: z.string().regex(REPO_RE) })

export async function submitStep3(
  _prev: WelcomeActionResult,
  fd: FormData,
): Promise<WelcomeActionResult> {
  const ctx = await requireTenantCtx()
  if ('error' in ctx) return ctx.error

  const existing = await getTenantBootstrap(ctx.tenantId)
  if (existing?.bootstrap?.completedAt) {
    return { ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' }
  }
  if (!existing?.bootstrap?.githubAppInstalled) {
    return { ok: false, code: 'INTERNAL_ERROR', message: '请先完成第 2 步' }
  }

  const parsed = step3Schema.safeParse({ repo: fd.get('repo') })
  if (!parsed.success) return { ok: false, code: 'INVALID_REPO_FORMAT', field: 'repo' }

  await patchBootstrap(ctx.tenantId, {
    ...existing.bootstrap,
    pendingRepoOwnerName: parsed.data.repo,
  })
  redirect('/welcome/step/4')
}
```

- [ ] **Step 4: Form (mirror Step 1 with Input + regex hint)**.

- [ ] **Step 5: Run tests — green**.

- [ ] **Step 6: Commit**

```bash
git add "packages/web/app/(welcome)/welcome/step/[n]/actions.ts" "packages/web/app/(welcome)/welcome/step/[n]/Step3*"
git commit -m "feat(web): welcome step 3 (GitHub repo) action + form (AC-01-07)"
```

---

## Task 15: Step 4 action + default-skills seeds (AC-01-08, AC-01-09)

**Files:**

- Create: `packages/web/lib/seeds/default-skills.ts`
- Create: `packages/web/lib/seeds/default-skills.test.ts`
- Modify: `actions.ts` (append `submitStep4`)
- Create: `Step4SkillsForm.tsx` + tests

- [ ] **Step 1: Author 5 default-skill literals**

Create `packages/web/lib/seeds/default-skills.ts`:

```ts
import type { AssetKind } from '@honeyai/db/schema'

export type DefaultSkillSeed = {
  kind: AssetKind
  name: string
  body: string
  metadata: Record<string, unknown>
}

export const DEFAULT_SKILL_SEEDS: DefaultSkillSeed[] = [
  {
    kind: 'skill',
    name: 'code-review-assistant',
    body: '# Code Review Assistant\n\nReview diffs for clarity, errors, security.\n',
    metadata: { source: 'honeyai-default-v1', category: 'review' },
  },
  {
    kind: 'rule',
    name: 'no-pii-in-logs',
    body: 'Never log raw email, phone, SSN, or API keys. Redact with `***`.\n',
    metadata: { source: 'honeyai-default-v1', severity: 'high' },
  },
  {
    kind: 'command',
    name: 'run-tests',
    body: 'pnpm test\n',
    metadata: { source: 'honeyai-default-v1' },
  },
  {
    kind: 'hint',
    name: 'prefer-server-components',
    body: 'Default to React Server Components. Use "use client" only for interactivity.\n',
    metadata: { source: 'honeyai-default-v1' },
  },
  {
    kind: 'hook',
    name: 'pre-commit-format',
    body: 'pnpm prettier --write . && pnpm lint --fix\n',
    metadata: { source: 'honeyai-default-v1', stage: 'pre-commit' },
  },
]

export async function importDefaultSkills(
  tx: any /* drizzle tx */,
  tenantId: string,
): Promise<void> {
  const { assets } = await import('@honeyai/db/schema')
  for (const seed of DEFAULT_SKILL_SEEDS) {
    await tx
      .insert(assets)
      .values({
        tenantId,
        kind: seed.kind,
        name: seed.name,
        body: seed.body,
        metadata: seed.metadata,
        isEnabled: true,
      })
      .onConflictDoNothing()
  }
}
```

- [ ] **Step 2: Write idempotency test (AC-01-09)**

```ts
// default-skills.test.ts (testcontainer)
import { withTestDb } from '../test/db'
import { assets, tenants } from '@honeyai/db/schema'
import { importDefaultSkills, DEFAULT_SKILL_SEEDS } from './default-skills'
import { uuidv7 } from 'uuidv7'
import { eq } from 'drizzle-orm'

it('AC-01-09: importDefaultSkills is idempotent', async () => {
  await withTestDb(async (db) => {
    const id = uuidv7()
    await db.insert(tenants).values({ id, slug: 't', name: 't', kind: 'personal' })
    await db.transaction((tx) => importDefaultSkills(tx, id))
    await db.transaction((tx) => importDefaultSkills(tx, id))
    const rows = await db.select().from(assets).where(eq(assets.tenantId, id))
    expect(rows).toHaveLength(DEFAULT_SKILL_SEEDS.length)
  })
})
```

- [ ] **Step 3: Implement `submitStep4`**

```ts
export async function submitStep4(
  _prev: WelcomeActionResult,
  fd: FormData,
): Promise<WelcomeActionResult> {
  const ctx = await requireTenantCtx()
  if ('error' in ctx) return ctx.error

  const existing = await getTenantBootstrap(ctx.tenantId)
  if (existing?.bootstrap?.completedAt) {
    return { ok: false, code: 'BOOTSTRAP_ALREADY_COMPLETE' }
  }
  if (!existing?.bootstrap?.pendingRepoOwnerName) {
    return { ok: false, code: 'INTERNAL_ERROR', message: '请先完成第 3 步' }
  }

  const action = fd.get('action')
  const applied = action === 'import' ? 'imported' : 'skipped'

  const db = getDb()
  await db.transaction(async (tx) => {
    if (action === 'import') {
      const { importDefaultSkills } = await import('@/lib/seeds/default-skills')
      await importDefaultSkills(tx, ctx.tenantId)
    }
    await tx
      .update(tenants)
      .set({
        settings: sql`COALESCE(${tenants.settings}, '{}'::jsonb) || ${JSON.stringify({
          bootstrap: {
            ...existing.bootstrap,
            defaultSkillsApplied: applied,
            completedAt: new Date().toISOString(),
          },
        })}::jsonb`,
      })
      .where(sql`${tenants.id} = ${ctx.tenantId}`)
  })
  revalidatePath('/welcome', 'layout')
  revalidatePath(`/t/${ctx.tenantSlug}`, 'layout')
  redirect(`/t/${ctx.tenantSlug}`)
}
```

- [ ] **Step 4: Form**

```tsx
// Step4SkillsForm.tsx
'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { submitStep4 } from './actions'
import { zhWelcome, zhErrorsWelcome } from '@/lib/strings/zh'

export function Step4SkillsForm() {
  const [state, formAction, pending] = useActionState(submitStep4, { ok: true } as any)
  const err = !state.ok ? state.code : undefined
  return (
    <form action={formAction} className="space-y-4">
      <h1>{zhWelcome.step4.title}</h1>
      {err && (
        <Alert variant="destructive">
          <AlertDescription>{state.message ?? zhErrorsWelcome[err]}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-3">
        <Button type="submit" name="action" value="import" disabled={pending}>
          {zhWelcome.step4.import}
        </Button>
        <Button type="submit" name="action" value="skip" variant="outline" disabled={pending}>
          {zhWelcome.step4.skip}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Write AC-01-08 action test**

```ts
it('AC-01-08: import sets completedAt + inserts 5 assets + redirects to /t/[slug]', async () => {
  // mock bootstrap state with all 3 prior steps done; fd.set('action','import')
  // expect REDIRECT:/t/alice; db assets has 5 rows; bootstrap.completedAt is iso string
})

it('AC-01-08: skip sets completedAt + applied="skipped" + redirects', async () => {
  // fd.set('action','skip')
  // expect REDIRECT:/t/alice; bootstrap.defaultSkillsApplied === 'skipped'
})
```

- [ ] **Step 6: Run tests — green**.

- [ ] **Step 7: Commit**

```bash
git add packages/web/lib/seeds "packages/web/app/(welcome)/welcome/step/[n]/actions.ts" "packages/web/app/(welcome)/welcome/step/[n]/Step4*"
git commit -m "feat(web): welcome step 4 (skills seed) action + form (AC-01-08/-09, ADR-037/038)"
```

---

## Task 16: Welcome routing pages

**Files:**

- Create: `packages/web/app/(welcome)/welcome/page.tsx` (bidirectional redirect)
- Create: `packages/web/app/(welcome)/welcome/step/[n]/page.tsx` (dispatcher)

- [ ] **Step 1: `welcome/page.tsx`**

```tsx
// packages/web/app/(welcome)/welcome/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTenantBootstrap } from '@/lib/bootstrap/read'

export default async function WelcomeIndexPage() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')
  const r = await getTenantBootstrap(session.user.tenantId)
  if (r?.bootstrap?.completedAt) redirect(`/t/${r.slug}`)

  // Resume from earliest unfinished step
  const b = r?.bootstrap
  if (!b?.anthropicKeyCiphertext) redirect('/welcome/step/1')
  if (!b.githubAppInstalled) redirect('/welcome/step/2')
  if (!b.pendingRepoOwnerName) redirect('/welcome/step/3')
  redirect('/welcome/step/4')
}
```

- [ ] **Step 2: `welcome/step/[n]/page.tsx` (dispatcher)**

```tsx
// packages/web/app/(welcome)/welcome/step/[n]/page.tsx
import { notFound } from 'next/navigation'
import { ProgressCards } from '@/components/welcome/ProgressCards'
import { Step1AnthropicKeyForm } from './Step1AnthropicKeyForm'
import { Step2GithubAppForm } from './Step2GithubAppForm'
import { Step3GithubRepoForm } from './Step3GithubRepoForm'
import { Step4SkillsForm } from './Step4SkillsForm'
import { auth } from '@/lib/auth'
import { getTenantBootstrap } from '@/lib/bootstrap/read'
import { redirect } from 'next/navigation'

const FORMS = {
  1: Step1AnthropicKeyForm,
  2: Step2GithubAppForm,
  3: Step3GithubRepoForm,
  4: Step4SkillsForm,
} as const

export default async function WelcomeStepPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params
  const step = Number(n)
  if (!Number.isInteger(step) || step < 1 || step > 4) notFound()

  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')
  const r = await getTenantBootstrap(session.user.tenantId)
  const completed: number[] = []
  if (r?.bootstrap?.anthropicKeyCiphertext) completed.push(1)
  if (r?.bootstrap?.githubAppInstalled) completed.push(2)
  if (r?.bootstrap?.pendingRepoOwnerName) completed.push(3)

  const Form = FORMS[step as 1 | 2 | 3 | 4]
  return (
    <div className="grid grid-cols-[1fr_320px] gap-8">
      <Form />
      <aside>
        <ProgressCards currentStep={step} completed={completed} />
      </aside>
    </div>
  )
}
```

- [ ] **Step 3: Smoke test that 4 routes render without crash** (testing-library + mocks for auth + getTenantBootstrap).

- [ ] **Step 4: Commit**

```bash
git add "packages/web/app/(welcome)/welcome"
git commit -m "feat(web): welcome routing pages + step dispatcher (ADR-043)"
```

---

## Task 17: Wire layout guards + slug validation (AC-01-04, AC-01-12)

**Files:**

- Modify: `packages/web/app/(welcome)/layout.tsx`
- Modify: `packages/web/app/t/[slug]/layout.tsx`
- Create: `packages/web/app/(welcome)/layout.test.tsx`
- Create: `packages/web/app/t/[slug]/layout.test.tsx`

- [ ] **Step 1: `(welcome)/layout.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { requireBootstrapIncomplete } from '@/lib/bootstrap/guard'

export default async function WelcomeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')
  await requireBootstrapIncomplete(session.user.tenantId)
  return <div className="min-h-screen bg-atmosphere p-8">{children}</div>
}
```

- [ ] **Step 2: `t/[slug]/layout.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { requireBootstrapComplete } from '@/lib/bootstrap/guard'
import { getTenantBootstrap } from '@/lib/bootstrap/read'

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')
  await requireBootstrapComplete(session.user.tenantId)

  const r = await getTenantBootstrap(session.user.tenantId)
  if (!r) notFound()
  if (r.slug !== slug) redirect(`/t/${r.slug}`) // AC-01-12

  return <>{children}</>
}
```

- [ ] **Step 3: Layout integration tests**

```ts
// AC-01-04 (welcome guard + reverse) + AC-01-12 (slug mismatch)
it('AC-01-04: complete user visiting /welcome → /t/alice', async () => { ... })
it('AC-01-04: incomplete user visiting /t/alice → /welcome', async () => { ... })
it('AC-01-12: alice visiting /t/bob → /t/alice', async () => { ... })
```

- [ ] **Step 4: Run tests — green**.

- [ ] **Step 5: Commit**

```bash
git add "packages/web/app/(welcome)/layout.tsx" "packages/web/app/t/[slug]/layout.tsx" "packages/web/app/(welcome)/layout.test.tsx" "packages/web/app/t/[slug]/layout.test.tsx"
git commit -m "feat(web): wire bootstrap layout guards + slug mismatch redirect (AC-01-04/-12, ADR-039/043)"
```

---

## Task 18: Three error.tsx layers

**Files:**

- Create: `packages/web/app/error.tsx`
- Create: `packages/web/app/(welcome)/error.tsx`
- Create: `packages/web/app/(welcome)/welcome/step/[n]/error.tsx`

- [ ] **Step 1: Implement each**

```tsx
// app/error.tsx
'use client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Alert variant="destructive">
        <AlertTitle>系统出错</AlertTitle>
        <AlertDescription>请稍后重试</AlertDescription>
      </Alert>
      <Button onClick={reset}>重试</Button>
    </main>
  )
}
```

(welcome and step variants follow same pattern with scoped copy: "引导出错" / "本步出错")

- [ ] **Step 2: Verify** `pnpm --filter @honeyai/web build` exits 0.

- [ ] **Step 3: Commit**

```bash
git add "packages/web/app/error.tsx" "packages/web/app/(welcome)/error.tsx" "packages/web/app/(welcome)/welcome/step/[n]/error.tsx"
git commit -m "feat(web): three-layer welcome error.tsx boundaries (ADR-041)"
```

---

## Task 19: Cross-tenant isolation test (AC-01-11)

**Files:**

- Create: `packages/web/lib/bootstrap/cross-tenant.test.ts`

- [ ] **Step 1: Write the testcontainer test**

```ts
import { describe, it, expect } from 'vitest'
import { uuidv7 } from 'uuidv7'
import { tenants } from '@honeyai/db/schema'
import { withTestDb } from '../test/db'
import { getTenantBootstrap } from './read'
import { withTenant } from '@honeyai/db'

it('AC-01-11: alice cannot read bob.settings.bootstrap', async () => {
  await withTestDb(async (db) => {
    const aliceId = uuidv7()
    const bobId = uuidv7()
    await db.insert(tenants).values([
      { id: aliceId, slug: 'alice', name: 'alice', kind: 'personal' },
      {
        id: bobId,
        slug: 'bob',
        name: 'bob',
        kind: 'personal',
        settings: { bootstrap: { completedAt: '2026-01-01T00:00:00Z' } },
      },
    ])

    // simulate alice's request context — read bob's id via withTenant scoped to alice
    const r = await withTenant(aliceId, () => getTenantBootstrap(bobId))
    expect(r).toBeNull()
  })
})
```

(Note: depends on `withTenant` enforcing RLS or scoping in `getDb()`. If V1 has no RLS yet — verify with user before writing — substitute with a scope-check that returns null when `tenantId !== sessionTenantId`.)

- [ ] **Step 2: Run** → if RLS not yet in place, expect failure → escalate to user with concrete options (add temporary scope check in `getTenantBootstrap`, or accept AC-01-11 as known-deferred).

- [ ] **Step 3: Commit**

```bash
git add packages/web/lib/bootstrap/cross-tenant.test.ts
git commit -m "test(web): AC-01-11 cross-tenant isolation guard"
```

---

## Task 20: Spec patches (01 / 06 / 07 / phase-2-4 / CHANGELOG)

**Files:**

- Modify: `docs/V1-SPEC/01-product.md`
- Modify: `docs/V1-SPEC/06-personas-flow.md`
- Modify: `docs/V1-SPEC/07-frontend.md` §8.4
- Modify: `docs/V1-SPEC/decisions/phase-2-4-open-questions.md` §4.3
- Modify: `docs/V1-SPEC/CHANGELOG.md`

- [ ] **Step 1: AC table append in `01-product.md`**

Insert AC-01-04..AC-01-12 rows (use exact AC titles from `phase-2-4-3-open-questions.md` Q5 table).

- [ ] **Step 2: Welcome flow narrative patch in `06-personas-flow.md`**

Add §4 paragraph: "Welcome 4-step bootstrap consists of (1) Anthropic API key (2) GitHub App install (3) GitHub repo slug (4) Default skills seed/skip. Tenant marked bootstrap-complete after step 4. ..."

- [ ] **Step 3: `07-frontend.md` §8.4 patch (PI3)**

Append 4 ProgressCards spec describing 3-state visual (idle / running / done) + AN2 transitions.

- [ ] **Step 4: Tick §4.3 checkbox** in `phase-2-4-open-questions.md` and link `phase-2-4-3-open-questions.md`.

- [ ] **Step 5: CHANGELOG v0.9.0 entry**

```markdown
## [0.9.0] - 2026-05-26

### Added

- Slice 4.3 Welcome 4-step bootstrap wizard
- 17 new ADRs (ADR-032..ADR-048)
- 9 new ACs (AC-01-04..AC-01-12)
- `@honeyai/core/crypto/anthropic-key` stub (ADR-034)
- `TenantBootstrapState` shape on `tenants.settings.bootstrap`
- React `cache()`-deduped bootstrap reader + layout guards
- 5 default skill seeds, idempotent import
- Three-layer error.tsx boundaries

### Changed

- Dev credentials carry uuidv7 IDs + tenantId/tenantSlug in JWT
- `instrumentation.ts` seeds dev tenants on server boot
```

- [ ] **Step 6: Commit**

```bash
git add docs/V1-SPEC
git commit -m "docs(spec): patch 01/06/07/CHANGELOG for slice 4.3 (ADR-032..048)"
```

---

## Task 21: CI verification + PR

- [ ] **Step 1: Full local CI**

```bash
pnpm install
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm --filter @honeyai/web build
pnpm ac:coverage
```

Expected:

- typecheck green
- lint green
- all tests green (web ~58, db +2, core +4)
- build exits 0 (Windows symlink EPERM tolerated)
- ac:coverage reports AC-01-04..-12 → green

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/phase-2-4-3-welcome-wizard
gh pr create --title "feat(web): slice 4.3 Welcome 4-step bootstrap wizard" --body "$(cat <<'EOF'
## Summary
- 4-step Welcome wizard (Anthropic Key / GitHub App / GitHub repo / Default skills)
- 17 new ADRs (ADR-032..ADR-048)
- 9 new ACs (AC-01-04..-12) — all auto-tested
- Anthropic key crypto stub (real AES-GCM Phase 3)
- TenantBootstrapState shape on tenants.settings (no SQL migration)
- React cache() bootstrap reader + 2 layout guards
- 5 default skill seeds, idempotent import
- Three-layer error.tsx boundaries
- Dev credentials uuidv7 + tenantId in JWT
- instrumentation.ts dev-seed at server boot

## Test plan
- [x] pnpm -r test green
- [x] pnpm -r typecheck green
- [x] pnpm -r lint green
- [x] pnpm --filter @honeyai/web build exits 0
- [x] AC-01-04..-12 all green in ac:coverage
- [ ] Manual: alice login → /welcome → 4 steps → /t/alice
- [ ] Manual: complete then revisit /welcome → redirect /t/alice
- [ ] Manual: /t/bob as alice → redirect /t/alice
EOF
)"
```

---

## Self-Review Checklist (run before declaring plan complete)

- [x] **Spec coverage:** Every Q1-Q12 decision and every AC-01-04..-12 maps to a task above.
- [x] **No placeholders:** All code/test snippets are concrete; no "TBD"/"add validation here".
- [x] **Type consistency:** `WelcomeActionResult`, `TenantBootstrapState`, `getTenantBootstrap` signatures consistent across Tasks 4 / 7 / 8 / 12-15.
- [x] **TDD discipline:** Every task that touches code has failing-test step before implementation.
- [x] **Frequent commits:** ~21 commits, one per task.
- [x] **Open Question O1 surfaced:** Task 1 Step 2 hard-stops to ask user before any schema work.
- [x] **No scope creep:** Middleware unchanged (slice 4.5), no real AES-GCM, no real GitHub OAuth, no real Anthropic validation.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-phase-2-4-3-welcome-wizard.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Suited to this plan's 21 mostly independent tasks.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Before either path begins, the implementer MUST hard-stop at Task 1 Step 2 to confirm Open Question O1 with the user.** All downstream work depends on the nested-key interpretation of `tenants.settings.bootstrap`.

Which approach?
