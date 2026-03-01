'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, MessageCircle, Check, X, MoreVertical, ShieldX } from 'lucide-react'
import { toast } from '@/components/ui/toaster'

export type ConnectionState =
  | { type: 'none' }
  | { type: 'pending_sent'; connection_id: string }
  | { type: 'pending_received'; connection_id: string }
  | { type: 'accepted'; connection_id: string }

interface ProfileActionsProps {
  targetProfileId: string
  targetName: string
  initialConnection: ConnectionState
  messageHref: string
}

export default function ProfileActions({
  targetProfileId,
  targetName,
  initialConnection,
  messageHref,
}: ProfileActionsProps) {
  const router = useRouter()
  const [connection, setConnection] = useState<ConnectionState>(initialConnection)
  const [loading, setLoading] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  async function handleConnect() {
    setLoading('connect')
    try {
      const res = await fetch('/api/connections/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver_profile_id: targetProfileId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to send request')
      setConnection({ type: 'pending_sent', connection_id: json.connection_id })
      toast('Connection request sent!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send request', 'error')
    } finally {
      setLoading(null)
    }
  }

  async function handleRespond(action: 'accept' | 'reject') {
    if (connection.type !== 'pending_received') return
    setLoading(action)
    try {
      const res = await fetch('/api/connections/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connection.connection_id, action }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')
      if (action === 'accept') {
        setConnection({ type: 'accepted', connection_id: connection.connection_id })
        toast('Connection accepted!', 'success')
      } else {
        setConnection({ type: 'none' })
        toast('Connection declined.', 'success')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed', 'error')
    } finally {
      setLoading(null)
    }
  }

  async function handleBlock() {
    setMenuOpen(false)
    if (!confirm(`Block ${targetName}? You won't see each other's profiles.`)) return
    setLoading('block')
    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_profile_id: targetProfileId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to block')
      toast(`${targetName} has been blocked.`, 'success')
      router.push('/dashboard/discover')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to block', 'error')
    } finally {
      setLoading(null)
    }
  }

  const busy = !!loading

  return (
    <div className="flex items-center gap-2">
      {/* Primary CTA */}
      {connection.type === 'none' && (
        <button
          onClick={handleConnect}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          {loading === 'connect' ? 'Sending…' : 'Connect'}
        </button>
      )}

      {connection.type === 'pending_sent' && (
        <button
          disabled
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-slate-100 text-slate-500 text-sm font-semibold cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          Request Sent
        </button>
      )}

      {connection.type === 'pending_received' && (
        <>
          <button
            onClick={() => handleRespond('accept')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4" />
            {loading === 'accept' ? 'Accepting…' : 'Accept Connection'}
          </button>
          <button
            onClick={() => handleRespond('reject')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <X className="w-4 h-4" />
            {loading === 'reject' ? 'Declining…' : 'Decline'}
          </button>
        </>
      )}

      {connection.type === 'accepted' && (
        <button
          onClick={() => router.push(messageHref)}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Message {targetName.split(' ')[0]}
        </button>
      )}

      {/* Three-dot overflow menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="More options"
          className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
            <button
              onClick={handleBlock}
              disabled={loading === 'block'}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <ShieldX className="w-4 h-4" />
              {loading === 'block' ? 'Blocking…' : 'Block User'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
