import { openai } from './openai'

// ─── Shared prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'You are a professional CV parser. Extract information accurately.'

function buildUserPrompt(cvText: string): string {
  return `Extract profile information from this CV text and return ONLY a valid JSON object \
with these exact fields (use null for any field you cannot determine):
{
  "name": "string",
  "bio": "string (2 sentence professional summary in first person)",
  "skills": ["string[] (technical and soft skills)"],
  "interests": ["string[] (professional interests and domains)"],
  "availability": "full_time | part_time | weekends | null",
  "working_style": "async | sync | hybrid | null",
  "ikigai_love": "string (what they seem passionate about based on their work history)",
  "ikigai_good_at": "string (their strongest demonstrated capabilities)",
  "portfolio_url": "string | null",
  "linkedin_url": "string | null",
  "github_url": "string | null",
  "twitter_url": "string | null"
}
CV Text: ${cvText}`
}

// ─── JSON extraction ────────────────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  // Strip markdown code fences if present (e.g. ```json ... ```)
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  return JSON.parse(stripped)
}

// ─── Main export ────────────────────────────────────────────────────────────────

export async function extractProfileFromText(text: string): Promise<unknown> {
  console.log('[extractProfile] sending to OpenAI, text length:', text.length)

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(text) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  console.log(
    '[extractProfile] completion received, finish_reason:',
    completion.choices[0]?.finish_reason,
    'content length:',
    raw.length,
  )

  const parsed = extractJson(raw)
  console.log('[extractProfile] parsed keys:', Object.keys(parsed as object))
  return parsed
}
