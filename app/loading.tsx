// Landing page loading state — shown during navigation to /
// Mirrors the hero + profile-grid layout with skeleton placeholders.

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar placeholder */}
      <div className="h-16 border-b border-slate-100 px-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="h-5 w-36 bg-slate-200 rounded-full animate-pulse" />
        <div className="flex gap-3">
          <div className="h-9 w-20 bg-slate-100 rounded-md animate-pulse" />
          <div className="h-9 w-24 bg-purple-100 rounded-md animate-pulse" />
        </div>
      </div>

      {/* Hero placeholder */}
      <section className="pt-32 pb-20 px-4 text-center">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4">
          <div className="h-4 w-40 bg-slate-200 rounded-full animate-pulse" />
          <div className="h-12 w-2/3 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-12 w-1/2 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-5 w-80 bg-slate-100 rounded-full animate-pulse" />
          <div className="flex gap-3 mt-2">
            <div className="h-11 w-36 bg-slate-100 rounded-md animate-pulse" />
            <div className="h-11 w-40 bg-purple-100 rounded-md animate-pulse" />
          </div>
        </div>
      </section>

      {/* Profile grid placeholder */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="h-6 w-44 bg-slate-200 rounded-full animate-pulse" />
            <div className="h-4 w-64 bg-slate-100 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-24" />
                  <div className="h-3 bg-slate-100 rounded w-16" />
                </div>
              </div>
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-3 bg-slate-100 rounded w-4/5" />
              <div className="flex gap-1.5">
                <div className="h-5 bg-slate-100 rounded-full w-14" />
                <div className="h-5 bg-slate-100 rounded-full w-12" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
