// packages/web/middleware.ts
// Passthrough middleware stub — multi-tenant slug parsing lands in slice 4.5.
// Matcher covers all routes except Next.js internals and static files.
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(_request: NextRequest): NextResponse {
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
