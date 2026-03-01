import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { extractProfileFromText } from '@/lib/extract-profile-from-text'

// Runs in Node.js (not Edge) — required for pdf-parse / pdfjs-dist
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  console.log('[parse-cv] POST received')

  // ── Parse multipart form data ────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[parse-cv] formData parse error:', msg)
    return NextResponse.json(
      { success: false, error: `Invalid multipart form data: ${msg}` },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    console.error('[parse-cv] missing or invalid "file" field')
    return NextResponse.json({ success: false, error: 'No PDF file provided in field "file".' }, { status: 400 })
  }

  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    console.error('[parse-cv] non-PDF file type:', file.type)
    return NextResponse.json({ success: false, error: 'Only PDF files are supported.' }, { status: 400 })
  }

  console.log('[parse-cv] received file:', file.name, 'size:', file.size, 'type:', file.type)

  // ── Extract text from PDF ────────────────────────────────────────────────
  let cvText: string
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log('[parse-cv] parsing PDF, buffer size:', buffer.length)

    const parser = new PDFParse({ data: buffer, verbosity: 0 })
    const result = await parser.getText()
    cvText = result.text.trim()

    if (!cvText) {
      console.error('[parse-cv] PDF text extraction returned empty string')
      return NextResponse.json(
        { success: false, error: 'Could not extract text from PDF. The file may be scanned or image-only.' },
        { status: 422 },
      )
    }

    console.log('[parse-cv] extracted text length:', cvText.length)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[parse-cv] PDF parse error:', msg)
    return NextResponse.json(
      { success: false, error: `Failed to parse PDF: ${msg}` },
      { status: 422 },
    )
  }

  // ── Extract profile via OpenAI ───────────────────────────────────────────
  try {
    const data = await extractProfileFromText(cvText)
    console.log('[parse-cv] extraction complete')
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[parse-cv] OpenAI extraction error:', msg)
    return NextResponse.json(
      { success: false, error: `Profile extraction failed: ${msg}` },
      { status: 500 },
    )
  }
}
