import type { NextRequest } from 'next/server'

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

export const MOCK_EVENTS: SseEventPayload[] = [
  {
    type: 'node_status',
    nodeId: 'req-agent',
    nodeName: '需求富化',
    nodeKind: 'agent',
    nodeStage: 1,
    status: 'running',
    ts: 0,
  },
  {
    type: 'node_status',
    nodeId: 'req-agent',
    nodeName: '需求富化',
    nodeKind: 'agent',
    nodeStage: 1,
    status: 'success',
    ts: 0,
  },
  {
    type: 'node_status',
    nodeId: 'gate-1',
    nodeName: 'Gate 1',
    nodeKind: 'gate',
    nodeStage: 1,
    status: 'running',
    ts: 0,
  },
  { type: 'run_status', status: 'paused_at_gate', ts: 0 },
  {
    type: 'node_status',
    nodeId: 'design-agent',
    nodeName: '设计拆解',
    nodeKind: 'agent',
    nodeStage: 2,
    status: 'running',
    ts: 0,
  },
  {
    type: 'node_status',
    nodeId: 'design-agent',
    nodeName: '设计拆解',
    nodeKind: 'agent',
    nodeStage: 2,
    status: 'success',
    ts: 0,
  },
  {
    type: 'node_status',
    nodeId: 'gate-2',
    nodeName: 'Gate 2',
    nodeKind: 'gate',
    nodeStage: 2,
    status: 'running',
    ts: 0,
  },
  {
    type: 'node_status',
    nodeId: 'dev-agent',
    nodeName: '编码 + UT',
    nodeKind: 'agent',
    nodeStage: 3,
    status: 'running',
    ts: 0,
  },
  { type: 'run_status', status: 'completed', ts: 0 },
]

function sseMessage(data: SseEventPayload): string {
  return `data: ${JSON.stringify({ ...data, ts: Date.now() })}\n\n`
}

export async function GET(request: NextRequest) {
  const interval = Number(request.nextUrl.searchParams.get('interval') ?? '2000')

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      for (const event of MOCK_EVENTS) {
        controller.enqueue(enc.encode(sseMessage(event)))
        if (interval > 0) {
          await new Promise((resolve) => setTimeout(resolve, interval))
        }
      }
      controller.close()
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
