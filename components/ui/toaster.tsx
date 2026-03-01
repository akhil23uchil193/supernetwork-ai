'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Public API ───────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

/**
 * Dispatch a toast from anywhere — no React context needed.
 * Uses a custom browser event to communicate with the <Toaster> component.
 */
export function toast(message: string, type: ToastType = 'info') {
  if (typeof window === 'undefined') return
  const detail: ToastItem = { id: Math.random().toString(36).slice(2), message, type }
  window.dispatchEvent(new CustomEvent('__sn_toast', { detail }))
}

// ─── Icons / styles per type ──────────────────────────────────────────────────

const META: Record<ToastType, { icon: React.ReactNode; border: string }> = {
  success: {
    icon: <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />,
    border: 'border-l-4 border-green-500',
  },
  error: {
    icon: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
    border: 'border-l-4 border-red-500',
  },
  info: {
    icon: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
    border: 'border-l-4 border-blue-500',
  },
}

const AUTO_DISMISS_MS = 4000
const MAX_VISIBLE = 5

// ─── Toaster component ────────────────────────────────────────────────────────

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    function onToast(e: Event) {
      const item = (e as CustomEvent<ToastItem>).detail
      console.log('[Toaster] received toast:', item)
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), item])
      setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS)
    }

    window.addEventListener('__sn_toast', onToast)
    return () => window.removeEventListener('__sn_toast', onToast)
  }, [dismiss])

  if (toasts.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 bg-white rounded-lg shadow-lg px-4 py-3',
            'border border-slate-200',
            'animate-in slide-in-from-right-5 fade-in duration-200',
            META[t.type].border
          )}
        >
          {META[t.type].icon}
          <p className="text-sm text-slate-700 flex-1 leading-relaxed">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            className="text-slate-400 hover:text-slate-600 shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
