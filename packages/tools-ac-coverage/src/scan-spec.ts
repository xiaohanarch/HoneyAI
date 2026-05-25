import { readFile } from 'node:fs/promises'
import fg from 'fast-glob'

/** A single AC reference found in spec markdown. */
export interface SpecAC {
  /** Canonical id e.g. `AC-03-01`. */
  id: string
  /** Absolute path of the markdown file the id was found in. */
  file: string
  /** 1-indexed line number where the id first appears in the file. */
  line: number
  /** Trimmed full line of context. */
  context: string
}

const AC_REGEX = /\bAC-(\d{2})-(\d{2})\b/g

/**
 * Walks all `**\/*.md` files under `rootDir` and extracts AC-XX-YY ids,
 * returning the first occurrence per id (subsequent occurrences are ignored
 * — the spec convention is that each AC is *defined* once and *referenced*
 * many times; we report the first hit, which by file-walk order is usually
 * the definition site for the seed ACs).
 */
export async function scanSpec(rootDir: string): Promise<Map<string, SpecAC>> {
  const files = await fg(['**/*.md'], { cwd: rootDir, absolute: true, dot: false })
  files.sort()
  const out = new Map<string, SpecAC>()
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      AC_REGEX.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = AC_REGEX.exec(line)) !== null) {
        const id = `AC-${match[1]}-${match[2]}`
        if (!out.has(id)) {
          out.set(id, { id, file, line: i + 1, context: line.trim() })
        }
      }
    }
  }
  return out
}
