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
