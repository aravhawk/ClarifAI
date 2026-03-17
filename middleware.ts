import { type NextRequest, NextResponse } from 'next/server'

// Middleware is intentionally lightweight: session verification happens in
// individual API routes via requireAuth(). Anonymous sign-in is handled
// client-side by useAuth. This avoids importing firebase-admin in the edge runtime.
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, icons, manifest (public assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
