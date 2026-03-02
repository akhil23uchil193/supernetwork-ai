'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Lock, ShieldX, UserX } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { DICEBEAR_BASE_URL } from '@/lib/constants'
import type { Profile } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockedProfile = Pick<Profile, 'id' | 'name' | 'image_url' | 'intent'>

interface BlockedUser {
  blockId:   string
  blockedId: string
  profile:   BlockedProfile | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  const router = useRouter()

  const [isPublic,      setIsPublic]      = useState(true)
  const [blockedUsers,  setBlockedUsers]  = useState<BlockedUser[]>([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [unblockingId,  setUnblockingId]  = useState<string | null>(null)

  // ── Fetch profile + blocked users ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createBrowserClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, is_public')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!profile) { setLoading(false); return }
    setIsPublic(profile.is_public ?? true)

    // Step 1: fetch block records (id + blocked_id only) — avoids RLS join issues
    const { data: blockRecords } = await supabase
      .from('blocks')
      .select('id, blocked_id')
      .eq('blocker_id', profile.id)
      .order('created_at', { ascending: false })

    // Step 2: fetch each blocked profile individually (may be null if RLS still hides it)
    const blockedUsersData: BlockedUser[] = await Promise.all(
      (blockRecords ?? []).map(async (block) => {
        const { data: blockedProfile } = await supabase
          .from('profiles')
          .select('id, name, image_url, intent')
          .eq('id', block.blocked_id)
          .maybeSingle()
        return {
          blockId:   block.id,
          blockedId: block.blocked_id,
          profile:   blockedProfile as BlockedProfile | null,
        }
      })
    )
    setBlockedUsers(blockedUsersData)

    setLoading(false)
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Visibility toggle ──────────────────────────────────────────────────────
  async function handleVisibilityChange(newValue: boolean) {
    if (newValue === isPublic || saving) return

    if (!newValue) {
      const confirmed = confirm(
        "Make your profile private?\n\n" +
        "You won't appear in Search or Discover. " +
        "People can still view your profile via a direct link."
      )
      if (!confirmed) return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/profile/visibility', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_public: newValue }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to update')
      setIsPublic(newValue)
      toast(newValue ? 'Profile is now public' : 'Profile is now private', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update visibility', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Unblock ────────────────────────────────────────────────────────────────
  async function handleUnblock(blockedId: string, name: string) {
    setUnblockingId(blockedId)
    try {
      const res = await fetch('/api/blocks', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ blocked_profile_id: blockedId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to unblock')
      setBlockedUsers((prev) => prev.filter((b) => b.blockedId !== blockedId))
      toast(`${name} unblocked.`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to unblock', 'error')
    } finally {
      setUnblockingId(null)
    }
  }

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="h-7 bg-slate-200 rounded w-28 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-48 animate-pulse" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-36" />
          <div className="h-14 bg-slate-100 rounded-xl" />
          <div className="h-14 bg-slate-100 rounded-xl" />
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Privacy</h1>
        <p className="text-sm text-slate-500 mt-1">Control who can see your profile</p>
      </div>

      {/* ── Section 1: Profile Visibility ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">
          Profile Visibility
        </h2>

        <div className="flex flex-col gap-3">
          {/* Public */}
          <label className={cn(
            'flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
            isPublic
              ? 'border-purple-400 bg-purple-50'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          )}>
            <input
              type="radio"
              name="visibility"
              checked={isPublic}
              onChange={() => handleVisibilityChange(true)}
              disabled={saving}
              className="mt-0.5 accent-purple-600 shrink-0"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Globe className={cn('w-4 h-4 shrink-0', isPublic ? 'text-purple-600' : 'text-slate-400')} />
                <span className={cn('text-sm font-semibold', isPublic ? 'text-purple-700' : 'text-slate-700')}>
                  Public
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Your profile appears in Search and Discover. Anyone can view it.
              </p>
            </div>
          </label>

          {/* Private */}
          <label className={cn(
            'flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
            !isPublic
              ? 'border-slate-600 bg-slate-50'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          )}>
            <input
              type="radio"
              name="visibility"
              checked={!isPublic}
              onChange={() => handleVisibilityChange(false)}
              disabled={saving}
              className="mt-0.5 accent-slate-700 shrink-0"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Lock className={cn('w-4 h-4 shrink-0', !isPublic ? 'text-slate-700' : 'text-slate-400')} />
                <span className={cn('text-sm font-semibold', !isPublic ? 'text-slate-800' : 'text-slate-700')}>
                  Private
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Only people with your direct link can view your profile.
              </p>
            </div>
          </label>
        </div>

        {saving && (
          <p className="text-xs text-slate-400 text-center mt-4 flex items-center justify-center gap-1.5">
            <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
            Saving…
          </p>
        )}
      </div>

      {/* ── Section 2: Blocked Users ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">
          Blocked Users
        </h2>

        {blockedUsers.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <ShieldX className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium">You haven&apos;t blocked anyone.</p>
            <p className="text-xs text-slate-400 mt-1">
              Blocked users won&apos;t appear in your Discover or search results.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {blockedUsers.map((b) => {
              const p    = b.profile
              const busy = unblockingId === b.blockedId

              // Fallback row when profile is hidden by RLS or was deleted
              if (!p) {
                return (
                  <div
                    key={b.blockId}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0 flex items-center justify-center">
                      <UserX className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="flex-1 text-sm text-slate-400 italic">Blocked user</p>
                    <button
                      onClick={() => handleUnblock(b.blockedId, 'this user')}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors shrink-0"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      {busy ? 'Unblocking…' : 'Unblock'}
                    </button>
                  </div>
                )
              }

              const avatar = p.image_url
                ?? `${DICEBEAR_BASE_URL}${encodeURIComponent(p.name ?? p.id)}`

              return (
                <div
                  key={b.blockId}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatar}
                    alt={p.name ?? ''}
                    className="w-10 h-10 rounded-full object-cover bg-slate-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {p.name ?? 'Unknown User'}
                    </p>
                    {p.intent && p.intent.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.intent.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-500 capitalize"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleUnblock(b.blockedId, p.name ?? 'this user')}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    {busy ? 'Unblocking…' : 'Unblock'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
