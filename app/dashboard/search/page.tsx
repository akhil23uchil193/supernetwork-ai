'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Search, User, Sparkles, UserPlus, Check, Clock, X,
  Linkedin, Github, Twitter, Globe,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/toaster'
import { cn, getBlockedProfileIds } from '@/lib/utils'
import { DICEBEAR_BASE_URL } from '@/lib/constants'
import type { Profile } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchMode = 'skills' | 'person'

interface SearchResult {
  profile:            Profile
  final_score:        number
  relevance_score:    number | null
  match_score:        number
  search_explanation: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTENT_STYLES: Record<string, string> = {
  cofounder: 'bg-purple-100 text-purple-700',
  teammate:  'bg-blue-100 text-blue-700',
  client:    'bg-green-100 text-green-700',
}

const INTENT_ACTIVE_STYLES: Record<string, string> = {
  cofounder: 'bg-purple-100 text-purple-700 border-purple-200',
  teammate:  'bg-blue-100 text-blue-700 border-blue-200',
  client:    'bg-green-100 text-green-700 border-green-200',
}

const AVAILABILITY_LABELS: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  weekends:  'Weekends Only',
}

const INTENT_OPTIONS = ['cofounder', 'teammate', 'client'] as const

// ─── Result card ─────────────────────────────────────────────────────────────

interface ResultCardProps {
  result:     SearchResult
  connected:  boolean
  onConnect:  (profileId: string, name: string) => Promise<void>
  connecting: boolean
}

function ResultCard({ result, connected, onConnect, connecting }: ResultCardProps) {
  const { profile, final_score, search_explanation } = result
  const avatarSrc = profile.image_url ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(profile.name ?? profile.id)}`
  const pct = Math.round(final_score * 100)

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
            <div className="flex flex-wrap gap-1 mt-1.5">
              {profile.intent.slice(0, 2).map((i) => (
                <span key={i} className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full capitalize', INTENT_STYLES[i] ?? 'bg-slate-100 text-slate-600')}>
                  {i}
                </span>
              ))}
            </div>
          </div>
          {pct > 0 && (
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-full border shrink-0',
              pct > 75  ? 'bg-green-100 text-green-700 border-green-200'  :
              pct >= 50 ? 'bg-amber-100 text-amber-700 border-amber-200'  :
                          'bg-orange-100 text-orange-700 border-orange-200'
            )}>
              {pct}%
            </span>
          )}
        </div>

        {/* Search explanation */}
        {search_explanation && (
          <p className="text-xs text-slate-600 leading-relaxed bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
            {search_explanation}
          </p>
        )}

        {/* Skills */}
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [mode, setMode] = useState<SearchMode>('skills')

  // Mode 1: AI search state
  const [query, setQuery]             = useState('')
  const [intentFilter, setIntentFilter] = useState<string[]>([])
  const [results, setResults]         = useState<SearchResult[]>([])
  const [searching, setSearching]     = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Mode 2: name search state
  const [nameQuery, setNameQuery]         = useState('')
  const [nameResults, setNameResults]     = useState<Profile[]>([])
  const [nameSearching, setNameSearching] = useState(false)

  // Shared
  const [connectedIds, setConnectedIds]   = useState<Set<string>>(new Set())
  const [blockedIds,   setBlockedIds]     = useState<Set<string>>(new Set())
  const [connectingId, setConnectingId]   = useState<string | null>(null)

  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load connected IDs + blocked IDs on mount
  useEffect(() => {
    async function init() {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: vp } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!vp) return

      const [connections, blockedArr] = await Promise.all([
        supabase
          .from('connections')
          .select('requester_id, receiver_id')
          .or(`requester_id.eq.${vp.id},receiver_id.eq.${vp.id}`)
          .then((r) => r.data ?? []),
        getBlockedProfileIds(supabase, vp.id),
      ])

      const connected = new Set<string>()
      for (const c of connections) {
        const otherId = c.requester_id === vp.id ? c.receiver_id : c.requester_id
        connected.add(otherId)
      }
      setConnectedIds(connected)
      setBlockedIds(new Set(blockedArr))
    }
    init()
  }, [])

  // ── Mode 1: AI search ──────────────────────────────────────────────────────
  async function handleSearch() {
    setSearching(true)
    setHasSearched(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, intent_filter: intentFilter }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Search failed')
      setResults(json.results ?? [])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Search failed', 'error')
    } finally {
      setSearching(false)
    }
  }

  function toggleIntent(intent: string) {
    setIntentFilter((prev) =>
      prev.includes(intent) ? prev.filter((i) => i !== intent) : [...prev, intent]
    )
  }

  // ── Mode 2: debounced name search ──────────────────────────────────────────
  const handleNameSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setNameResults([]); return }
    setNameSearching(true)
    try {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_public', true)
        .ilike('name', `%${q}%`)
        .limit(20)
      const filtered = ((data ?? []) as Profile[]).filter((p) => !blockedIds.has(p.id))
      setNameResults(filtered)
    } finally {
      setNameSearching(false)
    }
  }, [blockedIds])

  useEffect(() => {
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current)
    nameDebounceRef.current = setTimeout(() => handleNameSearch(nameQuery), 300)
    return () => { if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current) }
  }, [nameQuery, handleNameSearch])

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Search</h1>
        <p className="text-slate-500 text-sm mt-1">Find your next collaborator</p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setMode('skills')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all',
            mode === 'skills'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Sparkles className="w-3.5 h-3.5" />
          By Skills &amp; Intent
        </button>
        <button
          onClick={() => setMode('person')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all',
            mode === 'person'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <User className="w-3.5 h-3.5" />
          Find a Person
        </button>
      </div>

      {/* ── Mode 1: Skills & Intent ────────────────────────────────────────── */}
      {mode === 'skills' && (
        <div className="space-y-5">

          {/* Search bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !searching && handleSearch()}
                placeholder="e.g. React developer open to co-founding a B2B SaaS startup…"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-5 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {/* Intent filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Filter:</span>
            {INTENT_OPTIONS.map((intent) => (
              <button
                key={intent}
                onClick={() => toggleIntent(intent)}
                className={cn(
                  'text-xs font-medium px-3 py-1 rounded-full border capitalize transition-colors',
                  intentFilter.includes(intent)
                    ? INTENT_ACTIVE_STYLES[intent]
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                )}
              >
                {intentFilter.includes(intent) && <span className="mr-1">✓</span>}
                {intent}
              </button>
            ))}
            {intentFilter.length > 0 && (
              <button
                onClick={() => setIntentFilter([])}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {/* Results */}
          {searching ? (
            <LoadingSkeleton />
          ) : hasSearched && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Search className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">No results found</h3>
              <p className="text-sm text-slate-400">Try broadening your search or removing filters.</p>
            </div>
          ) : results.length > 0 ? (
            <>
              <p className="text-sm text-slate-400">
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((result) => (
                  <ResultCard
                    key={result.profile.id}
                    result={result}
                    connected={connectedIds.has(result.profile.id)}
                    onConnect={handleConnect}
                    connecting={connectingId === result.profile.id}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">Search by skills and intent</h3>
              <p className="text-sm text-slate-400 max-w-xs">
                Describe who you&apos;re looking for — our AI will find the best matches.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Mode 2: Find a Person ──────────────────────────────────────────── */}
      {mode === 'person' && (
        <div className="space-y-5">

          {/* Search bar */}
          <div className="relative max-w-lg">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Search by name…"
              autoFocus
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />
            {nameSearching && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Results */}
          {nameQuery.trim() === '' ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <User className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">Find someone specific</h3>
              <p className="text-sm text-slate-400">Type a name to search the network.</p>
            </div>
          ) : nameResults.length === 0 && !nameSearching ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <User className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">No one found</h3>
              <p className="text-sm text-slate-400">Try a different name.</p>
            </div>
          ) : (
            <>
              {nameResults.length > 0 && (
                <p className="text-sm text-slate-400">
                  {nameResults.length} result{nameResults.length !== 1 ? 's' : ''} found
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {nameResults.map((profile) => (
                  <ResultCard
                    key={profile.id}
                    result={{ profile, final_score: 0, relevance_score: null, match_score: 0, search_explanation: null }}
                    connected={connectedIds.has(profile.id)}
                    onConnect={handleConnect}
                    connecting={connectingId === profile.id}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
