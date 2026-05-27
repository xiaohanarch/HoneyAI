import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    tenantId: session.user.tenantId,
    tenantSlug: session.user.tenantSlug,
    userId: session.user.id,
    name: session.user.name,
  })
}
