'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  UserPlus, Check, X, Clock, MessageCircle, Users,
  Hourglass, Sparkles,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/toaster'
import { cn, getBlockedProfileIds } from '@/lib/utils'
import { DICEBEAR_BASE_URL } from '@/lib/constants'
import type { Profile } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveTab = 'requests' | 'connected'

interface ConnRow {
  id: string
  requester_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  other_profile: Profile
  i_am: 'requester' | 'receiver'
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

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 animate-pulse">
          <div className="w-14 h-14 rounded-full bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-32" />
            <div className="h-3 bg-slate-100 rounded w-24" />
            <div className="flex gap-1">
              <div className="h-5 bg-slate-100 rounded-full w-16" />
              <div className="h-5 bg-slate-100 rounded-full w-16" />
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="h-9 w-24 bg-slate-100 rounded-lg" />
            <div className="h-9 w-20 bg-slate-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-28" />
              <div className="h-3 bg-slate-100 rounded w-20" />
              <div className="h-5 bg-slate-100 rounded-full w-20" />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <div className="flex-1 h-9 bg-slate-100 rounded-lg" />
            <div className="flex-1 h-9 bg-purple-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Request row (received) ───────────────────────────────────────────────────

interface ReceivedRowProps {
  conn: ConnRow
  onAccept: (connId: string) => Promise<void>
  onDecline: (connId: string) => Promise<void>
  loading: string | null
}

function ReceivedRow({ conn, onAccept, onDecline, loading }: ReceivedRowProps) {
  const p = conn.other_profile
  const avatar = p.image_url ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(p.name ?? p.id)}`
  const busy = loading === conn.id

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:border-slate-300 transition-colors">
      <Link href={`/profile/${p.id}`} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar}
          alt={p.name ?? 'Profile'}
          className="w-14 h-14 rounded-full object-cover bg-slate-100 hover:opacity-90 transition-opacity"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/profile/${p.id}`}>
          <p className="font-semibold text-slate-900 hover:text-purple-600 transition-colors truncate leading-tight">
            {p.name}
          </p>
        </Link>
        {p.availability && (
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {AVAILABILITY_LABELS[p.availability] ?? p.availability}
          </p>
        )}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {p.intent.slice(0, 2).map((i) => (
            <span key={i} className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full capitalize', INTENT_STYLES[i] ?? 'bg-slate-100 text-slate-600')}>
              {i}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onAccept(conn.id)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          {loading === `accept-${conn.id}` ? 'Accepting…' : 'Accept'}
        </button>
        <button
          onClick={() => onDecline(conn.id)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          {loading === `decline-${conn.id}` ? 'Declining…' : 'Decline'}
        </button>
      </div>
    </div>
  )
}

// ─── Sent request row ─────────────────────────────────────────────────────────

interface SentRowProps {
  conn: ConnRow
  onCancel: (connId: string) => Promise<void>
  loading: string | null
}

function SentRow({ conn, onCancel, loading }: SentRowProps) {
  const p = conn.other_profile
  const avatar = p.image_url ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(p.name ?? p.id)}`
  const busy = loading === conn.id

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:border-slate-300 transition-colors">
      <Link href={`/profile/${p.id}`} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar}
          alt={p.name ?? 'Profile'}
          className="w-14 h-14 rounded-full object-cover bg-slate-100 hover:opacity-90 transition-opacity"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/profile/${p.id}`}>
          <p className="font-semibold text-slate-900 hover:text-purple-600 transition-colors truncate leading-tight">
            {p.name}
          </p>
        </Link>
        {p.availability && (
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {AVAILABILITY_LABELS[p.availability] ?? p.availability}
          </p>
        )}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {p.intent.slice(0, 2).map((i) => (
            <span key={i} className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full capitalize', INTENT_STYLES[i] ?? 'bg-slate-100 text-slate-600')}>
              {i}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold">
          <Hourglass className="w-3 h-3" />
          Pending
        </span>
        <button
          onClick={() => onCancel(conn.id)}
          disabled={busy}
          className="text-xs text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50 font-medium px-2 py-1.5"
        >
          {loading === conn.id ? 'Cancelling…' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}

// ─── Connected card ───────────────────────────────────────────────────────────

interface ConnectedCardProps {
  conn: ConnRow
}

function ConnectedCard({ conn }: ConnectedCardProps) {
  const p = conn.other_profile
  const avatar = p.image_url ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(p.name ?? p.id)}`
  const messageHref = `/dashboard/messages/${conn.id}`

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all flex flex-col h-full">
      <div className="p-5 flex flex-col gap-3 flex-1">

        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href={`/profile/${p.id}`} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar}
              alt={p.name ?? 'Profile'}
              className="w-[64px] h-[64px] rounded-full object-cover bg-slate-100 hover:opacity-90 transition-opacity"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/profile/${p.id}`}>
              <p className="font-semibold text-slate-900 hover:text-purple-600 transition-colors truncate leading-tight">
                {p.name}
              </p>
            </Link>
            {p.availability && (
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {AVAILABILITY_LABELS[p.availability] ?? p.availability}
              </p>
            )}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {p.intent.slice(0, 2).map((i) => (
                <span key={i} className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full capitalize', INTENT_STYLES[i] ?? 'bg-slate-100 text-slate-600')}>
                  {i}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bio snippet */}
        {p.bio && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{p.bio}</p>
        )}

        {/* Top skills */}
        {p.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.skills.slice(0, 4).map((s) => (
              <span key={s} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                {s}
              </span>
            ))}
            {p.skills.length > 4 && (
              <span className="text-[11px] text-slate-400">+{p.skills.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex gap-2 mt-auto">
        <Link
          href={`/profile/${p.id}`}
          className="flex-1 text-center py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          View Profile
        </Link>
        <Link
          href={messageHref}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Message
        </Link>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ActiveTab>('requests')
  const [loading, setLoading]     = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [received,  setReceived]  = useState<ConnRow[]>([])
  const [sent,      setSent]      = useState<ConnRow[]>([])
  const [connected, setConnected] = useState<ConnRow[]>([])

  // ── Fetch all connections ──────────────────────────────────────────────────
  const fetchConnections = useCallback(async () => {
    setLoading(true)
    const supabase = createBrowserClient()

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: vp } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!vp) return
      const vpId = vp.id

      // Fetch blocked IDs (bidirectional) and connections in parallel
      const blockedArr = await getBlockedProfileIds(supabase, vpId)
      const blockedSet = new Set(blockedArr)

      // Two parallel queries: connections as requester and as receiver
      const [asRequesterRes, asReceiverRes] = await Promise.all([
        supabase
          .from('connections')
          .select(`
            id, requester_id, receiver_id, status, created_at,
            other_profile:profiles!receiver_id(
              id, name, image_url, bio, intent, skills, availability,
              working_style, is_public, portfolio_url, linkedin_url,
              github_url, twitter_url, interests, cv_url, user_id,
              ikigai_love, ikigai_good_at, ikigai_world_needs, ikigai_paid_for, ikigai_mission,
              profile_completion_score, match_criteria, created_at, updated_at
            )
          `)
          .eq('requester_id', vpId)
          .neq('status', 'rejected'),

        supabase
          .from('connections')
          .select(`
            id, requester_id, receiver_id, status, created_at,
            other_profile:profiles!requester_id(
              id, name, image_url, bio, intent, skills, availability,
              working_style, is_public, portfolio_url, linkedin_url,
              github_url, twitter_url, interests, cv_url, user_id,
              ikigai_love, ikigai_good_at, ikigai_world_needs, ikigai_paid_for, ikigai_mission,
              profile_completion_score, match_criteria, created_at, updated_at
            )
          `)
          .eq('receiver_id', vpId)
          .neq('status', 'rejected'),
      ])

      type RawRow = {
        id: string
        requester_id: string
        receiver_id: string
        status: string
        created_at: string
        other_profile: Profile | null
      }

      const asSent     = ((asRequesterRes.data ?? []) as unknown as RawRow[]).map((r) => ({
        ...r,
        status: r.status as ConnRow['status'],
        i_am:   'requester' as const,
      }))
      const asReceived = ((asReceiverRes.data ?? []) as unknown as RawRow[]).map((r) => ({
        ...r,
        status: r.status as ConnRow['status'],
        i_am:   'receiver' as const,
      }))

      // Filter out null profiles (RLS-hidden or deleted) and blocked profiles
      const all = ([...asSent, ...asReceived] as (RawRow & { status: ConnRow['status']; i_am: 'requester' | 'receiver' })[])
        .filter((c): c is ConnRow & { i_am: 'requester' | 'receiver' } =>
          c.other_profile !== null && !blockedSet.has(c.other_profile.id)
        )

      setReceived(all.filter((c) => c.i_am === 'receiver' && c.status === 'pending'))
      setSent(all.filter((c) => c.i_am === 'requester' && c.status === 'pending'))
      setConnected(
        all
          .filter((c) => c.status === 'accepted')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      )
    } catch (err) {
      console.error('[ConnectionsPage] fetchConnections error:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchConnections() }, [fetchConnections])

  // ── Accept ─────────────────────────────────────────────────────────────────
  async function handleAccept(connId: string) {
    setActionLoading(`accept-${connId}`)
    try {
      const res = await fetch('/api/connections/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connId, action: 'accept' }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')

      // Move from received → connected
      const conn = received.find((c) => c.id === connId)
      if (conn) {
        setReceived((prev) => prev.filter((c) => c.id !== connId))
        setConnected((prev) => [{ ...conn, status: 'accepted' }, ...prev])
      }
      toast('Connection accepted!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to accept', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Decline ────────────────────────────────────────────────────────────────
  async function handleDecline(connId: string) {
    setActionLoading(`decline-${connId}`)
    try {
      const res = await fetch('/api/connections/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connId, action: 'reject' }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')
      setReceived((prev) => prev.filter((c) => c.id !== connId))
      toast('Connection declined.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to decline', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Cancel sent request ────────────────────────────────────────────────────
  async function handleCancel(connId: string) {
    setActionLoading(connId)
    try {
      const res = await fetch('/api/connections/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')
      setSent((prev) => prev.filter((c) => c.id !== connId))
      toast('Request cancelled.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to cancel', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const pendingCount = received.length + sent.length

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Connections</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your network and pending requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === 'requests'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Requests
          {!loading && pendingCount > 0 && (
            <span className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-purple-600 text-white text-[10px] font-bold px-1">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('connected')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === 'connected'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Users className="w-3.5 h-3.5" />
          Connected
          {!loading && connected.length > 0 && (
            <span className="ml-0.5 text-xs text-slate-400 font-normal">
              {connected.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Requests tab ──────────────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div className="space-y-8">
          {loading ? (
            <ListSkeleton />
          ) : received.length === 0 && sent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <UserPlus className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">No pending requests</h3>
              <p className="text-sm text-slate-400 max-w-xs">
                When someone wants to connect with you — or you reach out first — requests will appear here.
              </p>
              <Link
                href="/dashboard/discover"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Discover People
              </Link>
            </div>
          ) : (
            <>
              {/* Received */}
              {received.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Received ({received.length})
                  </h2>
                  <div className="flex flex-col gap-3">
                    {received.map((conn) => (
                      <ReceivedRow
                        key={conn.id}
                        conn={conn}
                        onAccept={handleAccept}
                        onDecline={handleDecline}
                        loading={actionLoading}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Sent */}
              {sent.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Sent ({sent.length})
                  </h2>
                  <div className="flex flex-col gap-3">
                    {sent.map((conn) => (
                      <SentRow
                        key={conn.id}
                        conn={conn}
                        onCancel={handleCancel}
                        loading={actionLoading}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Connected tab ──────────────────────────────────────────────────── */}
      {activeTab === 'connected' && (
        <>
          {loading ? (
            <GridSkeleton />
          ) : connected.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">No connections yet</h3>
              <p className="text-sm text-slate-400 max-w-xs">
                Start by discovering people and sending connection requests.
              </p>
              <Link
                href="/dashboard/discover"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Discover People
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-400 mb-4">
                {connected.length} {connected.length === 1 ? 'connection' : 'connections'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {connected.map((conn) => (
                  <ConnectedCard key={conn.id} conn={conn} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
