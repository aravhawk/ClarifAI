// Polling intervals (ms)
export const CHAT_POLL_INTERVAL = 2000
export const STATUS_POLL_INTERVAL = 4000

// Pause config
export const PAUSE_DURATION_MS = 5 * 60 * 1000
export const MAX_PAUSES_PER_USER = 2

// AI token limits
export const REASONING_TOKENS = 4000
export const GUIDANCE_MAX_TOKENS = 2000

// Relationship options (shared by create/join pages)
export const RELATIONSHIP_OPTIONS = [
  { value: 'my wife', label: 'My wife' },
  { value: 'my husband', label: 'My husband' },
  { value: 'my girlfriend', label: 'My girlfriend' },
  { value: 'my boyfriend', label: 'My boyfriend' },
  { value: 'my best friend', label: 'My best friend' },
  { value: 'my brother', label: 'My brother' },
  { value: 'my sister', label: 'My sister' },
  { value: 'other', label: 'Other' },
] as const
