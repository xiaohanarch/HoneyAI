import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

// -----------------------------------------------------------------------
// pg mock — must be hoisted before any import of route.ts
// -----------------------------------------------------------------------
let notifyHandler: ((msg: { channel: string; payload: string }) => void) | null = null
let abortHandler: (() => void) | null = null

const mockClientInstance = {
  connect: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue(undefined),
  on: vi.fn().mockImplementation((event: string, handler: unknown) => {
    if (event === 'notification') {
      notifyHandler = handler as (msg: { channel: string; payload: string }) => void
    }
  }),
  end: vi.fn().mockResolvedValue(undefined),
}

vi.mock('pg', () => {
  const MockClient = vi.fn().mockImplementation(() => mockClientInstance)
  return { Client: MockClient }
})

// Import AFTER mock is registered
const { GET } = await import('./route')

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function makeRequest(runId: string, signal?: AbortSignal) {
  return {
    signal: signal ?? new AbortController().signal,
  } as unknown as NextRequest
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------
describe('SSE stream route — pg LISTEN', () => {
  const originalDatabaseUrl = process.env['DATABASE_URL']

  beforeEach(() => {
    vi.clearAllMocks()
    notifyHandler = null
    abortHandler = null
    mockClientInstance.connect.mockResolvedValue(undefined)
    mockClientInstance.query.mockResolvedValue(undefined)
    mockClientInstance.end.mockResolvedValue(undefined)
    mockClientInstance.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'notification') {
        notifyHandler = handler as (msg: { channel: string; payload: string }) => void
      }
    })
    process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/testdb'
  })

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL']
    } else {
      process.env['DATABASE_URL'] = originalDatabaseUrl
    }
  })

  it('AC-02-08: GET /api/runs/[id]/stream returns 500 when DATABASE_URL not set', async () => {
    delete process.env['DATABASE_URL']
    const res = await GET(makeRequest('run-123'), { params: Promise.resolve({ id: 'run-123' }) })
    expect(res.status).toBe(500)
  })

  it('AC-02-09: GET /api/runs/[id]/stream returns text/event-stream content-type', async () => {
    const res = await GET(makeRequest('run-123'), { params: Promise.resolve({ id: 'run-123' }) })
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
  })

  it('AC-02-10: GET /api/runs/[id]/stream calls LISTEN with correct channel', async () => {
    await GET(makeRequest('run-123'), { params: Promise.resolve({ id: 'run-123' }) })
    const queryCalls = mockClientInstance.query.mock.calls
    const listenCall = queryCalls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('run:run-123'),
    )
    expect(listenCall).toBeDefined()
  })

  it('AC-02-11: GET /api/runs/[id]/stream forwards pg notification payload as SSE data', async () => {
    const res = await GET(makeRequest('run-123'), { params: Promise.resolve({ id: 'run-123' }) })

    // Trigger the captured notification handler
    expect(notifyHandler).not.toBeNull()
    const payload = '{"type":"run_status","status":"running"}'
    notifyHandler!({ channel: 'run:run-123', payload })

    // Read the first chunk from the readable stream
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const chunk = new TextDecoder().decode(value)

    expect(chunk).toContain('data: ' + payload)
    reader.cancel()
  })

  it('AC-02-12: GET /api/runs/[id]/stream calls UNLISTEN and client.end on abort', async () => {
    const ac = new AbortController()

    // Capture abort handler from request.signal.addEventListener
    const mockSignal = {
      addEventListener: vi.fn().mockImplementation((event: string, handler: unknown) => {
        if (event === 'abort') {
          abortHandler = handler as () => void
        }
      }),
    } as unknown as AbortSignal

    const req = { signal: mockSignal } as unknown as NextRequest
    await GET(req, { params: Promise.resolve({ id: 'run-123' }) })

    expect(abortHandler).not.toBeNull()

    // Trigger abort
    await abortHandler!()

    // Flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0))

    const queryCalls = mockClientInstance.query.mock.calls
    const unlistenCall = queryCalls.find(
      (args) => typeof args[0] === 'string' && args[0].toUpperCase().includes('UNLISTEN'),
    )
    expect(unlistenCall).toBeDefined()
    expect(mockClientInstance.end).toHaveBeenCalled()

    // Suppress unused variable warning
    void ac
  })
})
