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

  let body: { receiver_profile_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { receiver_profile_id } = body
  if (!receiver_profile_id) {
    return NextResponse.json({ success: false, error: 'Missing receiver_profile_id.' }, { status: 400 })
  }

  // Get requester's profile
  const { data: viewerProfile, error: vpErr } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (vpErr || !viewerProfile) {
    return NextResponse.json({ success: false, error: 'Your profile was not found.' }, { status: 404 })
  }
  if (viewerProfile.id === receiver_profile_id) {
    return NextResponse.json({ success: false, error: 'Cannot connect with yourself.' }, { status: 400 })
  }

  // Check for an existing connection in either direction
  const { data: existing } = await supabase
    .from('connections')
    .select('id, status')
    .or(
      `and(requester_id.eq.${viewerProfile.id},receiver_id.eq.${receiver_profile_id}),` +
      `and(requester_id.eq.${receiver_profile_id},receiver_id.eq.${viewerProfile.id})`
    )
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { success: false, error: 'A connection already exists.', connection: existing },
      { status: 409 }
    )
  }

  const { data: connection, error: connErr } = await supabase
    .from('connections')
    .insert({ requester_id: viewerProfile.id, receiver_id: receiver_profile_id, status: 'pending' })
    .select('id')
    .single()

  if (connErr || !connection) {
    console.error('[connections/request] insert error:', connErr?.message)
    return NextResponse.json({ success: false, error: connErr?.message ?? 'Failed to create connection.' }, { status: 500 })
  }

  // Notify receiver
  await supabase.from('notifications').insert({
    user_id: receiver_profile_id,
    type: 'connection_request',
    content: `${viewerProfile.name ?? 'Someone'} sent you a connection request`,
    reference_id: connection.id,
  })

  return NextResponse.json({ success: true, connection_id: connection.id })
}
