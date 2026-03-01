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
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { connection_id } = body
  if (!connection_id) {
    return NextResponse.json({ success: false, error: 'Missing connection_id.' }, { status: 400 })
  }

  // Get requester's profile
  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!viewerProfile) {
    return NextResponse.json({ success: false, error: 'Your profile was not found.' }, { status: 404 })
  }

  // Verify the connection is pending and belongs to this requester
  const { data: connection } = await supabase
    .from('connections')
    .select('id')
    .eq('id', connection_id)
    .eq('requester_id', viewerProfile.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ success: false, error: 'Connection not found or cannot be cancelled.' }, { status: 404 })
  }

  // Use service role to delete (no DELETE policy in RLS)
  const admin = createServiceRoleClient()
  const { error: deleteErr } = await admin
    .from('connections')
    .delete()
    .eq('id', connection_id)

  if (deleteErr) {
    console.error('[connections/cancel] delete error:', deleteErr.message)
    return NextResponse.json({ success: false, error: deleteErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
