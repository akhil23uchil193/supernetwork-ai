'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Globe, Linkedin, Github, Twitter,
  Clock, Layers, ChevronDown, Sparkles, UserCheck,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/toaster'
import { cn, formatExplanation } from '@/lib/utils'
import { DICEBEAR_BASE_URL } from '@/lib/constants'
import type { Profile } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscoverCard {
  id: string
  score: number
  one_liner: string | null
  explanation: string | null
  profile: Profile
}

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

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="max-w-md mx-auto py-6 flex flex-col gap-4">
      <div className="h-4 bg-slate-200 rounded-full w-44 mx-auto animate-pulse" />
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center gap-4">
        <div className="w-[120px] h-[120px] rounded-full bg-slate-200 animate-pulse" />
        <div className="h-7 bg-slate-200 rounded-full w-40 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-7 bg-slate-200 rounded-full w-20 animate-pulse" />
          <div className="h-7 bg-slate-200 rounded-full w-16 animate-pulse" />
        </div>
        <div className="w-full h-16 bg-slate-100 rounded-xl animate-pulse" />
        <div className="w-full space-y-2">
          <div className="h-3.5 bg-slate-200 rounded-full animate-pulse" />
          <div className="h-3.5 bg-slate-200 rounded-full w-5/6 animate-pulse" />
          <div className="h-3.5 bg-slate-200 rounded-full w-4/6 animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-7 bg-slate-100 rounded-full w-14 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-14 bg-slate-100 rounded-xl animate-pulse" />
        <div className="flex-1 h-14 bg-purple-100 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center mb-5">
        <UserCheck className="w-9 h-9 text-purple-400" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">
        You&apos;ve reviewed all your matches
      </h3>
      <p className="text-sm text-slate-500 mb-8 max-w-xs leading-relaxed">
        Keep your profile fresh to attract better matches. The AI updates recommendations regularly.
      </p>
      <Link
        href="/settings/profile"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm"
      >
        <Sparkles className="w-4 h-4" />
        Update your profile
      </Link>
    </div>
  )
}

// ─── Match card ───────────────────────────────────────────────────────────────

interface MatchCardProps {
  card: DiscoverCard
  expanded: boolean
  onToggleExpanded: () => void
  viewerName: string
}

function MatchCard({ card, expanded, onToggleExpanded, viewerName }: MatchCardProps) {
  const { profile, score, one_liner, explanation } = card
  const scorePercent = Math.round(score * 100)

  const barColor   = scorePercent > 75 ? 'bg-green-500'  : scorePercent >= 50 ? 'bg-amber-400'  : 'bg-orange-500'
  const textColor  = scorePercent > 75 ? 'text-green-600': scorePercent >= 50 ? 'text-amber-600': 'text-orange-600'
  const trackColor = scorePercent > 75 ? 'bg-green-100'  : scorePercent >= 50 ? 'bg-amber-100'  : 'bg-orange-100'

  const avatarSrc = profile.image_url ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(profile.name ?? profile.id)}`

  const socialLinks = [
    { href: profile.linkedin_url,  icon: <Linkedin className="w-4 h-4" />,  label: 'LinkedIn'  },
    { href: profile.github_url,    icon: <Github className="w-4 h-4" />,    label: 'GitHub'    },
    { href: profile.twitter_url,   icon: <Twitter className="w-4 h-4" />,   label: 'Twitter'   },
    { href: profile.portfolio_url, icon: <Globe className="w-4 h-4" />,     label: 'Portfolio' },
  ].filter((l) => l.href)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 flex flex-col items-center gap-5">

        {/* Avatar */}
        <Link href={`/profile/${profile.id}`} className="block group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            alt={profile.name ?? 'Profile'}
            className="w-[120px] h-[120px] rounded-full object-cover bg-slate-100 border-4 border-white shadow-md group-hover:shadow-lg transition-shadow"
          />
        </Link>

        {/* Name */}
        <Link href={`/profile/${profile.id}`} className="group text-center">
          <h2 className="text-2xl font-bold text-slate-900 group-hover:text-purple-600 transition-colors leading-tight">
            {profile.name}
          </h2>
        </Link>

        {/* Intent badges */}
        {profile.intent.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {profile.intent.map((i) => (
              <span
                key={i}
                className={cn('text-sm px-3 py-1 rounded-full font-medium capitalize', INTENT_STYLES[i] ?? 'bg-slate-100 text-slate-600')}
              >
                {i}
              </span>
            ))}
          </div>
        )}

        {/* Compatibility score */}
        <div className={cn('w-full rounded-xl p-4 flex items-center gap-4', trackColor)}>
          <div className="text-center shrink-0 w-16">
            <span className={cn('text-3xl font-bold tabular-nums', textColor)}>{scorePercent}%</span>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Match</p>
          </div>
          <div className="flex-1">
            <div className="w-full h-2.5 bg-white/60 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', barColor)}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Ikigai mission */}
        {profile.ikigai_mission && (
          <p className="text-center text-sm text-slate-600 italic leading-relaxed px-2">
            &ldquo;{profile.ikigai_mission}&rdquo;
          </p>
        )}

        {/* Top 6 skills */}
        {profile.skills.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {profile.skills.slice(0, 6).map((s) => (
              <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                {s}
              </span>
            ))}
            {profile.skills.length > 6 && (
              <span className="text-xs text-slate-400 self-center">+{profile.skills.length - 6} more</span>
            )}
          </div>
        )}

        {/* Availability + working style */}
        {(profile.availability || profile.working_style) && (
          <div className="flex flex-wrap justify-center gap-2">
            {profile.availability && (
              <span className="text-xs font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {AVAILABILITY_LABELS[profile.availability] ?? profile.availability}
              </span>
            )}
            {profile.working_style && (
              <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {WORKING_STYLE_LABELS[profile.working_style] ?? profile.working_style}
              </span>
            )}
          </div>
        )}

        {/* One-liner */}
        {one_liner && (
          <div className="w-full bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
            <p className="text-sm text-purple-800 font-medium text-center leading-relaxed">
              {one_liner}
            </p>
          </div>
        )}

        {/* "Why this match?" accordion */}
        {explanation && (
          <div className="w-full border-t border-slate-100 pt-4">
            <button
              onClick={onToggleExpanded}
              className="flex items-center justify-between w-full text-sm font-semibold text-slate-600 hover:text-purple-600 transition-colors"
            >
              Why this match?
              <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', expanded && 'rotate-180')} />
            </button>
            <div
              className={cn(
                'overflow-hidden transition-all duration-300 ease-in-out',
                expanded ? 'max-h-none mt-3 opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <p className="text-sm text-slate-600 leading-relaxed">{formatExplanation(explanation, viewerName)}</p>
            </div>
          </div>
        )}

        {/* Social links */}
        {socialLinks.length > 0 && (
          <div className="flex gap-4 pt-1">
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
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [cards, setCards]               = useState<DiscoverCard[]>([])
  const [index, setIndex]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [fading, setFading]             = useState(false)
  const [connecting, setConnecting]     = useState(false)
  const [expandedExpl, setExpandedExpl] = useState(false)
  const [viewerName, setViewerName]     = useState('')

  // Reset accordion when card changes
  useEffect(() => { setExpandedExpl(false) }, [index])

  // ── Fetch matches on mount ─────────────────────────────────────────────────
  const fetchMatches = useCallback(async () => {
    setLoading(true)
    const supabase = createBrowserClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    // Get viewer's profile
    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!viewerProfile) { setLoading(false); return }

    const profileId = viewerProfile.id
    setViewerName(viewerProfile.name ?? '')

    // Parallel: matches + connections + blocks
    const [matchesRes, connectionsRes, blocksRes] = await Promise.all([
      supabase
        .from('matches')
        .select(`
          id, score, one_liner, explanation,
          profile:profiles!matched_profile_id(
            id, user_id, name, image_url, bio, intent, skills, interests,
            availability, working_style, ikigai_mission,
            portfolio_url, linkedin_url, github_url, twitter_url, is_public
          )
        `)
        .eq('user_id', profileId)
        .order('score', { ascending: false })
        .limit(25),

      supabase
        .from('connections')
        .select('requester_id, receiver_id')
        .or(`requester_id.eq.${profileId},receiver_id.eq.${profileId}`),

      supabase
        .from('blocks')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${profileId},blocked_id.eq.${profileId}`),
    ])

    // Build exclusion sets
    const connectedIds = new Set<string>()
    for (const c of connectionsRes.data ?? []) {
      connectedIds.add(c.requester_id === profileId ? c.receiver_id : c.requester_id)
    }
    const blockedIds = new Set<string>()
    for (const b of blocksRes.data ?? []) {
      blockedIds.add(b.blocker_id === profileId ? b.blocked_id : b.blocker_id)
    }

    // Filter (Supabase infers the joined profile as array; cast via unknown)
    const filtered = ((matchesRes.data ?? []) as unknown as DiscoverCard[]).filter((m) => {
      const p = m.profile
      if (!p?.is_public) return false
      if (connectedIds.has(p.id)) return false
      if (blockedIds.has(p.id)) return false
      return true
    })

    console.log('[discover] matches fetched:', filtered.length, 'after filtering')
    setCards(filtered)
    setLoading(false)
  }, [])

  useEffect(() => { fetchMatches() }, [fetchMatches])

  // ── Card advance with fade ─────────────────────────────────────────────────
  async function advance() {
    setFading(true)
    await new Promise((r) => setTimeout(r, 180))
    setIndex((i) => i + 1)
    setFading(false)
  }

  // ── Skip ───────────────────────────────────────────────────────────────────
  function handleSkip() {
    advance()
  }

  // ── Connect ────────────────────────────────────────────────────────────────
  async function handleConnect() {
    const card = cards[index]
    if (!card) return
    setConnecting(true)
    try {
      const res = await fetch('/api/connections/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver_profile_id: card.profile.id }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to send request')
      toast(`Connection request sent to ${card.profile.name?.split(' ')[0] ?? 'them'}!`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to connect', 'error')
    } finally {
      setConnecting(false)
      advance()
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  const currentCard = cards[index]

  if (!currentCard) return <EmptyState />

  return (
    <div className="max-w-md mx-auto py-4 sm:py-8 flex flex-col gap-4">

      {/* Card with fade transition */}
      <div
        className={cn(
          'transition-all duration-200 ease-in-out',
          fading ? 'opacity-0 scale-[0.97]' : 'opacity-100 scale-100'
        )}
      >
        <MatchCard
          card={currentCard}
          expanded={expandedExpl}
          onToggleExpanded={() => setExpandedExpl((e) => !e)}
          viewerName={viewerName}
        />
      </div>

      {/* Action buttons */}
      <div
        className={cn(
          'flex gap-3 transition-opacity duration-200',
          fading ? 'opacity-0' : 'opacity-100'
        )}
      >
        <button
          onClick={handleSkip}
          disabled={fading || connecting}
          className="flex-1 py-4 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-base hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 transition-colors"
        >
          Skip
        </button>
        <button
          onClick={handleConnect}
          disabled={fading || connecting}
          className="flex-1 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold text-base hover:from-purple-700 hover:to-violet-700 disabled:opacity-40 transition-all shadow-sm hover:shadow-md"
        >
          {connecting ? 'Sending…' : 'Connect'}
        </button>
      </div>

    </div>
  )
}
