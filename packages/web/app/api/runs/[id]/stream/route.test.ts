import { describe, it, expect } from 'vitest'
import { GET, MOCK_EVENTS } from './route'

// Minimal NextRequest mock
function makeRequest(params = {}) {
  return {
    nextUrl: { searchParams: { get: (key: string) => (key === 'interval' ? '0' : null) } },
    ...params,
  } as never
}

async function collectSSE(response: Response): Promise<string[]> {
  const text = await response.text()
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((chunk) => chunk.replace(/^data: /, '').trim())
    .filter(Boolean)
}

describe('AC-07-07: SSE stream route', () => {
  it('AC-07-07: returns text/event-stream content-type', async () => {
    const res = await GET(makeRequest())
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
  })

  it('AC-07-07: streams all 9 mock events', async () => {
    const res = await GET(makeRequest())
    const messages = await collectSSE(res)
    expect(messages).toHaveLength(MOCK_EVENTS.length)
  })

  it('AC-07-07: first event is node_status for req-agent running', async () => {
    const res = await GET(makeRequest())
    const messages = await collectSSE(res)
    const first = JSON.parse(messages[0]!)
    expect(first.type).toBe('node_status')
    expect(first.nodeId).toBe('req-agent')
    expect(first.status).toBe('running')
  })

  it('AC-07-07: event 4 is run_status paused_at_gate', async () => {
    const res = await GET(makeRequest())
    const messages = await collectSSE(res)
    const fourth = JSON.parse(messages[3]!)
    expect(fourth.type).toBe('run_status')
    expect(fourth.status).toBe('paused_at_gate')
  })

  it('AC-07-07: last event is run_status completed', async () => {
    const res = await GET(makeRequest())
    const messages = await collectSSE(res)
    const last = JSON.parse(messages[messages.length - 1]!)
    expect(last.type).toBe('run_status')
    expect(last.status).toBe('completed')
  })
})
