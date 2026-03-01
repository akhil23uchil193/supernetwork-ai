import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

const INTENT_STYLES: Record<string, string> = {
  cofounder: 'bg-purple-100 text-purple-700',
  teammate:  'bg-blue-100 text-blue-700',
  client:    'bg-green-100 text-green-700',
}

const AVAILABILITY_LABELS: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  weekends:  'Weekends Only',
}

interface ProfileCardProps {
  profile: Profile
  /** When true, wraps the whole card in a Link to /profile/[id] */
  clickable?: boolean
}

export default function ProfileCard({ profile, clickable = true }: ProfileCardProps) {
  const avatarSrc =
    profile.image_url ??
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.name ?? profile.id)}`

  const card = (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 hover:shadow-md hover:border-slate-300 transition-all h-full">
      {/* Avatar + name + availability */}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc}
          alt={profile.name ?? 'Profile'}
          className="w-16 h-16 rounded-full object-cover bg-slate-100 shrink-0"
        />
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{profile.name ?? 'Anonymous'}</p>
          {profile.availability && (
            <span className="text-xs text-slate-500">
              {AVAILABILITY_LABELS[profile.availability] ?? profile.availability}
            </span>
          )}
        </div>
      </div>

      {/* Intent badges */}
      {profile.intent.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.intent.map((i) => (
            <span
              key={i}
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                INTENT_STYLES[i] ?? 'bg-slate-100 text-slate-600'
              )}
            >
              {i}
            </span>
          ))}
        </div>
      )}

      {/* Bio */}
      {profile.bio && (
        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{profile.bio}</p>
      )}

      {/* Top 3 skills */}
      {profile.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.skills.slice(0, 3).map((s) => (
            <span
              key={s}
              className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
            >
              {s}
            </span>
          ))}
          {profile.skills.length > 3 && (
            <span className="text-xs text-slate-400">+{profile.skills.length - 3} more</span>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="mt-auto pt-1">
        <span className="block text-center text-sm font-medium text-purple-600 border border-purple-200 rounded-lg py-2 hover:bg-purple-50 transition-colors">
          View Profile
        </span>
      </div>
    </div>
  )

  if (!clickable) return card

  return (
    <Link href={`/profile/${profile.id}`} className="block h-full">
      {card}
    </Link>
  )
}
