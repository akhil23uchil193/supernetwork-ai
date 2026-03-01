'use client'

import { useState, useEffect, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X, Clock, Zap, Calendar, MessageSquare, Video, Layers } from 'lucide-react'
import OnboardingProgress from '@/components/onboarding-progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

// ── Tag Input ──────────────────────────────────────────────────────────────────

function TagInput({
  tags, onChange, placeholder,
}: { tags: string[]; onChange: (t: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('')

  function commit() {
    const trimmed = input.trim().replace(/,+$/, '')
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInput('')
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
    if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 min-h-[42px] focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs font-medium px-2 py-0.5 rounded-full">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-purple-500 hover:text-purple-800">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent placeholder:text-slate-400"
      />
    </div>
  )
}

// ── Constants ──────────────────────────────────────────────────────────────────

const AVAILABILITY = [
  { value: 'full_time', label: 'Full Time',  icon: Clock,    desc: '40+ hrs/week' },
  { value: 'part_time', label: 'Part Time',  icon: Zap,      desc: '10–20 hrs/week' },
  { value: 'weekends',  label: 'Weekends',   icon: Calendar, desc: 'Weekends only' },
] as const

const WORKING_STYLE = [
  { value: 'async',   label: 'Async',   icon: MessageSquare, desc: 'Independent work, messaging' },
  { value: 'sync',    label: 'Sync',    icon: Video,         desc: 'Meetings, real-time collab' },
  { value: 'hybrid',  label: 'Hybrid',  icon: Layers,        desc: "Comfortable with both" },
] as const

const INTENT = [
  { value: 'cofounder', label: 'Cofounder', color: 'purple' },
  { value: 'teammate',  label: 'Teammate',  color: 'blue'   },
  { value: 'client',    label: 'Client',    color: 'green'  },
] as const

type AvailabilityVal = 'full_time' | 'part_time' | 'weekends'
type WorkingStyleVal = 'async' | 'sync' | 'hybrid'

export default function DetailsPage() {
  const router = useRouter()
  const [skills, setSkills]               = useState<string[]>([])
  const [interests, setInterests]         = useState<string[]>([])
  const [availability, setAvailability]   = useState<AvailabilityVal | null>(null)
  const [workingStyle, setWorkingStyle]   = useState<WorkingStyleVal | null>(null)
  const [intent, setIntent]               = useState<string[]>([])

  useEffect(() => {
    try {
      const prefill = JSON.parse(sessionStorage.getItem('onboarding_prefill') ?? '{}') as Partial<Profile>
      if (prefill.skills?.length)    setSkills(prefill.skills)
      if (prefill.interests?.length) setInterests(prefill.interests)
      console.log('[details] prefill loaded — skills:', prefill.skills?.length, 'interests:', prefill.interests?.length)
    } catch (e) { console.error('[details] prefill error:', e) }
  }, [])

  const canNext =
    skills.length >= 3 &&
    interests.length >= 1 &&
    availability !== null &&
    workingStyle !== null &&
    intent.length >= 1

  function handleNext() {
    const data = { skills, interests, availability, working_style: workingStyle, intent }
    try {
      const existing = JSON.parse(sessionStorage.getItem('onboarding_data') ?? '{}')
      sessionStorage.setItem('onboarding_data', JSON.stringify({ ...existing, ...data }))
      console.log('[details] saved to onboarding_data')
    } catch (e) { console.error('[details] save error:', e) }
    router.push('/onboarding/ikigai')
  }

  function toggleIntent(val: string) {
    setIntent((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val])
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 pt-12 pb-16">
      <div className="max-w-2xl mx-auto">
        <OnboardingProgress step={2} total={4} />

        <h1 className="text-2xl font-bold text-slate-900 mb-8">Your Details</h1>

        <div className="flex flex-col gap-6">
          {/* Skills */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-800">Your Skills</label>
              <span className={cn('text-xs', skills.length >= 3 ? 'text-green-600' : 'text-slate-400')}>
                {skills.length} {skills.length < 3 && '/ 3 min'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">Type a skill and press Enter or comma to add</p>
            <TagInput tags={skills} onChange={setSkills} placeholder="e.g. React, Python, Leadership…" />
          </div>

          {/* Interests */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <label className="block text-sm font-semibold text-slate-800 mb-2">Your Interests</label>
            <p className="text-xs text-slate-500 mb-3">Professional domains and areas you&apos;re drawn to</p>
            <TagInput tags={interests} onChange={setInterests} placeholder="e.g. AI, Climate Tech, Design…" />
          </div>

          {/* Availability */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <label className="block text-sm font-semibold text-slate-800 mb-3">Availability</label>
            <div className="grid grid-cols-3 gap-3">
              {AVAILABILITY.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  onClick={() => setAvailability(value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all',
                    availability === value
                      ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-300'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <Icon className={cn('w-5 h-5', availability === value ? 'text-purple-600' : 'text-slate-400')} />
                  <span className={cn('text-sm font-medium', availability === value ? 'text-purple-700' : 'text-slate-700')}>{label}</span>
                  <span className="text-[10px] text-slate-400">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Working Style */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <label className="block text-sm font-semibold text-slate-800 mb-3">Working Style</label>
            <div className="grid grid-cols-3 gap-3">
              {WORKING_STYLE.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  onClick={() => setWorkingStyle(value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all',
                    workingStyle === value
                      ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-300'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <Icon className={cn('w-5 h-5', workingStyle === value ? 'text-purple-600' : 'text-slate-400')} />
                  <span className={cn('text-sm font-medium', workingStyle === value ? 'text-purple-700' : 'text-slate-700')}>{label}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Intent */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <label className="block text-sm font-semibold text-slate-800 mb-1">What are you looking for?</label>
            <p className="text-xs text-slate-500 mb-3">Select all that apply</p>
            <div className="grid grid-cols-3 gap-3">
              {INTENT.map(({ value, label, color }) => {
                const selected = intent.includes(value)
                return (
                  <button
                    key={value}
                    onClick={() => toggleIntent(value)}
                    className={cn(
                      'rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all',
                      selected && color === 'purple' && 'border-purple-400 bg-purple-50 text-purple-700',
                      selected && color === 'blue'   && 'border-blue-400 bg-blue-50 text-blue-700',
                      selected && color === 'green'  && 'border-green-400 bg-green-50 text-green-700',
                      !selected && 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => router.push('/onboarding/social')}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back
          </button>
          <Button onClick={handleNext} disabled={!canNext} size="lg">
            Next →
          </Button>
        </div>
      </div>
    </div>
  )
}
