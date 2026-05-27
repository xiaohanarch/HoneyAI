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
  const client = new Client({ connectionString: databaseUrl })

  try {
    await client.connect()
    await client.query('LISTEN "run:' + runId + '"')
  } catch (err) {
    await client.end()
    return new Response(JSON.stringify({ error: 'Failed to connect to database' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const enc = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      client.on('notification', (msg) => {
        if (msg.channel === 'run:' + runId) {
          controller.enqueue(enc.encode('data: ' + msg.payload + '\n\n'))
        }
      })

      client.on('error', (err) => {
        controller.error(err)
      })

      request.signal.addEventListener('abort', async () => {
        try {
          await client.query('UNLISTEN *')
        } finally {
          await client.end()
        }
        controller.close()
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
