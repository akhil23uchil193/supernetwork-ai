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
        content: "You are an expert at understanding people's professional profiles and what makes great collaborations.",
      },
      {
        role: 'user',
        content: `Based on this person's profile, generate their ideal collaborator criteria.
Return ONLY valid JSON matching this exact structure:
{
  "required_skills": ["3-5 skills they need in a collaborator"],
  "preferred_domains": ["2-4 industries or domains"],
  "collaboration_style": "one sentence describing ideal working dynamic",
  "ideal_intent": ["what type of collaborator they need: cofounder/teammate/client"],
  "deal_breakers": "one sentence about what wouldn't work",
  "summary": "one sentence: 'Looking for a [type] who [description]'"
}
Profile: ${profileText}`,
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
