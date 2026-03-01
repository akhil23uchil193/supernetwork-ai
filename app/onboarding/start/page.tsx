'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { FileText, Link2, PenLine, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

type Mode = 'idle' | 'upload' | 'url'

export default function OnboardingStartPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('idle')
  const [loading, setLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')

  // ── CV upload ──────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setUploadedFile(file)
    console.log('[onboarding/start] file dropped:', file.name, file.size)
    await parseCV(file)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: loading,
  })

  async function parseCV(file: File) {
    setLoading(true)
    console.log('[onboarding/start] calling parse-cv API')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/onboarding/parse-cv', { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Parse failed')
      console.log('[onboarding/start] CV parsed successfully, keys:', Object.keys(json.data))
      sessionStorage.setItem('onboarding_prefill', JSON.stringify(json.data))
      router.push('/onboarding/social')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[onboarding/start] parse-cv error:', msg)
      toast(`CV parsing failed: ${msg}`, 'error')
      setUploadedFile(null)
    } finally {
      setLoading(false)
    }
  }

  async function parseUrl() {
    if (!url.trim()) return
    setLoading(true)
    console.log('[onboarding/start] calling parse-url API for:', url)
    try {
      const res = await fetch('/api/onboarding/parse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Parse failed')
      console.log('[onboarding/start] URL parsed successfully')
      sessionStorage.setItem('onboarding_prefill', JSON.stringify(json.data))
      router.push('/onboarding/social')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[onboarding/start] parse-url error:', msg)
      toast(`URL parsing failed: ${msg}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center px-4 pt-16 pb-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-2xl font-bold text-purple-600 tracking-tight">SuperNetworkAI</span>
          <h1 className="mt-6 text-3xl font-bold text-slate-900">Let&apos;s build your profile</h1>
          <p className="mt-2 text-slate-500">How would you like to get started?</p>
        </div>

        <div className="flex flex-col gap-4">
          {/* ── Card 1: Upload CV ─────────────────────────────────────────── */}
          <div
            className={cn(
              'bg-white rounded-xl border transition-all duration-200 overflow-hidden',
              mode === 'upload'
                ? 'border-purple-400 shadow-md ring-1 ring-purple-300'
                : 'border-slate-200 shadow-sm hover:border-purple-300 hover:shadow-md',
            )}
          >
            <button
              className="w-full text-left px-6 py-5 flex items-start gap-4"
              onClick={() => setMode(mode === 'upload' ? 'idle' : 'upload')}
              disabled={loading}
            >
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Upload CV</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Upload your CV and we&apos;ll pre-fill your profile automatically
                </p>
              </div>
            </button>

            {mode === 'upload' && (
              <div className="px-6 pb-6">
                {uploadedFile && loading ? (
                  <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <Loader2 className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{uploadedFile.name}</p>
                      <p className="text-xs text-slate-500">Parsing your CV…</p>
                    </div>
                  </div>
                ) : (
                  <div
                    {...getRootProps()}
                    className={cn(
                      'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                      isDragActive
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50',
                    )}
                  >
                    <input {...getInputProps()} />
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-700">
                      {isDragActive ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse — PDF only</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Card 2: Share URL ─────────────────────────────────────────── */}
          <div
            className={cn(
              'bg-white rounded-xl border transition-all duration-200 overflow-hidden',
              mode === 'url'
                ? 'border-purple-400 shadow-md ring-1 ring-purple-300'
                : 'border-slate-200 shadow-sm hover:border-purple-300 hover:shadow-md',
            )}
          >
            <button
              className="w-full text-left px-6 py-5 flex items-start gap-4"
              onClick={() => setMode(mode === 'url' ? 'idle' : 'url')}
              disabled={loading}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                <Link2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Share a URL</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Share your portfolio or LinkedIn URL
                </p>
              </div>
            </button>

            {mode === 'url' && (
              <div className="px-6 pb-6 flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && parseUrl()}
                  placeholder="https://linkedin.com/in/yourname"
                  autoFocus
                  disabled={loading}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-60"
                />
                <Button onClick={parseUrl} disabled={loading || !url.trim()} size="default">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Parse Profile'}
                </Button>
              </div>
            )}
          </div>

          {/* ── Card 3: Fill Manually ─────────────────────────────────────── */}
          <button
            onClick={() => {
              console.log('[onboarding/start] manual fill selected')
              sessionStorage.removeItem('onboarding_prefill')
              router.push('/onboarding/social')
            }}
            disabled={loading}
            className={cn(
              'bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5 flex items-start gap-4 text-left',
              'hover:border-purple-300 hover:shadow-md transition-all duration-200 disabled:opacity-60',
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0 mt-0.5">
              <PenLine className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Fill Manually</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Prefer to fill in your details yourself? No problem.
              </p>
            </div>
          </button>
        </div>

        {/* Cancel / clear loading */}
        {loading && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => { setLoading(false); setUploadedFile(null) }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
