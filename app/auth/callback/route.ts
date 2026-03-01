import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { PROFILE_COMPLETION_THRESHOLD } from '@/lib/constants'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard/discover'

  console.log('[auth/callback] GET — code present:', !!code, 'next:', next)

  if (!code) {
    console.error('[auth/callback] missing code param, redirecting to /login')
    return NextResponse.redirect(`${origin}/login`)
  }

  const supabase = createServerClient()

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    console.error('[auth/callback] code exchange failed:', error?.message)
    return NextResponse.redirect(`${origin}/login?error=callback_failed`)
  }

  const userId = data.session.user.id
  console.log('[auth/callback] session established, userId:', userId)

  // ── Determine redirect based on profile state ─────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, profile_completion_score')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) {
    console.error('[auth/callback] profile fetch error:', profileError.message)
  }

  if (!profile) {
    console.log('[auth/callback] new user — no profile → /onboarding/start')
    return NextResponse.redirect(`${origin}/onboarding/start`)
  }

  console.log('[auth/callback] profile score:', profile.profile_completion_score)

  if (profile.profile_completion_score >= PROFILE_COMPLETION_THRESHOLD) {
    console.log('[auth/callback] complete profile → /dashboard/discover')
    return NextResponse.redirect(`${origin}/dashboard/discover`)
  }

  console.log('[auth/callback] incomplete profile → /dashboard/discover?banner=incomplete')
  return NextResponse.redirect(`${origin}/dashboard/discover?banner=incomplete`)
}
