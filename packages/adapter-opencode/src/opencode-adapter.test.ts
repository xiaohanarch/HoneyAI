import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { OpenCodeAdapter } from './opencode-adapter.js'
import type { ExecuteNodeParams, StreamingNodeEvent } from '@honeyai/core'

// ─── Mock setup ──────────────────────────────────────────────────────────────

const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: mockSpawn }))

/** Build a fake child process emitting given stdout lines then exiting */
function makeFakeProcess(lines: string[], exitCode = 0) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()

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

// ─── opencode event builders ──────────────────────────────────────────────────

function makeTextEvent(text: string, sessionID = 'sess-1') {
  return JSON.stringify({
    type: 'text',
    timestamp: Date.now(),
    sessionID,
    part: { id: 'part-1', type: 'text', text, time: { start: Date.now(), end: Date.now() } },
  })
}

function makeToolUseEvent(
  tool: string,
  input: Record<string, unknown>,
  output: string,
  sessionID = 'sess-1',
) {
  return JSON.stringify({
    type: 'tool_use',
    timestamp: Date.now(),
    sessionID,
    part: {
      callID: 'call-1',
      tool,
      state: {
        status: 'completed',
        input,
        output,
        title: tool,
        metadata: {},
        time: { start: Date.now(), end: Date.now() },
      },
    },
  })
}

function makeStepFinishEvent(
  reason: 'stop' | 'tool-calls',
  tokens: { input: number; output: number },
  sessionID = 'sess-1',
) {
  return JSON.stringify({
    type: 'step_finish',
    timestamp: Date.now(),
    sessionID,
    part: {
      type: 'step-finish',
      reason,
      snapshot: 'abc123',
      cost: 0.01,
      tokens: { input: tokens.input, output: tokens.output, reasoning: 0 },
    },
  })
}

function makeStepStartEvent(sessionID = 'sess-1') {
  return JSON.stringify({
    type: 'step_start',
    timestamp: Date.now(),
    sessionID,
    part: { id: 'part-0', sessionID, messageID: 'msg-1', type: 'step-start', snapshot: 'abc123' },
  })
}

function makeErrorEvent(message: string, sessionID = 'sess-1') {
  return JSON.stringify({
    type: 'error',
    timestamp: Date.now(),
    sessionID,
    error: { name: 'AgentError', data: { message } },
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OpenCodeAdapter', () => {
  beforeEach(() => {
    mockSpawn.mockReset()
  })

  it('AC-07-01: text event maps to StreamingNodeEvent{kind:text}', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess([makeTextEvent('Hello world')]))

    const adapter = new OpenCodeAdapter()
    const events: StreamingNodeEvent[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    const text = events.find((e) => e.kind === 'text')
    expect(text).toBeDefined()
    expect(text!.content).toBe('Hello world')
  })

  it('AC-07-02: tool_use event maps to tool_call then tool_result events', async () => {
    const line = makeToolUseEvent('Read', { file_path: '/foo.ts' }, 'file contents here')
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new OpenCodeAdapter()
    const events: StreamingNodeEvent[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    const toolCall = events.find((e) => e.kind === 'tool_call')
    expect(toolCall).toBeDefined()
    expect(toolCall!.tool).toBe('Read')
    expect(toolCall!.args).toEqual({ file_path: '/foo.ts' })

    const toolResult = events.find((e) => e.kind === 'tool_result')
    expect(toolResult).toBeDefined()
    expect(toolResult!.tool).toBe('Read')
    expect(toolResult!.outputLen).toBe('file contents here'.length)
  })

  it('AC-07-03: step_finish reason:stop maps to StreamingNodeEvent{kind:finish,reason:end_turn}', async () => {
    const line = makeStepFinishEvent('stop', { input: 1000, output: 500 })
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new OpenCodeAdapter()
    const events: StreamingNodeEvent[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    const finish = events.find((e) => e.kind === 'finish')
    expect(finish).toBeDefined()
    expect(finish!.reason).toBe('end_turn')
    expect(finish!.inputTokens).toBe(1000)
    expect(finish!.outputTokens).toBe(500)
  })

  it('AC-07-04: step_finish reason:tool-calls is skipped (intermediate step)', async () => {
    const line = makeStepFinishEvent('tool-calls', { input: 100, output: 50 })
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new OpenCodeAdapter()
    const events: StreamingNodeEvent[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    expect(events.find((e) => e.kind === 'finish')).toBeUndefined()
  })

  it('AC-07-05: step_start event is skipped (no corresponding StreamingNodeEvent)', async () => {
    const line = makeStepStartEvent()
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new OpenCodeAdapter()
    const events: StreamingNodeEvent[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    expect(events).toHaveLength(0)
  })

  it('AC-07-06: error event maps to StreamingNodeEvent{kind:error}', async () => {
    const line = makeErrorEvent('something went wrong')
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new OpenCodeAdapter()
    const events: StreamingNodeEvent[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    const error = events.find((e) => e.kind === 'error')
    expect(error).toBeDefined()
    expect(error!.content).toBe('something went wrong')
  })

  it('AC-07-07: sessionId provided → spawn args include --session <sessionId>', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess([]))
    const adapter = new OpenCodeAdapter()

    const params = { ...BASE_PARAMS, sessionId: 'sess-xyz' }
    const gen = adapter.executeNode(params)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of gen) {
      /* drain */
    }

    const spawnArgs: string[] = mockSpawn.mock.calls[0]![1] as string[]
    expect(spawnArgs).toContain('--session')
    expect(spawnArgs).toContain('sess-xyz')
  })

  it('AC-07-08: no sessionId → spawn args do NOT include --session', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess([]))
    const adapter = new OpenCodeAdapter()

    const gen = adapter.executeNode(BASE_PARAMS)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of gen) {
      /* drain */
    }

    const spawnArgs: string[] = mockSpawn.mock.calls[0]![1] as string[]
    expect(spawnArgs).not.toContain('--session')
  })

  it('spawn uses ANTHROPIC_API_KEY from params', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess([]))
    const adapter = new OpenCodeAdapter()

    const gen = adapter.executeNode(BASE_PARAMS)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of gen) {
      /* drain */
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spawnOpts = mockSpawn.mock.calls[0]![2] as any
    expect(spawnOpts?.env?.ANTHROPIC_API_KEY).toBe('sk-test-key')
  })

  it('non-zero exit code without terminal event emits error event', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess([], 1))

    const adapter = new OpenCodeAdapter()
    const events: StreamingNodeEvent[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    const error = events.find((e) => e.kind === 'error')
    expect(error).toBeDefined()
    expect(error!.content).toContain('1')
  })

  it('multi-event sequence: text + finish both yielded', async () => {
    const lines = [
      makeTextEvent('Partial output'),
      makeStepFinishEvent('stop', { input: 200, output: 100 }),
    ]
    mockSpawn.mockReturnValue(makeFakeProcess(lines))

    const adapter = new OpenCodeAdapter()
    const events: StreamingNodeEvent[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    expect(events.some((e) => e.kind === 'text')).toBe(true)
    expect(events.some((e) => e.kind === 'finish')).toBe(true)
  })

  it('tool_use with non-completed status emits tool_call but NOT tool_result', async () => {
    // opencode may emit tool_use at intermediate states (e.g. status='running')
    const line = JSON.stringify({
      type: 'tool_use',
      timestamp: Date.now(),
      sessionID: 'sess-1',
      part: {
        callID: 'call-1',
        tool: 'Bash',
        state: { status: 'running', input: { command: 'ls' }, title: 'Bash' },
      },
    })
    mockSpawn.mockReturnValue(makeFakeProcess([line]))

    const adapter = new OpenCodeAdapter()
    const events: StreamingNodeEvent[] = []
    for await (const e of adapter.executeNode(BASE_PARAMS)) {
      events.push(e)
    }

    expect(events.find((e) => e.kind === 'tool_call')).toBeDefined()
    expect(events.find((e) => e.kind === 'tool_result')).toBeUndefined()
  })

  it('default model appears in spawn args', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess([]))
    const adapter = new OpenCodeAdapter() // default model

    const gen = adapter.executeNode(BASE_PARAMS)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of gen) {
      /* drain */
    }

    const spawnArgs: string[] = mockSpawn.mock.calls[0]![1] as string[]
    expect(spawnArgs).toContain('anthropic/claude-sonnet-4-6')
  })

  it('custom model passed to constructor appears in spawn args', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess([]))
    const adapter = new OpenCodeAdapter('anthropic/claude-opus-4-6')

    const gen = adapter.executeNode(BASE_PARAMS)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of gen) {
      /* drain */
    }

    const spawnArgs: string[] = mockSpawn.mock.calls[0]![1] as string[]
    expect(spawnArgs).toContain('anthropic/claude-opus-4-6')
  })
})
