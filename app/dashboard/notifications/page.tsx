'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, MessageCircle, Sparkles, Bell, Check } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotifRow {
  id:           string
  type:         'connection_request' | 'message' | 'match'
  content:      string
  reference_id: string | null
  read_at:      string | null
  created_at:   string
}

type DateGroup = 'today' | 'week' | 'earlier'

// ─── Constants ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  connection_request: UserPlus,
  message:            MessageCircle,
  match:              Sparkles,
}

const ICON_STYLE: Record<string, string> = {
  connection_request: 'text-purple-600 bg-purple-50',
  message:            'text-blue-600 bg-blue-50',
  match:              'text-amber-600 bg-amber-50',
}

const GROUP_LABELS: Record<DateGroup, string> = {
  today:   'Today',
  week:    'This Week',
  earlier: 'Earlier',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getGroup(dateStr: string): DateGroup {
  const date        = new Date(dateStr)
  const now         = new Date()
  const startOfDay  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenAgo    = new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000)
  if (date >= startOfDay) return 'today'
  if (date >= sevenAgo)   return 'week'
  return 'earlier'
}

function getHref(notif: NotifRow): string {
  if (notif.type === 'connection_request')              return '/dashboard/connections'
  if (notif.type === 'message' && notif.reference_id)   return `/dashboard/messages/${notif.reference_id}`
  if (notif.type === 'match')                           return '/dashboard/matches'
  return '/dashboard'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotifRow[]>([])
  const [loading,       setLoading]       = useState(true)
  const [profileId,     setProfileId]     = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
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
    setProfileId(vp.id)

    const { data } = await supabase
      .from('notifications')
      .select('id, type, content, reference_id, read_at, created_at')
      .eq('user_id', vp.id)
      .order('created_at', { ascending: false })
      .limit(100)

    setNotifications((data ?? []) as NotifRow[])
    setLoading(false)
  }, [router])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  // ── Mark all as read on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!profileId) return
    const supabase = createBrowserClient()
    const now = new Date().toISOString()
    supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', profileId)
      .is('read_at', null)
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) => n.read_at ? n : { ...n, read_at: now })
        )
      })
  }, [profileId])

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profileId) return

    const supabase = createBrowserClient()

    const channel = supabase
      .channel(`notifs:${profileId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as NotifRow, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profileId])

  // ── Mark single as read + navigate ────────────────────────────────────────
  async function handleClick(notif: NotifRow) {
    if (!notif.read_at) {
      const supabase = createBrowserClient()
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notif.id)
      setNotifications((prev) =>
        prev.map((n) => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n)
      )
    }
    router.push(getHref(notif))
  }

  // ── Mark all as read ───────────────────────────────────────────────────────
  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read_at)
    if (unread.length === 0) return

    const supabase = createBrowserClient()
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unread.map((n) => n.id))

    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => n.read_at ? n : { ...n, read_at: now }))
    toast(`Marked ${unread.length} notification${unread.length !== 1 ? 's' : ''} as read`, 'success')
  }

  // ── Group ──────────────────────────────────────────────────────────────────
  const grouped = (
    ['today', 'week', 'earlier'] as DateGroup[]
  ).map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: notifications.filter((n) => getGroup(n.created_at) === key),
  })).filter((g) => g.items.length > 0)

  const unreadCount = notifications.filter((n) => !n.read_at).length

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 space-y-2">
          <div className="h-7 bg-slate-200 rounded w-44 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-24 animate-pulse" />
        </div>
        <div className="flex flex-col gap-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-64" />
                <div className="h-3 bg-slate-100 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Bell className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">No notifications yet</h3>
          <p className="text-sm text-slate-400 max-w-xs">
            When someone connects with you or sends a message, you&apos;ll see it here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map((group) => (
            <div key={group.key}>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 px-1">
                {group.label}
              </h2>
              <div className="flex flex-col gap-1">
                {group.items.map((notif) => {
                  const Icon     = ICON_MAP[notif.type] ?? Bell
                  const iconCls  = ICON_STYLE[notif.type] ?? 'text-slate-500 bg-slate-100'
                  const isUnread = !notif.read_at

                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleClick(notif)}
                      className={cn(
                        'flex items-start gap-4 p-4 rounded-xl border text-left w-full transition-colors',
                        isUnread
                          ? 'bg-purple-50 border-purple-100 hover:bg-purple-100/70'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      {/* Icon */}
                      <span className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                        iconCls
                      )}>
                        <Icon className="w-4 h-4" />
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm leading-snug',
                          isUnread ? 'font-semibold text-slate-800' : 'font-normal text-slate-600'
                        )}>
                          {notif.content}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {relativeTime(notif.created_at)}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0 mt-2" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
