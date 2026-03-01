'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { DICEBEAR_BASE_URL } from '@/lib/constants'
import type { Profile } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MsgPreview {
  id: string
  content: string
  created_at: string
  sender_id: string
  read_at: string | null
  connection_id: string
}

interface ConversationRow {
  connection_id: string
  connection_created_at: string
  other_profile: Profile
  last_message: MsgPreview | null
  unread_count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + '…' : str
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading]             = useState(true)
  const viewerIdRef                       = useRef<string | null>(null)

  // ── Fetch inbox ────────────────────────────────────────────────────────────
  const fetchInbox = useCallback(async () => {
    setLoading(true)
    const supabase = createBrowserClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: vp } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!vp) { setLoading(false); return }
    const vpId = vp.id
    viewerIdRef.current = vpId

    // Fetch accepted connections (both directions) with joined other profile
    type RawConn = { id: string; created_at: string; other_profile: Profile }

    const [asRequesterRes, asReceiverRes] = await Promise.all([
      supabase
        .from('connections')
        .select(`
          id, created_at,
          other_profile:profiles!receiver_id(
            id, name, image_url, bio, intent, skills, availability,
            working_style, is_public, portfolio_url, linkedin_url,
            github_url, twitter_url, interests, cv_url, user_id,
            ikigai_love, ikigai_good_at, ikigai_world_needs, ikigai_paid_for, ikigai_mission,
            profile_completion_score, match_criteria, created_at, updated_at
          )
        `)
        .eq('requester_id', vpId)
        .eq('status', 'accepted'),

      supabase
        .from('connections')
        .select(`
          id, created_at,
          other_profile:profiles!requester_id(
            id, name, image_url, bio, intent, skills, availability,
            working_style, is_public, portfolio_url, linkedin_url,
            github_url, twitter_url, interests, cv_url, user_id,
            ikigai_love, ikigai_good_at, ikigai_world_needs, ikigai_paid_for, ikigai_mission,
            profile_completion_score, match_criteria, created_at, updated_at
          )
        `)
        .eq('receiver_id', vpId)
        .eq('status', 'accepted'),
    ])

    const allConns: RawConn[] = [
      ...((asRequesterRes.data ?? []) as unknown as RawConn[]),
      ...((asReceiverRes.data ?? []) as unknown as RawConn[]),
    ]

    if (allConns.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    const connectionIds = allConns.map((c) => c.id)

    // Fetch latest messages across all connections for previews + unread counts
    const { data: messages } = await supabase
      .from('messages')
      .select('id, content, created_at, sender_id, read_at, connection_id')
      .in('connection_id', connectionIds)
      .order('created_at', { ascending: false })
      .limit(500)

    // Group client-side: latest message + unread count per connection
    const latestByConn = new Map<string, MsgPreview>()
    const unreadByConn = new Map<string, number>()
    for (const id of connectionIds) { unreadByConn.set(id, 0) }

    for (const msg of (messages ?? []) as MsgPreview[]) {
      if (!latestByConn.has(msg.connection_id)) {
        latestByConn.set(msg.connection_id, msg)
      }
      if (msg.sender_id !== vpId && !msg.read_at) {
        unreadByConn.set(msg.connection_id, (unreadByConn.get(msg.connection_id) ?? 0) + 1)
      }
    }

    const rows: ConversationRow[] = allConns.map((conn) => ({
      connection_id:         conn.id,
      connection_created_at: conn.created_at,
      other_profile:         conn.other_profile,
      last_message:          latestByConn.get(conn.id) ?? null,
      unread_count:          unreadByConn.get(conn.id) ?? 0,
    }))

    rows.sort((a, b) => {
      const aTime = a.last_message?.created_at ?? a.connection_created_at
      const bTime = b.last_message?.created_at ?? b.connection_created_at
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

    setConversations(rows)
    setLoading(false)
  }, [router])

  useEffect(() => { fetchInbox() }, [fetchInbox])

  // ── Realtime: update previews + unread counts on new messages ─────────────
  useEffect(() => {
    if (conversations.length === 0) return

    const supabase = createBrowserClient()
    const vpId = viewerIdRef.current

    const channel = supabase
      .channel('inbox-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as MsgPreview
          setConversations((prev) => {
            const exists = prev.some((c) => c.connection_id === msg.connection_id)
            if (!exists) return prev

            const updated = prev.map((conv) => {
              if (conv.connection_id !== msg.connection_id) return conv
              return {
                ...conv,
                last_message: msg,
                unread_count: msg.sender_id !== vpId
                  ? conv.unread_count + 1
                  : conv.unread_count,
              }
            })

            return [...updated].sort((a, b) => {
              const aTime = a.last_message?.created_at ?? a.connection_created_at
              const bTime = b.last_message?.created_at ?? b.connection_created_at
              return new Date(bTime).getTime() - new Date(aTime).getTime()
            })
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversations.length])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 space-y-2">
          <div className="h-7 bg-slate-200 rounded w-32 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-44 animate-pulse" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-28" />
                <div className="h-3 bg-slate-100 rounded w-48" />
              </div>
              <div className="h-3 bg-slate-100 rounded w-8 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
        <p className="text-sm text-slate-500 mt-1">
          {conversations.length > 0
            ? `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`
            : 'Your conversations'}
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
            <MessageCircle className="w-7 h-7 text-purple-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">No messages yet</h3>
          <p className="text-sm text-slate-400 max-w-xs">
            Connect with someone to start chatting!
          </p>
          <Link
            href="/dashboard/connections"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
          >
            View Connections
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {conversations.map((conv) => {
            const p   = conv.other_profile
            const avatar = p.image_url ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(p.name ?? p.id)}`
            const msg = conv.last_message
            const isMe = msg?.sender_id === viewerIdRef.current
            const preview = msg
              ? `${isMe ? 'You: ' : ''}${truncate(msg.content, isMe ? 45 : 50)}`
              : null

            return (
              <Link
                key={conv.connection_id}
                href={`/dashboard/messages/${conv.connection_id}`}
                className="flex items-center gap-4 px-4 py-4 hover:bg-slate-50 transition-colors"
              >
                {/* Avatar + unread badge */}
                <div className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatar}
                    alt={p.name ?? ''}
                    className="w-12 h-12 rounded-full object-cover bg-slate-100"
                  />
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {conv.unread_count > 99 ? '99+' : conv.unread_count}
                    </span>
                  )}
                </div>

                {/* Name + preview + timestamp */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn(
                      'text-sm truncate',
                      conv.unread_count > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                    )}>
                      {p.name}
                    </p>
                    {msg && (
                      <span className="text-xs text-slate-400 shrink-0">
                        {relativeTime(msg.created_at)}
                      </span>
                    )}
                  </div>
                  {preview ? (
                    <p className={cn(
                      'text-sm mt-0.5 truncate',
                      conv.unread_count > 0 ? 'text-slate-700 font-medium' : 'text-slate-400'
                    )}>
                      {preview}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 mt-0.5 italic">No messages yet</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
