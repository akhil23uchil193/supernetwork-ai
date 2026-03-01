'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, AlertCircle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { DICEBEAR_BASE_URL } from '@/lib/constants'
import type { Profile } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MsgRow {
  id: string
  content: string
  created_at: string
  sender_id: string
  read_at: string | null
  connection_id: string
  isOptimistic?: boolean
}

type ChatItem =
  | { kind: 'divider'; label: string; key: string }
  | { kind: 'message'; msg: MsgRow }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateDivider(dateStr: string): string {
  const date      = new Date(dateStr)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString())     return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function buildChatItems(messages: MsgRow[]): ChatItem[] {
  const items: ChatItem[] = []
  let lastDateStr = ''
  for (const msg of messages) {
    const dateStr = new Date(msg.created_at).toDateString()
    if (dateStr !== lastDateStr) {
      items.push({
        kind:  'divider',
        label: formatDateDivider(msg.created_at),
        key:   `divider-${msg.id}`,
      })
      lastDateStr = dateStr
    }
    items.push({ kind: 'message', msg })
  }
  return items
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-4 max-w-2xl mx-auto">
      {[0, 1, 1, 0, 0, 1].map((isMe, i) => (
        <div key={i} className={cn('flex gap-2 animate-pulse', isMe ? 'flex-row-reverse' : '')}>
          {!isMe && <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0 self-end" />}
          <div className={cn(
            'h-10 rounded-2xl',
            isMe ? 'w-36 bg-purple-100' : 'w-52 bg-slate-200'
          )} />
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ChatPage({ params }: { params: { connectionId: string } }) {
  const { connectionId } = params
  const router = useRouter()

  const [messages,      setMessages]      = useState<MsgRow[]>([])
  const [otherProfile,  setOtherProfile]  = useState<Profile | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [notFound,      setNotFound]      = useState(false)
  const [notAccepted,   setNotAccepted]   = useState(false)
  const [inputText,     setInputText]     = useState('')
  const [sending,       setSending]       = useState(false)

  const viewerIdRef       = useRef<string | null>(null)
  const bottomRef         = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLTextAreaElement>(null)

  function scrollToBottom(smooth = false) {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }

  // ── Initial load ───────────────────────────────────────────────────────────
  const loadChat = useCallback(async () => {
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

    // Fetch connection with both profiles joined
    const { data: conn } = await supabase
      .from('connections')
      .select(`
        id, status, requester_id, receiver_id,
        requester:profiles!requester_id(
          id, name, image_url, bio, intent, skills, availability,
          working_style, is_public, portfolio_url, linkedin_url,
          github_url, twitter_url, interests, cv_url, user_id,
          ikigai_love, ikigai_good_at, ikigai_world_needs, ikigai_paid_for, ikigai_mission,
          profile_completion_score, match_criteria, created_at, updated_at
        ),
        receiver:profiles!receiver_id(
          id, name, image_url, bio, intent, skills, availability,
          working_style, is_public, portfolio_url, linkedin_url,
          github_url, twitter_url, interests, cv_url, user_id,
          ikigai_love, ikigai_good_at, ikigai_world_needs, ikigai_paid_for, ikigai_mission,
          profile_completion_score, match_criteria, created_at, updated_at
        )
      `)
      .eq('id', connectionId)
      .maybeSingle()

    if (!conn) { setNotFound(true); setLoading(false); return }

    type RawConn = {
      id: string; status: string
      requester_id: string; receiver_id: string
      requester: Profile; receiver: Profile
    }
    const raw = conn as unknown as RawConn

    if (raw.requester_id !== vpId && raw.receiver_id !== vpId) {
      setNotFound(true); setLoading(false); return
    }

    setOtherProfile(raw.requester_id === vpId ? raw.receiver : raw.requester)

    if (raw.status !== 'accepted') {
      setNotAccepted(true); setLoading(false); return
    }

    // Fetch message history
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, content, created_at, sender_id, read_at, connection_id')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: true })

    setMessages((msgs ?? []) as MsgRow[])
    setLoading(false)

    // Mark messages as read (fire and forget)
    fetch('/api/messages/read', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ connection_id: connectionId }),
    }).catch(() => {/* silent */})
  }, [connectionId, router])

  useEffect(() => { loadChat() }, [loadChat])

  // Scroll to bottom after initial load
  useEffect(() => {
    if (!loading) setTimeout(() => scrollToBottom(false), 60)
  }, [loading])

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (loading || notFound || notAccepted) return

    const supabase = createBrowserClient()

    const channel = supabase
      .channel(`messages:${connectionId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'messages',
          filter: `connection_id=eq.${connectionId}`,
        },
        (payload) => {
          const msg = payload.new as MsgRow
          // Skip my own — already handled optimistically
          if (msg.sender_id === viewerIdRef.current) return

          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          setTimeout(() => scrollToBottom(true), 50)

          // Mark as read since user is actively viewing
          fetch('/api/messages/read', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ connection_id: connectionId }),
          }).catch(() => {/* silent */})
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loading, notFound, notAccepted, connectionId])

  // ── Send message ───────────────────────────────────────────────────────────
  async function sendMessage() {
    const content = inputText.trim()
    if (!content || sending) return

    const vpId = viewerIdRef.current
    if (!vpId) return

    setInputText('')
    // Reset textarea height
    if (inputRef.current) { inputRef.current.style.height = '40px' }
    setSending(true)

    // Optimistic update
    const optId = `opt-${Date.now()}`
    const optimistic: MsgRow = {
      id: optId, content,
      created_at:    new Date().toISOString(),
      sender_id:     vpId,
      read_at:       null,
      connection_id: connectionId,
      isOptimistic:  true,
    }
    setMessages((prev) => [...prev, optimistic])
    setTimeout(() => scrollToBottom(true), 50)

    try {
      const supabase = createBrowserClient()
      const { data: inserted, error } = await supabase
        .from('messages')
        .insert({ connection_id: connectionId, sender_id: vpId, content })
        .select('id, content, created_at, sender_id, read_at, connection_id')
        .single()

      if (error) throw error

      setMessages((prev) =>
        prev.map((m) => m.id === optId ? { ...(inserted as MsgRow), isOptimistic: false } : m)
      )
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optId))
      setInputText(content)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  // ── Error states ───────────────────────────────────────────────────────────
  if (!loading && notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
        <h3 className="text-base font-semibold text-slate-700">Conversation not found</h3>
        <p className="text-sm text-slate-400 mt-1">This conversation doesn&apos;t exist or you&apos;re not a participant.</p>
        <Link href="/dashboard/messages" className="mt-4 text-sm text-purple-600 hover:underline">
          Back to messages
        </Link>
      </div>
    )
  }

  if (!loading && notAccepted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-8 h-8 text-amber-400 mb-3" />
        <h3 className="text-base font-semibold text-slate-700">You need to be connected to message</h3>
        <p className="text-sm text-slate-400 mt-1">
          Accept the connection request first to start chatting.
        </p>
        <Link href="/dashboard/connections" className="mt-4 text-sm text-purple-600 hover:underline">
          View connections
        </Link>
      </div>
    )
  }

  // ── Chat layout ────────────────────────────────────────────────────────────
  const vpId     = viewerIdRef.current
  const avatar   = otherProfile?.image_url ?? (otherProfile
    ? `${DICEBEAR_BASE_URL}${encodeURIComponent(otherProfile.name ?? otherProfile.id)}`
    : null)
  const chatItems = buildChatItems(messages)

  return (
    // Negate parent padding so header + input span full width
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8 min-h-[calc(100svh-3.5rem)] lg:min-h-screen">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 sticky top-0 z-20 bg-white border-b border-slate-200
                      px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/messages')}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
          aria-label="Back to messages"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {otherProfile && avatar ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatar}
              alt={otherProfile.name ?? ''}
              className="w-9 h-9 rounded-full object-cover bg-slate-100 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-tight truncate">
                {otherProfile.name}
              </p>
            </div>
            <Link
              href={`/profile/${otherProfile.id}`}
              className="text-xs font-medium text-purple-600 hover:text-purple-700 shrink-0 transition-colors"
            >
              View Profile
            </Link>
          </>
        ) : (
          <div className="flex-1 h-5 bg-slate-200 rounded animate-pulse" />
        )}
      </div>

      {/* ── Messages area ─────────────────────────────────────────────────── */}
      <div className="flex-1 bg-slate-50 px-4 sm:px-6 lg:px-8 py-4 overflow-x-hidden">
        {loading ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-slate-400">
              No messages yet. Say hello to {otherProfile?.name?.split(' ')[0] ?? 'them'}!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 max-w-2xl mx-auto">
            {chatItems.map((item) => {
              if (item.kind === 'divider') {
                return (
                  <div key={item.key} className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400 font-medium shrink-0">{item.label}</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )
              }

              const msg  = item.msg
              const isMe = msg.sender_id === vpId

              return (
                <div
                  key={msg.id}
                  className={cn('flex items-end gap-2 mb-0.5', isMe ? 'flex-row-reverse' : '')}
                >
                  {/* Other person's avatar (shown on their messages) */}
                  {!isMe ? (
                    avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatar}
                        alt={otherProfile?.name ?? ''}
                        className="w-7 h-7 rounded-full object-cover bg-slate-100 shrink-0 mb-0.5"
                      />
                    ) : (
                      <div className="w-7 shrink-0" />
                    )
                  ) : (
                    <div className="w-7 shrink-0" /> // spacer to align my messages
                  )}

                  <div className={cn('flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
                    {/* Bubble */}
                    <div className={cn(
                      'px-3.5 py-2.5 rounded-2xl max-w-xs sm:max-w-sm text-sm leading-relaxed break-words',
                      isMe
                        ? cn(
                            'bg-purple-600 text-white rounded-br-sm',
                            msg.isOptimistic && 'opacity-60'
                          )
                        : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200 shadow-sm'
                    )}>
                      {msg.content}
                    </div>
                    {/* Timestamp */}
                    <span className="text-[10px] text-slate-400 px-1">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
            {/* Scroll target */}
            <div ref={bottomRef} className="h-1" />
          </div>
        )}
      </div>

      {/* ── Input area ────────────────────────────────────────────────────── */}
      <div className="shrink-0 sticky bottom-0 z-20 bg-white border-t border-slate-200
                      px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type a message…"
            disabled={loading || notFound || notAccepted}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50
                       px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400
                       focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                       transition overflow-hidden leading-relaxed disabled:opacity-50"
            style={{ height: '40px', minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || sending || loading}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl
                       bg-purple-600 text-white hover:bg-purple-700
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-300 text-center mt-1.5 select-none">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
