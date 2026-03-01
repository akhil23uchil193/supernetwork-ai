import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Profile } from "@/types"
import { DICEBEAR_BASE_URL } from "@/lib/constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateProfileCompletionScore(profile: Partial<Profile>): number {
  let score = 0

  // name: 10pts
  if (profile.name) score += 10

  // bio: 10pts
  if (profile.bio) score += 10

  // ikigai fields: 6pts each = 30pts
  if (profile.ikigai_love) score += 6
  if (profile.ikigai_good_at) score += 6
  if (profile.ikigai_world_needs) score += 6
  if (profile.ikigai_paid_for) score += 6
  if (profile.ikigai_mission) score += 6

  // skills (3 or more): 15pts
  if (profile.skills && profile.skills.length >= 3) score += 15

  // intent (at least 1): 10pts
  if (profile.intent && profile.intent.length >= 1) score += 10

  // availability: 5pts
  if (profile.availability) score += 5

  // working_style: 5pts
  if (profile.working_style) score += 5

  // any social link present: 5pts
  if (
    profile.portfolio_url ||
    profile.linkedin_url ||
    profile.github_url ||
    profile.twitter_url
  ) {
    score += 5
  }

  // image_url not dicebear (custom uploaded): 5pts
  if (profile.image_url && !profile.image_url.startsWith(DICEBEAR_BASE_URL)) {
    score += 5
  }

  // cv_url present: 5pts
  if (profile.cv_url) score += 5

  return score
}
