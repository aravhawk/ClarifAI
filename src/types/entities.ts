// Core entity types from the database

import type { AIAnalysis, LiveGuidance } from './ai'

export type RoomStatus = 'waiting' | 'ready' | 'revealed' | 'in_progress' | 'completed' | 'flagged'
export type SafetyLevel = 'normal' | 'warning' | 'critical'
export type SessionOutcome = 'completed' | 'abandoned' | 'paused' | 'flagged'
export type PauseStatus = 'active' | 'completed'

export interface Room {
  id: string
  code: string
  status: RoomStatus
  created_at: string
  completed_at: string | null
  delete_at: string | null
  consent_version: string
}

export interface RoomMember {
  room_id: string
  user_id: string
  joined_at: string
  consented_at: string
  relationship_to_other: string | null
  display_name: string | null
}

export interface RoomEntry {
  room_id: string
  user_id: string
  text: string
  submitted_at: string | null
  updated_at: string
}

export interface RoomAIAnalysis {
  room_id: string
  analysis_json: AIAnalysis
  safety_level: SafetyLevel
  horsemen: string[]
  conflict_category: string | null
  sentiment_before_a: number | null
  sentiment_before_b: number | null
  sentiment_after_a: number | null
  sentiment_after_b: number | null
  created_at: string
}

export interface RoomEvent {
  id: string
  room_id: string
  user_id: string | null
  type: string
  metadata: RoomEventMetadata
  created_at: string
}

// Specific metadata types for room events
export type RoomEventMetadata =
  | { type: 'chat_started'; firstSpeaker: string }
  | { type: 'message_sent'; messageId: string; toneLabels: string[] }
  | { type: 'pause_initiated'; pauseId: string; pauseIndex: number }
  | { type: 'pause_completed'; pauseId: string; endedEarly: boolean }
  | { type: 'turn_changed'; previousUser: string; currentUser: string }
  | { type: 'end_requested'; requestedBy: string }
  | { type: 'end_accepted'; acceptedBy: string }
  | { type: 'end_declined'; declinedBy: string }
  | { type: 'session_completed'; outcome: SessionOutcome }
  | Record<string, unknown> // Fallback for untyped events

export interface RoomMessage {
  id: string
  room_id: string
  user_id: string
  text: string
  tone_labels: string[]
  tone_analysis: ToneAnalysis
  blocked: boolean
  created_at: string
}

export interface ToneAnalysis {
  toneSummary?: string
  suggestedLabels?: string[]
  warning?: string
}

export interface RoomTurnState {
  room_id: string
  current_user_id: string
  last_turn_at: string
  resolved_by_ai: boolean
  resolution_reason: string | null
  suggest_break: boolean
  break_message: string | null
  user_a_confirmed: boolean
  user_b_confirmed: boolean
  end_requested_by: string | null
  end_request_pending: boolean
  ai_guidance: LiveGuidance | null
  created_at: string
  updated_at: string
}

export interface RoomPause {
  id: string
  room_id: string
  initiated_by: string
  pause_index: number
  paused_at: string
  resume_at: string
  status: PauseStatus
  created_at: string
}

// Tone label presets
export const TONE_LABEL_PRESETS = [
  'Calm',
  'Hurt',
  'Frustrated',
  'Angry',
  'Anxious',
  'Sad',
  'Confused',
  'Hopeful',
  'Appreciative',
  'Overwhelmed',
  'Apologetic',
  'Curious',
  'Defensive',
  'Vulnerable',
  'Disappointed',
] as const

export type ToneLabelPreset = typeof TONE_LABEL_PRESETS[number]
