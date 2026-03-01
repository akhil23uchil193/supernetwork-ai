export const PROFILE_COMPLETION_THRESHOLD = 70

export const DICEBEAR_BASE_URL = 'https://api.dicebear.com/7.x/avataaars/svg?seed='

export const INTENT_OPTIONS = ['cofounder', 'teammate', 'client'] as const

export const AVAILABILITY_OPTIONS = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'weekends', label: 'Weekends' },
] as const

export const WORKING_STYLE_OPTIONS = [
  { value: 'async', label: 'Async' },
  { value: 'sync', label: 'Sync' },
  { value: 'hybrid', label: 'Hybrid' },
] as const
