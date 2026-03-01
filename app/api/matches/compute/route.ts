import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { openai } from '@/lib/openai'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'

export const runtime = 'nodejs'

const BATCH_SIZE = 5

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

type MatchScore = { score: number; one_liner: string; explanation: string }

async function scoreMatch(personA: Profile, personB: Profile): Promise<MatchScore> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at evaluating professional compatibility for collaboration.',
      },
      {
        role: 'user',
        content: `Rate the collaboration compatibility between Person A and Person B.
Consider: complementary skills, shared domains, compatible working styles, aligned intents.
Return ONLY valid JSON:
{
  "score": <number 0 to 1, where 1 is perfect match>,
  "one_liner": "<max 12 words explaining the match from Person A's perspective>",
  "explanation": "<2-3 sentences with specific reasons why they'd work well together>"
}

Person A (looking for collaborators):
Name: ${personA.name}, Intent: ${(personA.intent ?? []).join(', ')}, Skills: ${(personA.skills ?? []).join(', ')},
Ikigai Mission: ${personA.ikigai_mission ?? 'N/A'}, Match Criteria: ${JSON.stringify(personA.match_criteria)}

Person B (potential match):
Name: ${personB.name}, Intent: ${(personB.intent ?? []).join(', ')}, Skills: ${(personB.skills ?? []).join(', ')},
Bio: ${personB.bio ?? 'N/A'}, Ikigai Mission: ${personB.ikigai_mission ?? 'N/A'}, Availability: ${personB.availability ?? 'N/A'}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const result = JSON.parse(raw) as Partial<MatchScore>
  return {
    score: Math.min(1, Math.max(0, result.score ?? 0.5)),
    one_liner: result.one_liner ?? 'Compatible professionals',
    explanation: result.explanation ?? '',
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log('[matches/compute] ═══ POST received ═══')
  console.log('[matches/compute] service role key configured:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

  let body: { profile_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { profile_id } = body
  console.log('[matches/compute] profile_id:', profile_id)
  if (!profile_id) {
    return NextResponse.json({ success: false, error: 'Missing profile_id.' }, { status: 400 })
  }

  // ── Auth: internal header OR authenticated user owning this profile ─────────
  const internalKey = request.headers.get('x-internal-key')
  const isInternalCall = !!internalKey && internalKey === process.env.INTERNAL_API_KEY
  console.log('[matches/compute] auth path:', isInternalCall ? 'internal-key' : 'session')

  if (!isInternalCall) {
    const authClient = createServerClient()
    const { data: { session }, error: sessionErr } = await authClient.auth.getSession()
    if (sessionErr) console.error('[matches/compute] getSession error:', sessionErr.message)
    console.log('[matches/compute] session user id:', session?.user?.id ?? 'NO SESSION')

    if (!session) {
      console.error('[matches/compute] → 401 no session')
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
    }

    const admin = createServiceRoleClient()
    const { data: ownerCheck, error: ownerErr } = await admin
      .from('profiles')
      .select('id')
      .eq('id', profile_id)
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (ownerErr) console.error('[matches/compute] owner check DB error:', ownerErr.message)
    console.log('[matches/compute] owner check:', ownerCheck ? 'authorized' : '→ 403 not owner')

    if (!ownerCheck) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 403 })
    }
  }

  const admin = createServiceRoleClient()

  // ── Fetch source profile ───────────────────────────────────────────────────
  const { data: sourceProfile, error: sourceErr } = await admin
    .from('profiles')
    .select('*')
    .eq('id', profile_id)
    .single()

  if (sourceErr || !sourceProfile) {
    console.error('[matches/compute] source profile not found:', sourceErr?.message)
    return NextResponse.json({ success: false, error: 'Profile not found.' }, { status: 404 })
  }

  const source = sourceProfile as Profile
  console.log('[matches/compute] source profile:', source.name, '| skills:', source.skills?.length, '| intent:', source.intent)

  // ── Fetch block lists (profiles blocked by or blocking source) ─────────────
  const [{ data: blockedByMe, error: blkByErr }, { data: blockedMe, error: blkMeErr }] = await Promise.all([
    admin.from('blocks').select('blocked_id').eq('blocker_id', profile_id),
    admin.from('blocks').select('blocker_id').eq('blocked_id', profile_id),
  ])
  if (blkByErr) console.error('[matches/compute] blocks-by-me error:', blkByErr.message)
  if (blkMeErr) console.error('[matches/compute] blocks-me error:', blkMeErr.message)

  const blockedSet = new Set<string>([
    ...(blockedByMe ?? []).map((r) => r.blocked_id as string),
    ...(blockedMe ?? []).map((r) => r.blocker_id as string),
  ])
  console.log('[matches/compute] blocked profiles:', blockedSet.size)

  // ── Fetch candidates (all public, excluding self and blocked) ──────────────
  const { data: candidates, error: candidatesErr } = await admin
    .from('profiles')
    .select('*')
    .eq('is_public', true)
    .neq('id', profile_id)

  if (candidatesErr) {
    console.error('[matches/compute] candidates fetch error:', candidatesErr.message)
    return NextResponse.json({ success: false, error: 'Failed to fetch candidates.' }, { status: 500 })
  }

  console.log('[matches/compute] total public profiles (excl. self):', candidates?.length ?? 0)

  const filtered = (candidates as Profile[]).filter((c) => !blockedSet.has(c.id))
  console.log('[matches/compute] candidates after block filter:', filtered.length,
    filtered.map((c) => c.name))

  if (filtered.length === 0) {
    console.log('[matches/compute] no candidates → skipping OpenAI, returning 0')
    return NextResponse.json({ success: true, matches_computed: 0 })
  }

  // ── Score in batches of BATCH_SIZE, bidirectional ──────────────────────────
  type MatchRow = {
    user_id: string
    matched_profile_id: string
    score: number
    one_liner: string
    explanation: string
  }

  const matchRows: MatchRow[] = []
  let batchIndex = 0

  for (const batch of chunk(filtered, BATCH_SIZE)) {
    batchIndex++
    console.log(`[matches/compute] batch ${batchIndex}: scoring ${batch.length} candidates →`,
      batch.map((c) => c.name))

    // For each candidate: compute both directions concurrently
    const batchResults = await Promise.all(
      batch.flatMap((candidate) => [
        // A → B: how source perceives candidate
        scoreMatch(source, candidate)
          .then((r): MatchRow => {
            console.log(`[matches/compute]   A→B ${source.name} ↔ ${candidate.name}: score=${r.score.toFixed(2)}`)
            return { user_id: profile_id, matched_profile_id: candidate.id, ...r }
          })
          .catch((err) => {
            console.error('[matches/compute]   A→B ERROR for', candidate.name, ':', err)
            return null
          }),
        // B → A: how candidate perceives source (bidirectional)
        scoreMatch(candidate, source)
          .then((r): MatchRow => {
            console.log(`[matches/compute]   B→A ${candidate.name} ↔ ${source.name}: score=${r.score.toFixed(2)}`)
            return { user_id: candidate.id, matched_profile_id: profile_id, ...r }
          })
          .catch((err) => {
            console.error('[matches/compute]   B→A ERROR for', candidate.name, ':', err)
            return null
          }),
      ])
    )

    const validInBatch = batchResults.filter((r): r is MatchRow => r !== null)
    console.log(`[matches/compute] batch ${batchIndex} produced ${validInBatch.length}/${batchResults.length} valid rows`)
    matchRows.push(...validInBatch)
  }

  const matchesComputed = matchRows.filter((r) => r.user_id === profile_id).length
  console.log('[matches/compute] total rows to upsert:', matchRows.length,
    `(${matchesComputed} for source, ${matchRows.length - matchesComputed} bidirectional)`)

  // ── Upsert all rows ────────────────────────────────────────────────────────
  if (matchRows.length > 0) {
    const { error: upsertErr } = await admin
      .from('matches')
      .upsert(matchRows, { onConflict: 'user_id,matched_profile_id' })

    if (upsertErr) {
      console.error('[matches/compute] ✗ upsert error:', upsertErr.message, '| code:', upsertErr.code)
      return NextResponse.json({ success: false, error: 'Failed to save matches.' }, { status: 500 })
    }
    console.log('[matches/compute] ✓ upsert successful')
  }

  console.log('[matches/compute] ═══ DONE — matches_computed:', matchesComputed, '═══')
  return NextResponse.json({ success: true, matches_computed: matchesComputed })
}
