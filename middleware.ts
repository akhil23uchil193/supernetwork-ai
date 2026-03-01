import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  console.log('[middleware] incoming:', pathname)

  // Build a response we can mutate (Supabase needs to refresh cookies)
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write cookies to the outgoing response
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session — this silently re-hydrates the auth token if expired
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    console.error('[middleware] getSession error:', error.message)
  }

  const isAuthenticated = !!session
  console.log('[middleware]', pathname, '| authenticated:', isAuthenticated)

  // ── Redirect authenticated users away from auth pages ────────────────────
  if (isAuthenticated && (pathname === '/login' || pathname === '/signup')) {
    console.log('[middleware] authenticated user hitting auth page → /dashboard/discover')
    return NextResponse.redirect(new URL('/dashboard/discover', request.url))
  }

  // ── Protect /dashboard/* and /settings/* ─────────────────────────────────
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/settings')
  ) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      console.log('[middleware] unauthenticated → redirecting to /login with next:', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── Protect /onboarding/* ─────────────────────────────────────────────────
  if (pathname.startsWith('/onboarding')) {
    if (!isAuthenticated) {
      console.log('[middleware] unauthenticated onboarding access → /login')
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static and _next/image (Next.js internals)
     * - favicon.ico
     * - /auth/callback (must be public so Supabase can POST the code)
     * - API routes
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|api/).*)',
  ],
}
