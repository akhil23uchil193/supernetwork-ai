import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import Navbar from '@/components/navbar'
import ProfileCard from '@/components/profile-card'
import type { Profile } from '@/types'

export const revalidate = 60 // ISR: revalidate every 60 seconds

export default async function HomePage() {
  const supabase = createServerClient()

  // ── Session (determines whether to show the sign-up banner) ──────────────
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) console.error('[page] getSession error:', sessionError.message)
  const isLoggedIn = !!session
  console.log('[page] rendering landing page, isLoggedIn:', isLoggedIn)

  // ── Fetch 8 showcase profiles ─────────────────────────────────────────────
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_public', true)
    .order('profile_completion_score', { ascending: false })
    .limit(8)

  if (profilesError) {
    console.error('[page] profiles fetch error:', profilesError.message)
  } else {
    console.log('[page] fetched', profiles?.length ?? 0, 'showcase profiles')
  }

  const showcaseProfiles: Profile[] = (profiles as Profile[]) ?? []

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-xs font-semibold tracking-widest text-purple-600 uppercase mb-4">
            AI-Powered Networking
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-5">
            Find Your Perfect{' '}
            <span className="text-purple-600">Cofounder</span>,{' '}
            Teammate, or Client
          </h1>
          <p className="text-lg sm:text-xl text-slate-500 mb-10 max-w-2xl mx-auto">
            AI-powered matching based on your Ikigai, skills, and goals. Discover people who
            complement your vision — not just your résumé.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/?browse=true"
              className="inline-flex items-center justify-center h-11 px-8 text-base font-medium border border-slate-300 rounded-md bg-white text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
            >
              Browse Profiles
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center h-11 px-8 text-base font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* ── Sign-up banner for guests ─────────────────────────────────────── */}
      {!isLoggedIn && (
        <div className="mx-4 sm:mx-6 lg:mx-8 max-w-7xl lg:mx-auto mb-6">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 rounded-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-purple-700">Sign up for free</span> to see your
              AI-matched compatibility score with each person.
            </p>
            <Link
              href="/signup"
              className="shrink-0 inline-flex items-center justify-center h-8 px-4 text-sm font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}

      {/* ── Discover profiles section ─────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Discover People</h2>
            <p className="text-slate-500 mt-1 text-sm">
              Explore profiles from builders, creators, and changemakers.
            </p>
          </div>
          {isLoggedIn && (
            <Link
              href="/dashboard/discover"
              className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
            >
              See all →
            </Link>
          )}
        </div>

        {showcaseProfiles.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-lg font-medium">No profiles yet</p>
            <p className="text-sm mt-1">Check back soon — the community is growing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {showcaseProfiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
