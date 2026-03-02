'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, ShieldX, Flag } from 'lucide-react'
import { toast } from '@/components/ui/toaster'

interface ProfileMenuProps {
  targetProfileId: string
  targetName: string
}

export default function ProfileMenu({ targetProfileId, targetName }: ProfileMenuProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading,  setLoading]  = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  async function handleBlock() {
    setMenuOpen(false)
    if (!confirm(`Block ${targetName}? You won't see each other's profiles.`)) return
    setLoading('block')
    try {
      const res = await fetch('/api/blocks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ blocked_profile_id: targetProfileId }),
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

  function handleReport() {
    setMenuOpen(false)
    toast('Reported. Thank you for keeping the community safe.', 'info')
  }

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="More options"
        disabled={!!loading}
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1 overflow-hidden">
          <button
            onClick={handleReport}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left"
          >
            <Flag className="w-4 h-4 shrink-0" />
            Report
          </button>
          <div className="border-t border-slate-100 my-1" />
          <button
            onClick={handleBlock}
            disabled={loading === 'block'}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 text-left"
          >
            <ShieldX className="w-4 h-4 shrink-0" />
            {loading === 'block' ? 'Blocking…' : 'Block User'}
          </button>
        </div>
      )}
    </div>
  )
}
