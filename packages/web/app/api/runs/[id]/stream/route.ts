import type { NextRequest } from 'next/server'
import { Client } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type SseEventPayload =
  | {
      type: 'node_status'
      nodeId: string
      nodeName: string
      nodeKind: string
      nodeStage: number
      status: string
      ts: number
    }
  | { type: 'run_status'; status: string; ts: number }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const databaseUrl = process.env['DATABASE_URL']
  if (!databaseUrl) {
    return new Response(JSON.stringify({ error: 'DATABASE_URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id: runId } = await params

  if (!UUID_RE.test(runId)) {
    return new Response(JSON.stringify({ error: 'Invalid run id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const client = new Client({ connectionString: databaseUrl })

  try {
    await client.connect()
    await client.query('LISTEN "run:' + runId + '"')
  } catch {
    await client.end()
    return new Response(JSON.stringify({ error: 'Failed to connect to database' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const enc = new TextEncoder()
  let streamClosed = false

  const stream = new ReadableStream({
    start(controller) {
      client.on('notification', (msg) => {
        if (msg.channel === 'run:' + runId && msg.payload !== undefined) {
          controller.enqueue(enc.encode('data: ' + msg.payload + '\n\n'))
        }
      })

      client.on('error', (err) => {
        if (!streamClosed) {
          streamClosed = true
          void client.end()
          controller.error(err)
        }
      })

      client.on('end', () => {
        if (!streamClosed) {
          streamClosed = true
          controller.close()
        }
      })

      request.signal.addEventListener('abort', async () => {
        if (streamClosed) return
        try {
          await client.query('UNLISTEN *')
        } catch {
          // connection may already be gone
        } finally {
          try {
            await client.end()
          } catch {
            // ignore
          }
        }
        if (!streamClosed) {
          streamClosed = true
          controller.close()
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
