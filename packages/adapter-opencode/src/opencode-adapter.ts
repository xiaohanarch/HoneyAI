import { spawn } from 'node:child_process'
import type { RuntimeAdapter, ExecuteNodeParams, StreamingNodeEvent } from '@honeyai/core'

/**
 * OpenCodeAdapter — implements RuntimeAdapter using the opencode CLI.
 *
 * Spawns: opencode run --format json --model <model> [--session <id>] "<prompt>"
 *
 * opencode event format differs from Claude Code; this adapter maps the 5 known
 * opencode event types to StreamingNodeEvent:
 *   text       → { kind: 'text', content }
 *   tool_use   → { kind: 'tool_call', tool, args } + { kind: 'tool_result', tool, outputLen }
 *   step_finish reason:stop   → { kind: 'finish', reason: 'end_turn', inputTokens, outputTokens }
 *   step_finish reason:tool-calls → skipped (intermediate step)
 *   step_start → skipped
 *   error      → { kind: 'error', content }
 */
export class OpenCodeAdapter implements RuntimeAdapter {
  private readonly model: string

  constructor(model = 'anthropic/claude-sonnet-4-6') {
    this.model = model
  }

  async *executeNode(params: ExecuteNodeParams): AsyncGenerator<StreamingNodeEvent> {
    const { kind, irInput, anthropicKey, sessionId } = params

    // opencode has no --system-prompt flag; embed the stage kind as a preamble
    const stageHint = `[Stage: ${kind}]\n\n`
    const prompt = stageHint + irInput

    const args = ['run', '--format', 'json', '--model', this.model]
    if (sessionId) {
      args.push('--session', sessionId)
    }
    args.push(prompt)

    const spawnEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ANTHROPIC_API_KEY: anthropicKey || undefined,
    }

    console.log('[opencode-adapter] spawning opencode, kind=%s, model=%s', kind, this.model)
    const proc = spawn('opencode', args, { env: spawnEnv, stdio: ['ignore', 'pipe', 'pipe'] })
    proc.on('spawn', () => console.log('[opencode-adapter] process spawned, pid=%d', proc.pid))

    let buffer = ''

    const queue: StreamingNodeEvent[] = []
    let done = false
    let resolveWaiter: (() => void) | null = null

    function enqueue(event: StreamingNodeEvent): void {
      queue.push(event)
      resolveWaiter?.()
      resolveWaiter = null
      if (event.kind === 'finish' || event.kind === 'error') {
        console.log(
          '[opencode-adapter] terminal event received, kind=%s, killing process',
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
      console.error('[opencode-adapter stderr]', chunk.toString())
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
      // Attempt to parse remaining buffer (final line may arrive without trailing \n)
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
          content: `opencode process exited with code ${code}`,
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
  const type = parsed['type']

  if (type === 'text') {
    const part = parsed['part'] as Record<string, unknown> | undefined
    const text = String(part?.['text'] ?? '')
    result.push({ ts, kind: 'text', content: text })
    return result
  }

  if (type === 'tool_use') {
    const part = parsed['part'] as Record<string, unknown> | undefined
    const tool = String(part?.['tool'] ?? '')
    const state = part?.['state'] as Record<string, unknown> | undefined
    const input = (state?.['input'] as Record<string, unknown>) ?? {}
    const output = String(state?.['output'] ?? '')

    // Emit tool_call (with input args) and tool_result (with output length)
    result.push({ ts, kind: 'tool_call', tool, args: input })
    result.push({ ts, kind: 'tool_result', tool, outputLen: output.length })
    return result
  }

  if (type === 'step_finish') {
    const part = parsed['part'] as Record<string, unknown> | undefined
    const reason = String(part?.['reason'] ?? '')

    // Only "stop" means the full run is done; "tool-calls" is an intermediate step
    if (reason !== 'stop') return result

    const tokens = part?.['tokens'] as Record<string, unknown> | undefined
    result.push({
      ts,
      kind: 'finish',
      reason: 'end_turn',
      inputTokens: Number(tokens?.['input'] ?? 0),
      outputTokens: Number(tokens?.['output'] ?? 0),
    })
    return result
  }

  if (type === 'error') {
    const error = parsed['error'] as Record<string, unknown> | undefined
    const data = error?.['data'] as Record<string, unknown> | undefined
    const message = String(data?.['message'] ?? 'unknown error')
    result.push({ ts, kind: 'error', content: message })
    return result
  }

  // step_start and unknown types → skip
  return result
}
