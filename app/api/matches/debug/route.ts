/**
 * GET /api/matches/debug?profile_id=<id>
 * Returns match counts and top matches for a profile. Dev/debug only.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const profile_id = request.nextUrl.searchParams.get('profile_id')
  if (!profile_id) {
    return NextResponse.json({ error: 'Missing profile_id query param' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  const [matchesRes, totalProfilesRes] = await Promise.all([
    admin
      .from('matches')
      .select('id, matched_profile_id, score, one_liner, explanation, computed_at')
      .eq('user_id', profile_id)
      .order('score', { ascending: false })
      .limit(10),
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true),
  ])

  return NextResponse.json({
    profile_id,
    total_public_profiles: totalProfilesRes.count ?? 0,
    matches_found: matchesRes.data?.length ?? 0,
    matches_error: matchesRes.error?.message ?? null,
    top_matches: (matchesRes.data ?? []).map((m) => ({
      matched_profile_id: m.matched_profile_id,
      score: m.score,
      one_liner: m.one_liner,
      has_explanation: !!m.explanation,
      computed_at: m.computed_at,
    })),
  })
}
