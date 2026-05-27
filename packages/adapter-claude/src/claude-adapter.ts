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
      '--model',
      'claude-sonnet-4-6',
      '--system-prompt',
      systemPrompt,
      '--message',
      irInput,
    ]
    if (sessionId) {
      args.push('--resume', sessionId)
    }

    const proc = spawn('claude', args, {
      env: { ...process.env, ANTHROPIC_API_KEY: anthropicKey },
    })

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
    }

    function waitForData(): Promise<void> {
      return new Promise((resolve) => {
        resolveWaiter = resolve
      })
    }

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>
          const event = mapToStreamingEvent(parsed)
          if (event) enqueue(event)
        } catch {
          // skip unparseable lines
        }
      }
    })

    proc.on('close', (code: number | null) => {
      // Flush any remaining buffered content
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim()) as Record<string, unknown>
          const event = mapToStreamingEvent(parsed)
          if (event) enqueue(event)
        } catch {
          // ignore
        }
        buffer = ''
      }
      if (code !== 0 && code !== null) {
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

function mapToStreamingEvent(parsed: Record<string, unknown>): StreamingNodeEvent | null {
  const ts = new Date().toISOString()

  if (parsed['type'] === 'assistant') {
    const msg = parsed['message'] as Record<string, unknown> | undefined
    const contentArr = msg?.['content'] as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(contentArr)) return null

    for (const item of contentArr) {
      if (item['type'] === 'thinking') {
        return { ts, kind: 'thinking', content: String(item['thinking'] ?? '') }
      }
      if (item['type'] === 'tool_use') {
        return {
          ts,
          kind: 'tool_call',
          tool: String(item['name'] ?? ''),
          args: (item['input'] as Record<string, unknown>) ?? {},
        }
      }
      if (item['type'] === 'text') {
        return { ts, kind: 'text', content: String(item['text'] ?? '') }
      }
    }
    return null
  }

  if (parsed['type'] === 'tool') {
    const content = String(parsed['content'] ?? '')
    return {
      ts,
      kind: 'tool_result',
      tool: String(parsed['tool_name'] ?? ''),
      outputLen: content.length,
    }
  }

  if (parsed['type'] === 'result') {
    if (parsed['subtype'] === 'success') {
      const usage = parsed['usage'] as Record<string, unknown> | undefined
      return {
        ts,
        kind: 'finish',
        reason: 'end_turn',
        inputTokens: Number(usage?.['input_tokens'] ?? 0),
        outputTokens: Number(usage?.['output_tokens'] ?? 0),
      }
    }
    return {
      ts,
      kind: 'error',
      content: `result subtype: ${String(parsed['subtype'] ?? 'unknown')}`,
    }
  }

  return null
}
