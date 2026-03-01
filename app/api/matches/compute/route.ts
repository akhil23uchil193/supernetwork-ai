import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { openai } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase/server'
import type { Profile, MatchCriteria } from '@/types'

export const runtime = 'nodejs'

const MATCH_BATCH = 20 // profiles to compare against at a time

export async function POST(request: NextRequest) {
  console.log('[matches/compute] POST received')

  const supabase = createServerClient()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session) {
    console.error('[matches/compute] unauthenticated')
    return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 })
  }

  let body: { profile_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { profile_id } = body
  if (!profile_id) {
    return NextResponse.json({ success: false, error: 'Missing profile_id.' }, { status: 400 })
  }

  console.log('[matches/compute] computing matches for profile:', profile_id)

  // Fetch the requesting profile with its match criteria
  const { data: sourceProfile, error: sourceErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profile_id)
    .single()

  if (sourceErr || !sourceProfile) {
    console.error('[matches/compute] source profile not found:', sourceErr?.message)
    return NextResponse.json({ success: false, error: 'Profile not found.' }, { status: 404 })
  }

  const source = sourceProfile as Profile
  console.log('[matches/compute] source profile:', source.name)

  // Fetch other public profiles (exclude self)
  const { data: candidates, error: candidatesErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_public', true)
    .neq('id', profile_id)
    .limit(MATCH_BATCH)

  if (candidatesErr) {
    console.error('[matches/compute] candidates fetch error:', candidatesErr.message)
    return NextResponse.json({ success: false, error: 'Failed to fetch candidates.' }, { status: 500 })
  }

  console.log('[matches/compute] candidates found:', candidates?.length ?? 0)

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ success: true, data: { matches_created: 0 } })
  }

  // Score each candidate with OpenAI
  const matchRows: {
    user_id: string
    matched_profile_id: string
    score: number
    one_liner: string
    explanation: string | null
  }[] = []

  const criteria = source.match_criteria as MatchCriteria | null

  for (const candidate of candidates as Profile[]) {
    try {
      const prompt = `Score the compatibility between these two professionals on a scale of 0.0 to 1.0.
Return ONLY a JSON object: { "score": number, "one_liner": "string (max 8 words why they match)" }

Person A: ${JSON.stringify({
        name: source.name,
        skills: source.skills,
        intent: source.intent,
        ikigai_mission: source.ikigai_mission,
        match_criteria: criteria,
      })}

Person B: ${JSON.stringify({
        name: candidate.name,
        skills: candidate.skills,
        intent: candidate.intent,
        ikigai_mission: candidate.ikigai_mission,
      })}`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      })

      const raw = completion.choices[0]?.message?.content ?? '{}'
      const result = JSON.parse(raw) as { score: number; one_liner: string }

      matchRows.push({
        user_id: profile_id,
        matched_profile_id: candidate.id,
        score: Math.min(1, Math.max(0, result.score ?? 0.5)),
        one_liner: result.one_liner ?? 'Compatible professionals',
        explanation: null,
      })
    } catch (err) {
      console.error('[matches/compute] scoring error for candidate', candidate.id, ':', err)
      // Skip this candidate rather than failing the whole batch
    }
  }

  console.log('[matches/compute] scored', matchRows.length, 'matches')

  // Upsert matches (on_conflict: user_id + matched_profile_id)
  if (matchRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('matches')
      .upsert(matchRows, { onConflict: 'user_id,matched_profile_id' })

    if (upsertErr) {
      console.error('[matches/compute] upsert error:', upsertErr.message)
      return NextResponse.json({ success: false, error: 'Failed to save matches.' }, { status: 500 })
    }
  }

  console.log('[matches/compute] done, matches_created:', matchRows.length)
  return NextResponse.json({ success: true, data: { matches_created: matchRows.length } })
}
