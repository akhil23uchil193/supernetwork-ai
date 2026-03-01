import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'
import type { Profile } from '@/types'

export const runtime = 'nodejs'

// ─── Name detection ───────────────────────────────────────────────────────────
// Words that strongly suggest a skill/domain query rather than a person's name

const SKILL_KEYWORDS = new Set([
  'react', 'node', 'python', 'javascript', 'typescript', 'css', 'html',
  'design', 'ml', 'ai', 'backend', 'frontend', 'fullstack', 'devops',
  'data', 'product', 'marketing', 'sales', 'engineer', 'developer',
  'startup', 'cofounder', 'teammate', 'client', 'mobile', 'ios', 'android',
  'cloud', 'aws', 'gcp', 'azure', 'blockchain', 'crypto', 'fintech', 'saas',
  'open', 'looking', 'need', 'want', 'find', 'seeking', 'with', 'and', 'for',
])

function isLikelyName(query: string): boolean {
  const words = query.trim().split(/\s+/)
  if (words.length > 2) return false
  return words.every((w) => !SKILL_KEYWORDS.has(w.toLowerCase()))
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 })
  }

  let body: { query?: string; intent_filter?: string[] }
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const query        = (body.query ?? '').trim()
  const intentFilter = body.intent_filter ?? []

  const admin = createServiceRoleClient()

  // ── Viewer profile ─────────────────────────────────────────────────────────
  const { data: viewerProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!viewerProfile) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
  }

  const viewerProfileId = viewerProfile.id

  // ── Block list ─────────────────────────────────────────────────────────────
  const { data: blocksData } = await admin
    .from('blocks')
    .select('blocked_id, blocker_id')
    .or(`blocker_id.eq.${viewerProfileId},blocked_id.eq.${viewerProfileId}`)

  const blockedSet = new Set<string>()
  for (const b of blocksData ?? []) {
    blockedSet.add(b.blocker_id === viewerProfileId ? b.blocked_id : b.blocker_id)
  }

  // ── Fetch public profiles ──────────────────────────────────────────────────
  let profilesQuery = admin
    .from('profiles')
    .select('*')
    .eq('is_public', true)
    .neq('id', viewerProfileId)
    .limit(100)

  if (intentFilter.length > 0) {
    profilesQuery = profilesQuery.overlaps('intent', intentFilter)
  }

  const { data: allProfiles } = await profilesQuery
  const profiles = ((allProfiles ?? []) as Profile[]).filter((p) => !blockedSet.has(p.id))

  if (profiles.length === 0) {
    return NextResponse.json({ success: true, results: [] })
  }

  // ── Pre-computed match scores ──────────────────────────────────────────────
  const { data: matchesData } = await admin
    .from('matches')
    .select('matched_profile_id, score')
    .eq('user_id', viewerProfileId)

  const matchScoreMap = new Map<string, number>()
  for (const m of matchesData ?? []) {
    matchScoreMap.set(m.matched_profile_id, m.score)
  }

  // ── No query → return top pre-computed matches ─────────────────────────────
  if (!query) {
    const results = profiles
      .map((p) => ({
        profile: p,
        final_score:        matchScoreMap.get(p.id) ?? 0,
        relevance_score:    null,
        match_score:        matchScoreMap.get(p.id) ?? 0,
        search_explanation: null,
      }))
      .sort((a, b) => b.final_score - a.final_score)
      .slice(0, 20)
    return NextResponse.json({ success: true, results })
  }

  // ── Name detection: flag partial name matches ──────────────────────────────
  const nameBoostSet = new Set<string>()
  if (isLikelyName(query)) {
    const lq = query.toLowerCase()
    for (const p of profiles) {
      if (p.name?.toLowerCase().includes(lq)) {
        nameBoostSet.add(p.id)
      }
    }
  }

  // ── NL search via OpenAI ───────────────────────────────────────────────────
  const profilesForAI = profiles.slice(0, 80).map((p) => ({
    id:             p.id,
    name:           p.name,
    skills:         p.skills,
    intent:         p.intent,
    bio:            p.bio,
    ikigai_mission: p.ikigai_mission,
    availability:   p.availability,
  }))

  type AIRanking = { profile_id: string; relevance_score: number; reason: string }
  let aiRankings: AIRanking[] = []

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a search engine for a professional networking platform. Rank profiles by relevance to the search query. Consider skills, intent, bio, and mission. Be strict — only score highly if there is a genuine match.',
        },
        {
          role: 'user',
          content: `Search query: "${query}"

Profiles:
${JSON.stringify(profilesForAI, null, 2)}

Return ONLY valid JSON:
{
  "results": [
    { "profile_id": "<id>", "relevance_score": <0.0-1.0>, "reason": "<brief reason, max 15 words>" }
  ]
}
Only include profiles with relevance_score > 0.1. Sort by relevance_score descending.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as { results?: AIRanking[] }
    aiRankings = parsed.results ?? []
  } catch (err) {
    console.error('[search] OpenAI error:', err)
    // Fall back to name-match only — aiRankings stays empty
  }

  // ── Build AI score map ─────────────────────────────────────────────────────
  const aiMap = new Map<string, { relevance_score: number; reason: string }>()
  for (const r of aiRankings) {
    aiMap.set(r.profile_id, { relevance_score: r.relevance_score, reason: r.reason })
  }

  // Boost name matches not surfaced by AI (or already surfaced → extra +0.2)
  const nameBoostArr = Array.from(nameBoostSet)
  for (const id of nameBoostArr) {
    if (!aiMap.has(id)) {
      aiMap.set(id, { relevance_score: 0.7, reason: 'Name match' })
    } else {
      const existing = aiMap.get(id)!
      aiMap.set(id, {
        ...existing,
        relevance_score: Math.min(1, existing.relevance_score + 0.2),
      })
    }
  }

  // ── Merge AI relevance + match scores ─────────────────────────────────────
  const results = profiles
    .filter((p) => aiMap.has(p.id))
    .map((p) => {
      const ai         = aiMap.get(p.id)!
      const matchScore = matchScoreMap.get(p.id) ?? 0
      return {
        profile:            p,
        final_score:        ai.relevance_score * 0.6 + matchScore * 0.4,
        relevance_score:    ai.relevance_score,
        match_score:        matchScore,
        search_explanation: ai.reason,
      }
    })
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, 20)

  return NextResponse.json({ success: true, results })
}
