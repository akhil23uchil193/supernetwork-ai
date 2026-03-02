'use client'

import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Camera, Sparkles, CheckCircle2, Circle,
  Clock, Zap, Calendar, MessageSquare, Video, Layers,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/toaster'
import { cn, calculateProfileCompletionScore } from '@/lib/utils'
import { DICEBEAR_BASE_URL } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import type { Profile, MatchCriteria } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  name:               string
  bio:                string
  ikigai_love:        string
  ikigai_good_at:     string
  ikigai_world_needs: string
  ikigai_paid_for:    string
  ikigai_mission:     string
  skills:             string[]
  interests:          string[]
  availability:       'full_time' | 'part_time' | 'weekends' | null
  working_style:      'async' | 'sync' | 'hybrid' | null
  intent:             string[]
  portfolio_url:      string
  linkedin_url:       string
  github_url:         string
  twitter_url:        string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagInput({
  tags, onChange, placeholder,
}: { tags: string[]; onChange: (t: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('')

  function commit() {
    const trimmed = input.trim().replace(/,+$/, '')
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed])
    setInput('')
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
    if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1))
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

function CircularProgress({ score }: { score: number }) {
  const r    = 38
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const color  = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#f1f5f9" strokeWidth="9" />
      <circle
        cx="48" cy="48" r={r}
        fill="none" stroke={color} strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 48 48)"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text
        x="48" y="48"
        textAnchor="middle" dominantBaseline="central"
        fontSize="19" fontWeight="700" fill={color}
      >
        {score}%
      </text>
    </svg>
  )
}

// ─── Completion checklist ─────────────────────────────────────────────────────

interface CheckItem { label: string; done: boolean; anchor: string }

function getCheckItems(form: FormState, imageUrl: string | null, cvUrl: string | null): CheckItem[] {
  return [
    { label: 'Add your name',              done: !!form.name,                                             anchor: '#basic-info' },
    { label: 'Write a bio',                done: !!form.bio,                                              anchor: '#basic-info' },
    { label: 'What you love (Ikigai)',     done: form.ikigai_love.trim().length >= 20,                    anchor: '#ikigai' },
    { label: "What you're good at",        done: form.ikigai_good_at.trim().length >= 20,                 anchor: '#ikigai' },
    { label: 'What the world needs',       done: form.ikigai_world_needs.trim().length >= 20,             anchor: '#ikigai' },
    { label: 'What you can be paid for',   done: form.ikigai_paid_for.trim().length >= 20,                anchor: '#ikigai' },
    { label: 'Your personal mission',      done: form.ikigai_mission.trim().length >= 20,                 anchor: '#ikigai' },
    { label: 'Add at least 3 skills',      done: form.skills.length >= 3,                                 anchor: '#skills-interests' },
    { label: "What you're looking for",    done: form.intent.length >= 1,                                 anchor: '#professional' },
    { label: 'Set availability',           done: !!form.availability,                                     anchor: '#professional' },
    { label: 'Set working style',          done: !!form.working_style,                                    anchor: '#professional' },
    { label: 'Add a social link',          done: !!(form.portfolio_url || form.linkedin_url || form.github_url || form.twitter_url), anchor: '#social-links' },
    { label: 'Upload a profile photo',     done: !!(imageUrl && !imageUrl.startsWith(DICEBEAR_BASE_URL)), anchor: '#image-section' },
    { label: 'Add your CV/resume',         done: !!cvUrl,                                                 anchor: '#basic-info' },
  ]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABILITY = [
  { value: 'full_time', label: 'Full Time',  icon: Clock,    desc: '40+ hrs/week'   },
  { value: 'part_time', label: 'Part Time',  icon: Zap,      desc: '10–20 hrs/week' },
  { value: 'weekends',  label: 'Weekends',   icon: Calendar, desc: 'Weekends only'  },
] as const

const WORKING_STYLE = [
  { value: 'async',  label: 'Async',  icon: MessageSquare, desc: 'Independent work'       },
  { value: 'sync',   label: 'Sync',   icon: Video,         desc: 'Real-time collab'       },
  { value: 'hybrid', label: 'Hybrid', icon: Layers,        desc: 'Comfortable with both'  },
] as const

const INTENT = [
  { value: 'cofounder', label: 'Cofounder', color: 'purple' },
  { value: 'teammate',  label: 'Teammate',  color: 'blue'   },
  { value: 'client',    label: 'Client',    color: 'green'  },
] as const

const IKIGAI_FIELDS = [
  { key: 'ikigai_love',        label: 'What do you love doing?',                       placeholder: 'Activities and work that genuinely excite and fulfil you…'       },
  { key: 'ikigai_good_at',     label: "What are you genuinely good at?",               placeholder: 'Skills and expertise that come naturally or through practice…'   },
  { key: 'ikigai_world_needs', label: 'What does the world need that you can offer?',  placeholder: 'Problems you can solve or gaps you can fill for others…'         },
  { key: 'ikigai_paid_for',    label: 'What can you be paid for?',                     placeholder: 'Services or expertise people would pay you for…'                 },
  { key: 'ikigai_mission',     label: 'What is your personal mission?',                placeholder: 'Your purpose — the "why" behind what you do…'                   },
] as const

type IkigaiKey = typeof IKIGAI_FIELDS[number]['key']

const SOCIAL_FIELDS = [
  { key: 'portfolio_url', label: 'Portfolio / Website', placeholder: 'https://yoursite.com'         },
  { key: 'linkedin_url',  label: 'LinkedIn',            placeholder: 'https://linkedin.com/in/…'    },
  { key: 'github_url',    label: 'GitHub',              placeholder: 'https://github.com/…'         },
  { key: 'twitter_url',   label: 'Twitter / X',         placeholder: 'https://twitter.com/…'        },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsProfilePage() {
  const router      = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const [userId,    setUserId]    = useState('')
  const [profileId, setProfileId] = useState('')
  const [imageUrl,  setImageUrl]  = useState<string | null>(null)
  const [cvUrl,     setCvUrl]     = useState<string | null>(null)

  const emptyForm: FormState = {
    name: '', bio: '',
    ikigai_love: '', ikigai_good_at: '', ikigai_world_needs: '', ikigai_paid_for: '', ikigai_mission: '',
    skills: [], interests: [],
    availability: null, working_style: null, intent: [],
    portfolio_url: '', linkedin_url: '', github_url: '', twitter_url: '',
  }

  const [form,     setForm]     = useState<FormState>(emptyForm)
  const [origForm, setOrigForm] = useState<FormState | null>(null)

  const emptyCriteria: MatchCriteria = {
    required_skills: [], preferred_domains: [], collaboration_style: '',
    ideal_intent: [], deal_breakers: '', summary: '',
  }

  const [criteria,     setCriteria]     = useState<MatchCriteria>(emptyCriteria)
  const [origCriteria, setOrigCriteria] = useState<MatchCriteria | null>(null)

  // ── Fetch profile ───────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    const supabase = createBrowserClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    setUserId(session.user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!profile) { setLoading(false); return }

    setProfileId(profile.id)
    setImageUrl(profile.image_url ?? null)
    setCvUrl(profile.cv_url ?? null)

    const f: FormState = {
      name:               profile.name               ?? '',
      bio:                profile.bio                ?? '',
      ikigai_love:        profile.ikigai_love        ?? '',
      ikigai_good_at:     profile.ikigai_good_at     ?? '',
      ikigai_world_needs: profile.ikigai_world_needs ?? '',
      ikigai_paid_for:    profile.ikigai_paid_for    ?? '',
      ikigai_mission:     profile.ikigai_mission     ?? '',
      skills:             profile.skills             ?? [],
      interests:          profile.interests          ?? [],
      availability:       profile.availability       ?? null,
      working_style:      profile.working_style      ?? null,
      intent:             profile.intent             ?? [],
      portfolio_url:      profile.portfolio_url      ?? '',
      linkedin_url:       profile.linkedin_url       ?? '',
      github_url:         profile.github_url         ?? '',
      twitter_url:        profile.twitter_url        ?? '',
    }
    setForm(f)
    setOrigForm(f)

    const c: MatchCriteria = profile.match_criteria ?? emptyCriteria
    setCriteria(c)
    setOrigCriteria(c)

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  // ── Derived state ───────────────────────────────────────────────────────────

  const isDirty = origForm !== null && (
    JSON.stringify(form)     !== JSON.stringify(origForm) ||
    JSON.stringify(criteria) !== JSON.stringify(origCriteria)
  )

  const profilePartial: Partial<Profile> = {
    name:               form.name               || null,
    bio:                form.bio                || null,
    ikigai_love:        form.ikigai_love        || null,
    ikigai_good_at:     form.ikigai_good_at     || null,
    ikigai_world_needs: form.ikigai_world_needs || null,
    ikigai_paid_for:    form.ikigai_paid_for    || null,
    ikigai_mission:     form.ikigai_mission     || null,
    skills:             form.skills,
    interests:          form.interests,
    availability:       form.availability,
    working_style:      form.working_style,
    intent:             form.intent,
    portfolio_url:      form.portfolio_url      || null,
    linkedin_url:       form.linkedin_url       || null,
    github_url:         form.github_url         || null,
    twitter_url:        form.twitter_url        || null,
    image_url:          imageUrl,
    cv_url:             cvUrl,
  }

  const liveScore    = calculateProfileCompletionScore(profilePartial)
  const checkItems   = getCheckItems(form, imageUrl, cvUrl)
  const incomplete   = checkItems.filter((c) => !c.done)
  const scoreColor   = liveScore >= 70 ? 'text-green-600' : liveScore >= 50 ? 'text-amber-500' : 'text-red-500'
  const avatarSrc    = imageUrl ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(form.name || profileId)}`
  const isCustomImg  = imageUrl && !imageUrl.startsWith(DICEBEAR_BASE_URL)

  // ── Image upload ────────────────────────────────────────────────────────────

  async function handleImageUpload(file: File) {
    if (!userId) return
    setUploading(true)
    try {
      const supabase = createBrowserClient()
      const path = `${userId}/profile.jpg`

      const { error: uploadErr } = await supabase.storage
        .from('images')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
      const urlWithBust = `${publicUrl}?cb=${Date.now()}`

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ image_url: publicUrl })
        .eq('user_id', userId)
      if (updateErr) throw updateErr

      setImageUrl(urlWithBust)
      toast('Profile photo updated!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleResetAvatar() {
    const seed       = encodeURIComponent(form.name || profileId)
    const dicebearUrl = `${DICEBEAR_BASE_URL}${seed}`
    const supabase   = createBrowserClient()
    const { error }  = await supabase
      .from('profiles')
      .update({ image_url: dicebearUrl })
      .eq('user_id', userId)
    if (error) { toast('Failed to reset avatar', 'error'); return }
    setImageUrl(dicebearUrl)
    toast('Reset to generated avatar', 'success')
  }

  // ── Regenerate AI criteria ──────────────────────────────────────────────────

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const res  = await fetch('/api/profile/generate-criteria', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ profile: profilePartial }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to regenerate')
      setCriteria(json.data as MatchCriteria)
      toast('Match criteria regenerated!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to regenerate', 'error')
    } finally {
      setRegenerating(false)
    }
  }

  // ── Save changes ────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!isDirty || saving) return
    setSaving(true)

    // capture before state update
    const significantChanged = origForm !== null && (
      JSON.stringify(form.skills)  !== JSON.stringify(origForm.skills)  ||
      JSON.stringify(form.intent)  !== JSON.stringify(origForm.intent)  ||
      form.ikigai_love        !== origForm.ikigai_love        ||
      form.ikigai_good_at     !== origForm.ikigai_good_at     ||
      form.ikigai_world_needs !== origForm.ikigai_world_needs ||
      form.ikigai_paid_for    !== origForm.ikigai_paid_for    ||
      form.ikigai_mission     !== origForm.ikigai_mission
    )

    try {
      const newScore = calculateProfileCompletionScore(profilePartial)
      const supabase = createBrowserClient()

      const { error } = await supabase
        .from('profiles')
        .update({
          name:                    form.name               || null,
          bio:                     form.bio                || null,
          ikigai_love:             form.ikigai_love        || null,
          ikigai_good_at:          form.ikigai_good_at     || null,
          ikigai_world_needs:      form.ikigai_world_needs || null,
          ikigai_paid_for:         form.ikigai_paid_for    || null,
          ikigai_mission:          form.ikigai_mission     || null,
          skills:                  form.skills,
          interests:               form.interests,
          availability:            form.availability,
          working_style:           form.working_style,
          intent:                  form.intent,
          portfolio_url:           form.portfolio_url      || null,
          linkedin_url:            form.linkedin_url       || null,
          github_url:              form.github_url         || null,
          twitter_url:             form.twitter_url        || null,
          match_criteria:          criteria,
          profile_completion_score: newScore,
          updated_at:              new Date().toISOString(),
        })
        .eq('user_id', userId)

      if (error) throw error

      setOrigForm({ ...form })
      setOrigCriteria({ ...criteria })
      toast('Profile updated!', 'success')

      if (significantChanged) {
        fetch('/api/matches/compute', { method: 'POST' }).catch(console.error)
      }

      setTimeout(() => router.push('/dashboard/discover'), 1500)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="h-7 bg-slate-200 rounded w-32 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-52 animate-pulse" />
        </div>
        {[96, 64, 120, 96, 80, 64, 80].map((h, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-28 mb-4" />
            <div className={`bg-slate-100 rounded-xl`} style={{ height: h }} />
          </div>
        ))}
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">

      {/* ── Page title ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Update your information and preferences</p>
      </div>

      {/* ── Profile Completion Card ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-5">
          <CircularProgress score={liveScore} />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-slate-800">
              Your profile is <span className={scoreColor}>{liveScore}% complete</span>
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {liveScore >= 70
                ? 'Great! Your profile is strong and will attract quality matches.'
                : liveScore >= 50
                  ? 'Getting there — a few more details will boost your matches.'
                  : 'Complete your profile to get better AI match results.'}
            </p>
          </div>
        </div>

        {incomplete.length > 0 ? (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">To complete</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
              {incomplete.map((item) => (
                <a
                  key={item.label}
                  href={item.anchor}
                  className="flex items-center gap-2 group"
                >
                  <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-sm text-slate-500 group-hover:text-purple-600 transition-colors truncate">
                    {item.label}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Profile is 100% complete!</span>
          </div>
        )}
      </div>

      {/* ── Image Section ──────────────────────────────────────────────── */}
      <div id="image-section" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">
          Profile Photo
        </h2>
        <div className="flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            alt={form.name || 'Profile'}
            className="w-24 h-24 rounded-full object-cover bg-slate-100 border-2 border-slate-200 shrink-0"
          />
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors w-fit"
            >
              <Camera className="w-4 h-4" />
              {uploading ? 'Uploading…' : 'Upload Photo'}
            </button>
            {isCustomImg && (
              <button
                onClick={handleResetAvatar}
                className="text-xs text-slate-400 hover:text-slate-600 text-left transition-colors"
              >
                Reset to generated avatar
              </button>
            )}
            <p className="text-xs text-slate-400">JPG, PNG or GIF. Recommended 400×400px.</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImageUpload(file)
            e.target.value = ''
          }}
        />
      </div>

      {/* ── Basic Info ─────────────────────────────────────────────────── */}
      <div id="basic-info" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Basic Info
        </h2>
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Your full name"
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Bio</label>
          <textarea
            rows={3}
            value={form.bio}
            onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
            placeholder="A short intro about yourself…"
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y transition"
          />
        </div>
      </div>

      {/* ── Ikigai ─────────────────────────────────────────────────────── */}
      <div id="ikigai" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Ikigai
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            These answers power your AI match score. Minimum 20 characters each.
          </p>
        </div>
        {IKIGAI_FIELDS.map(({ key, label, placeholder }) => {
          const val = form[key as IkigaiKey]
          const ok  = val.trim().length >= 20
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-800">{label}</label>
                <span className={cn('text-xs', ok ? 'text-green-600' : 'text-slate-400')}>
                  {val.length}{!ok && ' / 20 min'}
                </span>
              </div>
              <textarea
                rows={3}
                value={val}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y transition"
              />
              {!ok && val.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {20 - val.trim().length} more characters needed
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Skills & Interests ─────────────────────────────────────────── */}
      <div id="skills-interests" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Skills &amp; Interests
        </h2>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-semibold text-slate-800">Skills</label>
            <span className={cn('text-xs', form.skills.length >= 3 ? 'text-green-600' : 'text-slate-400')}>
              {form.skills.length}{form.skills.length < 3 && ' / 3 min'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-2">Press Enter or comma to add</p>
          <TagInput
            tags={form.skills}
            onChange={(t) => setForm((p) => ({ ...p, skills: t }))}
            placeholder="e.g. React, Python, Leadership…"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Interests</label>
          <p className="text-xs text-slate-500 mb-2">Professional domains and areas you&apos;re drawn to</p>
          <TagInput
            tags={form.interests}
            onChange={(t) => setForm((p) => ({ ...p, interests: t }))}
            placeholder="e.g. AI, Climate Tech, Design…"
          />
        </div>
      </div>

      {/* ── Professional ───────────────────────────────────────────────── */}
      <div id="professional" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Professional
        </h2>

        {/* Availability */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-3">Availability</label>
          <div className="grid grid-cols-3 gap-3">
            {AVAILABILITY.map(({ value, label, icon: Icon, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, availability: value }))}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all',
                  form.availability === value
                    ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-300'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <Icon className={cn('w-5 h-5', form.availability === value ? 'text-purple-600' : 'text-slate-400')} />
                <span className={cn('text-sm font-medium', form.availability === value ? 'text-purple-700' : 'text-slate-700')}>
                  {label}
                </span>
                <span className="text-[10px] text-slate-400">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Working Style */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-3">Working Style</label>
          <div className="grid grid-cols-3 gap-3">
            {WORKING_STYLE.map(({ value, label, icon: Icon, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, working_style: value }))}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all',
                  form.working_style === value
                    ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-300'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <Icon className={cn('w-5 h-5', form.working_style === value ? 'text-purple-600' : 'text-slate-400')} />
                <span className={cn('text-sm font-medium', form.working_style === value ? 'text-purple-700' : 'text-slate-700')}>
                  {label}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Intent */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">What are you looking for?</label>
          <p className="text-xs text-slate-500 mb-3">Select all that apply</p>
          <div className="grid grid-cols-3 gap-3">
            {INTENT.map(({ value, label, color }) => {
              const selected = form.intent.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((p) => ({
                    ...p,
                    intent: p.intent.includes(value)
                      ? p.intent.filter((x) => x !== value)
                      : [...p.intent, value],
                  }))}
                  className={cn(
                    'rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all',
                    selected && color === 'purple' && 'border-purple-400 bg-purple-50 text-purple-700',
                    selected && color === 'blue'   && 'border-blue-400   bg-blue-50   text-blue-700',
                    selected && color === 'green'  && 'border-green-400  bg-green-50  text-green-700',
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

      {/* ── Social Links ───────────────────────────────────────────────── */}
      <div id="social-links" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Social Links
        </h2>
        {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">{label}</label>
            <input
              type="url"
              value={form[key as keyof FormState] as string}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />
          </div>
        ))}
      </div>

      {/* ── AI Match Criteria ──────────────────────────────────────────── */}
      <div id="match-criteria" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              AI Match Criteria
            </h2>
            <p className="text-xs text-slate-500 mt-1">Used to find your best matches</p>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-600 border border-purple-200 hover:bg-purple-50 disabled:opacity-50 transition-colors shrink-0"
          >
            {regenerating ? (
              <>
                <span className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Regenerate with AI
              </>
            )}
          </button>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Required Skills</label>
          <TagInput
            tags={criteria.required_skills}
            onChange={(t) => setCriteria((p) => ({ ...p, required_skills: t }))}
            placeholder="e.g. React, TypeScript…"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Preferred Domains</label>
          <TagInput
            tags={criteria.preferred_domains}
            onChange={(t) => setCriteria((p) => ({ ...p, preferred_domains: t }))}
            placeholder="e.g. AI, Fintech, SaaS…"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Ideal Intent</label>
          <TagInput
            tags={criteria.ideal_intent}
            onChange={(t) => setCriteria((p) => ({ ...p, ideal_intent: t }))}
            placeholder="e.g. cofounder, teammate…"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Collaboration Style</label>
          <input
            type="text"
            value={criteria.collaboration_style}
            onChange={(e) => setCriteria((p) => ({ ...p, collaboration_style: e.target.value }))}
            placeholder="e.g. async-first, remote-friendly…"
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Deal Breakers</label>
          <input
            type="text"
            value={criteria.deal_breakers}
            onChange={(e) => setCriteria((p) => ({ ...p, deal_breakers: e.target.value }))}
            placeholder="e.g. no remote work, equity-only compensation…"
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">Summary</label>
          <textarea
            rows={2}
            value={criteria.summary}
            onChange={(e) => setCriteria((p) => ({ ...p, summary: e.target.value }))}
            placeholder="Looking for a [type] who [description]…"
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y transition"
          />
        </div>
      </div>

      {/* ── Save Button ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        {isDirty ? (
          <p className="text-xs text-slate-400">You have unsaved changes</p>
        ) : (
          <span />
        )}
        <Button onClick={handleSave} disabled={!isDirty || saving} size="lg">
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          ) : 'Save Changes'}
        </Button>
      </div>

    </div>
  )
}
