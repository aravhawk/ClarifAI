// Main types export file - re-exports all types for backward compatibility
// Types are now organized into separate modules:
// - entities.ts: Database entities (Room, RoomMember, RoomMessage, etc.)
// - ai.ts: AI analysis and guidance types
// - contexts.ts: React context types

// Re-export all entity types
export type {
  RoomStatus,
  SafetyLevel,
  SessionOutcome,
  PauseStatus,
  Room,
  RoomMember,
  RoomEntry,
  RoomAIAnalysis,
  RoomEvent,
  RoomEventMetadata,
  RoomMessage,
  ToneAnalysis,
  RoomTurnState,
  RoomPause,
  ToneLabelPreset,
} from './entities'

export { TONE_LABEL_PRESETS } from './entities'

// Re-export all AI types
export type {
  AIAnalysis,
  PersonAnalysis,
  PatternDetection,
  NVCTranslation,
  ScriptSection,
  Compromise,
  LiveGuidance,
  ToneCheckResponse,
} from './ai'

// Re-export all context types
export type {
  RoomContext,
  LiveChatContext,
} from './contexts'
