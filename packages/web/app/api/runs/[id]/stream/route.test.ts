import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

// -----------------------------------------------------------------------
// pg mock — must be hoisted before any import of route.ts
// -----------------------------------------------------------------------
let notifyHandler: ((msg: { channel: string; payload: string | undefined }) => void) | null = null
let abortHandler: (() => Promise<void>) | null = null
let endHandler: (() => void) | null = null

const mockClientInstance = {
  connect: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue(undefined),
  on: vi.fn().mockImplementation((event: string, handler: unknown) => {
    if (event === 'notification') {
      notifyHandler = handler as (msg: { channel: string; payload: string | undefined }) => void
    }
    if (event === 'end') {
      endHandler = handler as () => void
    }
  }),
  end: vi.fn().mockResolvedValue(undefined),
}

vi.mock('pg', () => {
  const MockClient = vi.fn().mockImplementation(() => mockClientInstance)
  return { Client: MockClient }
})

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { tenantId: 'tenant-1', id: 'user-1' } }),
}))

// Import AFTER mock is registered
const { GET } = await import('./route')
import { auth } from '@/lib/auth'

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function makeRequest(signal?: AbortSignal) {
  return {
    signal: signal ?? new AbortController().signal,
  } as unknown as NextRequest
}

function makeRequestWithAbortCapture() {
  const mockSignal = {
    addEventListener: vi.fn().mockImplementation((event: string, handler: unknown) => {
      if (event === 'abort') {
        abortHandler = handler as () => Promise<void>
      }
    }),
  } as unknown as AbortSignal
  return { signal: mockSignal } as unknown as NextRequest
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
    endHandler = null
    mockClientInstance.connect.mockResolvedValue(undefined)
    mockClientInstance.query.mockResolvedValue(undefined)
    mockClientInstance.end.mockResolvedValue(undefined)
    mockClientInstance.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'notification') {
        notifyHandler = handler as (msg: { channel: string; payload: string | undefined }) => void
      }
      if (event === 'end') {
        endHandler = handler as () => void
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
    vi.mocked(auth).mockResolvedValueOnce({ user: { tenantId: 'tenant-1', id: 'user-1' } } as never)
    delete process.env['DATABASE_URL']
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'run-123' }) })
    expect(res.status).toBe(500)
  })

  it('AC-02-23: GET returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null)
    const req = new Request('http://localhost/api/runs/11111111-1111-1111-1111-111111111111/stream')
    const res = await GET(req as NextRequest, {
      params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }),
    })
    expect(res.status).toBe(401)
  })

  it('AC-02-08b: GET /api/runs/[id]/stream returns 400 when runId is not a valid UUID', async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
  })

  it('AC-02-09: GET /api/runs/[id]/stream returns text/event-stream content-type', async () => {
    const validId = '01234567-89ab-cdef-0123-456789abcdef'
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: validId }) })
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
  })

  it('AC-02-10: GET /api/runs/[id]/stream calls LISTEN with correct channel', async () => {
    const validId = '01234567-89ab-cdef-0123-456789abcdef'
    await GET(makeRequest(), { params: Promise.resolve({ id: validId }) })
    const queryCalls = mockClientInstance.query.mock.calls
    const listenCall = queryCalls.find(
      (args) => typeof args[0] === 'string' && args[0].includes(validId),
    )
    expect(listenCall).toBeDefined()
  })

  it('AC-02-11: GET /api/runs/[id]/stream forwards pg notification payload as SSE data', async () => {
    const validId = '01234567-89ab-cdef-0123-456789abcdef'
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: validId }) })

    // Trigger the captured notification handler
    expect(notifyHandler).not.toBeNull()
    const payload = '{"type":"run_status","status":"running"}'
    notifyHandler!({ channel: 'run:' + validId, payload })

    // Read the first chunk from the readable stream
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const chunk = new TextDecoder().decode(value)

    expect(chunk).toContain('data: ' + payload)
    reader.cancel()
  })

  it('AC-02-12: GET /api/runs/[id]/stream calls UNLISTEN and client.end on abort', async () => {
    const validId = '01234567-89ab-cdef-0123-456789abcdef'
    const req = makeRequestWithAbortCapture()
    await GET(req, { params: Promise.resolve({ id: validId }) })

    expect(abortHandler).not.toBeNull()

    // Make UNLISTEN throw to verify client.end() is still called
    mockClientInstance.query.mockRejectedValueOnce(new Error('connection gone'))

    await abortHandler!()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const queryCalls = mockClientInstance.query.mock.calls
    const unlistenCall = queryCalls.find(
      (args) => typeof args[0] === 'string' && args[0].toUpperCase().includes('UNLISTEN'),
    )
    expect(unlistenCall).toBeDefined()
    expect(mockClientInstance.end).toHaveBeenCalled()
  })

  it('AC-02-13: stream closes when pg client emits end event', async () => {
    const validId = '01234567-89ab-cdef-0123-456789abcdef'
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: validId }) })

    expect(endHandler).not.toBeNull()

    // Fire the end event — should close the stream
    endHandler!()

    // The stream should be closed — reading returns done: true
    const reader = res.body!.getReader()
    const { done } = await reader.read()
    expect(done).toBe(true)
  })
})
