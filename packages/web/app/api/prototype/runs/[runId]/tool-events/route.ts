import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@honeyai/db'
import { events, nodes, runs } from '@honeyai/db/schema'
import { auth } from '@/lib/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TOOL_LABELS: Record<string, string> = {
  Read: '读取文件',
  Write: '写入文件',
  Edit: '编辑文件',
  Bash: '执行命令',
  Grep: '搜索内容',
  Glob: '查找文件',
  WebFetch: '请求网页',
  WebSearch: '网页搜索',
  Task: '调用子任务',
}

function extractSummary(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case 'Read':
      return String(args['file_path'] ?? args['path'] ?? '')
    case 'Write':
    case 'Edit':
      return String(args['file_path'] ?? args['path'] ?? '')
    case 'Bash':
      return String(args['command'] ?? '').slice(0, 120)
    case 'Grep':
      return `"${args['pattern'] ?? ''}" in ${args['path'] ?? '.'}`
    case 'Glob':
      return String(args['pattern'] ?? '')
    case 'WebFetch':
      return String(args['url'] ?? '')
    case 'WebSearch':
      return String(args['query'] ?? '')
    default:
      return JSON.stringify(args).slice(0, 100)
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { runId } = await params
  if (!UUID_RE.test(runId)) {
    return NextResponse.json({ error: 'Invalid runId' }, { status: 400 })
  }

  const db = getDb()

  // Verify tenant ownership
  const runRows = await db
    .select({ tenantId: runs.tenantId })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1)

  if (!runRows[0] || runRows[0].tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Get all tool_use events with their node stage info
  const toolEventRows = await db
    .select({
      id: events.id,
      seq: events.seq,
      payload: events.payload,
      occurredAt: events.occurredAt,
      nodeId: events.nodeId,
      stage: nodes.stage,
      nodeName: nodes.name,
    })
    .from(events)
    .leftJoin(nodes, eq(events.nodeId, nodes.id))
    .where(and(eq(events.runId, runId), eq(events.kind, 'tool_use')))
    .orderBy(events.seq)
    .limit(500)

  const toolEvents = toolEventRows.map((row) => {
    const payload = row.payload as { tool?: string; args?: Record<string, unknown> }
    const tool = payload.tool ?? 'Unknown'
    const args = payload.args ?? {}
    return {
      id: row.id,
      seq: row.seq.toString(),
      tool,
      label: TOOL_LABELS[tool] ?? tool,
      summary: extractSummary(tool, args),
      args,
      occurredAt: row.occurredAt,
      nodeId: row.nodeId,
      stage: row.stage ?? null,
      nodeName: row.nodeName ?? null,
    }
  })

  // Group by stage
  const byStage: Record<number, typeof toolEvents> = {}
  const noStage: typeof toolEvents = []
  for (const ev of toolEvents) {
    if (ev.stage !== null) {
      if (!byStage[ev.stage]) byStage[ev.stage] = []
      byStage[ev.stage].push(ev)
    } else {
      noStage.push(ev)
    }
  }

  return NextResponse.json({
    total: toolEvents.length,
    byStage,
    noStage,
    all: toolEvents,
  })
}
