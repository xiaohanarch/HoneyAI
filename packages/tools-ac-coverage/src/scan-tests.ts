import { readFile } from 'node:fs/promises'
import fg from 'fast-glob'

/** A single test occurrence that references an AC id. */
export interface TestAC {
  /** Canonical id e.g. `AC-03-01`. */
  id: string
  /** Absolute path of the `.test.ts` file. */
  file: string
  /** 1-indexed line number where the id appears. */
  line: number
  /** Trimmed full line of context. */
  context: string
  /** Whether the line is a `describe(...)` block (vs `it(...)`). */
  kind: 'describe' | 'it' | 'other'
}

const AC_REGEX = /\bAC-(\d{2})-(\d{2})\b/g
const DESCRIBE_REGEX = /\bdescribe\s*\(/
const IT_REGEX = /\b(?:it|test)\s*\(/

/**
 * Walks all `*.test.ts` / `*.test.tsx` files under `rootDir` and finds every
 * line that references an `AC-XX-YY` id, returning the map keyed by id with
 * an array of occurrences (a single AC may have multiple test cases).
 */
export async function scanTests(rootDir: string): Promise<Map<string, TestAC[]>> {
  const files = await fg(['**/*.test.{ts,tsx}'], {
    cwd: rootDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.turbo/**'],
  })
  files.sort()
  const out = new Map<string, TestAC[]>()
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      AC_REGEX.lastIndex = 0
      const seenInLine = new Set<string>()
      let match: RegExpExecArray | null
      while ((match = AC_REGEX.exec(line)) !== null) {
        const id = `AC-${match[1]}-${match[2]}`
        if (seenInLine.has(id)) continue
        seenInLine.add(id)
        const kind: TestAC['kind'] = DESCRIBE_REGEX.test(line)
          ? 'describe'
          : IT_REGEX.test(line)
            ? 'it'
            : 'other'
        const occ: TestAC = { id, file, line: i + 1, context: line.trim(), kind }
        const existing = out.get(id)
        if (existing) existing.push(occ)
        else out.set(id, [occ])
      }
    }
  }
  return out
}
