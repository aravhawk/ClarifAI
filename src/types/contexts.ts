// React context types for client-side state management

import type {
  Room,
  RoomMember,
  RoomEntry,
  RoomAIAnalysis,
  RoomMessage,
  RoomTurnState,
  RoomPause,
} from './entities'
import type { ToneCheckResponse } from './ai'

export interface RoomContext {
  room: Room | null
  members: RoomMember[]
  entries: RoomEntry[]
  analysis: RoomAIAnalysis | null
  currentUserId: string | null
  partnerId: string | null
  myEntry: RoomEntry | null
  partnerEntry: RoomEntry | null
  isCreator: boolean
  memberCount: number
  bothSubmitted: boolean
  loading: boolean
  error: string | null
  refreshRoom: () => Promise<void>
}

export interface LiveChatContext {
  messages: RoomMessage[]
  turnState: RoomTurnState | null
  activePause: RoomPause | null
  pauseCounts: Record<string, number>
  isMyTurn: boolean
  isPaused: boolean
  pauseTimeLeft: number | null
  myPausesRemaining: number
  endRequestPending: boolean
  endRequestedByMe: boolean
  loading: boolean
  error: string | null
  sendMessage: (text: string, toneLabels: string[]) => Promise<void>
  checkTone: (text: string, toneLabels: string[]) => Promise<ToneCheckResponse>
  triggerPause: () => Promise<void>
  endPauseEarly: () => Promise<void>
  requestEnd: () => Promise<void>
  respondToEndRequest: (accept: boolean) => Promise<{ ended: boolean }>
  cancelEndRequest: () => Promise<void>
  refreshChat: () => Promise<void>
}
