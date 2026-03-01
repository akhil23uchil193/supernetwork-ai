import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { extractProfileFromText } from '@/lib/extract-profile-from-text'

export const runtime = 'nodejs'

const JINA_BASE = 'https://r.jina.ai/'
// Generous timeout — Jina can be slow on large pages
const FETCH_TIMEOUT_MS = 15_000

export async function POST(request: NextRequest) {
  console.log('[parse-url] POST received')

  // ── Parse request body ───────────────────────────────────────────────────
  let body: { url?: string }
  try {
    body = await request.json()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[parse-url] JSON parse error:', msg)
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { url } = body
  if (!url || typeof url !== 'string') {
    console.error('[parse-url] missing url field')
    return NextResponse.json({ success: false, error: 'Missing required field "url".' }, { status: 400 })
  }

  // Basic URL validation
  try {
    new URL(url)
  } catch {
    console.error('[parse-url] invalid URL:', url)
    return NextResponse.json({ success: false, error: 'Invalid URL provided.' }, { status: 400 })
  }

  console.log('[parse-url] fetching URL via Jina reader:', url)

  // ── Fetch page content via Jina reader ───────────────────────────────────
  let pageText: string
  try {
    const jinaUrl = JINA_BASE + encodeURIComponent(url)
    console.log('[parse-url] Jina request URL:', jinaUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'text/plain',
      },
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('[parse-url] Jina responded with status:', response.status)
      return NextResponse.json(
        { success: false, error: `Could not fetch URL content (status ${response.status}). Try pasting your CV as text instead.` },
        { status: 502 },
      )
    }

    pageText = (await response.text()).trim()
    console.log('[parse-url] Jina returned text length:', pageText.length)

    if (!pageText) {
      return NextResponse.json(
        { success: false, error: 'No readable content found at the provided URL.' },
        { status: 422 },
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = msg.includes('abort') || msg.includes('timeout')
    console.error('[parse-url] fetch error:', msg)
    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? 'Request timed out fetching the URL. Try a different URL or paste your CV as text.'
          : `Failed to fetch URL: ${msg}`,
      },
      { status: 502 },
    )
  }

  // ── Extract profile via OpenAI ───────────────────────────────────────────
  try {
    const data = await extractProfileFromText(pageText)
    console.log('[parse-url] extraction complete')
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[parse-url] OpenAI extraction error:', msg)
    return NextResponse.json(
      { success: false, error: `Profile extraction failed: ${msg}` },
      { status: 500 },
    )
  }
}
