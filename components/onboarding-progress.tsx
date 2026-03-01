'use client'

import { cn } from '@/lib/utils'

interface OnboardingProgressProps {
  step: number   // 1-based current step
  total: number
}

export default function OnboardingProgress({ step, total }: OnboardingProgressProps) {
  const pct = Math.round((step / total) * 100)
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Step {step} of {total}
        </span>
        <span className="text-xs font-medium text-purple-600">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-2">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'text-[10px] font-medium',
              i + 1 <= step ? 'text-purple-600' : 'text-slate-300',
            )}
          >
            {['Profile', 'Details', 'Ikigai', 'Review'][i]}
          </div>
        ))}
      </div>
    </div>
  )
}
