import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { ClaudeCodeAdapter } from './claude-adapter.js'
import type { ExecuteNodeParams, StreamingNodeEvent } from '@honeyai/core'

// ─── Mock setup ─────────────────────────────────────────────────────────────

// vi.hoisted ensures mockSpawn is defined before vi.mock is hoisted
const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: mockSpawn }))

/** Build a fake child process that emits the given stdout lines then exits */
function makeFakeProcess(lines: string[], exitCode = 0) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()

  // Emit lines asynchronously so the generator can start
  setTimeout(() => {
    for (const line of lines) {
      proc.stdout.emit('data', line + '\n')
    }
    proc.emit('close', exitCode)
  }, 0)

  return proc
}

const BASE_PARAMS: ExecuteNodeParams = {
  tenantId: 'tenant-1',
  runId: 'run-1',
  nodeId: 'node-1',
  kind: 'enrich',
  anthropicKey: 'sk-test-key',
  irInput: '# Test input',
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ClaudeCodeAdapter', () => {
  beforeEach(() => {
    mockSpawn.mockReset()
  })

  it('AC-06-01: thinking line maps to StreamingNodeEvent{kind:thinking}', async () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'thinking', thinking: 'I need to analyze...' }] },
    })
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new ClaudeCodeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    const thinking = events.find((e) => e.kind === 'thinking')
    expect(thinking).toBeDefined()
    expect(thinking.content).toBe('I need to analyze...')
  })

  it('AC-06-02: tool_use line maps to StreamingNodeEvent{kind:tool_call}', async () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/foo.ts' } }] },
    })
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new ClaudeCodeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    const toolCall = events.find((e) => e.kind === 'tool_call')
    expect(toolCall).toBeDefined()
    expect(toolCall.tool).toBe('Read')
    expect(toolCall.args).toEqual({ file_path: '/foo.ts' })
  })

  it('AC-06-03: tool result line maps to StreamingNodeEvent{kind:tool_result}', async () => {
    const line = JSON.stringify({
      type: 'tool',
      tool_name: 'Read',
      content: 'file contents here',
    })
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new ClaudeCodeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    const toolResult = events.find((e) => e.kind === 'tool_result')
    expect(toolResult).toBeDefined()
    expect(toolResult.tool).toBe('Read')
    expect(toolResult.outputLen).toBe('file contents here'.length)
  })

  it('AC-06-04: text line maps to StreamingNodeEvent{kind:text}', async () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Here is the RequirementIR:' }] },
    })
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new ClaudeCodeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    const text = events.find((e) => e.kind === 'text')
    expect(text).toBeDefined()
    expect(text.content).toBe('Here is the RequirementIR:')
  })

  it('AC-06-05: result success line maps to StreamingNodeEvent{kind:finish}', async () => {
    const line = JSON.stringify({
      type: 'result',
      subtype: 'success',
      usage: { input_tokens: 1000, output_tokens: 500 },
      session_id: 'sess-abc',
    })
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new ClaudeCodeAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    const finish = events.find((e) => e.kind === 'finish')
    expect(finish).toBeDefined()
    expect(finish.reason).toBe('end_turn')
    expect(finish.inputTokens).toBe(1000)
    expect(finish.outputTokens).toBe(500)
  })

  it('AC-06-06: sessionId provided → spawn args include --resume <sessionId>', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess([]))
    const adapter = new ClaudeCodeAdapter()

    const params = { ...BASE_PARAMS, sessionId: 'sess-xyz' }
    const gen = adapter.executeNode(params)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of gen) {
      /* drain */
    }

    const spawnArgs: string[] = mockSpawn.mock.calls[0]![1] as string[]
    expect(spawnArgs).toContain('--resume')
    expect(spawnArgs).toContain('sess-xyz')
  })

  it('AC-06-07: no sessionId → spawn args do NOT include --resume', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess([]))
    const adapter = new ClaudeCodeAdapter()

    const gen = adapter.executeNode(BASE_PARAMS)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of gen) {
      /* drain */
    }

    const spawnArgs: string[] = mockSpawn.mock.calls[0]![1] as string[]
    expect(spawnArgs).not.toContain('--resume')
  })

  it('AC-06-08: ANTHROPIC_API_KEY set to params.anthropicKey in spawn env', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess([]))
    const adapter = new ClaudeCodeAdapter()

    const gen = adapter.executeNode(BASE_PARAMS)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of gen) {
      /* drain */
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spawnOpts = mockSpawn.mock.calls[0]![2] as any
    expect(spawnOpts?.env?.ANTHROPIC_API_KEY).toBe('sk-test-key')
  })

  it('multi-block: all content blocks yielded', async () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'thinking', thinking: 'Reasoning...' },
          { type: 'text', text: 'Final answer' },
        ],
      },
    })
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new ClaudeCodeAdapter()
    const events: StreamingNodeEvent[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    expect(events.some((e) => e.kind === 'thinking')).toBe(true)
    expect(events.some((e) => e.kind === 'text')).toBe(true)
    expect(events).toHaveLength(2)
  })
})
