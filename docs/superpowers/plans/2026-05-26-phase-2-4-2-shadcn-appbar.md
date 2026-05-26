# Phase 2 — 切片 4.2: `@honeyai/web` shadcn 基础组件 + AppBar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install 5 shadcn/ui primitives (Button / Card / DropdownMenu / Avatar / Skeleton) into `packages/web/components/ui/` via the shadcn CLI; build a presentational `AppBar` component (logo + tenant dropdown + user avatar) with TDD-grade unit tests covering tenant switching, single-tenant collapse, and user menu interactions; add a `@media (prefers-color-scheme: dark)` placeholder block to `styles/tokens.css` (no dark OKLCH values defined per spec 07 §7).

**Architecture:** shadcn primitives are vendored (copy-paste model) into `packages/web/components/ui/*.tsx` so the team owns the source and can micro-edit; the shadcn CLI also auto-adds its required CSS variable block (HSL channel values for `--background` / `--foreground` / `--primary` etc.) to `styles/globals.css` on first component install — this set coexists with the OKLCH design tokens in `styles/tokens.css` (separate concerns: shadcn primitives use their default neutral palette, our custom components use spec 07 OKLCH tokens; visual integration polish is deferred to 4.3+). `AppBar` is built as a pure presentational component that accepts `tenants: Tenant[]` + `currentTenant: Tenant` + `user: { name: string }` + `onTenantChange: (slug: string) => void` + `onSignOut: () => void` via props — **no route layout wiring in 4.2** (Q3 user decision); integration into `app/t/[slug]/layout.tsx` lands in slice 4.5. When `tenants.length === 1` the dropdown trigger collapses to a static label (Q9 拍板:"1 个 tenant 时 dropdown 自动隐藏"). User avatar shows lucide `User` icon fallback (no `image` field on `users` table in spec 03).

**Tech Stack:**

- Node `>=22.11.0` (ADR-017)
- `shadcn@latest` CLI invoked via `pnpm dlx` (one-shot, no global install)
- `@radix-ui/react-dropdown-menu` + `@radix-ui/react-avatar` + `@radix-ui/react-slot` (auto-installed by shadcn CLI)
- `lucide-react` (icon library, configured in `components.json`)
- `class-variance-authority` + `clsx` + `tailwind-merge` (already present)
- React 19.1.0, Next.js 15.3.2, Tailwind v4 (already present)
- Vitest 2.1.8 + `@testing-library/react` + `@testing-library/user-event` (last one is **new** — needed for AppBar dropdown click tests)
- jsdom (already present)

**Reference docs read before starting:**

- `docs/V1-SPEC/07-frontend.md` — §3 design tokens, §6 shadcn V1 component list, §7 i18n/主题 (zh-CN only, 深色变量留好不暴露切换)
- `docs/V1-SPEC/decisions/phase-2-4-open-questions.md` — Q3 (shadcn), Q4 (tokens.css + Tailwind 任意值), Q9 (AppBar dropdown), Q11 (Vitest+jsdom)
- `docs/superpowers/plans/2026-05-26-phase-2-4-web-skeleton.md` — slice 4.1 structure & cadence reference
- `packages/web/components.json` — existing shadcn config (style=default, rsc=true, baseColor=slate, iconLibrary=lucide)
- `packages/db/src/schema/identity.ts:56-68` — `tenants` table shape `{ id, slug, name, kind, ... }`; AppBar uses minimal subset `{ id, slug, name }`

**Branch:** `feat/phase-2-4-2-shadcn-appbar`

**Acceptance:**

- `pnpm --filter @honeyai/web test` 100% green (existing 17 + new tests: 5 smoke + ~6 AppBar = ~28 total)
- `pnpm --filter @honeyai/web typecheck` green
- `pnpm --filter @honeyai/web lint` green
- `pnpm --filter @honeyai/web build` exits 0 (Next.js compile + static-gen; Windows symlink EPERM during standalone packaging tolerated per slice 4.1 precedent)
- 5 shadcn primitives exist at `packages/web/components/ui/{button,card,dropdown-menu,avatar,skeleton}.tsx`
- `packages/web/components/ui/AppBar.tsx` + `AppBar.test.tsx` exist
- `styles/tokens.css` ends with a `@media (prefers-color-scheme: dark)` block containing only a `/* TODO V1.1 */` comment
- `pnpm ac:coverage` does not regress (this slice introduces no seed AC-prefixed tests)
- No route layout (`app/**/layout.tsx`) imports `AppBar` in this slice

**Scope guardrails (explicit non-goals):**

- ❌ No GitHub OAuth / real session / db query
- ❌ No actual tenant switching behavior — `onTenantChange` is just a prop callback, not wired to `useRouter().push()` in 4.2 (4.5 will wire)
- ❌ No dark mode OKLCH values (spec 07 §7 explicitly "深色变量留好不暴露切换"; just placeholder block)
- ❌ No new ADRs (Q3/Q4/Q9/Q11 already pinned in `phase-2-4-open-questions.md`)
- ❌ No Storybook (V1.0; spec excludes)
- ❌ No Tooltip / Toast / Dialog primitives (deferred until needed in 4.3+; spec 07 §6 lists them but 4.2 scope only covers 5 primitives)

---

## File Structure

| Path                                                | Responsibility                                                                                                                                                                                                     | Est. Lines |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `packages/web/styles/tokens.css`                    | **Modify**: append `@media (prefers-color-scheme: dark) { :root { /* TODO V1.1 */ } }` at end of file                                                                                                              | +3 lines   |
| `packages/web/styles/globals.css`                   | **Modify (auto by shadcn CLI on first add)**: shadcn HSL CSS variable block prepended (`--background`, `--foreground`, `--primary`, etc.)                                                                          | +30 lines  |
| `packages/web/package.json`                         | **Modify (auto by shadcn CLI)**: deps add `@radix-ui/react-dropdown-menu`, `@radix-ui/react-avatar`, `@radix-ui/react-slot`, `class-variance-authority`, `lucide-react`; devDeps add `@testing-library/user-event` | +6 deps    |
| `packages/web/components/ui/button.tsx`             | **Create (shadcn CLI)**: shadcn Button primitive — variants (default/destructive/outline/secondary/ghost/link), sizes (default/sm/lg/icon)                                                                         | ~50 lines  |
| `packages/web/components/ui/card.tsx`               | **Create (shadcn CLI)**: shadcn Card primitive — Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter                                                                                                  | ~70 lines  |
| `packages/web/components/ui/dropdown-menu.tsx`      | **Create (shadcn CLI)**: shadcn DropdownMenu primitive — full Radix wrapper (Trigger/Content/Item/Separator/Label/etc.)                                                                                            | ~180 lines |
| `packages/web/components/ui/avatar.tsx`             | **Create (shadcn CLI)**: shadcn Avatar primitive — Avatar/AvatarImage/AvatarFallback                                                                                                                               | ~50 lines  |
| `packages/web/components/ui/skeleton.tsx`           | **Create (shadcn CLI)**: shadcn Skeleton primitive — single utility component                                                                                                                                      | ~15 lines  |
| `packages/web/components/ui/button.test.tsx`        | **Create**: smoke test — renders default + variant=destructive without crash                                                                                                                                       | ~25 lines  |
| `packages/web/components/ui/card.test.tsx`          | **Create**: smoke test — renders Card with header + title + content                                                                                                                                                | ~25 lines  |
| `packages/web/components/ui/dropdown-menu.test.tsx` | **Create**: smoke test — renders closed trigger; opens on click; shows item                                                                                                                                        | ~30 lines  |
| `packages/web/components/ui/avatar.test.tsx`        | **Create**: smoke test — renders fallback text when no image                                                                                                                                                       | ~20 lines  |
| `packages/web/components/ui/skeleton.test.tsx`      | **Create**: smoke test — renders div with `animate-pulse` class                                                                                                                                                    | ~20 lines  |
| `packages/web/components/ui/AppBar.tsx`             | **Create**: presentational AppBar — logo (text `HoneyAI` w/ `--font-display`), tenant dropdown (or static label if `tenants.length === 1`), user avatar dropdown (avatar fallback + sign-out item)                 | ~110 lines |
| `packages/web/components/ui/AppBar.test.tsx`        | **Create**: 6 behavioral tests — see Task 8 for full list                                                                                                                                                          | ~120 lines |
| `packages/web/lib/strings/zh.ts`                    | **Modify**: append `appBar.signOut`, `appBar.switchTenant` keys                                                                                                                                                    | +6 lines   |
| `docs/V1-SPEC/CHANGELOG.md`                         | **Modify**: append v0.8.0 entry documenting slice 4.2 deliverables                                                                                                                                                 | +20 lines  |

**Total estimated lines added: ~750** (primarily auto-generated shadcn vendored source ~365 lines + ~250 hand-written AppBar + tests + ~135 smoke tests)

---

## Task 1: Branch + dark `@media` placeholder in `tokens.css`

**Files:**

- Create branch: `feat/phase-2-4-2-shadcn-appbar`
- Modify: `packages/web/styles/tokens.css`

- [ ] **Step 1: Create branch from main**

```bash
cd /d/code/ai-devops
git checkout main
git pull --ff-only
git checkout -b feat/phase-2-4-2-shadcn-appbar
```

- [ ] **Step 2: Append dark mode placeholder block to `tokens.css`**

Append at end of `packages/web/styles/tokens.css`:

```css
/* Dark theme — TODO V1.1 (spec 07 §7: 深色变量留好不暴露切换) */
@media (prefers-color-scheme: dark) {
  :root {
    /* TODO V1.1 — dark mode OKLCH values to be designed */
  }
}
```

- [ ] **Step 3: Verify tokens.css still valid**

Run: `pnpm --filter @honeyai/web typecheck`
Expected: PASS (CSS is not type-checked, but verify nothing else broke)

Run: `pnpm --filter @honeyai/web test`
Expected: PASS — existing 17 tests should still be green.

- [ ] **Step 4: Commit**

```bash
git add packages/web/styles/tokens.css
git commit -m "feat(web/tokens): dark @media placeholder block (spec 07 §7)"
```

---

## Task 2: Install shadcn `Button` via CLI + smoke test

**Files:**

- Create (by CLI): `packages/web/components/ui/button.tsx`
- Create: `packages/web/components/ui/button.test.tsx`
- Modify (by CLI): `packages/web/package.json` — adds `class-variance-authority`, `@radix-ui/react-slot`, `lucide-react` to dependencies
- Modify (by CLI): `packages/web/styles/globals.css` — prepends shadcn theme CSS variables block

- [ ] **Step 1: Install shadcn Button via CLI**

```bash
cd /d/code/ai-devops/packages/web
pnpm dlx shadcn@latest add button --yes --overwrite
```

Notes:

- `--yes` skips interactive prompts (accepts defaults from `components.json`)
- `--overwrite` ensures clean output if any file exists
- This is the **first** shadcn invocation; CLI will also add base theme variables to `styles/globals.css` (the HSL channel values for `--background`, `--foreground`, `--primary`, `--ring`, etc.) and install required peer deps (`class-variance-authority`, `@radix-ui/react-slot`, `lucide-react`)

- [ ] **Step 2: Verify CLI-generated `button.tsx` exists**

Run: `ls packages/web/components/ui/button.tsx`
Expected: file present.

Read the file to confirm it exports `Button` and `buttonVariants` and uses `cn` from `@/lib/utils`. If the CLI generated a path that doesn't match (e.g. used `~/lib/utils` instead), fix the import to `@/lib/utils`.

- [ ] **Step 3: Verify `globals.css` got the shadcn theme block**

Read: `packages/web/styles/globals.css`
Expected: contains a `:root { --background: ...; --foreground: ...; ... }` block (HSL channel values, not OKLCH). If the CLI did NOT add it (older versions don't), manually prepend the default shadcn light-theme block from <https://ui.shadcn.com/docs/installation/manual> §"Add CSS variables".

- [ ] **Step 4: Write smoke test**

Create `packages/web/components/ui/button.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button (shadcn primitive smoke)', () => {
  it('renders default variant with children', () => {
    render(<Button>点击</Button>)
    expect(screen.getByRole('button', { name: '点击' })).toBeInTheDocument()
  })

  it('renders destructive variant without crashing', () => {
    render(<Button variant="destructive">删除</Button>)
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument()
  })

  it('renders disabled button', () => {
    render(<Button disabled>禁用</Button>)
    expect(screen.getByRole('button', { name: '禁用' })).toBeDisabled()
  })
})
```

- [ ] **Step 5: Run smoke test — should pass on first try**

Run: `pnpm --filter @honeyai/web test button.test.tsx`
Expected: PASS (3 tests). If FAIL with import error, the CLI may have used a different alias; fix imports.

- [ ] **Step 6: Run full test suite to confirm no regressions**

Run: `pnpm --filter @honeyai/web test`
Expected: PASS (17 existing + 3 new = 20 total).

- [ ] **Step 7: Commit**

```bash
git add packages/web/components/ui/button.tsx packages/web/components/ui/button.test.tsx packages/web/styles/globals.css packages/web/package.json pnpm-lock.yaml
git commit -m "feat(web/ui): shadcn Button primitive + smoke test"
```

---

## Task 3: Install shadcn `Card` via CLI + smoke test

**Files:**

- Create (by CLI): `packages/web/components/ui/card.tsx`
- Create: `packages/web/components/ui/card.test.tsx`

- [ ] **Step 1: Install via CLI**

```bash
cd /d/code/ai-devops/packages/web
pnpm dlx shadcn@latest add card --yes --overwrite
```

- [ ] **Step 2: Verify `card.tsx` exists and exports**

Read: `packages/web/components/ui/card.tsx`
Expected: exports `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`. Fix `cn` import to `@/lib/utils` if needed.

- [ ] **Step 3: Write smoke test**

Create `packages/web/components/ui/card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardContent } from './card'

describe('Card (shadcn primitive smoke)', () => {
  it('renders with header + title + content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>标题</CardTitle>
        </CardHeader>
        <CardContent>内容</CardContent>
      </Card>,
    )
    expect(screen.getByText('标题')).toBeInTheDocument()
    expect(screen.getByText('内容')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @honeyai/web test card.test.tsx`
Expected: PASS (1 test).

Run: `pnpm --filter @honeyai/web test`
Expected: PASS (20 + 1 = 21 total).

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/ui/card.tsx packages/web/components/ui/card.test.tsx packages/web/package.json pnpm-lock.yaml
git commit -m "feat(web/ui): shadcn Card primitive + smoke test"
```

---

## Task 4: Install shadcn `DropdownMenu` via CLI + smoke test

**Files:**

- Create (by CLI): `packages/web/components/ui/dropdown-menu.tsx`
- Create: `packages/web/components/ui/dropdown-menu.test.tsx`
- Modify (by CLI): `packages/web/package.json` — adds `@radix-ui/react-dropdown-menu`
- Modify (manual): `packages/web/package.json` — adds `@testing-library/user-event` to devDependencies (needed for click interaction tests)

- [ ] **Step 1: Install via CLI**

```bash
cd /d/code/ai-devops/packages/web
pnpm dlx shadcn@latest add dropdown-menu --yes --overwrite
```

- [ ] **Step 2: Install `@testing-library/user-event` for click tests**

```bash
cd /d/code/ai-devops/packages/web
pnpm add -D @testing-library/user-event@14.5.2
```

- [ ] **Step 3: Verify `dropdown-menu.tsx` exists**

Read: `packages/web/components/ui/dropdown-menu.tsx`
Expected: exports include `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuLabel`. Fix `cn` import.

- [ ] **Step 4: Write smoke test**

Create `packages/web/components/ui/dropdown-menu.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './dropdown-menu'

describe('DropdownMenu (shadcn primitive smoke)', () => {
  it('renders closed trigger', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>打开</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>项目 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    expect(screen.getByRole('button', { name: '打开' })).toBeInTheDocument()
    // Item is not in the DOM when menu is closed
    expect(screen.queryByText('项目 1')).not.toBeInTheDocument()
  })

  it('opens menu and shows items on trigger click', async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>打开</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>项目 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await user.click(screen.getByRole('button', { name: '打开' }))
    expect(await screen.findByText('项目 1')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @honeyai/web test dropdown-menu.test.tsx`
Expected: PASS (2 tests). If the second test fails because Radix portal renders to `document.body` outside the `container`, the test still works because `screen` queries the entire document.

Run: `pnpm --filter @honeyai/web test`
Expected: PASS (21 + 2 = 23 total).

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/ui/dropdown-menu.tsx packages/web/components/ui/dropdown-menu.test.tsx packages/web/package.json pnpm-lock.yaml
git commit -m "feat(web/ui): shadcn DropdownMenu + user-event devDep + smoke test"
```

---

## Task 5: Install shadcn `Avatar` via CLI + smoke test

**Files:**

- Create (by CLI): `packages/web/components/ui/avatar.tsx`
- Create: `packages/web/components/ui/avatar.test.tsx`
- Modify (by CLI): `packages/web/package.json` — adds `@radix-ui/react-avatar`

- [ ] **Step 1: Install via CLI**

```bash
cd /d/code/ai-devops/packages/web
pnpm dlx shadcn@latest add avatar --yes --overwrite
```

- [ ] **Step 2: Verify `avatar.tsx`**

Read: `packages/web/components/ui/avatar.tsx`
Expected: exports `Avatar`, `AvatarImage`, `AvatarFallback`. Fix `cn` import.

- [ ] **Step 3: Write smoke test**

Create `packages/web/components/ui/avatar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Avatar, AvatarFallback } from './avatar'

describe('Avatar (shadcn primitive smoke)', () => {
  it('renders fallback when no image source', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    )
    expect(screen.getByText('AB')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @honeyai/web test avatar.test.tsx`
Expected: PASS (1 test).

Run: `pnpm --filter @honeyai/web test`
Expected: PASS (23 + 1 = 24 total).

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/ui/avatar.tsx packages/web/components/ui/avatar.test.tsx packages/web/package.json pnpm-lock.yaml
git commit -m "feat(web/ui): shadcn Avatar primitive + smoke test"
```

---

## Task 6: Install shadcn `Skeleton` via CLI + smoke test

**Files:**

- Create (by CLI): `packages/web/components/ui/skeleton.tsx`
- Create: `packages/web/components/ui/skeleton.test.tsx`

- [ ] **Step 1: Install via CLI**

```bash
cd /d/code/ai-devops/packages/web
pnpm dlx shadcn@latest add skeleton --yes --overwrite
```

- [ ] **Step 2: Verify `skeleton.tsx`**

Read: `packages/web/components/ui/skeleton.tsx`
Expected: exports `Skeleton` (single component). Fix `cn` import.

- [ ] **Step 3: Write smoke test**

Create `packages/web/components/ui/skeleton.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from './skeleton'

describe('Skeleton (shadcn primitive smoke)', () => {
  it('renders a div with animate-pulse class', () => {
    const { container } = render(<Skeleton data-testid="sk" className="h-8 w-32" />)
    const el = container.querySelector('[data-testid="sk"]')
    expect(el).not.toBeNull()
    expect(el?.className).toContain('animate-pulse')
  })
})
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @honeyai/web test skeleton.test.tsx`
Expected: PASS (1 test).

Run: `pnpm --filter @honeyai/web test`
Expected: PASS (24 + 1 = 25 total).

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/ui/skeleton.tsx packages/web/components/ui/skeleton.test.tsx
git commit -m "feat(web/ui): shadcn Skeleton primitive + smoke test"
```

---

## Task 7: Append AppBar zh strings + write AppBar.test.tsx (RED)

**Files:**

- Modify: `packages/web/lib/strings/zh.ts`
- Create: `packages/web/components/ui/AppBar.test.tsx`

- [ ] **Step 1: Append AppBar strings to `zh.ts`**

Modify `packages/web/lib/strings/zh.ts` — add `appBar` key inside the `zh` const:

```ts
// packages/web/lib/strings/zh.ts
// All zh-CN UI strings for @honeyai/web (Q10 — no next-intl, V1 single language).
// Add keys as new components are built; do NOT scatter hardcoded strings in JSX.

export const zh = {
  common: {
    appName: 'HoneyAI',
    loading: '加载中…',
    error: '出错了,请稍后再试',
  },
  login: {
    title: '登录 HoneyAI',
    usernamePlaceholder: '用户名',
    passwordPlaceholder: '密码',
    submitLabel: '登录',
    errorInvalid: '用户名或密码错误',
    errorUnknown: '登录失败,请稍后再试',
  },
  welcome: {
    heading: '欢迎使用 HoneyAI',
    subheading: '多智能体 AI 数字研发产线',
    loginLink: '去登录',
  },
  appBar: {
    switchTenant: '切换租户',
    userMenu: '用户菜单',
    signOut: '退出登录',
  },
} as const

export type ZhStrings = typeof zh
```

- [ ] **Step 2: Write the full failing test file**

Create `packages/web/components/ui/AppBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppBar, type Tenant } from './AppBar'

const tenantA: Tenant = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'alice',
  name: 'Alice Personal',
}
const tenantB: Tenant = {
  id: '00000000-0000-0000-0000-000000000002',
  slug: 'team-x',
  name: 'Team X',
}

describe('AppBar', () => {
  it('renders HoneyAI text logo', () => {
    render(
      <AppBar
        tenants={[tenantA]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={() => {}}
        onSignOut={() => {}}
      />,
    )
    expect(screen.getByText('HoneyAI')).toBeInTheDocument()
  })

  it('shows current tenant name as static label when only 1 tenant', () => {
    render(
      <AppBar
        tenants={[tenantA]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={() => {}}
        onSignOut={() => {}}
      />,
    )
    expect(screen.getByText('Alice Personal')).toBeInTheDocument()
    // No tenant dropdown trigger button when only 1 tenant
    expect(screen.queryByRole('button', { name: /切换租户/ })).not.toBeInTheDocument()
  })

  it('shows tenant dropdown trigger when 2+ tenants', () => {
    render(
      <AppBar
        tenants={[tenantA, tenantB]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={() => {}}
        onSignOut={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /切换租户/ })).toBeInTheDocument()
  })

  it('invokes onTenantChange with new slug when tenant dropdown item clicked', async () => {
    const user = userEvent.setup()
    const onTenantChange = vi.fn()
    render(
      <AppBar
        tenants={[tenantA, tenantB]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={onTenantChange}
        onSignOut={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: /切换租户/ }))
    await user.click(await screen.findByText('Team X'))
    expect(onTenantChange).toHaveBeenCalledTimes(1)
    expect(onTenantChange).toHaveBeenCalledWith('team-x')
  })

  it('renders user avatar fallback with first letter of user name (uppercased)', () => {
    render(
      <AppBar
        tenants={[tenantA]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={() => {}}
        onSignOut={() => {}}
      />,
    )
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('invokes onSignOut when user menu sign-out item clicked', async () => {
    const user = userEvent.setup()
    const onSignOut = vi.fn()
    render(
      <AppBar
        tenants={[tenantA]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={() => {}}
        onSignOut={onSignOut}
      />,
    )
    await user.click(screen.getByRole('button', { name: /用户菜单/ }))
    await user.click(await screen.findByText('退出登录'))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run the test — verify it FAILS**

Run: `pnpm --filter @honeyai/web test AppBar.test.tsx`
Expected: FAIL with "Cannot find module './AppBar'" (file doesn't exist yet).

- [ ] **Step 4: Commit failing test + zh strings**

```bash
git add packages/web/components/ui/AppBar.test.tsx packages/web/lib/strings/zh.ts
git commit -m "test(web/ui): AppBar.test.tsx + zh.appBar strings (TDD red)"
```

---

## Task 8: Implement `AppBar.tsx` (GREEN)

**Files:**

- Create: `packages/web/components/ui/AppBar.tsx`

- [ ] **Step 1: Write the AppBar component**

Create `packages/web/components/ui/AppBar.tsx`:

```tsx
'use client'
import * as React from 'react'
import { User as UserIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Avatar, AvatarFallback } from './avatar'
import { Button } from './button'
import { zh } from '@/lib/strings/zh'

export type Tenant = {
  id: string
  slug: string
  name: string
}

export type AppBarUser = {
  name: string
}

export type AppBarProps = {
  tenants: Tenant[]
  currentTenant: Tenant
  user: AppBarUser
  onTenantChange: (slug: string) => void
  onSignOut: () => void
}

export function AppBar({ tenants, currentTenant, user, onTenantChange, onSignOut }: AppBarProps) {
  const userInitial = user.name.charAt(0).toUpperCase()
  const showTenantDropdown = tenants.length > 1

  return (
    <header
      className="flex h-14 items-center justify-between border-b px-4"
      style={{
        backgroundColor: 'var(--bg-elev)',
        borderColor: 'var(--bg-deep)',
      }}
    >
      <div className="flex items-center gap-4">
        <span
          className="text-lg font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-strong)' }}
        >
          {zh.common.appName}
        </span>
        {showTenantDropdown ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={zh.appBar.switchTenant}>
                {currentTenant.name}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>{zh.appBar.switchTenant}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tenants.map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => onTenantChange(t.slug)}>
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-body)' }}>
            {currentTenant.name}
          </span>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={zh.appBar.userMenu}>
            <Avatar className="h-8 w-8">
              <AvatarFallback>{userInitial || <UserIcon className="h-4 w-4" />}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut}>{zh.appBar.signOut}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

- [ ] **Step 2: Run AppBar tests — should all pass (GREEN)**

Run: `pnpm --filter @honeyai/web test AppBar.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 3: Run full test suite**

Run: `pnpm --filter @honeyai/web test`
Expected: PASS (25 + 6 = 31 total).

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter @honeyai/web typecheck`
Expected: PASS.

- [ ] **Step 5: Run lint**

Run: `pnpm --filter @honeyai/web lint`
Expected: PASS (no warnings, no errors). If `lint` script doesn't include `components/`, update the script in `package.json`:

```json
"lint": "eslint app components lib middleware.ts"
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/ui/AppBar.tsx packages/web/package.json
git commit -m "feat(web/ui): AppBar component (logo + tenant dropdown + user avatar)"
```

---

## Task 9: Full test + typecheck + lint + build smoke verification

**Files:**

- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm --filter @honeyai/web test`
Expected: 31 tests pass.

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @honeyai/web typecheck`
Expected: clean.

- [ ] **Step 3: Run lint**

Run: `pnpm --filter @honeyai/web lint`
Expected: clean.

- [ ] **Step 4: Run `next build` smoke**

Run: `pnpm --filter @honeyai/web build`
Expected: compile + static-gen succeed (5/5 pages). Windows symlink EPERM during standalone packaging is tolerated (slice 4.1 precedent — CI Linux unaffected).

- [ ] **Step 5: Run AC coverage to confirm no regression**

Run: `pnpm ac:coverage` (from repo root)
Expected: seed AC tests still 100% green; no new AC introduced this slice.

- [ ] **Step 6: Run turbo pipeline end-to-end**

Run: `pnpm turbo run typecheck lint test --filter=@honeyai/web`
Expected: all targets cached or succeeded.

- [ ] **Step 7: If any verification failed, stop and ask user**

Do NOT mutate the code to suppress failures. Report the failure with full output.

---

## Task 10: CHANGELOG v0.8.0 entry

**Files:**

- Modify: `docs/V1-SPEC/CHANGELOG.md`

- [ ] **Step 1: Append v0.8.0 entry above v0.7.0**

Insert this block in `docs/V1-SPEC/CHANGELOG.md` directly above the existing v0.7.0 entry:

```md
## v0.8.0 — 2026-05-26

**Phase 2.4 slice 4.2 — `@honeyai/web` shadcn primitives + AppBar**

### Added

- 5 shadcn/ui primitives vendored into `packages/web/components/ui/`: `Button`, `Card`, `DropdownMenu`, `Avatar`, `Skeleton` (installed via `pnpm dlx shadcn@latest add`)
- `packages/web/components/ui/AppBar.tsx` — presentational header component with text logo (`HoneyAI` using `--font-display`), tenant dropdown (auto-collapses to static label when `tenants.length === 1` per Q9 拍板), user avatar fallback + sign-out menu
- Smoke tests for all 5 primitives (5 files, ~120 lines total)
- 6 behavioral unit tests for `AppBar` covering logo render, single-tenant collapse, multi-tenant dropdown, `onTenantChange` callback, avatar fallback initial, `onSignOut` callback
- `@testing-library/user-event@14.5.2` devDep for click interaction tests
- `appBar` namespace in `lib/strings/zh.ts` (`switchTenant`, `userMenu`, `signOut`)

### Changed

- `packages/web/styles/tokens.css` — appended `@media (prefers-color-scheme: dark) { :root { /* TODO V1.1 */ } }` placeholder block per spec 07 §7 ("深色变量留好不暴露切换")
- `packages/web/styles/globals.css` — shadcn CLI auto-prepended the default light-theme HSL CSS variable block (`--background`, `--foreground`, `--primary`, etc.)
- `packages/web/package.json` — deps added by shadcn CLI: `@radix-ui/react-slot`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-avatar`, `class-variance-authority`, `lucide-react`

### Note

- AppBar is not wired into any route layout in this slice; integration into `app/t/[slug]/layout.tsx` lands in slice 4.5 alongside multi-tenant middleware (Q3 user decision)
- No new ADRs — Q3/Q4/Q9/Q11 already pinned in `decisions/phase-2-4-open-questions.md`
```

- [ ] **Step 2: Commit CHANGELOG**

```bash
git add docs/V1-SPEC/CHANGELOG.md
git commit -m "docs(changelog): v0.8.0 entry for slice 4.2 shadcn + AppBar"
```

---

## Task 11: Push branch + open PR

**Files:**

- None

- [ ] **Step 1: Push branch**

```bash
cd /d/code/ai-devops
git push -u origin feat/phase-2-4-2-shadcn-appbar
```

If push fails with credential prompt (Windows + bad GITHUB_TOKEN env), use the PAT-via-URL workaround established in slice 4.1:

```bash
unset GITHUB_TOKEN
TOKEN=$(gh auth token)
git push "https://x-access-token:${TOKEN}@github.com/xiaohanarch/HoneyAI.git" feat/phase-2-4-2-shadcn-appbar
git fetch origin feat/phase-2-4-2-shadcn-appbar
git branch --set-upstream-to=origin/feat/phase-2-4-2-shadcn-appbar feat/phase-2-4-2-shadcn-appbar
```

- [ ] **Step 2: Create PR via `gh`**

```bash
unset GITHUB_TOKEN
gh pr create --base main --head feat/phase-2-4-2-shadcn-appbar \
  --title "feat(web): slice 4.2 — shadcn primitives + AppBar component" \
  --body "$(cat <<'EOF'
## Summary

Phase 2 slice 4.2: install 5 shadcn/ui primitives (Button / Card / DropdownMenu / Avatar / Skeleton) into \`packages/web/components/ui/\` via the shadcn CLI; build a presentational \`AppBar\` component (logo + tenant dropdown + user avatar) with full unit-test coverage; add a \`@media (prefers-color-scheme: dark)\` placeholder block to \`tokens.css\` per spec 07 §7.

**Deliverables (11 tasks):**

- 5 shadcn primitives vendored via \`pnpm dlx shadcn@latest add\` — each with a smoke test (~120 lines total)
- \`AppBar\` component with 6 behavioral tests:
  - text logo renders
  - single-tenant case collapses to static label (Q9 拍板)
  - multi-tenant case shows dropdown trigger
  - \`onTenantChange\` invoked with new slug on item click
  - avatar fallback shows first letter (uppercased)
  - \`onSignOut\` invoked from user menu
- \`zh.appBar\` strings (switchTenant / userMenu / signOut)
- Dark-mode placeholder block (no OKLCH values — spec 07 §7 keeps dark theme variables \"留好不暴露切换\" for V1.1)

**Spec references:** spec 07 §3/§6/§7, phase-2-4-open-questions Q3/Q4/Q9/Q11 (all already pinned, no new ADRs).

**CHANGELOG:** v0.8.0 entry added.

## Scope Guardrails

- AppBar is **not** wired into any route layout in this slice — integration lands in slice 4.5 alongside multi-tenant middleware
- No GitHub OAuth, no db query, no real session — \`AppBar\` is purely presentational and accepts all data via props
- No dark OKLCH values defined — placeholder block only
- No new ADRs

## Test plan

- [x] \`pnpm --filter @honeyai/web test\` — 31/31 pass (17 existing + 14 new)
- [x] \`pnpm --filter @honeyai/web typecheck\` — clean
- [x] \`pnpm --filter @honeyai/web lint\` — clean
- [x] \`pnpm --filter @honeyai/web build\` — compile + static-gen succeed
- [x] \`pnpm ac:coverage\` — no regression
- [ ] CI green on this PR
- [ ] Manual smoke (post-merge slice 4.5 wiring): \`<AppBar tenants={[{...}]} currentTenant={...} />\` renders correctly in dev server

## Notes

- shadcn primitives installed via the CLI, NOT manually copied — first invocation also auto-added the shadcn default light-theme HSL variable block to \`globals.css\`. This coexists with spec 07 OKLCH tokens in \`tokens.css\`; visual integration polish (mapping shadcn variables → OKLCH) is deferred to slice 4.3+ if needed.
- \`@testing-library/user-event\` added as devDep — required for DropdownMenu click interaction tests.
EOF
)"
```

- [ ] **Step 3: Wait for CI to complete**

Run: `gh pr checks` (re-run until all pass).
Expected: lint / typecheck / migration-check / test / ac-coverage all green.

If CI fails, do NOT merge — report failure to user with the failing job log.

- [ ] **Step 4: Report PR URL to user**

Report the PR URL printed by `gh pr create`.

---

## Self-Review

**Spec coverage check:**

- ✅ Q3 (shadcn/ui) — 5 primitives installed via CLI
- ✅ Q4 (tokens.css + Tailwind 任意值) — AppBar uses inline `style={{ var() }}` for tokens (Tailwind arbitrary values not strictly needed here; primitives use shadcn HSL vars)
- ✅ Q9 (AppBar dropdown) — implemented with single-tenant collapse
- ✅ Q10 (lib/strings/zh.ts) — appBar namespace added
- ✅ Q11 (Vitest + jsdom) — all tests use Vitest; click tests use `@testing-library/user-event`
- ✅ spec 07 §6 — Button / Card / DropdownMenu / Avatar / Skeleton are 5 of the 20 shadcn components listed for V1 (remaining 15 added on demand in later slices)
- ✅ spec 07 §7 — dark mode placeholder added without exposing toggle

**Placeholder scan:** None of "TBD" / "TODO: implement later" / "Similar to Task N" appear outside the explicit dark-mode `/* TODO V1.1 */` comment block (which is the intended placeholder per spec).

**Type consistency check:**

- `Tenant` type defined in `AppBar.tsx`, imported in `AppBar.test.tsx` — matches
- `AppBarUser` minimal shape `{ name: string }` used consistently
- `onTenantChange: (slug: string) => void` — uses `slug` not `id`, consistent with route param `/t/[slug]/` (spec 07 §2)

**Out-of-scope leakage check:**

- ✅ No db imports
- ✅ No `auth()` call (NextAuth session not consumed; AppBar is presentational)
- ✅ No `useRouter` / `redirect` — callback props only
- ✅ No `'use client'` boundary issues beyond AppBar itself
