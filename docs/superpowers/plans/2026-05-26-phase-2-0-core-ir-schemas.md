# Phase 2.0 — `@honeyai/core` IR zod schemas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 3 IR zod schemas (Requirement / Design / Implementation) + `parseIR` / `stringifyIR` utilities in `@honeyai/core/src/ir/`, with 100% schema unit test coverage and spec §8 golden-fixture roundtrip tests.

**Architecture:** Pure server/sandbox/web-tri-runnable package. Frontmatter is YAML parsed by `gray-matter`, validated by `zod`. Markdown body is preserved as-is and scanned for required H2 sections — missing sections yield warnings (non-blocking, per ADR-023). Each IR file (`requirement.ts` / `design.ts` / `implementation.ts`) exports its schema, parse function, stringify function, and required-sections constant. A `shared.ts` holds reusable enums + the `IRParseOutcome<T>` discriminated union. The barrel `index.ts` (per ADR-014) re-exports the IR module surface.

**Tech Stack:** zod 3.24.1 (already in `@honeyai/core/package.json`) + gray-matter 4.0.3 (new dependency) + Vitest 2.1.8. No DOM, no React, no Redis, no DB.

**Reference docs (read before starting):**

- `docs/V1-SPEC/04-ir-schemas.md` — authoritative schemas + §8 examples + §11 (out of scope for Phase 2.0)
- `docs/V1-SPEC/decisions/phase-2-open-questions.md` — Q1-Q6 拍板
- `docs/V1-SPEC/ADRs/ADR-014-core-barrel-only.md` — only barrel exports from core
- `packages/core/src/errors/base.ts` — existing pattern for module shape + `.test.ts` co-location
- `packages/core/tsconfig.json` — strict + Bundler resolution + `.js` extension on imports required

**Scope (locked by `decisions/phase-2-open-questions.md`):**

- ✅ 3 zod frontmatter schemas (exact field-for-field match to spec 04 §2.1 / §3.1 / §4.1)
- ✅ `parseRequirementIR` / `parseDesignIR` / `parseImplementationIR` (gray-matter + zod, returns discriminated `IRParseOutcome<T>`)
- ✅ `stringifyRequirementIR` / `stringifyDesignIR` / `stringifyImplementationIR` (frontmatter + body → markdown)
- ✅ Body H2 section warnings — RequirementIR only (spec §2.2 enumerates 4 sections); DesignIR/ImplementationIR have no spec-mandated sections → no warnings emitted
- ✅ Golden roundtrip tests using spec §8.1 / §8.2 / §8.3 markdown verbatim
- ✅ 6 new ADRs (ADR-021..026) recording Q1-Q6 decisions
- ❌ IR version rule runtime (Redis lock / monotonic int / force-unlock) — Q5=B, Slice 1
- ❌ Tiptap zod-to-form generator — Q6=B, Slice 4
- ❌ Persistence to `ir_documents` table — Slice 1

**Branch:** `feat/phase-2-0-core-ir-schemas`

**Acceptance:**

- `pnpm --filter @honeyai/core test` 100% green; ≥1 happy + ≥1 failure case per schema; ≥1 spec §8 golden roundtrip per IR
- `pnpm --filter @honeyai/core typecheck` green
- `pnpm --filter @honeyai/core lint` green
- `pnpm ac:coverage` does not regress (Phase 2.0 introduces no new seed AC — they live in spec 04 §12 and bind to Slice 5 / Server Action layer)
- ADRs 021-026 + `ADRs/README.md` index + `CHANGELOG.md v0.4.0` entry all present
- PR opened against `main`

---

## File Structure

| Path                                          | Responsibility                                                                                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/ir/shared.ts`              | Reusable enums (Priority / Complexity / RiskLevel / FindingSeverity) + `IRParseOutcome<T>` discriminated type + internal `parseFrontmatter<T>` helper (gray-matter + zod) + internal `stringifyFrontmatter` helper |
| `packages/core/src/ir/shared.test.ts`         | Tests for `parseFrontmatter` helper (happy / zod-fail / yaml-fail / no-frontmatter) and stringifyFrontmatter roundtrip                                                                                             |
| `packages/core/src/ir/requirement.ts`         | `RequirementIRSchema` zod + `type RequirementIR` + `REQUIRED_REQUIREMENT_SECTIONS` const + `parseRequirementIR` + `stringifyRequirementIR`                                                                         |
| `packages/core/src/ir/requirement.test.ts`    | Schema happy / failure case + body section warnings + spec §8.1 golden roundtrip                                                                                                                                   |
| `packages/core/src/ir/design.ts`              | `DesignIRSchema` + `type DesignIR` + `parseDesignIR` + `stringifyDesignIR`                                                                                                                                         |
| `packages/core/src/ir/design.test.ts`         | Schema happy / failure case + spec §8.2 golden roundtrip                                                                                                                                                           |
| `packages/core/src/ir/implementation.ts`      | `ImplementationIRSchema` + `type ImplementationIR` + `parseImplementationIR` + `stringifyImplementationIR`                                                                                                         |
| `packages/core/src/ir/implementation.test.ts` | Schema happy / failure case + spec §8.3 golden roundtrip                                                                                                                                                           |
| `packages/core/src/ir/index.ts`               | Barrel re-exporting all IR-module public surface                                                                                                                                                                   |
| `packages/core/src/index.ts`                  | Add `export * from './ir/index.js'`                                                                                                                                                                                |
| `packages/core/package.json`                  | Add `gray-matter` dep + `@types/gray-matter` is not needed (ships with types in newer versions; we install plain `gray-matter`)                                                                                    |
| `docs/V1-SPEC/ADRs/ADR-021..026-*.md`         | 6 new ADRs                                                                                                                                                                                                         |
| `docs/V1-SPEC/ADRs/README.md`                 | Index 6 new ADRs                                                                                                                                                                                                   |
| `docs/V1-SPEC/CHANGELOG.md`                   | v0.4.0 entry                                                                                                                                                                                                       |

---

## Task 1: Branch + gray-matter dependency

**Files:**

- Modify: `packages/core/package.json`

- [ ] **Step 1: Create branch from main**

```bash
cd /d/code/ai-devops
git checkout main
git pull --ff-only
git checkout -b feat/phase-2-0-core-ir-schemas
```

- [ ] **Step 2: Add gray-matter dependency**

Edit `packages/core/package.json` — add `"gray-matter": "4.0.3"` to `dependencies` (alphabetical order, after `@t3-oss/env-core`):

```json
{
  "name": "@honeyai/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": {
    "@t3-oss/env-core": "0.11.1",
    "gray-matter": "4.0.3",
    "pino": "9.5.0",
    "zod": "3.24.1"
  },
  "devDependencies": {
    "pino-pretty": "13.0.0",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 3: Install + verify gray-matter resolves**

```bash
pnpm install
pnpm --filter @honeyai/core exec node -e "import('gray-matter').then(m => console.log(typeof m.default))"
```

Expected output: `function`

- [ ] **Step 4: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): add gray-matter dependency for IR markdown parsing"
```

---

## Task 2: `shared.ts` — enums + `IRParseOutcome` + internal helpers

**Files:**

- Create: `packages/core/src/ir/shared.ts`
- Create: `packages/core/src/ir/shared.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/ir/shared.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  PrioritySchema,
  ComplexitySchema,
  RiskLevelSchema,
  FindingSeveritySchema,
  parseFrontmatter,
  stringifyFrontmatter,
} from './shared.js'

describe('shared enums', () => {
  it('PrioritySchema accepts P0..P3 and rejects other', () => {
    expect(PrioritySchema.safeParse('P0').success).toBe(true)
    expect(PrioritySchema.safeParse('P3').success).toBe(true)
    expect(PrioritySchema.safeParse('P4').success).toBe(false)
    expect(PrioritySchema.safeParse('high').success).toBe(false)
  })

  it('ComplexitySchema accepts XS..XL', () => {
    expect(ComplexitySchema.safeParse('XS').success).toBe(true)
    expect(ComplexitySchema.safeParse('XL').success).toBe(true)
    expect(ComplexitySchema.safeParse('XXL').success).toBe(false)
  })

  it('RiskLevelSchema is low/medium/high (no critical)', () => {
    expect(RiskLevelSchema.safeParse('high').success).toBe(true)
    expect(RiskLevelSchema.safeParse('critical').success).toBe(false)
  })

  it('FindingSeveritySchema includes critical', () => {
    expect(FindingSeveritySchema.safeParse('critical').success).toBe(true)
  })
})

describe('parseFrontmatter', () => {
  const TestSchema = z.object({ name: z.string(), n: z.number() })

  it('parses valid frontmatter + body', () => {
    const md = `---\nname: foo\nn: 42\n---\n\n# body here\n`
    const out = parseFrontmatter(md, TestSchema)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data).toEqual({ name: 'foo', n: 42 })
      expect(out.body.trim()).toBe('# body here')
    }
  })

  it('returns ok=false with ZodError on schema mismatch', () => {
    const md = `---\nname: foo\n---\n\nbody\n`
    const out = parseFrontmatter(md, TestSchema)
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.error).toBeInstanceOf(z.ZodError)
      expect(out.error.issues[0]?.path).toEqual(['n'])
    }
  })

  it('returns ok=false with ZodError when frontmatter is absent', () => {
    const md = `# only body, no frontmatter\n`
    const out = parseFrontmatter(md, TestSchema)
    expect(out.ok).toBe(false)
  })

  it('throws on malformed YAML (lets gray-matter error propagate)', () => {
    const md = `---\nname: : :\n---\nbody\n`
    expect(() => parseFrontmatter(md, TestSchema)).toThrow()
  })
})

describe('stringifyFrontmatter', () => {
  it('produces markdown that round-trips through parseFrontmatter', () => {
    const TestSchema = z.object({ name: z.string(), n: z.number() })
    const md = stringifyFrontmatter({ name: 'foo', n: 42 }, '# hello\n')
    const out = parseFrontmatter(md, TestSchema)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data).toEqual({ name: 'foo', n: 42 })
      expect(out.body.trim()).toBe('# hello')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @honeyai/core test -- shared
```

Expected: FAIL with "Cannot find module './shared.js'" or similar.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/ir/shared.ts`:

```ts
import matter from 'gray-matter'
import { z, type ZodType } from 'zod'

// Reusable enums (spec 04 §2.1 / §3.1 / §4.1)
export const PrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3'])
export type Priority = z.infer<typeof PrioritySchema>

export const ComplexitySchema = z.enum(['XS', 'S', 'M', 'L', 'XL'])
export type Complexity = z.infer<typeof ComplexitySchema>

export const RiskLevelSchema = z.enum(['low', 'medium', 'high'])
export type RiskLevel = z.infer<typeof RiskLevelSchema>

export const FindingSeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>

// Parse outcome — discriminated union; spec §10 dictates ZodError path-aware reporting upstream.
export type IRParseWarning = { kind: 'missing_section'; section: string }

export type IRParseOk<T> = {
  ok: true
  data: T
  body: string
  warnings: IRParseWarning[]
}

export type IRParseErr = {
  ok: false
  error: z.ZodError
  body: string
}

export type IRParseOutcome<T> = IRParseOk<T> | IRParseErr

/**
 * Internal helper: gray-matter to split YAML frontmatter + body, then zod-validate frontmatter.
 * Returns IRParseOutcome with `warnings: []` — IR-specific callers append section warnings.
 * Throws if gray-matter cannot parse YAML at all.
 */
export function parseFrontmatter<T>(markdown: string, schema: ZodType<T>): IRParseOutcome<T> {
  const parsed = matter(markdown)
  const result = schema.safeParse(parsed.data)
  if (result.success) {
    return { ok: true, data: result.data, body: parsed.content, warnings: [] }
  }
  return { ok: false, error: result.error, body: parsed.content }
}

/**
 * Internal helper: re-emit YAML frontmatter + body as a single markdown document.
 * Callers are expected to have zod-validated `data` already (per ADR-024).
 */
export function stringifyFrontmatter(data: unknown, body: string): string {
  return matter.stringify(body, data as object)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @honeyai/core test -- shared
```

Expected: PASS, all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ir/shared.ts packages/core/src/ir/shared.test.ts
git commit -m "feat(core/ir): shared enums + parseFrontmatter helper"
```

---

## Task 3: `RequirementIRSchema` — zod schema only

**Files:**

- Create: `packages/core/src/ir/requirement.ts`
- Create: `packages/core/src/ir/requirement.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/ir/requirement.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { RequirementIRSchema } from './requirement.js'

const validFrontmatter = {
  title: 'Add /health detailed status',
  one_liner: 'GET /health returns 200 + {db, redis}',
  priority: 'P2',
  estimated_complexity: 'XS',
  in_scope: ['修改 /health 路由', '加 db ping'],
  out_of_scope: ['鉴权'],
  success_criteria: ['GET /health 始终返回 200'],
  constraints: [],
  risks: [],
  impact_surface: [],
  related: [],
}

describe('RequirementIRSchema', () => {
  it('accepts a valid frontmatter object', () => {
    const r = RequirementIRSchema.safeParse(validFrontmatter)
    expect(r.success).toBe(true)
  })

  it('rejects when title is missing', () => {
    const { title: _omit, ...rest } = validFrontmatter
    const r = RequirementIRSchema.safeParse(rest)
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'title')).toBe(true)
    }
  })

  it('rejects priority outside P0..P3', () => {
    const r = RequirementIRSchema.safeParse({ ...validFrontmatter, priority: 'P9' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'priority')).toBe(true)
    }
  })

  it('rejects empty in_scope (min 1)', () => {
    const r = RequirementIRSchema.safeParse({ ...validFrontmatter, in_scope: [] })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'in_scope')).toBe(true)
    }
  })

  it('applies default [] to constraints / risks / impact_surface / related when omitted', () => {
    const minimal = {
      title: 't',
      one_liner: 'hello',
      priority: 'P2',
      estimated_complexity: 'XS',
      in_scope: ['x'],
      out_of_scope: [],
      success_criteria: ['y'],
    }
    const r = RequirementIRSchema.safeParse(minimal)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.constraints).toEqual([])
      expect(r.data.risks).toEqual([])
      expect(r.data.impact_surface).toEqual([])
      expect(r.data.related).toEqual([])
    }
  })

  it('validates risks.likelihood / impact as low|medium|high', () => {
    const r = RequirementIRSchema.safeParse({
      ...validFrontmatter,
      risks: [{ description: 'r', likelihood: 'critical', impact: 'high' }],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('likelihood'))).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @honeyai/core test -- requirement
```

Expected: FAIL with "Cannot find module './requirement.js'".

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/ir/requirement.ts`:

```ts
import { z } from 'zod'
import { PrioritySchema, ComplexitySchema, RiskLevelSchema } from './shared.js'

export const RequirementIRSchema = z.object({
  title: z.string().min(1).max(200),
  one_liner: z.string().min(5).max(500),
  priority: PrioritySchema,
  estimated_complexity: ComplexitySchema,
  in_scope: z.array(z.string()).min(1),
  out_of_scope: z.array(z.string()),
  success_criteria: z.array(z.string()).min(1),
  constraints: z
    .array(
      z.object({
        kind: z.enum(['tech', 'business', 'compliance', 'perf']),
        statement: z.string(),
      }),
    )
    .default([]),
  risks: z
    .array(
      z.object({
        description: z.string(),
        likelihood: RiskLevelSchema,
        impact: RiskLevelSchema,
        mitigation: z.string().optional(),
      }),
    )
    .default([]),
  impact_surface: z.array(z.string()).default([]),
  related: z
    .array(
      z.object({
        kind: z.enum(['issue', 'pr', 'doc']),
        url: z.string().url(),
      }),
    )
    .default([]),
})

export type RequirementIR = z.infer<typeof RequirementIRSchema>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @honeyai/core test -- requirement
```

Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ir/requirement.ts packages/core/src/ir/requirement.test.ts
git commit -m "feat(core/ir): RequirementIRSchema (spec 04 §2.1)"
```

---

## Task 4: `parseRequirementIR` + body section warnings + `stringifyRequirementIR`

**Files:**

- Modify: `packages/core/src/ir/requirement.ts`
- Modify: `packages/core/src/ir/requirement.test.ts`

- [ ] **Step 1: Extend the test file with parse/stringify cases**

Append to `packages/core/src/ir/requirement.test.ts`:

```ts
import {
  parseRequirementIR,
  stringifyRequirementIR,
  REQUIRED_REQUIREMENT_SECTIONS,
} from './requirement.js'

describe('REQUIRED_REQUIREMENT_SECTIONS', () => {
  it('lists the 4 sections from spec 04 §2.2', () => {
    expect(REQUIRED_REQUIREMENT_SECTIONS).toEqual(['背景', '用户故事', '验收标准明细', '开放问题'])
  })
})

describe('parseRequirementIR', () => {
  it('parses valid markdown with all 4 sections — zero warnings', () => {
    const md = `---
title: t
one_liner: short
priority: P2
estimated_complexity: XS
in_scope:
  - a
out_of_scope: []
success_criteria:
  - sc
---

## 背景
text

## 用户故事
text

## 验收标准明细
text

## 开放问题
text
`
    const out = parseRequirementIR(md)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.title).toBe('t')
      expect(out.warnings).toEqual([])
    }
  })

  it('emits missing_section warnings for absent sections (non-blocking, ADR-023)', () => {
    const md = `---
title: t
one_liner: short
priority: P2
estimated_complexity: XS
in_scope:
  - a
out_of_scope: []
success_criteria:
  - sc
---

## 背景
only
`
    const out = parseRequirementIR(md)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.warnings).toEqual([
        { kind: 'missing_section', section: '用户故事' },
        { kind: 'missing_section', section: '验收标准明细' },
        { kind: 'missing_section', section: '开放问题' },
      ])
    }
  })

  it('returns ok=false when frontmatter fails zod (preserves body)', () => {
    const md = `---
title: ''
one_liner: short
priority: P2
estimated_complexity: XS
in_scope:
  - a
out_of_scope: []
success_criteria:
  - sc
---

## 背景
text
`
    const out = parseRequirementIR(md)
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.error.issues.some((i) => i.path[0] === 'title')).toBe(true)
      expect(out.body).toContain('## 背景')
    }
  })
})

describe('stringifyRequirementIR', () => {
  it('round-trips: parse → stringify → parse yields equal data', () => {
    const md = `---
title: roundtrip
one_liner: roundtrip test
priority: P1
estimated_complexity: S
in_scope:
  - r1
out_of_scope:
  - r2
success_criteria:
  - sc1
---

## 背景
b

## 用户故事
u

## 验收标准明细
ac

## 开放问题
op
`
    const first = parseRequirementIR(md)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const back = stringifyRequirementIR(first.data, first.body)
    const second = parseRequirementIR(back)
    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.data).toEqual(first.data)
      expect(second.warnings).toEqual([])
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @honeyai/core test -- requirement
```

Expected: FAIL with "Cannot find name 'parseRequirementIR'" or similar.

- [ ] **Step 3: Implement parse + stringify + section detection**

Append to `packages/core/src/ir/requirement.ts`:

```ts
import {
  parseFrontmatter,
  stringifyFrontmatter,
  type IRParseOutcome,
  type IRParseWarning,
} from './shared.js'

export const REQUIRED_REQUIREMENT_SECTIONS = [
  '背景',
  '用户故事',
  '验收标准明细',
  '开放问题',
] as const

function findMissingSections(body: string, required: readonly string[]): IRParseWarning[] {
  const headings = new Set<string>()
  for (const match of body.matchAll(/^##\s+(.+?)\s*$/gm)) {
    if (match[1]) headings.add(match[1].trim())
  }
  return required
    .filter((s) => !headings.has(s))
    .map<IRParseWarning>((s) => ({ kind: 'missing_section', section: s }))
}

export function parseRequirementIR(markdown: string): IRParseOutcome<RequirementIR> {
  const base = parseFrontmatter(markdown, RequirementIRSchema)
  if (!base.ok) return base
  const warnings = findMissingSections(base.body, REQUIRED_REQUIREMENT_SECTIONS)
  return { ...base, warnings }
}

export function stringifyRequirementIR(data: RequirementIR, body: string): string {
  return stringifyFrontmatter(data, body)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @honeyai/core test -- requirement
```

Expected: PASS, total 10 tests green (6 schema + 1 const + 3 parse + 1 roundtrip = 11; if any drift, fix until matching).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ir/requirement.ts packages/core/src/ir/requirement.test.ts
git commit -m "feat(core/ir): parseRequirementIR + stringifyRequirementIR + section warnings"
```

---

## Task 5: Spec §8.1 golden roundtrip — RequirementIR

**Files:**

- Modify: `packages/core/src/ir/requirement.test.ts`

- [ ] **Step 1: Append golden fixture test**

Append to `packages/core/src/ir/requirement.test.ts`:

```ts
const SPEC_8_1_REQUIREMENT_MD = `---
title: 给 /health 端点添加 db/redis 状态返回
one_liner: GET /health 返回 200 + {db: ok/down, redis: ok/down}
priority: P2
estimated_complexity: XS
in_scope:
  - 修改 /health 路由
  - 加 db ping
  - 加 redis ping
  - 加单元测试
out_of_scope:
  - 鉴权
  - rate limit
  - 历史指标
success_criteria:
  - GET /health 始终返回 200
  - body 字段 db 和 redis 各自为 'ok' 或 'down'
  - db/redis 不可用时不抛 500
  - 测试覆盖率 >= 80%
constraints:
  - kind: tech
    statement: 必须复用现有 db.pool 和 redis.client,不要新建连接
  - kind: tech
    statement: 返回格式参考 k8s liveness probe 风格(短字符串)
risks:
  - description: redis 不可达时 ping 阻塞影响 /health 响应时间
    likelihood: medium
    impact: medium
    mitigation: ping 加 500ms 超时
impact_surface:
  - src/routes/health.ts
  - src/health/db_check.ts
  - src/health/redis_check.ts
  - tests/health.test.ts
related: []
---

## 背景
当前 /health 仅返回 200 OK 字符串,监控系统无法判断 db 和 redis 是否健康。
SRE 反馈需要细化健康状态。

## 用户故事
As a SRE 工程师
I want /health 返回结构化健康信息
So that 我能在监控面板分别看到 db/redis 状态

## 验收标准明细
1. 正常情况: \`{db: 'ok', redis: 'ok'}\` 200
2. db 挂: \`{db: 'down', redis: 'ok'}\` 200

## 开放问题
- 是否需要返回版本号 / 启动时间?→ 暂不(out_of_scope)
`

describe('RequirementIR — spec §8.1 golden fixture', () => {
  it('parses the spec example without errors and warnings', () => {
    const out = parseRequirementIR(SPEC_8_1_REQUIREMENT_MD)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.title).toBe('给 /health 端点添加 db/redis 状态返回')
      expect(out.data.priority).toBe('P2')
      expect(out.data.estimated_complexity).toBe('XS')
      expect(out.data.in_scope).toHaveLength(4)
      expect(out.data.constraints).toHaveLength(2)
      expect(out.data.risks).toHaveLength(1)
      expect(out.data.risks[0]?.likelihood).toBe('medium')
      expect(out.warnings).toEqual([])
    }
  })

  it('roundtrips: parse → stringify → parse → data preserved', () => {
    const first = parseRequirementIR(SPEC_8_1_REQUIREMENT_MD)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const back = stringifyRequirementIR(first.data, first.body)
    const second = parseRequirementIR(back)
    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.data).toEqual(first.data)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

```bash
pnpm --filter @honeyai/core test -- requirement
```

Expected: PASS, 2 new tests green (plus all previous).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/ir/requirement.test.ts
git commit -m "test(core/ir): spec §8.1 RequirementIR golden roundtrip"
```

---

## Task 6: DesignIR — schema + parse + stringify + spec §8.2 golden roundtrip

**Files:**

- Create: `packages/core/src/ir/design.ts`
- Create: `packages/core/src/ir/design.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/ir/design.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DesignIRSchema, parseDesignIR, stringifyDesignIR, type DesignIR } from './design.js'

const validDesign: DesignIR = {
  approach_summary: 'a'.repeat(25),
  architecture_decisions: [],
  affected_components: ['src/routes/health.ts'],
  data_model_changes: [],
  api_changes: [],
  task_graph: {
    nodes: [{ id: 'T1', title: 't', kind: 'code', estimated_effort_lines: 10 }],
    edges: [],
  },
  test_strategy: { unit: [], integration: [], e2e: [] },
  security_review: { threats_considered: [], mitigations: [], requires_secrets: false },
  rollout: { strategy: 'big_bang', rollback_plan: 'revert' },
}

describe('DesignIRSchema', () => {
  it('accepts a valid design', () => {
    expect(DesignIRSchema.safeParse(validDesign).success).toBe(true)
  })

  it('rejects approach_summary shorter than 20 chars', () => {
    const r = DesignIRSchema.safeParse({ ...validDesign, approach_summary: 'too short' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path[0]).toBe('approach_summary')
    }
  })

  it('rejects ADR id not matching ADR-\\d+', () => {
    const r = DesignIRSchema.safeParse({
      ...validDesign,
      architecture_decisions: [
        { id: 'foo', title: 't', context: 'c', decision: 'd', consequences: 'cs' },
      ],
    })
    expect(r.success).toBe(false)
  })

  it('rejects task_graph node with non-positive estimated_effort_lines', () => {
    const r = DesignIRSchema.safeParse({
      ...validDesign,
      task_graph: {
        nodes: [{ id: 'T1', title: 't', kind: 'code', estimated_effort_lines: 0 }],
        edges: [],
      },
    })
    expect(r.success).toBe(false)
  })

  it('rejects affected_components empty array (min 1)', () => {
    const r = DesignIRSchema.safeParse({ ...validDesign, affected_components: [] })
    expect(r.success).toBe(false)
  })

  it('applies defaults for architecture_decisions / data_model_changes / api_changes', () => {
    const minimal = {
      approach_summary: 'a'.repeat(25),
      affected_components: ['x'],
      task_graph: {
        nodes: [{ id: 'T1', title: 't', kind: 'code', estimated_effort_lines: 1 }],
        edges: [],
      },
      test_strategy: { unit: [], integration: [], e2e: [] },
      security_review: { threats_considered: [], mitigations: [], requires_secrets: false },
      rollout: { strategy: 'big_bang', rollback_plan: 'revert' },
    }
    const r = DesignIRSchema.safeParse(minimal)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.architecture_decisions).toEqual([])
      expect(r.data.data_model_changes).toEqual([])
      expect(r.data.api_changes).toEqual([])
    }
  })
})

const SPEC_8_2_DESIGN_MD = `---
approach_summary: |
  在 src/health/ 新增两个独立 check 模块(db_check.ts, redis_check.ts),
  各自封装 500ms 超时的 ping 函数。/health 路由 Promise.all 并发调用,
  结果合并返回。失败不抛错,统一返回 'down'。
architecture_decisions:
  - id: ADR-001
    title: 健康检查独立模块而非内联
    context: /health 路由原本只有 3 行
    decision: 拆出 src/health/ 目录,每个被检对象一个文件
    consequences: 文件变多但可测;后续加 kafka/s3 check 容易扩
    alternatives_considered:
      - 在 health.ts 内联,更短但不利扩展
affected_components:
  - src/routes/health.ts
  - src/health/db_check.ts (new)
data_model_changes: []
api_changes:
  - method: GET
    path: /health
    change: modify
    detail: 响应体从 'OK' 字符串改为 JSON {db, redis}
task_graph:
  nodes:
    - id: T1
      title: 新增 src/health/db_check.ts
      kind: code
      estimated_effort_lines: 30
    - id: T2
      title: 新增 tests/health.test.ts
      kind: test
      estimated_effort_lines: 80
  edges:
    - { from: T1, to: T2 }
test_strategy:
  unit:
    - db_check 超时返回 'down'
  integration:
    - /health 端到端 4 种状态
  e2e: []
security_review:
  threats_considered:
    - 信息泄露
  mitigations:
    - 只返回 ok/down
  requires_secrets: false
rollout:
  strategy: big_bang
  rollback_plan: revert PR
---

## 设计正文

### 模块拆分
(详细说明)
`

describe('parseDesignIR — spec §8.2 golden fixture', () => {
  it('parses without errors', () => {
    const out = parseDesignIR(SPEC_8_2_DESIGN_MD)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.task_graph.nodes).toHaveLength(2)
      expect(out.data.task_graph.edges).toHaveLength(1)
      expect(out.data.api_changes[0]?.method).toBe('GET')
      expect(out.warnings).toEqual([])
    }
  })

  it('roundtrips: parse → stringify → parse → data preserved', () => {
    const first = parseDesignIR(SPEC_8_2_DESIGN_MD)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const back = stringifyDesignIR(first.data, first.body)
    const second = parseDesignIR(back)
    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.data).toEqual(first.data)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @honeyai/core test -- design
```

Expected: FAIL with "Cannot find module './design.js'".

- [ ] **Step 3: Implement design.ts**

Create `packages/core/src/ir/design.ts`:

```ts
import { z } from 'zod'
import { parseFrontmatter, stringifyFrontmatter, type IRParseOutcome } from './shared.js'

export const DesignIRSchema = z.object({
  approach_summary: z.string().min(20),
  architecture_decisions: z
    .array(
      z.object({
        id: z.string().regex(/^ADR-\d+$/),
        title: z.string(),
        context: z.string(),
        decision: z.string(),
        consequences: z.string(),
        alternatives_considered: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  affected_components: z.array(z.string()).min(1),
  data_model_changes: z
    .array(
      z.object({
        table: z.string(),
        change: z.enum(['add_table', 'add_column', 'alter_column', 'drop_column', 'add_index']),
        detail: z.string(),
      }),
    )
    .default([]),
  api_changes: z
    .array(
      z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
        path: z.string(),
        change: z.enum(['add', 'modify', 'deprecate', 'remove']),
        detail: z.string(),
      }),
    )
    .default([]),
  task_graph: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        kind: z.enum(['code', 'test', 'doc', 'migration']),
        estimated_effort_lines: z.number().int().positive(),
      }),
    ),
    edges: z.array(z.object({ from: z.string(), to: z.string() })),
  }),
  test_strategy: z.object({
    unit: z.array(z.string()),
    integration: z.array(z.string()),
    e2e: z.array(z.string()),
  }),
  security_review: z.object({
    threats_considered: z.array(z.string()),
    mitigations: z.array(z.string()),
    requires_secrets: z.boolean(),
  }),
  rollout: z.object({
    strategy: z.enum(['big_bang', 'feature_flag', 'gradual']),
    rollback_plan: z.string(),
  }),
})

export type DesignIR = z.infer<typeof DesignIRSchema>

export function parseDesignIR(markdown: string): IRParseOutcome<DesignIR> {
  return parseFrontmatter(markdown, DesignIRSchema)
}

export function stringifyDesignIR(data: DesignIR, body: string): string {
  return stringifyFrontmatter(data, body)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @honeyai/core test -- design
```

Expected: PASS, 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ir/design.ts packages/core/src/ir/design.test.ts
git commit -m "feat(core/ir): DesignIRSchema + parse/stringify + spec §8.2 golden roundtrip"
```

---

## Task 7: ImplementationIR — schema + parse + stringify + spec §8.3 golden roundtrip

**Files:**

- Create: `packages/core/src/ir/implementation.ts`
- Create: `packages/core/src/ir/implementation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/ir/implementation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  ImplementationIRSchema,
  parseImplementationIR,
  stringifyImplementationIR,
  type ImplementationIR,
} from './implementation.js'

const validImpl: ImplementationIR = {
  pr: { title: 't', body: 'b', branch: 'feat/x', base: 'main', draft: false },
  commits: [{ sha: 'a'.repeat(40), message: 'm', files_changed: 1 }],
  files_changed: [{ path: 'src/x.ts', change: 'add', additions: 10, deletions: 0 }],
  tests: { added: [], modified: [] },
  quality_gates: {
    lint: 'pass',
    typecheck: 'pass',
    build: 'pass',
    security_scan: 'pass',
    findings: [],
  },
  ai_self_review: { confidence: 'high', known_limitations: [], suggested_human_review: [] },
  task_completion: [],
  links: { commit_urls: [] },
}

describe('ImplementationIRSchema', () => {
  it('accepts a valid implementation', () => {
    expect(ImplementationIRSchema.safeParse(validImpl).success).toBe(true)
  })

  it('rejects pr.title longer than 72 chars', () => {
    const r = ImplementationIRSchema.safeParse({
      ...validImpl,
      pr: { ...validImpl.pr, title: 'a'.repeat(73) },
    })
    expect(r.success).toBe(false)
  })

  it('rejects commits.sha not 40 chars', () => {
    const r = ImplementationIRSchema.safeParse({
      ...validImpl,
      commits: [{ sha: 'short', message: 'm', files_changed: 1 }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects negative additions / deletions', () => {
    const r = ImplementationIRSchema.safeParse({
      ...validImpl,
      files_changed: [{ path: 'p', change: 'add', additions: -1, deletions: 0 }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects findings.severity = "info" (only low/medium/high/critical)', () => {
    const r = ImplementationIRSchema.safeParse({
      ...validImpl,
      quality_gates: {
        ...validImpl.quality_gates,
        findings: [{ severity: 'info', rule: 'r', file: 'f', line: 1, message: 'm' }],
      },
    })
    expect(r.success).toBe(false)
  })

  it('applies defaults for pr.base / pr.draft / findings / commit_urls', () => {
    const minimal = {
      pr: { title: 't', body: 'b', branch: 'feat/x' },
      commits: [],
      files_changed: [],
      tests: { added: [], modified: [] },
      quality_gates: {
        lint: 'pass',
        typecheck: 'pass',
        build: 'pass',
        security_scan: 'pass',
      },
      ai_self_review: { confidence: 'low', known_limitations: [], suggested_human_review: [] },
      task_completion: [],
      links: {},
    }
    const r = ImplementationIRSchema.safeParse(minimal)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.pr.base).toBe('main')
      expect(r.data.pr.draft).toBe(false)
      expect(r.data.quality_gates.findings).toEqual([])
      expect(r.data.links.commit_urls).toEqual([])
    }
  })

  it('accepts optional tests.coverage_pct in [0,100]', () => {
    const ok = ImplementationIRSchema.safeParse({
      ...validImpl,
      tests: { ...validImpl.tests, coverage_pct: 92 },
    })
    expect(ok.success).toBe(true)
    const bad = ImplementationIRSchema.safeParse({
      ...validImpl,
      tests: { ...validImpl.tests, coverage_pct: 101 },
    })
    expect(bad.success).toBe(false)
  })
})

const SPEC_8_3_IMPL_MD = `---
pr:
  title: "feat(health): 添加 db/redis 状态返回"
  body: |
    实现 RequirementIR #abc12 中的 /health 增强。
  branch: feat/health-detailed-status
  base: main
  draft: false
commits:
  - sha: a1b2c3d4e5f6789012345678901234567890abcd
    message: "feat(health): add db_check module"
    files_changed: 1
  - sha: b1c2d3e4f56789012345678901234567890abcde
    message: "feat(health): add redis_check module"
    files_changed: 1
files_changed:
  - path: src/health/db_check.ts
    change: add
    additions: 28
    deletions: 0
tests:
  added:
    - tests/health.test.ts
  modified: []
  coverage_pct: 92
quality_gates:
  lint: pass
  typecheck: pass
  build: pass
  security_scan: pass
  findings: []
ai_self_review:
  confidence: high
  known_limitations:
    - redis_check 超时仅依赖 Promise.race,未取消底层连接
  suggested_human_review:
    - 确认 500ms 超时是否合理
task_completion:
  - task_id: T1
    status: done
  - task_id: T2
    status: done
links:
  pr_url: https://github.com/user/repo/pull/42
  commit_urls:
    - https://github.com/user/repo/commit/a1b2c3d
---

## 实现摘要

按 DesignIR.task_graph 拓扑序完成 4 个任务。
所有 quality gates 通过。
`

describe('parseImplementationIR — spec §8.3 golden fixture', () => {
  it('parses without errors', () => {
    const out = parseImplementationIR(SPEC_8_3_IMPL_MD)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.pr.title).toBe('feat(health): 添加 db/redis 状态返回')
      expect(out.data.commits).toHaveLength(2)
      expect(out.data.tests.coverage_pct).toBe(92)
      expect(out.data.task_completion).toHaveLength(2)
      expect(out.warnings).toEqual([])
    }
  })

  it('roundtrips: parse → stringify → parse → data preserved', () => {
    const first = parseImplementationIR(SPEC_8_3_IMPL_MD)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const back = stringifyImplementationIR(first.data, first.body)
    const second = parseImplementationIR(back)
    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.data).toEqual(first.data)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @honeyai/core test -- implementation
```

Expected: FAIL with "Cannot find module './implementation.js'".

- [ ] **Step 3: Implement implementation.ts**

Create `packages/core/src/ir/implementation.ts`:

```ts
import { z } from 'zod'
import {
  parseFrontmatter,
  stringifyFrontmatter,
  FindingSeveritySchema,
  type IRParseOutcome,
} from './shared.js'

export const ImplementationIRSchema = z.object({
  pr: z.object({
    title: z.string().max(72),
    body: z.string(),
    branch: z.string(),
    base: z.string().default('main'),
    draft: z.boolean().default(false),
  }),
  commits: z.array(
    z.object({
      sha: z.string().length(40),
      message: z.string(),
      files_changed: z.number().int().nonnegative(),
    }),
  ),
  files_changed: z.array(
    z.object({
      path: z.string(),
      change: z.enum(['add', 'modify', 'delete', 'rename']),
      additions: z.number().int().nonnegative(),
      deletions: z.number().int().nonnegative(),
    }),
  ),
  tests: z.object({
    added: z.array(z.string()),
    modified: z.array(z.string()),
    coverage_pct: z.number().min(0).max(100).optional(),
  }),
  quality_gates: z.object({
    lint: z.enum(['pass', 'fail', 'skipped']),
    typecheck: z.enum(['pass', 'fail', 'skipped']),
    build: z.enum(['pass', 'fail', 'skipped']),
    security_scan: z.enum(['pass', 'fail', 'skipped']),
    findings: z
      .array(
        z.object({
          severity: FindingSeveritySchema,
          rule: z.string(),
          file: z.string(),
          line: z.number().int().positive(),
          message: z.string(),
        }),
      )
      .default([]),
  }),
  ai_self_review: z.object({
    confidence: z.enum(['low', 'medium', 'high']),
    known_limitations: z.array(z.string()),
    suggested_human_review: z.array(z.string()),
  }),
  task_completion: z.array(
    z.object({
      task_id: z.string(),
      status: z.enum(['done', 'partial', 'skipped']),
      notes: z.string().optional(),
    }),
  ),
  links: z.object({
    pr_url: z.string().url().optional(),
    commit_urls: z.array(z.string().url()).default([]),
  }),
})

export type ImplementationIR = z.infer<typeof ImplementationIRSchema>

export function parseImplementationIR(markdown: string): IRParseOutcome<ImplementationIR> {
  return parseFrontmatter(markdown, ImplementationIRSchema)
}

export function stringifyImplementationIR(data: ImplementationIR, body: string): string {
  return stringifyFrontmatter(data, body)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @honeyai/core test -- implementation
```

Expected: PASS, 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ir/implementation.ts packages/core/src/ir/implementation.test.ts
git commit -m "feat(core/ir): ImplementationIRSchema + parse/stringify + spec §8.3 golden roundtrip"
```

---

## Task 8: IR module barrel + core barrel update

**Files:**

- Create: `packages/core/src/ir/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the barrel + integration test**

Create `packages/core/src/ir/index.ts`:

```ts
export * from './shared.js'
export * from './requirement.js'
export * from './design.js'
export * from './implementation.js'
```

Modify `packages/core/src/index.ts` (append one line):

```ts
export * from './errors/index.js'
export * from './log/index.js'
export * from './env/index.js'
export * from './constants/index.js'
export * from './ir/index.js'
```

Create `packages/core/src/ir/barrel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  RequirementIRSchema,
  DesignIRSchema,
  ImplementationIRSchema,
  parseRequirementIR,
  parseDesignIR,
  parseImplementationIR,
  stringifyRequirementIR,
  stringifyDesignIR,
  stringifyImplementationIR,
  PrioritySchema,
  ComplexitySchema,
  RiskLevelSchema,
  FindingSeveritySchema,
  REQUIRED_REQUIREMENT_SECTIONS,
} from './index.js'

describe('IR barrel', () => {
  it('re-exports all 3 schemas + 3 parse + 3 stringify + 4 shared enums + required-sections const', () => {
    expect(RequirementIRSchema).toBeDefined()
    expect(DesignIRSchema).toBeDefined()
    expect(ImplementationIRSchema).toBeDefined()
    expect(typeof parseRequirementIR).toBe('function')
    expect(typeof parseDesignIR).toBe('function')
    expect(typeof parseImplementationIR).toBe('function')
    expect(typeof stringifyRequirementIR).toBe('function')
    expect(typeof stringifyDesignIR).toBe('function')
    expect(typeof stringifyImplementationIR).toBe('function')
    expect(PrioritySchema).toBeDefined()
    expect(ComplexitySchema).toBeDefined()
    expect(RiskLevelSchema).toBeDefined()
    expect(FindingSeveritySchema).toBeDefined()
    expect(REQUIRED_REQUIREMENT_SECTIONS).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

```bash
pnpm --filter @honeyai/core test
```

Expected: PASS, all suites green (existing errors/log/env/constants + new shared/requirement/design/implementation/barrel).

- [ ] **Step 3: Typecheck + lint**

```bash
pnpm --filter @honeyai/core typecheck
pnpm --filter @honeyai/core lint
```

Expected: zero errors.

- [ ] **Step 4: Verify root-level barrel doesn't break other packages**

```bash
pnpm -r typecheck
```

Expected: zero errors across all packages.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ir/index.ts packages/core/src/ir/barrel.test.ts packages/core/src/index.ts
git commit -m "feat(core): export IR module from root barrel"
```

---

## Task 9: ADRs 021-026 — record Q1-Q6 decisions

**Files:**

- Create: `docs/V1-SPEC/ADRs/ADR-021-gray-matter-frontmatter-parser.md`
- Create: `docs/V1-SPEC/ADRs/ADR-022-ir-three-files-plus-shared.md`
- Create: `docs/V1-SPEC/ADRs/ADR-023-body-section-warnings-not-zod.md`
- Create: `docs/V1-SPEC/ADRs/ADR-024-parse-stringify-in-core.md`
- Create: `docs/V1-SPEC/ADRs/ADR-025-no-version-runtime-in-phase-2-0.md`
- Create: `docs/V1-SPEC/ADRs/ADR-026-no-tiptap-generator-in-core.md`
- Modify: `docs/V1-SPEC/ADRs/README.md`

- [ ] **Step 1: Write ADR-021 (gray-matter)**

Create `docs/V1-SPEC/ADRs/ADR-021-gray-matter-frontmatter-parser.md`:

```markdown
# ADR-021: Markdown frontmatter 解析库选 `gray-matter`

- 状态: Accepted
- 日期: 2026-05-26

## Context

`@honeyai/core` 的 IR 文档是 Markdown + YAML frontmatter。Phase 2.0 需要 parse + zod validate,不需要修改 markdown AST。

候选:

- `gray-matter` — 1.5 KB gzipped,无 DOM 依赖,YAML/TOML/JSON 三种 frontmatter,npm 周下载 1.7M
- `remark` + `remark-frontmatter` — 完整 AST,体量大,适合需要修改 markdown 的场景
- 手写正则 — 规避依赖,但要测试边缘 case

## Decision

选 **`gray-matter` 4.0.3**。固定 patch version,与现有 zod 3.24.1 锁版本风格一致。

## Consequences

**正面**:体积小、server/sandbox/web 三端可跑、单 import 完成 parse + stringify、ecosystem 成熟。

**负面**:不支持 markdown AST 修改 —— Phase 2.0 不需要,符合范围;切片 4 (Tiptap) 编辑器自己持有 AST,不依赖 gray-matter。

**后续影响**:`@honeyai/core/src/ir/shared.ts` 暴露内部 `parseFrontmatter` / `stringifyFrontmatter` helper,IR 业务侧透传调用。

## Alternatives Considered

- `remark`:overkill,体积约 30 KB,引入 unified ecosystem 阻塞 sandbox 启动时间
- 手写正则:节省 1 个依赖但增加单测面;`gray-matter` 已包含成熟边缘 case 覆盖

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q1`
- 关联 ADR: ADR-022 (IR 模块文件布局),ADR-024 (parse/stringify 内化到 core)
```

- [ ] **Step 2: Write ADR-022 (file layout)**

Create `docs/V1-SPEC/ADRs/ADR-022-ir-three-files-plus-shared.md`:

```markdown
# ADR-022: `packages/core/src/ir/` 按 IR 拆 3 文件 + 1 共享

- 状态: Accepted
- 日期: 2026-05-26

## Context

3 个 IR(Requirement / Design / Implementation)+ 共享 enum(Priority / Complexity / RiskLevel / FindingSeverity)+ 共享 parse/stringify helper,可选布局:

- A — 按 IR 拆 3 文件 + shared.ts + barrel index.ts
- B — 单文件全塞 `ir.ts`(简单但 200+ 行)
- C — 按 zod / parse / stringify 横切拆分

## Decision

选 **A**。最终结构:
```

packages/core/src/ir/
├── shared.ts # 共享 enum + IRParseOutcome 类型 + 内部 helper
├── requirement.ts # RequirementIRSchema + parse/stringify + 必填 section 检测
├── design.ts # DesignIRSchema + parse/stringify
├── implementation.ts # ImplementationIRSchema + parse/stringify
└── index.ts # barrel(ADR-014)

```

每文件配 `.test.ts` 同目录,延续 `packages/core/src/errors/` 既有约定。

## Consequences

**正面**:每个 IR 独立文件,与 spec 04 §2/§3/§4 章节一一对应;review 体验最好;single-file 内聚度高。

**负面**:`barrel.test.ts` 需 reflectively 检查所有再导出 —— 已在 Task 8 覆盖。

**后续影响**:切片 5(Tiptap)消费时 import `from '@honeyai/core'`,经 ADR-014 root barrel 透传。

## Alternatives Considered

- B(单文件):200+ 行难维护,git blame / git diff review 噪音大
- C(横切):schema/parse/stringify 一致变化时需改 3 个文件,违反"changes-together-live-together"

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q2`
- 关联 ADR: ADR-014 (core 仅 barrel 导出)
```

- [ ] **Step 3: Write ADR-023 (body warnings)**

Create `docs/V1-SPEC/ADRs/ADR-023-body-section-warnings-not-zod.md`:

```markdown
# ADR-023: IR 正文 H2 section 仅 warning,不进 zod 强校验

- 状态: Accepted
- 日期: 2026-05-26

## Context

Spec 04 §2.2 列举 RequirementIR markdown 正文必含 `## 背景` / `## 用户故事` / `## 验收标准明细` / `## 开放问题` 4 个 H2 section,但没指明这是 zod 强校验还是 prompt 模板范围。Design / Implementation IR 未在 spec 内枚举 H2 section。

候选:

- A — 进 zod,缺少 section 拒绝保存(强校验)
- B — 仅 frontmatter zod,正文 sections 检测出"缺失"返回 warning(非阻断)
- C — 完全不校验正文

## Decision

选 **B**。

- `parseRequirementIR` 返回 `IRParseOk<T> = { ok: true; data; body; warnings: IRParseWarning[] }`
- `warnings` 中 `{ kind: 'missing_section', section: string }` 用于 UI 提示("缺失 ## 开放问题 章节")
- DesignIR / ImplementationIR 在 Phase 2.0 不发 section warning(spec 未枚举);如未来 spec 04 §3 / §4 补 section 列表,扩 `REQUIRED_DESIGN_SECTIONS` / `REQUIRED_IMPLEMENTATION_SECTIONS` 常量即可

## Consequences

**正面**:正文是 LLM 输出 + 人工编辑混合产物,过于严苛会引发频繁 `llm_quality_failed` 重试(spec 06);warning 路径保留 UX 提示能力。

**负面**:warning 类型独立于 `z.SafeParseReturnType`,Phase 2.0 引入 `IRParseOutcome<T>` 自定义 discriminated union;代码量略增。

**后续影响**:Tiptap 编辑器(切片 4)消费 `warnings` 数组,渲染 inline hint;Server Action `saveArtifact`(切片 5)不拒绝 warning 状态的 IR。

## Alternatives Considered

- A(强校验):破坏 LLM workflow,首轮 3-stage 跑通成功率掉到 < 30%
- C(完全不校验):放弃 UX 提示,LLM 经常漏 `## 开放问题`,人工 review 负担重

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q3`
- 关联 spec: 04 §2.2
- 关联 ADR: ADR-024 (parseRequirementIR 输出形状)
```

- [ ] **Step 4: Write ADR-024 (parse/stringify in core)**

Create `docs/V1-SPEC/ADRs/ADR-024-parse-stringify-in-core.md`:

```markdown
# ADR-024: `parseIR` / `stringifyIR` 内化到 `@honeyai/core`

- 状态: Accepted
- 日期: 2026-05-26

## Context

`@honeyai/core` 是 IR 类型权威。是否同时承担 IR 的 parse / stringify 工具,可选:

- A — 内化(schema + parse + stringify 同包同 PR 落)
- B — 不含,Phase 2.0 仅暴露 zod schema,工具函数推迟到使用方(orchestrator / web)各自实现
- C — 仅含 parse,不含 stringify

## Decision

选 **A**。`@honeyai/core/src/ir/` 同时暴露:

- 3 个 zod schema + 3 个 TypeScript type
- 3 个 `parse<IR>(markdown)` 函数,返回 `IRParseOutcome<T>` discriminated union
- 3 个 `stringify<IR>(data, body)` 函数,输出 markdown 字符串
- shared.ts 内部 `parseFrontmatter` / `stringifyFrontmatter` helper (gray-matter wrapper)

`stringify<IR>` 不在内部做 zod 校验 —— 调用方(orchestrator / sandbox / Server Action)在 stringify 前已经 zod-validate,此处 stringify 视为纯字符串组装。

## Consequences

**正面**:`@honeyai/core` 是 IR 唯一权威,parse/stringify 与 schema 配对最自然;orchestrator / sandbox-runner / web 三个消费方零重复 frontmatter 提取逻辑;Phase 2.0 PR 体量仍小。

**负面**:`@honeyai/core` 体积略增(gray-matter ≈ 1.5 KB gzipped),可接受。

**后续影响**:切片 1 orchestrator FSM、切片 2 sandbox-runner、切片 5 web Server Action 均 `import { parseRequirementIR } from '@honeyai/core'`。

## Alternatives Considered

- B(分散):3 个消费方各写一遍 frontmatter 提取逻辑,drift 风险高;schema 变更后 stringify 不同步会产生坏数据
- C(仅 parse):stringify 在 Tiptap 保存 (切片 5) 触发,推迟到切片 5 实现等价于"先卡 parse 跑通"——但 Phase 2.0 测试需要 roundtrip 验证,stringify 必须就位

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q4`
- 关联 ADR: ADR-021 (gray-matter), ADR-022 (文件布局), ADR-023 (输出形状含 warnings)
```

- [ ] **Step 5: Write ADR-025 (no version runtime)**

Create `docs/V1-SPEC/ADRs/ADR-025-no-version-runtime-in-phase-2-0.md`:

```markdown
# ADR-025: IR 版本规则运行时逻辑不在 Phase 2.0,延后切片 1

- 状态: Accepted
- 日期: 2026-05-26

## Context

Spec 04 §11 定义 IR 版本规则:`ir_documents.version` monotonic int + Redis advisory 编辑锁 5min idle + 强抢二次确认 + zod 失败 / 锁丢失 UX。是否 Phase 2.0 内一并交付:

- A — 包含完整运行时 (`acquireEditLock` / `incrementVersion` / `forceUnlock`)
- B — 不含,Phase 2.0 仅暴露 zod 类型 + parse/stringify;版本规则运行时延后到切片 1(orchestrator)或切片 5(web)
- C — 仅含版本号字段定义,不含锁逻辑

## Decision

选 **B**。

## Consequences

**正面**:`@honeyai/core` 维持"纯函数 + 纯类型"定位,无 Redis / DB / Server Action 依赖,server-side / sandbox-side / web 三端可跑;Phase 2.0 PR 体量收窄,TDD 友好。

**负面**:切片 5(web Gate UI)依赖版本规则运行时,排期顺序需保证 orchestrator(切片 1)先于 web 完成 —— 已在 `decisions/phase-2-open-questions.md §M1` 切片顺序中保证。

**后续影响**:切片 1 在 `@honeyai/orchestrator` 新增 `irVersion.ts` 模块,封装 (a) 乐观锁版本检查;(b) Redis advisory lock 客户端;(c) 强抢 SSE 广播。`@honeyai/core` 不知情。

## Alternatives Considered

- A(全装):违反 `@honeyai/core` 纯函数定位;引入 ioredis 依赖到 core 后,sandbox-runner / 三端跑面将被迫装 Redis 客户端
- C(字段):字段无运行时配合等于半成品,价值低

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q5`
- 关联 spec: 04 §11
- 关联 ADR: ADR-014 (core 仅 barrel),M1 切片顺序
```

- [ ] **Step 6: Write ADR-026 (no Tiptap generator)**

Create `docs/V1-SPEC/ADRs/ADR-026-no-tiptap-generator-in-core.md`:

```markdown
# ADR-026: Tiptap 表单 generator 不进 `@honeyai/core`,延后切片 4

- 状态: Accepted
- 日期: 2026-05-26

## Context

Spec 04 §9 描述 zod schema 喂给 generator 自动出 Tiptap 表单。是否 Phase 2.0 内交付:

- A — 进 Phase 2.0(`@honeyai/core` 暴露 zod-to-tiptap util)
- B — 不进,推迟到切片 4(`@honeyai/web`)
- C — 进单独包 `@honeyai/forms`

## Decision

选 **B**。`@honeyai/core` 不引入 React / Tiptap 任何依赖。Tiptap generator 在切片 4 落到 `@honeyai/web/src/lib/forms/`。

## Consequences

**正面**:`@honeyai/core` 维持无 DOM 依赖,可在 sandbox-runner / Node CLI / web SSR 三端跑;`pnpm install --filter sandbox-runner` 不拖 React。

**负面**:切片 4 实施 PR 需独立设计 generator,不能复用 core 内代码 —— 但 generator 本身就是 React 组件,放 web 合理。

**后续影响**:切片 4 在 `@honeyai/web/src/lib/forms/schema-to-tiptap.ts` 实现 zod → Tiptap node spec 的递归映射;依赖 `@honeyai/core` 仅取 schema 对象,不取 UI。

## Alternatives Considered

- A(进 core):core 必然引入 React 类型,破坏 server/sandbox/web 三端可跑性
- C(独立包):再开一个 npm package 增加 workspace 维护成本;切片 4 唯一消费,放 web 内部更简单

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q6`
- 关联 spec: 04 §9
- 关联 ADR: ADR-022 (core/ir 布局,不含 Tiptap 部分)
```

- [ ] **Step 7: Update ADRs/README.md index**

Edit `docs/V1-SPEC/ADRs/README.md` — append 6 rows after the ADR-020 line:

```markdown
| [ADR-021](./ADR-021-gray-matter-frontmatter-parser.md) | Markdown frontmatter 解析库选 `gray-matter` | Accepted |
| [ADR-022](./ADR-022-ir-three-files-plus-shared.md) | `packages/core/src/ir/` 按 IR 拆 3 文件 + 1 共享 | Accepted |
| [ADR-023](./ADR-023-body-section-warnings-not-zod.md) | IR 正文 H2 section 仅 warning,不进 zod 强校验 | Accepted |
| [ADR-024](./ADR-024-parse-stringify-in-core.md) | `parseIR` / `stringifyIR` 内化到 `@honeyai/core` | Accepted |
| [ADR-025](./ADR-025-no-version-runtime-in-phase-2-0.md) | IR 版本规则运行时逻辑不在 Phase 2.0,延后切片 1 | Accepted |
| [ADR-026](./ADR-026-no-tiptap-generator-in-core.md) | Tiptap 表单 generator 不进 `@honeyai/core`,延后切片 4 | Accepted |
```

- [ ] **Step 8: Commit**

```bash
git add docs/V1-SPEC/ADRs/ADR-021-gray-matter-frontmatter-parser.md \
        docs/V1-SPEC/ADRs/ADR-022-ir-three-files-plus-shared.md \
        docs/V1-SPEC/ADRs/ADR-023-body-section-warnings-not-zod.md \
        docs/V1-SPEC/ADRs/ADR-024-parse-stringify-in-core.md \
        docs/V1-SPEC/ADRs/ADR-025-no-version-runtime-in-phase-2-0.md \
        docs/V1-SPEC/ADRs/ADR-026-no-tiptap-generator-in-core.md \
        docs/V1-SPEC/ADRs/README.md
git commit -m "docs(adr): ADR-021..026 — Phase 2.0 Q1-Q6 decisions"
```

---

## Task 10: CHANGELOG v0.4.0 entry

**Files:**

- Modify: `docs/V1-SPEC/CHANGELOG.md`

- [ ] **Step 1: Insert v0.4.0 entry at top of the changelog (after the header lines, before "## 2026-05-25")**

Find the `## 2026-05-25` heading near the top, and insert before it:

```markdown
## 2026-05-26

### v0.4.0 — Phase 2.0 切片 0:`@honeyai/core` IR zod schemas

3 个 IR(Requirement / Design / Implementation)zod schema + parse/stringify 工具 + spec §8 golden roundtrip 测试落地。
不含版本规则运行时(Q5=B,切片 1)、不含 Tiptap generator(Q6=B,切片 4)、不含 ir_documents 持久化(切片 1)。

**Added**

- `@honeyai/core/src/ir/shared.ts`:Priority / Complexity / RiskLevel / FindingSeverity enums + `IRParseOutcome<T>` discriminated union + 内部 `parseFrontmatter` / `stringifyFrontmatter` helper(gray-matter wrapper)
- `@honeyai/core/src/ir/requirement.ts`:`RequirementIRSchema` + `parseRequirementIR` + `stringifyRequirementIR` + `REQUIRED_REQUIREMENT_SECTIONS` 常量(对齐 spec 04 §2.1 / §2.2)
- `@honeyai/core/src/ir/design.ts`:`DesignIRSchema` + `parseDesignIR` + `stringifyDesignIR`(对齐 spec 04 §3.1)
- `@honeyai/core/src/ir/implementation.ts`:`ImplementationIRSchema` + `parseImplementationIR` + `stringifyImplementationIR`(对齐 spec 04 §4.1)
- `@honeyai/core/src/ir/index.ts`:IR 模块 barrel
- 单元测试:每 schema happy + failure case + spec §8.1 / §8.2 / §8.3 golden roundtrip
- ADR-021 至 ADR-026:Phase 2.0 Q1-Q6 拍板入档

**Changed**

- `@honeyai/core/package.json`:新增 `gray-matter 4.0.3` 依赖
- `@honeyai/core/src/index.ts`:根 barrel 追加 IR 模块再导出

**Note**

- IR 正文 H2 section(spec 04 §2.2)仅返回 warning,**不**进 zod 强校验(ADR-023)
- Phase 2.0 PR 不含 orchestrator / adapter / sandbox / web / github / worker 任何代码;以上交付按 `decisions/phase-2-open-questions.md §M1` 切片顺序后续推进
```

- [ ] **Step 2: Commit**

```bash
git add docs/V1-SPEC/CHANGELOG.md
git commit -m "docs: changelog v0.4.0 — Phase 2.0 切片 0"
```

---

## Task 11: Final verification + PR

**Files:** none (verification + git push + gh)

- [ ] **Step 1: Full repo verification**

```bash
pnpm install
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm ac:coverage
```

Expected:

- `typecheck` zero errors
- `lint` zero errors
- `test` all green; `@honeyai/core` shows ≥ 20 IR-related tests added
- `ac:coverage` not regressed (Phase 2.0 doesn't add seed AC bindings; spec 04 §12 AC-04-01 / AC-04-02 still bind to Slice 1 / 5 layers)

- [ ] **Step 2: Push branch**

```bash
unset GITHUB_TOKEN
TOKEN=$(gh auth token)
git push "https://x-access-token:${TOKEN}@github.com/xiaohanarch/HoneyAI.git" \
  feat/phase-2-0-core-ir-schemas:feat/phase-2-0-core-ir-schemas
git fetch origin feat/phase-2-0-core-ir-schemas
git branch --set-upstream-to=origin/feat/phase-2-0-core-ir-schemas feat/phase-2-0-core-ir-schemas
```

Expected: `[new branch]` created.

- [ ] **Step 3: Open PR**

```bash
env -u GITHUB_TOKEN gh pr create --base main --head feat/phase-2-0-core-ir-schemas \
  --title "feat(core): Phase 2.0 — IR zod schemas + parse/stringify" \
  --body "$(cat <<'EOF'
## Summary

Phase 2.0(切片 0):落地 `@honeyai/core` IR zod schemas + parse/stringify 工具,与 spec 04 §1-§10 字段对齐。

- 3 个 zod schema:RequirementIR / DesignIR / ImplementationIR
- 3 对 parse / stringify 工具函数(gray-matter wrapper)
- shared.ts 暴露 Priority / Complexity / RiskLevel / FindingSeverity enums + `IRParseOutcome<T>` discriminated union
- RequirementIR 正文 4 个 H2 section 缺失返回非阻断 warning(ADR-023)
- spec §8.1 / §8.2 / §8.3 三个示例 markdown 作 golden roundtrip 测试
- 6 个新 ADR(ADR-021..026)记录 Phase 2.0 Q1-Q6 拍板

## 不在本 PR

- orchestrator FSM(切片 1) / sandbox-runner(切片 2) / web(切片 4-5) / github(切片 3)
- IR 版本规则运行时(Redis lock / monotonic version / 强抢 UX) → 切片 1,ADR-025
- Tiptap 表单 generator → 切片 4,ADR-026
- `ir_documents` 持久化 → 切片 1

## Test plan

- [x] `pnpm --filter @honeyai/core test` 全部 green
- [x] `pnpm --filter @honeyai/core typecheck` zero error
- [x] `pnpm --filter @honeyai/core lint` zero error
- [x] `pnpm -r test` 不回归
- [x] `pnpm ac:coverage` 不回归(seed AC 仍 100%)
- [x] CI 5 job 全 green
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 4: Watch CI**

```bash
env -u GITHUB_TOKEN gh pr checks $(env -u GITHUB_TOKEN gh pr view --json number --jq .number)
```

Expected: all 5 jobs(lint / typecheck / migration-check / test / ac-coverage)green.

- [ ] **Step 5: Report PR URL + CI result to user; wait for review/merge instruction**

Do NOT auto-merge. Per CLAUDE.md, plan output ≠ implementation autopilot;user reviews and instructs `merge it` separately.

---

## Self-review (run after Task 11)

**Spec coverage check** (spec 04 § → task mapping):

| Spec §                      | Required                    | Task                                                                         |
| --------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| §1 存储格式                 | Markdown + YAML frontmatter | Task 2 (gray-matter)                                                         |
| §2.1 RequirementIRSchema    | All 10 fields               | Task 3                                                                       |
| §2.2 markdown sections      | 4 H2 warnings               | Task 4                                                                       |
| §3.1 DesignIRSchema         | All 9 fields                | Task 6                                                                       |
| §3.2 task_graph contract    | id unique + DAG             | Task 6 (id present + edges); DAG cycle check left to consumer per Q5 scope   |
| §4.1 ImplementationIRSchema | All 9 fields                | Task 7                                                                       |
| §5 校验时机                 | 3 个位置                    | Out of Phase 2.0 (Server Action / Tiptap / sandbox-runner 各自层,切片 1/2/5) |
| §6 编辑器形态               | Tiptap layout               | Out of Phase 2.0 (Q6, ADR-026, 切片 4)                                       |
| §7 跨阶段数据流             | sub-IR naming               | Out of Phase 2.0 (orchestrator FSM, 切片 1)                                  |
| §8.1/8.2/8.3 examples       | Golden roundtrip            | Task 5 / 6 / 7                                                               |
| §9 zod → Tiptap             | Generator                   | Out of Phase 2.0 (ADR-026, 切片 4)                                           |
| §10 校验错误显示            | ZodError path               | Covered by `IRParseErr.error.issues[].path` (consumer-side rendering 切片 5) |
| §11 IR 版本规则             | Runtime                     | Out of Phase 2.0 (ADR-025, 切片 1)                                           |
| §12 AC-04-01/02             | Acceptance bindings         | Out of Phase 2.0 (Server Action layer, 切片 1/5)                             |

All in-scope spec items mapped to a task. Out-of-scope items have an ADR explaining why.

**Placeholder scan:** none — every code step contains complete code; every test step contains complete assertions.

**Type consistency:** `IRParseOutcome<T>` / `parseFrontmatter` / `stringifyFrontmatter` / `IRParseWarning` names are stable across Tasks 2-8. `REQUIRED_REQUIREMENT_SECTIONS` named consistently. `RequirementIR` / `DesignIR` / `ImplementationIR` types consistent.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-phase-2-0-core-ir-schemas.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for Phase 2.0's 11 well-isolated tasks with clear test boundaries.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Lower overhead but reduces parallelism between review + impl.

**Which approach?**
