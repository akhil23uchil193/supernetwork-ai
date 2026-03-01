'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Settings, Shield, ChevronDown } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'

import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import NotificationBell from '@/components/notification-bell'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

export default function Navbar() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Fetch user profile ─────────────────────────────────────────────────────
  const fetchProfile = useCallback(
    async (userId: string) => {
      console.log('[Navbar] fetching profile for user:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('[Navbar] profile fetch error:', error.message)
      } else {
        console.log('[Navbar] profile loaded:', data?.name)
        setProfile(data as Profile)
      }
    },
    [supabase]
  )

  // ── Auth state ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true)

    // Initial session
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) console.error('[Navbar] getSession error:', error.message)
      console.log('[Navbar] initial session:', s ? 'authenticated' : 'none')
      setSession(s)
      if (s?.user) fetchProfile(s.user.id)
    })

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      console.log('[Navbar] auth event:', event)
      setSession(s)
      if (s?.user) {
        fetchProfile(s.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile])

  // ── Close dropdown on outside click ───────────────────────────────────────
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [dropdownOpen])

  // ── Sign out ───────────────────────────────────────────────────────────────
  async function signOut() {
    console.log('[Navbar] signing out')
    setDropdownOpen(false)
    const { error } = await supabase.auth.signOut()
    if (error) console.error('[Navbar] sign-out error:', error.message)
    else router.push('/')
  }

  const isLoggedIn = mounted && !!session

  const avatarSrc =
    profile?.image_url ??
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile?.name ?? 'user')}`

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-16 bg-white border-b border-slate-200 flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-bold text-purple-600 tracking-tight hover:text-purple-700 transition-colors shrink-0"
        >
          SuperNetworkAI
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Before mount (SSR) — render nothing to avoid hydration mismatch */}
          {!mounted ? null : isLoggedIn ? (
            /* ── Logged-in ─────────────────────────────────────────────── */
            <>
              {profile && <NotificationBell profileId={profile.id} />}

              {/* Avatar dropdown */}
              <div ref={dropdownRef} className="relative ml-1">
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 hover:bg-slate-100 transition-colors"
                  aria-label="Account menu"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarSrc}
                    alt={profile?.name ?? 'You'}
                    className="w-8 h-8 rounded-full object-cover bg-slate-200"
                  />
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-slate-500 transition-transform duration-150',
                      dropdownOpen && 'rotate-180'
                    )}
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Identity */}
                    {profile && (
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-900 truncate">{profile.name}</p>
                        <p className="text-xs text-slate-500 truncate">{session?.user.email}</p>
                      </div>
                    )}

                    <div className="py-1">
                      <DropdownItem
                        icon={<Settings className="w-4 h-4" />}
                        label="Edit Profile"
                        href="/settings/profile"
                        onClick={() => setDropdownOpen(false)}
                      />
                      <DropdownItem
                        icon={<Shield className="w-4 h-4" />}
                        label="Privacy"
                        href="/settings/privacy"
                        onClick={() => setDropdownOpen(false)}
                      />
                    </div>

                    <div className="border-t border-slate-100 py-1">
                      <button
                        onClick={signOut}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Logged-out ────────────────────────────────────────────── */
            <>
              <Link href="/?browse=true">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                  Browse Profiles
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="default" size="sm">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

// ─── Dropdown item ─────────────────────────────────────────────────────────────

function DropdownItem({
  icon,
  label,
  href,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  href: string
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
    >
      <span className="text-slate-400">{icon}</span>
      {label}
    </Link>
  )
}
