import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 })
  }

  let body: { blocked_profile_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { blocked_profile_id } = body
  if (!blocked_profile_id) {
    return NextResponse.json({ success: false, error: 'Missing blocked_profile_id.' }, { status: 400 })
  }

  // Get blocker's profile
  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!viewerProfile) {
    return NextResponse.json({ success: false, error: 'Your profile was not found.' }, { status: 404 })
  }
  if (viewerProfile.id === blocked_profile_id) {
    return NextResponse.json({ success: false, error: 'Cannot block yourself.' }, { status: 400 })
  }

  // Upsert block (idempotent)
  const { error: blockErr } = await supabase
    .from('blocks')
    .upsert(
      { blocker_id: viewerProfile.id, blocked_id: blocked_profile_id },
      { onConflict: 'blocker_id,blocked_id' }
    )

  if (blockErr) {
    console.error('[blocks] upsert error:', blockErr.message)
    return NextResponse.json({ success: false, error: blockErr.message }, { status: 500 })
  }

  // Remove any existing connections between them
  await supabase
    .from('connections')
    .delete()
    .or(
      `and(requester_id.eq.${viewerProfile.id},receiver_id.eq.${blocked_profile_id}),` +
      `and(requester_id.eq.${blocked_profile_id},receiver_id.eq.${viewerProfile.id})`
    )

  return NextResponse.json({ success: true })
}
