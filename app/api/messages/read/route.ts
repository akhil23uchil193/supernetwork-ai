import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 })
  }

  let body: { connection_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { connection_id } = body
  if (!connection_id) {
    return NextResponse.json({ success: false, error: 'Missing connection_id' }, { status: 400 })
  }

  // Get viewer's profile id
  const { data: vp } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!vp) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
  }

  // Verify viewer is a participant in this connection
  const { data: conn } = await supabase
    .from('connections')
    .select('id')
    .eq('id', connection_id)
    .or(`requester_id.eq.${vp.id},receiver_id.eq.${vp.id}`)
    .maybeSingle()

  if (!conn) {
    return NextResponse.json({ success: false, error: 'Not a participant' }, { status: 403 })
  }

  // Use service role to update — the messages table has no UPDATE RLS policy
  const admin = createServiceRoleClient()
  await admin
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('connection_id', connection_id)
    .neq('sender_id', vp.id)
    .is('read_at', null)

  return NextResponse.json({ success: true })
}
