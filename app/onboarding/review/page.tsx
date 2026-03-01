'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe, Linkedin, Github, Twitter, Loader2, Plus, X,
  CheckCircle2, Sparkles,
} from 'lucide-react'
import OnboardingProgress from '@/components/onboarding-progress'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { calculateProfileCompletionScore } from '@/lib/utils'
import { DICEBEAR_BASE_URL } from '@/lib/constants'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Profile, MatchCriteria } from '@/types'

// ─── EditableTagGroup ─────────────────────────────────────────────────────────

function EditableTagGroup({
  label, tags, onChange, color = 'purple',
}: {
  label: string
  tags: string[]
  onChange: (t: string[]) => void
  color?: 'purple' | 'blue' | 'green'
}) {
  const [input, setInput] = useState('')
  const colorMap = {
    purple: 'bg-purple-100 text-purple-800',
    blue:   'bg-blue-100 text-blue-800',
    green:  'bg-green-100 text-green-800',
  }

  function add() {
    const v = input.trim()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInput('')
  }

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <span key={t} className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', colorMap[color])}>
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} className="opacity-60 hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 pl-1.5 pr-2 py-0.5">
          <Plus className="w-3 h-3 text-slate-400" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
            onBlur={add}
            placeholder="add…"
            className="text-xs outline-none w-16 bg-transparent placeholder:text-slate-300"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type OnboardingData = Partial<Profile> & { working_style?: Profile['working_style'] }

export default function ReviewPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [data, setData]                     = useState<OnboardingData>({})
  const [photoPreview, setPhotoPreview]     = useState<string | null>(null)
  const [criteria, setCriteria]             = useState<MatchCriteria | null>(null)
  const [criteriaLoading, setCriteriaLoading] = useState(true)
  const [criteriaError, setCriteriaError]   = useState<string | null>(null)
  const [submitting, setSubmitting]         = useState(false)

  // ── Load sessionStorage + generate criteria ────────────────────────────
  const generateCriteria = useCallback(async (profileData: OnboardingData) => {
    console.log('[review] generating AI match criteria')
    setCriteriaLoading(true)
    setCriteriaError(null)
    try {
      const res = await fetch('/api/profile/generate-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileData }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to generate criteria')
      console.log('[review] criteria generated:', json.data)
      setCriteria(json.data as MatchCriteria)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[review] criteria generation error:', msg)
      setCriteriaError(msg)
    } finally {
      setCriteriaLoading(false)
    }
  }, [])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('onboarding_data') ?? '{}'
      const parsed: OnboardingData = JSON.parse(raw)
      console.log('[review] loaded onboarding_data, keys:', Object.keys(parsed))
      setData(parsed)
      generateCriteria(parsed)
    } catch (e) {
      console.error('[review] data load error:', e)
      setCriteriaLoading(false)
    }

    // Load photo preview (base64 stored by social step)
    const photo = sessionStorage.getItem('onboarding_photo')
    if (photo) setPhotoPreview(photo)
  }, [generateCriteria])

  // ── Complete profile ───────────────────────────────────────────────────
  async function handleComplete() {
    if (!criteria) { toast('Please wait for AI to finish analyzing your profile', 'error'); return }
    setSubmitting(true)
    console.log('[review] completing profile')

    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr || !session) {
        toast('Session expired. Please sign in again.', 'error')
        router.push('/login')
        return
      }

      const name = data.name ?? ''
      // Default to DiceBear — real photo will be uploaded after the profile row exists
      const defaultImageUrl = `${DICEBEAR_BASE_URL}${encodeURIComponent(name)}`

      const profilePayload: Omit<Profile, 'id' | 'created_at' | 'updated_at'> = {
        user_id:                  session.user.id,
        name,
        bio:                      data.bio ?? null,
        image_url:                defaultImageUrl,
        ikigai_love:              data.ikigai_love              ?? null,
        ikigai_good_at:           data.ikigai_good_at           ?? null,
        ikigai_world_needs:       data.ikigai_world_needs       ?? null,
        ikigai_paid_for:          data.ikigai_paid_for          ?? null,
        ikigai_mission:           data.ikigai_mission           ?? null,
        skills:                   data.skills                   ?? [],
        interests:                data.interests                ?? [],
        availability:             data.availability             ?? null,
        working_style:            data.working_style            ?? null,
        intent:                   data.intent                   ?? [],
        portfolio_url:            data.portfolio_url            ?? null,
        linkedin_url:             data.linkedin_url             ?? null,
        github_url:               data.github_url               ?? null,
        twitter_url:              data.twitter_url              ?? null,
        cv_url:                   null,
        is_public:                true,
        match_criteria:           criteria,
        profile_completion_score: 0,
      }

      profilePayload.profile_completion_score = calculateProfileCompletionScore(profilePayload)
      console.log('[review] profile completion score:', profilePayload.profile_completion_score)

      const { data: inserted, error: insertErr } = await supabase
        .from('profiles')
        .insert(profilePayload)
        .select('id')
        .single()

      if (insertErr || !inserted) {
        console.error('[review] insert error:', insertErr?.message)
        throw new Error(insertErr?.message ?? 'Failed to save profile')
      }

      console.log('[review] profile inserted, id:', inserted.id)

      // ── Upload photo now that the profile row exists (RLS passes) ──────────
      const photoData = sessionStorage.getItem('onboarding_photo')
      const photoExt  = sessionStorage.getItem('onboarding_photo_ext') ?? 'jpg'
      if (photoData) {
        try {
          // Decode base64 data URL → Blob
          const [header, b64] = photoData.split(',')
          const mimeType = header.split(':')[1].split(';')[0]
          const byteStr  = atob(b64)
          const bytes    = new Uint8Array(byteStr.length)
          for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i)
          const blob = new Blob([bytes], { type: mimeType })

          const path = `${inserted.id}/profile.${photoExt}`
          const { error: uploadErr } = await supabase.storage
            .from('images')
            .upload(path, blob, { upsert: true, contentType: mimeType })

          if (uploadErr) {
            console.error('[review] photo upload error:', uploadErr.message)
          } else {
            const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
            const { error: updateErr } = await supabase
              .from('profiles')
              .update({ image_url: publicUrl })
              .eq('id', inserted.id)
            if (updateErr) {
              console.error('[review] image_url update error:', updateErr.message)
            } else {
              console.log('[review] photo uploaded, image_url updated:', publicUrl)
            }
          }
        } catch (photoErr) {
          console.error('[review] photo processing error:', photoErr)
          // Non-fatal — profile is created, just with the default DiceBear avatar
        }
      }

      toast('Profile created! Finding your matches…', 'success')

      // Trigger match computation (fire-and-forget — don't block navigation)
      fetch('/api/matches/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: inserted.id }),
      }).then((r) => r.json())
        .then((j) => console.log('[review] matches computed:', j))
        .catch((e) => console.error('[review] match compute error:', e))

      // Clean up sessionStorage
      sessionStorage.removeItem('onboarding_data')
      sessionStorage.removeItem('onboarding_prefill')
      sessionStorage.removeItem('onboarding_photo')
      sessionStorage.removeItem('onboarding_photo_ext')

      router.push('/dashboard/discover')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[review] complete error:', msg)
      toast(`Failed to save profile: ${msg}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  const intentColors: Record<string, string> = {
    cofounder: 'bg-purple-100 text-purple-700',
    teammate:  'bg-blue-100 text-blue-700',
    client:    'bg-green-100 text-green-700',
  }

  const socialLinks = [
    { icon: <Globe className="w-4 h-4" />,    label: 'Portfolio', val: data.portfolio_url },
    { icon: <Linkedin className="w-4 h-4" />, label: 'LinkedIn',  val: data.linkedin_url  },
    { icon: <Github className="w-4 h-4" />,   label: 'GitHub',    val: data.github_url    },
    { icon: <Twitter className="w-4 h-4" />,  label: 'Twitter',   val: data.twitter_url   },
  ].filter((l) => l.val)

  const avatarUrl = photoPreview ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(data.name ?? 'user')}`

  return (
    <div className="min-h-screen bg-slate-50 px-4 pt-12 pb-16">
      <div className="max-w-2xl mx-auto">
        <OnboardingProgress step={4} total={4} />

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Review Your Profile</h1>
        <p className="text-slate-500 text-sm mb-8">Everything look good? You can edit these details later.</p>

        <div className="flex flex-col gap-5">
          {/* Profile Preview */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Profile Preview</h2>
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl} alt={data.name ?? ''} className="w-16 h-16 rounded-full bg-slate-100 object-cover shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{data.name || '—'}</p>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{data.bio || 'No bio added'}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(data.intent ?? []).map((i) => (
                    <span key={i} className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', intentColors[i] ?? 'bg-slate-100 text-slate-600')}>
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Ikigai */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Ikigai</h2>
            <div className="flex flex-col gap-3">
              {[
                ['What you love',          data.ikigai_love],
                ['What you&apos;re good at',     data.ikigai_good_at],
                ['What the world needs',   data.ikigai_world_needs],
                ['What you can be paid for', data.ikigai_paid_for],
                ['Your mission',           data.ikigai_mission],
              ].map(([label, val]) => val ? (
                <div key={label as string}>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm text-slate-700 mt-0.5">{val}</p>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Skills & Details */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Skills &amp; Details</h2>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {(data.skills ?? []).map((s) => (
                <span key={s} className="bg-slate-100 text-slate-700 text-xs font-medium px-2 py-0.5 rounded-full">{s}</span>
              ))}
            </div>
            <div className="flex gap-4 text-sm text-slate-600">
              {data.availability && <span className="capitalize">{data.availability.replace('_', ' ')}</span>}
              {data.working_style && <span className="capitalize">{data.working_style}</span>}
            </div>
          </div>

          {/* Social Links */}
          {socialLinks.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Social Links</h2>
              <div className="flex flex-col gap-2">
                {socialLinks.map(({ icon, label, val }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-slate-400">{icon}</span>
                    <span className="font-medium text-slate-500 w-16 shrink-0">{label}</span>
                    <a href={val!} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline truncate">
                      {val}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Match Criteria */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-semibold text-slate-800">Who you&apos;re looking for</h2>
              <span className="text-[10px] font-medium bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full ml-auto">AI generated</span>
            </div>

            {criteriaLoading ? (
              <div className="flex items-center gap-3 py-4 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span className="text-sm">Our AI is analyzing your profile…</span>
              </div>
            ) : criteriaError ? (
              <div className="py-3">
                <p className="text-sm text-red-600 mb-2">{criteriaError}</p>
                <button
                  onClick={() => generateCriteria(data)}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  Retry →
                </button>
              </div>
            ) : criteria ? (
              <div className="flex flex-col gap-5">
                {criteria.summary && (
                  <p className="text-sm text-slate-700 font-medium bg-purple-50 rounded-lg px-4 py-3">
                    {criteria.summary}
                  </p>
                )}
                <EditableTagGroup
                  label="Required Skills"
                  tags={criteria.required_skills ?? []}
                  onChange={(t) => setCriteria((prev) => prev ? { ...prev, required_skills: t } : prev)}
                  color="purple"
                />
                <EditableTagGroup
                  label="Preferred Domains"
                  tags={criteria.preferred_domains ?? []}
                  onChange={(t) => setCriteria((prev) => prev ? { ...prev, preferred_domains: t } : prev)}
                  color="blue"
                />
                <EditableTagGroup
                  label="Ideal Intent"
                  tags={criteria.ideal_intent ?? []}
                  onChange={(t) => setCriteria((prev) => prev ? { ...prev, ideal_intent: t } : prev)}
                  color="green"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Deal Breakers</p>
                  <textarea
                    rows={2}
                    value={criteria.deal_breakers ?? ''}
                    onChange={(e) =>
                      setCriteria((prev) => prev ? { ...prev, deal_breakers: e.target.value } : prev)
                    }
                    placeholder="Describe what would make a bad match…"
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>You can edit these tags — changes are saved automatically</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Complete */}
        <div className="mt-8 flex justify-between items-center">
          <button onClick={() => router.push('/onboarding/ikigai')} className="text-sm text-slate-500 hover:text-slate-700">
            ← Back
          </button>
          <Button
            onClick={handleComplete}
            disabled={submitting || criteriaLoading}
            size="lg"
            className="min-w-[180px]"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </span>
            ) : (
              'Complete Profile →'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
