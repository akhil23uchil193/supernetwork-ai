'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Compass,
  Sparkles,
  Search,
  Users,
  MessageCircle,
  Bell,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react'

import { createBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BadgeCounts {
  matches: number
  pendingConnections: number
  unreadMessages: number
  unreadNotifications: number
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [counts, setCounts] = useState<BadgeCounts>({
    matches: 0,
    pendingConnections: 0,
    unreadMessages: 0,
    unreadNotifications: 0,
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // ── Fetch badge counts ─────────────────────────────────────────────────────
  const fetchCounts = useCallback(
    async (profileId: string) => {
      console.log('[DashboardLayout] fetching badge counts for profile:', profileId)

      const [matchesRes, connectionsRes, messagesRes, notificationsRes] = await Promise.all([
        // Total match count
        supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileId),

        // Pending incoming connection requests
        supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', profileId)
          .eq('status', 'pending'),

        // Unread messages in accepted connections
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .neq('sender_id', profileId)
          .is('read_at', null),

        // Unread notifications
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileId)
          .is('read_at', null),
      ])

      if (matchesRes.error) console.error('[DashboardLayout] matches count error:', matchesRes.error.message)
      if (connectionsRes.error) console.error('[DashboardLayout] connections count error:', connectionsRes.error.message)
      if (messagesRes.error) console.error('[DashboardLayout] messages count error:', messagesRes.error.message)
      if (notificationsRes.error) console.error('[DashboardLayout] notifications count error:', notificationsRes.error.message)

      const newCounts = {
        matches: matchesRes.count ?? 0,
        pendingConnections: connectionsRes.count ?? 0,
        unreadMessages: messagesRes.count ?? 0,
        unreadNotifications: notificationsRes.count ?? 0,
      }
      console.log('[DashboardLayout] badge counts:', newCounts)
      setCounts(newCounts)
    },
    [supabase]
  )

  // ── Auth + profile + counts ────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) console.error('[DashboardLayout] getSession error:', sessionError.message)

      if (!session) {
        console.log('[DashboardLayout] no session, redirecting to /login')
        router.push('/login')
        return
      }

      console.log('[DashboardLayout] session found, fetching profile')
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error) {
        console.error('[DashboardLayout] profile fetch error:', error.message)
      } else {
        console.log('[DashboardLayout] profile:', data?.name)
        setProfile(data as Profile)
        await fetchCounts(data.id)
      }

      setLoading(false)
    }

    init()
  }, [supabase, router, fetchCounts])

  // ── Realtime: notification inserts update badge live ──────────────────────
  useEffect(() => {
    if (!profile) return

    const channel = supabase
      .channel(`dash-notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log('[DashboardLayout] new notification realtime:', payload.new)
          setCounts((prev) => ({ ...prev, unreadNotifications: prev.unreadNotifications + 1 }))
        }
      )
      .subscribe((status) => console.log('[DashboardLayout] realtime status:', status))

    return () => { supabase.removeChannel(channel) }
  }, [supabase, profile])

  // ── Close mobile sidebar on route change ──────────────────────────────────
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // ── Sign out ───────────────────────────────────────────────────────────────
  async function signOut() {
    console.log('[DashboardLayout] signing out')
    await supabase.auth.signOut()
    router.push('/')
  }

  // ── Nav items ──────────────────────────────────────────────────────────────
  const navItems: NavItem[] = [
    { label: 'Discover',      href: '/dashboard/discover',      icon: <Compass className="w-4 h-4" /> },
    { label: 'My Matches',    href: '/dashboard/matches',       icon: <Sparkles className="w-4 h-4" />, badge: counts.matches },
    { label: 'Search',        href: '/dashboard/search',        icon: <Search className="w-4 h-4" /> },
    { label: 'Connections',   href: '/dashboard/connections',   icon: <Users className="w-4 h-4" />,   badge: counts.pendingConnections },
    { label: 'Messages',      href: '/dashboard/messages',      icon: <MessageCircle className="w-4 h-4" />, badge: counts.unreadMessages },
    { label: 'Notifications', href: '/dashboard/notifications', icon: <Bell className="w-4 h-4" />,   badge: counts.unreadNotifications },
  ]

  const bottomItems: NavItem[] = [
    { label: 'Settings', href: '/settings/profile', icon: <Settings className="w-4 h-4" /> },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
          <span className="text-lg font-bold text-purple-600 tracking-tight">SuperNetworkAI</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded hover:bg-slate-100 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile mini */}
        {profile && (
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  profile.image_url ??
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.name ?? profile.id)}`
                }
                alt={profile.name ?? ''}
                className="w-8 h-8 rounded-full object-cover bg-slate-100 shrink-0"
              />
              <p className="text-sm font-medium text-slate-900 truncate">{profile.name}</p>
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <SidebarLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}

          <div className="my-2 border-t border-slate-100" />

          {bottomItems.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={pathname.startsWith('/settings')}
            />
          ))}
        </nav>

        {/* Sign out */}
        <div className="border-t border-slate-100 p-2 shrink-0">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-base font-bold text-purple-600">SuperNetworkAI</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

// ─── Sidebar link ──────────────────────────────────────────────────────────────

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors group',
        active
          ? 'bg-purple-50 text-purple-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      )}
    >
      <span className={cn('shrink-0', active ? 'text-purple-600' : 'text-slate-400 group-hover:text-slate-600')}>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {typeof item.badge === 'number' && item.badge > 0 && (
        <span className="min-w-[18px] h-[18px] bg-purple-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </Link>
  )
}
