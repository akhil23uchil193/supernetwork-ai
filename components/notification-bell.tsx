'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, UserPlus, MessageCircle, Sparkles } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const TYPE_ICON: Record<Notification['type'], React.ReactNode> = {
  connection_request: <UserPlus className="w-4 h-4 text-purple-500 shrink-0" />,
  message:            <MessageCircle className="w-4 h-4 text-blue-500 shrink-0" />,
  match:              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />,
}

function notifHref(n: Notification): string {
  if (n.type === 'connection_request') return '/dashboard/connections'
  if (n.type === 'message' && n.reference_id) return `/dashboard/messages/${n.reference_id}`
  if (n.type === 'match') return '/dashboard/matches'
  return '/dashboard/notifications'
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NotificationBellProps {
  profileId: string
}

export default function NotificationBell({ profileId }: NotificationBellProps) {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read_at).length

  // ── Fetch last 8 notifications ─────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    console.log('[NotificationBell] fetching notifications for profile:', profileId)
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(8)

    if (error) {
      console.error('[NotificationBell] fetch error:', error)
    } else {
      console.log('[NotificationBell] fetched', data?.length ?? 0, 'notifications')
      setNotifications((data as Notification[]) ?? [])
    }
    setLoading(false)
  }, [supabase, profileId])

  // ── Mark all as read ───────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    console.log('[NotificationBell] marking all as read')
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', profileId)
      .is('read_at', null)

    if (error) {
      console.error('[NotificationBell] markAllRead error:', error)
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })))
    }
  }, [supabase, profileId])

  // ── Click a single notification ────────────────────────────────────────────
  const handleClick = useCallback(
    async (n: Notification) => {
      setOpen(false)
      if (!n.read_at) {
        const { error } = await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', n.id)
        if (error) console.error('[NotificationBell] mark-read error:', error)
        else setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      }
      router.push(notifHref(n))
    },
    [supabase, router]
  )

  // ── Mount: fetch + realtime subscription ──────────────────────────────────
  useEffect(() => {
    fetchNotifications()

    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          console.log('[NotificationBell] realtime INSERT:', payload.new)
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 8))
        }
      )
      .subscribe((status) => {
        console.log('[NotificationBell] realtime status:', status)
      })

    return () => {
      console.log('[NotificationBell] unsubscribing realtime')
      supabase.removeChannel(channel)
    }
  }, [profileId, fetchNotifications, supabase])

  // ── Auto-mark-all-read when dropdown opens ────────────────────────────────
  useEffect(() => {
    if (open && unreadCount > 0) {
      markAllRead()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Click-outside to close ─────────────────────────────────────────────────
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="px-4 py-6 text-sm text-slate-500 text-center">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500 text-center">No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors',
                    !n.read_at && 'border-l-2 border-blue-400'
                  )}
                >
                  <div className="mt-0.5">{TYPE_ICON[n.type]}</div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-snug', !n.read_at ? 'text-slate-900 font-medium' : 'text-slate-600')}>
                      {n.content}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{relativeTime(n.created_at)}</p>
                  </div>
                  {!n.read_at && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-2">
            <button
              onClick={() => { setOpen(false); router.push('/dashboard/notifications') }}
              className="text-xs text-slate-500 hover:text-purple-600 w-full text-center py-1 transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
