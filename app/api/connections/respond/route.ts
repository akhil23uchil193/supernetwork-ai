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

  let body: { connection_id?: string; action?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { connection_id, action } = body
  if (!connection_id || (action !== 'accept' && action !== 'reject')) {
    return NextResponse.json({ success: false, error: 'Missing or invalid parameters.' }, { status: 400 })
  }

  // Get responder's profile
  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!viewerProfile) {
    return NextResponse.json({ success: false, error: 'Your profile was not found.' }, { status: 404 })
  }

  // Verify the connection exists, is pending, and this user is the receiver
  const { data: connection } = await supabase
    .from('connections')
    .select('id, requester_id, status')
    .eq('id', connection_id)
    .eq('receiver_id', viewerProfile.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ success: false, error: 'Connection not found or already resolved.' }, { status: 404 })
  }

  const newStatus = action === 'accept' ? 'accepted' : 'rejected'

  const { error: updateErr } = await supabase
    .from('connections')
    .update({ status: newStatus })
    .eq('id', connection_id)

  if (updateErr) {
    console.error('[connections/respond] update error:', updateErr.message)
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 })
  }

  // Notify requester when accepted — skip if a block exists in either direction
  if (action === 'accept') {
    const { data: blockForNotif } = await supabase
      .from('blocks')
      .select('id')
      .or(
        `and(blocker_id.eq.${viewerProfile.id},blocked_id.eq.${connection.requester_id}),` +
        `and(blocker_id.eq.${connection.requester_id},blocked_id.eq.${viewerProfile.id})`
      )
      .maybeSingle()

    if (!blockForNotif) {
      await supabase.from('notifications').insert({
        user_id: connection.requester_id,
        type: 'connection_request',
        content: `${(viewerProfile as { id: string; name: string | null }).name ?? 'Someone'} accepted your connection request`,
        reference_id: connection_id,
      })
    }
  }

  return NextResponse.json({ success: true })
}
