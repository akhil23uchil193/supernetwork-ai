'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import OnboardingProgress from '@/components/onboarding-progress'
import { Button } from '@/components/ui/button'

const FIELDS = [
  { key: 'ikigai_love',        label: 'What do you love doing?',                         placeholder: 'The activities, topics, or work that genuinely excite and fulfil you…' },
  { key: 'ikigai_good_at',     label: 'What are you genuinely good at?',                 placeholder: 'Skills, expertise, or talents that come naturally or through practice…' },
  { key: 'ikigai_world_needs', label: 'What does the world need that you can offer?',    placeholder: 'Problems you can solve or gaps you can fill for others…' },
  { key: 'ikigai_paid_for',    label: 'What can you be paid for?',                       placeholder: 'Services, products, or expertise people would pay you for…' },
  { key: 'ikigai_mission',     label: 'What is your personal mission?',                  placeholder: 'Your purpose — the "why" behind what you do…' },
] as const

type IkigaiKey = typeof FIELDS[number]['key']
type IkigaiValues = Record<IkigaiKey, string>

const MIN_CHARS = 20

export default function IkigaiPage() {
  const router = useRouter()
  const [values, setValues] = useState<IkigaiValues>({
    ikigai_love: '', ikigai_good_at: '', ikigai_world_needs: '', ikigai_paid_for: '', ikigai_mission: '',
  })

  // Load prefill from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('onboarding_prefill')
      if (!raw) return
      const prefill = JSON.parse(raw)
      console.log('[ikigai] loading prefill, keys:', Object.keys(prefill))
      setValues((prev) => ({
        ...prev,
        ...(prefill.ikigai_love    ? { ikigai_love:    prefill.ikigai_love }    : {}),
        ...(prefill.ikigai_good_at ? { ikigai_good_at: prefill.ikigai_good_at } : {}),
      }))
    } catch (e) {
      console.error('[ikigai] prefill parse error:', e)
    }
  }, [])

  const allFilled = FIELDS.every(({ key }) => values[key].trim().length >= MIN_CHARS)

  function handleNext() {
    try {
      const existing = JSON.parse(sessionStorage.getItem('onboarding_data') ?? '{}')
      const merged = { ...existing, ...values }
      sessionStorage.setItem('onboarding_data', JSON.stringify(merged))
      console.log('[ikigai] saved to onboarding_data')
    } catch (e) {
      console.error('[ikigai] save error:', e)
    }
    router.push('/onboarding/review')
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 pt-12 pb-16">
      <div className="max-w-2xl mx-auto">
        <OnboardingProgress step={3} total={4} />

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Your Ikigai</h1>
          <p className="mt-2 text-slate-500 text-sm leading-relaxed">
            Ikigai (生き甲斐) is a Japanese concept meaning your &quot;reason for being&quot; — the
            intersection of what you love, what you&apos;re good at, what the world needs, and what
            you can be paid for. These answers power your AI-match score.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {FIELDS.map(({ key, label, placeholder }) => {
            const val = values[key]
            const ok = val.trim().length >= MIN_CHARS
            return (
              <div key={key} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-800">{label}</label>
                  <span className={`text-xs ${ok ? 'text-green-600' : 'text-slate-400'}`}>
                    {val.length} {!ok && `/ ${MIN_CHARS} min`}
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={val}
                  onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y transition"
                />
                {!ok && val.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {MIN_CHARS - val.trim().length} more characters needed
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => router.push('/onboarding/details')}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back
          </button>
          <Button onClick={handleNext} disabled={!allFilled} size="lg">
            Next →
          </Button>
        </div>
      </div>
    </div>
  )
}
