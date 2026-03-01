export interface MatchCriteria {
  required_skills: string[]
  preferred_domains: string[]
  collaboration_style: string
  ideal_intent: string[]
  deal_breakers: string
  summary: string
}

export interface Profile {
  id: string
  user_id: string | null
  name: string | null
  image_url: string | null
  bio: string | null
  ikigai_love: string | null
  ikigai_good_at: string | null
  ikigai_world_needs: string | null
  ikigai_paid_for: string | null
  ikigai_mission: string | null
  skills: string[]
  interests: string[]
  availability: 'full_time' | 'part_time' | 'weekends' | null
  working_style: 'async' | 'sync' | 'hybrid' | null
  intent: string[]
  portfolio_url: string | null
  linkedin_url: string | null
  github_url: string | null
  twitter_url: string | null
  cv_url: string | null
  is_public: boolean
  profile_completion_score: number
  match_criteria: MatchCriteria | null
  created_at: string
  updated_at: string
}

export interface Match {
  id: string
  user_id: string
  matched_profile_id: string
  score: number
  one_liner: string | null
  explanation: string | null
  computed_at: string
  profile?: Profile
}

export interface Connection {
  id: string
  requester_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  requester_profile?: Profile
  receiver_profile?: Profile
}

export interface Message {
  id: string
  connection_id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
}

export interface Notification {
  id: string
  user_id: string
  type: 'connection_request' | 'message' | 'match'
  content: string
  reference_id: string | null
  read_at: string | null
  created_at: string
}

export interface Block {
  id: string
  blocker_id: string
  blocked_id: string
  created_at: string
}
