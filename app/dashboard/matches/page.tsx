'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Clock, UserPlus, Check, ArrowUpDown,
  Linkedin, Github, Twitter, Globe,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { DICEBEAR_BASE_URL } from '@/lib/constants'
import type { Profile } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchRow {
  id: string
  score: number
  one_liner: string | null
  computed_at: string
  profile: Profile
}

type FilterTab = 'all' | 'cofounder' | 'teammate' | 'client'
type SortKey   = 'score' | 'recent'

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

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'cofounder', label: 'Cofounder' },
  { key: 'teammate',  label: 'Teammate'  },
  { key: 'client',    label: 'Client'    },
]

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const cls =
    pct > 75 ? 'bg-green-100 text-green-700 border-green-200'  :
    pct >= 50 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                'bg-orange-100 text-orange-700 border-orange-200'
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border', cls)}>
      <Sparkles className="w-3 h-3" />
      {pct}% Match
    </span>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-[72px] h-[72px] rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-28" />
              <div className="h-3 bg-slate-100 rounded w-20" />
              <div className="h-5 bg-slate-100 rounded-full w-24" />
            </div>
          </div>
          <div className="h-3 bg-slate-100 rounded w-full" />
          <div className="h-3 bg-slate-100 rounded w-5/6" />
          <div className="flex gap-1.5">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-6 bg-slate-100 rounded-full w-14" />
            ))}
          </div>
          <div className="flex gap-2 mt-1">
            <div className="flex-1 h-9 bg-slate-100 rounded-lg" />
            <div className="flex-1 h-9 bg-purple-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center col-span-full">
      <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
        <Sparkles className="w-7 h-7 text-purple-400" />
      </div>
      {filtered ? (
        <>
          <h3 className="text-base font-semibold text-slate-700 mb-1">No matches in this category</h3>
          <p className="text-sm text-slate-400">Try switching to &quot;All&quot; to see everyone.</p>
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold text-slate-700 mb-1">Computing your matches…</h3>
          <p className="text-sm text-slate-400 max-w-xs">
            Our AI is analysing your profile. Check back in a moment — results update automatically.
          </p>
        </>
      )}
    </div>
  )
}

// ─── Match card ───────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: MatchRow
  connected: boolean
  onConnect: (profileId: string, name: string) => Promise<void>
  connecting: boolean
}

function MatchCard({ match, connected, onConnect, connecting }: MatchCardProps) {
  const { profile, score, one_liner } = match
  const avatarSrc = profile.image_url ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(profile.name ?? profile.id)}`

  const socialLinks = [
    { href: profile.linkedin_url,  icon: <Linkedin className="w-3.5 h-3.5" />, label: 'LinkedIn'  },
    { href: profile.github_url,    icon: <Github className="w-3.5 h-3.5" />,   label: 'GitHub'    },
    { href: profile.twitter_url,   icon: <Twitter className="w-3.5 h-3.5" />,  label: 'Twitter'   },
    { href: profile.portfolio_url, icon: <Globe className="w-3.5 h-3.5" />,    label: 'Portfolio' },
  ].filter((l) => l.href)

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all flex flex-col h-full">
      <div className="p-5 flex flex-col gap-3 flex-1">

        {/* Header: avatar + name + score */}
        <div className="flex items-start gap-3">
          <Link href={`/profile/${profile.id}`} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc}
              alt={profile.name ?? 'Profile'}
              className="w-[72px] h-[72px] rounded-full object-cover bg-slate-100 hover:opacity-90 transition-opacity"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/profile/${profile.id}`}>
              <p className="font-semibold text-slate-900 hover:text-purple-600 transition-colors truncate leading-tight">
                {profile.name}
              </p>
            </Link>
            {profile.availability && (
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {AVAILABILITY_LABELS[profile.availability] ?? profile.availability}
              </p>
            )}
            {/* Intent badges */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {profile.intent.slice(0, 2).map((i) => (
                <span key={i} className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full capitalize', INTENT_STYLES[i] ?? 'bg-slate-100 text-slate-600')}>
                  {i}
                </span>
              ))}
            </div>
          </div>
          <ScoreBadge score={score} />
        </div>

        {/* One-liner */}
        {one_liner && (
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 bg-purple-50 px-3 py-2 rounded-lg border border-purple-100">
            {one_liner}
          </p>
        )}

        {/* Top 4 skills */}
        {profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.slice(0, 4).map((s) => (
              <span key={s} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                {s}
              </span>
            ))}
            {profile.skills.length > 4 && (
              <span className="text-[11px] text-slate-400">+{profile.skills.length - 4}</span>
            )}
          </div>
        )}

        {/* Social icons */}
        {socialLinks.length > 0 && (
          <div className="flex gap-2.5">
            {socialLinks.map(({ href, icon, label }) => (
              <a
                key={label}
                href={href!}
                target="_blank"
                rel="noopener noreferrer"
                title={label}
                className="text-slate-300 hover:text-purple-500 transition-colors"
              >
                {icon}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 flex gap-2 mt-auto">
        <Link
          href={`/profile/${profile.id}`}
          className="flex-1 text-center py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          View Profile
        </Link>
        {connected ? (
          <button
            disabled
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
            Connected
          </button>
        ) : (
          <button
            onClick={() => onConnect(profile.id, profile.name ?? 'them')}
            disabled={connecting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {connecting ? '…' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const router = useRouter()
  const [matches, setMatches]         = useState<MatchRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<FilterTab>('all')
  const [sortKey, setSortKey]         = useState<SortKey>('score')
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set())
  const [connectingId, setConnectingId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchMatches = useCallback(async () => {
    setLoading(true)
    const supabase = createBrowserClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!viewerProfile) { setLoading(false); return }
    const profileId = viewerProfile.id

    const [matchesRes, connectionsRes, blocksRes] = await Promise.all([
      supabase
        .from('matches')
        .select(`
          id, score, one_liner, computed_at,
          profile:profiles!matched_profile_id(
            id, user_id, name, image_url, bio, intent, skills, interests,
            availability, working_style, portfolio_url, linkedin_url,
            github_url, twitter_url, is_public
          )
        `)
        .eq('user_id', profileId)
        .order('score', { ascending: false }),

      supabase
        .from('connections')
        .select('requester_id, receiver_id, status')
        .or(`requester_id.eq.${profileId},receiver_id.eq.${profileId}`),

      supabase
        .from('blocks')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${profileId},blocked_id.eq.${profileId}`),
    ])

    // Exclusion sets
    const blockedSet = new Set<string>()
    for (const b of blocksRes.data ?? []) {
      blockedSet.add(b.blocker_id === profileId ? b.blocked_id : b.blocker_id)
    }

    const connected = new Set<string>()
    for (const c of connectionsRes.data ?? []) {
      const otherId = c.requester_id === profileId ? c.receiver_id : c.requester_id
      connected.add(otherId)
    }
    setConnectedIds(connected)

    const filtered = ((matchesRes.data ?? []) as unknown as MatchRow[]).filter((m) => {
      const p = m.profile
      if (!p?.is_public) return false
      if (blockedSet.has(p.id)) return false
      return true
    })

    setMatches(filtered)
    setLoading(false)
  }, [router])

  useEffect(() => { fetchMatches() }, [fetchMatches])

  // ── Connect ────────────────────────────────────────────────────────────────
  async function handleConnect(profileId: string, name: string) {
    setConnectingId(profileId)
    try {
      const res = await fetch('/api/connections/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver_profile_id: profileId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')
      setConnectedIds((prev) => { const next = new Set(prev); next.add(profileId); return next })
      toast(`Connection request sent to ${name.split(' ')[0]}!`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to connect', 'error')
    } finally {
      setConnectingId(null)
    }
  }

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = matches
    if (activeTab !== 'all') {
      list = list.filter((m) => m.profile.intent?.includes(activeTab))
    }
    if (sortKey === 'recent') {
      list = [...list].sort((a, b) =>
        new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime()
      )
    }
    return list
  }, [matches, activeTab, sortKey])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Matches</h1>
        <p className="text-slate-500 text-sm mt-1">
          AI-curated profiles based on your Ikigai and skills
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 self-start">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                activeTab === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Count + sort */}
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-sm text-slate-400">
              {displayed.length} {displayed.length === 1 ? 'match' : 'matches'} found
            </span>
          )}
          <div className="relative">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="appearance-none pl-8 pr-4 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors cursor-pointer"
            >
              <option value="score">Match Score</option>
              <option value="recent">Most Recent</option>
            </select>
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.length === 0 ? (
            <EmptyState filtered={activeTab !== 'all'} />
          ) : (
            displayed.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                connected={connectedIds.has(match.profile.id)}
                onConnect={handleConnect}
                connecting={connectingId === match.profile.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
