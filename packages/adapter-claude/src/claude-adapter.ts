import { spawn } from 'node:child_process'
import type { RuntimeAdapter, ExecuteNodeParams, StreamingNodeEvent } from '@honeyai/core'
import { buildSystemPrompt } from './prompts.js'

export class ClaudeCodeAdapter implements RuntimeAdapter {
  async *executeNode(params: ExecuteNodeParams): AsyncGenerator<StreamingNodeEvent> {
    const { kind, irInput, anthropicKey, sessionId } = params

    const systemPrompt = buildSystemPrompt(kind, irInput)

    const args = [
      '--output-format',
      'stream-json',
      '--verbose',
      '--model',
      'claude-sonnet-4-6',
      '--system-prompt',
      systemPrompt,
      '-p',
      irInput,
    ]
    if (sessionId) {
      args.push('--resume', sessionId)
    }

    // Only set ANTHROPIC_API_KEY when non-empty; if empty, remove it so the
    // claude CLI falls back to its own OAuth auth (Claude Code subscription).
    const spawnEnv = { ...process.env, ANTHROPIC_API_KEY: anthropicKey }
    if (!anthropicKey) delete spawnEnv['ANTHROPIC_API_KEY']
    // Remove CLAUDECODE so the worker can spawn claude even when running inside
    // a Claude Code session (e.g. developer's integrated terminal).
    delete spawnEnv['CLAUDECODE']

    console.log('[claude-adapter] spawning claude, kind=%s, args=%s', kind, args.join(' '))
    const proc = spawn('claude', args, { env: spawnEnv, stdio: ['ignore', 'pipe', 'pipe'] })
    proc.on('spawn', () => console.log('[claude-adapter] process spawned, pid=%d', proc.pid))

    // Buffer for partial lines
    let buffer = ''

    // Queue + promise pattern to bridge EventEmitter into AsyncGenerator
    const queue: StreamingNodeEvent[] = []
    let done = false
    let resolveWaiter: (() => void) | null = null

    function enqueue(event: StreamingNodeEvent): void {
      queue.push(event)
      resolveWaiter?.()
      resolveWaiter = null
      // Once Claude signals done (finish or error), don't wait for the process to
      // naturally exit — Stop hooks (e.g. pnpm build) can take minutes.
      if (event.kind === 'finish' || event.kind === 'error') {
        console.log(
          '[claude-adapter] terminal event received, kind=%s, killing process',
          event.kind,
        )
        done = true
        if (!proc.killed) proc.kill()
      }
    }

    function waitForData(): Promise<void> {
      return new Promise((resolve) => {
        resolveWaiter = resolve
      })
    }

    proc.stderr.on('data', (chunk: Buffer) => {
      console.error('[claude-adapter stderr]', chunk.toString())
    })

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>
          for (const event of mapToStreamingEvents(parsed)) {
            enqueue(event)
          }
        } catch {
          // skip unparseable lines
        }
      }
      // Also attempt to parse any remaining buffer that arrived without a trailing \n
      // (the final result JSON from claude CLI often comes without a newline)
      const trimmedBuffer = buffer.trim()
      if (trimmedBuffer) {
        try {
          const parsed = JSON.parse(trimmedBuffer) as Record<string, unknown>
          for (const event of mapToStreamingEvents(parsed)) {
            enqueue(event)
          }
          buffer = ''
        } catch {
          // Incomplete JSON — keep buffering
        }
      }
    })

    proc.on('close', (code: number | null) => {
      // Flush any remaining buffered content
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim()) as Record<string, unknown>
          for (const event of mapToStreamingEvents(parsed)) {
            enqueue(event)
          }
        } catch {
          // ignore
        }
        buffer = ''
      }
      if (code !== 0 && code !== null && !done) {
        enqueue({
          ts: new Date().toISOString(),
          kind: 'error',
          content: `claude process exited with code ${code}`,
        })
      }
      done = true
      resolveWaiter?.()
      resolveWaiter = null
    })

    while (!done || queue.length > 0) {
      if (queue.length === 0) {
        await waitForData()
      }
      while (queue.length > 0) {
        yield queue.shift()!
      }
    }
  }
}

function mapToStreamingEvents(parsed: Record<string, unknown>): StreamingNodeEvent[] {
  const ts = new Date().toISOString()
  const result: StreamingNodeEvent[] = []

  if (parsed['type'] === 'assistant') {
    const msg = parsed['message'] as Record<string, unknown> | undefined
    const contentArr = msg?.['content'] as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(contentArr)) return result

    for (const item of contentArr) {
      if (item['type'] === 'thinking') {
        result.push({ ts, kind: 'thinking', content: String(item['thinking'] ?? '') })
      } else if (item['type'] === 'tool_use') {
        result.push({
          ts,
          kind: 'tool_call',
          tool: String(item['name'] ?? ''),
          args: (item['input'] as Record<string, unknown>) ?? {},
        })
      } else if (item['type'] === 'text') {
        result.push({ ts, kind: 'text', content: String(item['text'] ?? '') })
      }
    }
    return result
  }

  if (parsed['type'] === 'tool') {
    const content = String(parsed['content'] ?? '')
    result.push({
      ts,
      kind: 'tool_result',
      tool: String(parsed['tool_name'] ?? ''),
      outputLen: content.length,
    })
    return result
  }

  if (parsed['type'] === 'result') {
    if (parsed['subtype'] === 'success') {
      const usage = parsed['usage'] as Record<string, unknown> | undefined
      result.push({
        ts,
        kind: 'finish',
        reason: 'end_turn',
        inputTokens: Number(usage?.['input_tokens'] ?? 0),
        outputTokens: Number(usage?.['output_tokens'] ?? 0),
      })
    } else {
      result.push({
        ts,
        kind: 'error',
        content: `result subtype: ${String(parsed['subtype'] ?? 'unknown')}`,
      })
    }
    return result
  }

  return result
}
