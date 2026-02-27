// Auth protection is handled at the page level via useSession / getServerSideProps.
// This middleware is intentionally minimal to avoid Edge Runtime / NEXTAUTH_SECRET issues.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
