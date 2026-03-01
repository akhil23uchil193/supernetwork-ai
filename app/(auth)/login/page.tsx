'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { PROFILE_COMPLETION_THRESHOLD } from '@/lib/constants'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    console.log('[login] attempting sign in for:', email)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      console.error('[login] auth error:', authError.message)
      setError(friendlyAuthError(authError.message))
      setLoading(false)
      return
    }

    const userId = data.user?.id
    console.log('[login] signed in successfully, userId:', userId)

    // ── Determine redirect ────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, profile_completion_score')
      .eq('user_id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('[login] profile fetch error:', profileError.message)
    }

    if (!profile) {
      console.log('[login] no profile found → /onboarding/start')
      router.push('/onboarding/start')
      return
    }

    console.log('[login] profile score:', profile.profile_completion_score)

    if (profile.profile_completion_score >= PROFILE_COMPLETION_THRESHOLD) {
      console.log('[login] profile complete → /dashboard/discover')
      router.push('/dashboard/discover')
    } else {
      console.log('[login] profile incomplete → /settings/profile with banner')
      router.push('/settings/profile?banner=incomplete')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold text-purple-600 tracking-tight">
              SuperNetworkAI
            </span>
          </Link>
          <p className="mt-2 text-sm text-slate-500">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="mt-4 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium text-purple-600 hover:text-purple-700">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function friendlyAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Incorrect email or password.'
  if (message.includes('Email not confirmed')) return 'Please confirm your email before signing in.'
  if (message.includes('too many requests')) return 'Too many attempts. Please try again later.'
  return message
}
