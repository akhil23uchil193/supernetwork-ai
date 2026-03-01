import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { openai } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  console.log('[generate-criteria] POST received')

  const supabase = createServerClient()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session) {
    console.error('[generate-criteria] unauthenticated', sessionError?.message)
    return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { profile } = body
  if (!profile || typeof profile !== 'object') {
    return NextResponse.json({ success: false, error: 'Missing profile in body.' }, { status: 400 })
  }

  console.log('[generate-criteria] generating for profile:', (profile as Record<string, unknown>).name)

  const profileText = JSON.stringify(profile, null, 2)

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert professional network matchmaker. Analyze profiles and generate precise matching criteria.',
      },
      {
        role: 'user',
        content: `Based on this professional profile, generate ideal match criteria. Return ONLY a valid JSON object:
{
  "required_skills": ["string[] — top 5-8 skills this person needs in a collaborator"],
  "preferred_domains": ["string[] — 3-5 industry/domain areas they should connect with"],
  "collaboration_style": "string — one sentence describing their ideal collaboration dynamic",
  "ideal_intent": ["cofounder" | "teammate" | "client" — list of desired connection types"],
  "deal_breakers": "string — one sentence about what would make a bad match",
  "summary": "string — one sentence: who they are and who they are looking for"
}

Profile:
${profileText}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  console.log('[generate-criteria] raw completion length:', raw.length)

  let criteria: unknown
  try {
    criteria = JSON.parse(raw)
  } catch (err) {
    console.error('[generate-criteria] JSON parse error:', err)
    return NextResponse.json({ success: false, error: 'Failed to parse AI response.' }, { status: 500 })
  }

  console.log('[generate-criteria] criteria generated successfully')
  return NextResponse.json({ success: true, data: criteria })
}
