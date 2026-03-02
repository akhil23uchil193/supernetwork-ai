import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// POST: create a "message" notification for the other participant in a connection
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

  // Get sender's profile
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!senderProfile) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
  }

  // Verify sender is a participant and get the receiver's profile id
  const { data: conn } = await supabase
    .from('connections')
    .select('id, requester_id, receiver_id, status')
    .eq('id', connection_id)
    .or(`requester_id.eq.${senderProfile.id},receiver_id.eq.${senderProfile.id}`)
    .eq('status', 'accepted')
    .maybeSingle()

  if (!conn) {
    return NextResponse.json({ success: false, error: 'Connection not found or not accepted' }, { status: 403 })
  }

  const receiverProfileId =
    conn.requester_id === senderProfile.id ? conn.receiver_id : conn.requester_id

  // Use service role to bypass RLS INSERT restriction on notifications
  const admin = createServiceRoleClient()
  await admin.from('notifications').insert({
    user_id:      receiverProfileId,
    type:         'message',
    content:      `${senderProfile.name ?? 'Someone'} sent you a message`,
    reference_id: connection_id,
  })

  return NextResponse.json({ success: true })
}
