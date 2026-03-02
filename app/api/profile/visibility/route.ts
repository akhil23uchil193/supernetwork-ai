import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 })
  }

  let body: { is_public?: boolean }
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.is_public !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Missing or invalid is_public.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_public: body.is_public })
    .eq('user_id', session.user.id)

  if (error) {
    console.error('[profile/visibility] update error:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
