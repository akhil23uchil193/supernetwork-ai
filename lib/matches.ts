/**
 * Server-only utility for fetching match records with lazy explanation generation.
 * Import only from Server Components, Route Handlers, or Server Actions.
 */
import { openai } from '@/lib/openai'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Match, Profile } from '@/types'

// ─── getMatchWithExplanation ──────────────────────────────────────────────────
//
// Fetches the match record for (userId → matchedProfileId).
// If the explanation is already populated, returns it immediately.
// Otherwise calls OpenAI to generate one, persists it, then returns the updated record.
// OpenAI is therefore called at most once per match pair.

export async function getMatchWithExplanation(
  userId: string,
  matchedProfileId: string,
): Promise<Match | null> {
  const admin = createServiceRoleClient()

  // ── 1. Fetch existing match ────────────────────────────────────────────────
  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('*, profile:profiles!matched_profile_id(*)')
    .eq('user_id', userId)
    .eq('matched_profile_id', matchedProfileId)
    .maybeSingle()

  if (matchErr) {
    console.error('[getMatchWithExplanation] fetch error:', matchErr.message)
    return null
  }
  if (!match) return null

  // ── 2. Return early if explanation already exists ──────────────────────────
  if (match.explanation) return match as Match

  // ── 3. Fetch both profiles for generation ─────────────────────────────────
  const [{ data: profileA }, { data: profileB }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
    admin.from('profiles').select('*').eq('id', matchedProfileId).maybeSingle(),
  ])

  if (!profileA || !profileB) {
    console.error('[getMatchWithExplanation] one or both profiles not found for match', match.id)
    return match as Match
  }

  const a = profileA as Profile
  const b = profileB as Profile

  // ── 4. Call OpenAI ─────────────────────────────────────────────────────────
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at evaluating professional compatibility for collaboration.',
        },
        {
          role: 'user',
          content: `Generate a match explanation from Person A's perspective about why Person B is a good collaborator match.
Return ONLY valid JSON:
{
  "one_liner": "<max 12 words>",
  "explanation": "<2-3 sentences with specific reasons>"
}

Person A: Name: ${a.name}, Skills: ${(a.skills ?? []).join(', ')}, Ikigai Mission: ${a.ikigai_mission ?? 'N/A'}, Intent: ${(a.intent ?? []).join(', ')}, Match Criteria: ${JSON.stringify(a.match_criteria)}
Person B: Name: ${b.name}, Skills: ${(b.skills ?? []).join(', ')}, Bio: ${b.bio ?? 'N/A'}, Ikigai Mission: ${b.ikigai_mission ?? 'N/A'}, Intent: ${(b.intent ?? []).join(', ')}, Availability: ${b.availability ?? 'N/A'}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const result = JSON.parse(raw) as { one_liner?: string; explanation?: string }

    // ── 5. Persist and return ────────────────────────────────────────────────
    const { data: updated, error: updateErr } = await admin
      .from('matches')
      .update({
        one_liner:   result.one_liner   ?? match.one_liner,
        explanation: result.explanation ?? '',
      })
      .eq('id', match.id)
      .select('*, profile:profiles!matched_profile_id(*)')
      .single()

    if (updateErr) {
      console.error('[getMatchWithExplanation] update error:', updateErr.message)
      return match as Match
    }

    console.log('[getMatchWithExplanation] explanation generated for match:', match.id)
    return updated as Match
  } catch (err) {
    console.error('[getMatchWithExplanation] OpenAI error:', err)
    return match as Match // return without explanation rather than failing
  }
}
