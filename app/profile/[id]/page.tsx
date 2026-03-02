import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Globe, Linkedin, Github, Twitter,
  Heart, Sparkles, Globe2, Banknote, Compass,
  Clock, Zap, Calendar, Layers, MessageSquareMore,
  LogIn, ChevronDown,
} from 'lucide-react'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getMatchWithExplanation } from '@/lib/matches'
import { cn } from '@/lib/utils'
import { DICEBEAR_BASE_URL } from '@/lib/constants'
import ProfileActions from '@/components/profile-actions'
import ProfileMenu from '@/components/profile-menu'
import type { ConnectionState } from '@/components/profile-actions'
import type { Profile, Connection } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const INTENT_STYLES: Record<string, string> = {
  cofounder: 'bg-purple-100 text-purple-700',
  teammate:  'bg-blue-100 text-blue-700',
  client:    'bg-green-100 text-green-700',
}

const AVAILABILITY_LABELS: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  weekends:  'Weekends Only',
}

const WORKING_STYLE_LABELS: Record<string, string> = {
  async:  'Async-first',
  sync:   'Sync / Real-time',
  hybrid: 'Hybrid',
}

const IKIGAI_FIELDS = [
  { key: 'ikigai_love',        label: 'What they love',          icon: Heart },
  { key: 'ikigai_good_at',     label: 'What they excel at',      icon: Sparkles },
  { key: 'ikigai_world_needs', label: 'What the world needs',    icon: Globe2 },
  { key: 'ikigai_paid_for',    label: 'What they can earn from', icon: Banknote },
  { key: 'ikigai_mission',     label: 'Their mission',           icon: Compass },
] as const

const RING_CIRCUMFERENCE = 2 * Math.PI * 40 // r = 40 → ≈ 251.3

function scoreRingColor(pct: number) {
  if (pct >= 80) return { ring: 'stroke-green-500',  text: 'text-green-600'  }
  if (pct >= 60) return { ring: 'stroke-purple-500', text: 'text-purple-600' }
  if (pct >= 40) return { ring: 'stroke-amber-500',  text: 'text-amber-600'  }
  return           { ring: 'stroke-slate-300',        text: 'text-slate-500'  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const admin = createServiceRoleClient()

  // ── Fetch profile ──────────────────────────────────────────────────────────
  const { data: profileData } = await admin
    .from('profiles')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!profileData) notFound()
  const profile = profileData as Profile

  // ── Session ────────────────────────────────────────────────────────────────
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const isOwner    = !!session && session.user.id === profile.user_id
  const isLoggedIn = !!session

  // Private profile: only owner may view
  if (!profile.is_public && !isOwner) notFound()

  // ── Viewer-specific data (match + connection) ──────────────────────────────
  let viewerProfileId: string | null = null
  let matchScore:       number | null = null
  let matchOneLiner:    string | null = null
  let matchExplanation: string | null = null
  let connectionState:  ConnectionState = { type: 'none' }
  let messageHref = '/dashboard/messages'

  if (isLoggedIn && !isOwner) {
    const { data: vp } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', session!.user.id)
      .maybeSingle()

    viewerProfileId = vp?.id ?? null

    if (viewerProfileId) {
      const [matchResult, connResult] = await Promise.all([
        getMatchWithExplanation(viewerProfileId, profile.id),
        admin
          .from('connections')
          .select('id, requester_id, receiver_id, status')
          .or(
            `and(requester_id.eq.${viewerProfileId},receiver_id.eq.${profile.id}),` +
            `and(requester_id.eq.${profile.id},receiver_id.eq.${viewerProfileId})`
          )
          .maybeSingle(),
      ])

      if (matchResult) {
        matchScore       = matchResult.score
        matchOneLiner    = matchResult.one_liner
        matchExplanation = matchResult.explanation
      }

      const conn = connResult.data as Connection | null
      if (conn) {
        if (conn.status === 'accepted') {
          connectionState = { type: 'accepted', connection_id: conn.id }
          messageHref = `/dashboard/messages/${conn.id}`
        } else if (conn.status === 'pending') {
          connectionState = conn.requester_id === viewerProfileId
            ? { type: 'pending_sent',     connection_id: conn.id }
            : { type: 'pending_received', connection_id: conn.id }
        }
      }
    }
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const avatarUrl  = profile.image_url ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(profile.name ?? 'user')}`
  const scorePercent = matchScore !== null ? Math.round(matchScore * 100) : null
  const ringColors   = scorePercent !== null ? scoreRingColor(scorePercent) : null
  const ringOffset   = scorePercent !== null
    ? RING_CIRCUMFERENCE * (1 - scorePercent / 100)
    : RING_CIRCUMFERENCE

  const socialLinks = [
    { href: profile.linkedin_url,  icon: <Linkedin className="w-4 h-4" />,  label: 'LinkedIn'  },
    { href: profile.github_url,    icon: <Github className="w-4 h-4" />,    label: 'GitHub'    },
    { href: profile.twitter_url,   icon: <Twitter className="w-4 h-4" />,   label: 'Twitter'   },
    { href: profile.portfolio_url, icon: <Globe className="w-4 h-4" />,     label: 'Portfolio' },
  ].filter((l) => l.href)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-5">

        {/* ── Profile header ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start gap-5">
            {/* Avatar with optional score ring */}
            <div className="relative shrink-0 w-24 h-24">
              {scorePercent !== null && (
                <svg
                  width="96" height="96"
                  className="absolute inset-0 -rotate-90"
                  aria-hidden="true"
                >
                  <circle cx="48" cy="48" r="40" fill="none" strokeWidth="5" className="stroke-slate-100" />
                  <circle
                    cx="48" cy="48" r="40" fill="none" strokeWidth="5"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    className={cn('transition-all', ringColors!.ring)}
                  />
                </svg>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={profile.name ?? 'Profile'}
                className={cn(
                  'w-full h-full rounded-full object-cover bg-slate-100',
                  scorePercent !== null ? 'p-1.5' : ''
                )}
              />
            </div>

            {/* Name, badges, score label */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
                  {/* Compatibility label beneath name */}
                  {scorePercent !== null && (
                    <p className={cn('text-sm font-semibold mt-0.5', ringColors!.text)}>
                      {scorePercent}% Compatible
                    </p>
                  )}
                </div>
                {/* Owner badge / three-dot menu for visitors */}
                {isOwner ? (
                  <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full shrink-0">
                    Your Profile
                  </span>
                ) : isLoggedIn && (
                  <ProfileMenu
                    targetProfileId={profile.id}
                    targetName={profile.name ?? 'this person'}
                  />
                )}
              </div>

              {/* Intent + availability badges */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {profile.intent.map((i) => (
                  <span key={i} className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full capitalize', INTENT_STYLES[i] ?? 'bg-slate-100 text-slate-600')}>
                    {i}
                  </span>
                ))}
                {profile.availability && (
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {AVAILABILITY_LABELS[profile.availability] ?? profile.availability}
                  </span>
                )}
                {profile.working_style && (
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {WORKING_STYLE_LABELS[profile.working_style] ?? profile.working_style}
                  </span>
                )}
              </div>

              {/* Social links */}
              {socialLinks.length > 0 && (
                <div className="flex gap-3 mt-3">
                  {socialLinks.map(({ href, icon, label }) => (
                    <a
                      key={label}
                      href={href!}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={label}
                      className="text-slate-400 hover:text-purple-600 transition-colors"
                    >
                      {icon}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-5">
              {profile.bio}
            </p>
          )}
        </div>

        {/* ── Compatibility + connection actions (logged-in, not owner) ─────── */}
        {isLoggedIn && !isOwner && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                {matchOneLiner && (
                  <p className="text-base font-semibold text-slate-800 mb-1">{matchOneLiner}</p>
                )}
                {scorePercent !== null && !matchOneLiner && (
                  <p className={cn('text-base font-semibold mb-1', ringColors!.text)}>
                    {scorePercent}% compatibility match
                  </p>
                )}
                {!matchScore && (
                  <p className="text-sm text-slate-400 mb-1">Match score not yet computed</p>
                )}

                {/* Expandable explanation */}
                {matchExplanation && (
                  <details className="group mt-2">
                    <summary className="flex items-center gap-1 text-sm text-purple-600 font-medium cursor-pointer list-none select-none hover:text-purple-800">
                      <MessageSquareMore className="w-3.5 h-3.5" />
                      Why this match?
                      <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed pl-0.5">
                      {matchExplanation}
                    </p>
                  </details>
                )}
              </div>

              {/* Action buttons */}
              <ProfileActions
                targetProfileId={profile.id}
                targetName={profile.name ?? 'this person'}
                initialConnection={connectionState}
                messageHref={messageHref}
              />
            </div>
          </div>
        )}

        {/* ── Sign-in banner (not logged in) ───────────────────────────────── */}
        {!isLoggedIn && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <p className="font-semibold text-slate-800">See your compatibility with {profile.name?.split(' ')[0]}</p>
              <p className="text-sm text-slate-500 mt-0.5">Sign in to view your AI match score and send a connection request.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        )}

        {/* ── Ikigai ───────────────────────────────────────────────────────── */}
        {IKIGAI_FIELDS.some(({ key }) => profile[key]) && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">
              The Ikigai of {profile.name?.split(' ')[0]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {IKIGAI_FIELDS.map(({ key, label, icon: Icon }) => {
                const val = profile[key]
                if (!val) return null
                return (
                  <div key={key} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-purple-600" />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                      <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{val}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Skills ───────────────────────────────────────────────────────── */}
        {profile.skills.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((s) => (
                <span key={s} className="text-sm bg-slate-100 text-slate-700 font-medium px-3 py-1 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Interests ────────────────────────────────────────────────────── */}
        {profile.interests.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((i) => (
                <span key={i} className="text-sm bg-purple-50 text-purple-700 font-medium px-3 py-1 rounded-full">
                  {i}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
