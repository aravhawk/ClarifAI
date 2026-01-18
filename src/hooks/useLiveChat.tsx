'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { LiveChatContext } from '@/types/room'
import { useMessages } from './useMessages'
import { usePause } from './usePause'
import { useTurnState } from './useTurnState'
import { useEndRequest } from './useEndRequest'

const LiveChatCtx = createContext<LiveChatContext | null>(null)

interface LiveChatProviderProps {
  children: ReactNode
  roomId: string
  currentUserId: string
}

export function LiveChatProvider({ children, roomId, currentUserId }: LiveChatProviderProps) {
  const [loading] = useState(false)
  const [error] = useState<string | null>(null)

  // Compose focused hooks
  const { messages, sendMessage, checkTone } = useMessages(roomId)
  const { turnState, isMyTurn } = useTurnState(roomId, currentUserId)
  const {
    activePause,
    pauseCounts,
    pauseTimeLeft,
    isPaused,
    myPausesRemaining,
    triggerPause,
    endPauseEarly,
  } = usePause(roomId, currentUserId)

  // End request state (derived from turnState)
  const endRequestPending = turnState?.end_request_pending || false
  const endRequestedByMe = turnState?.end_requested_by === currentUserId

  // End request handlers need to update turnState
  const [localTurnState, setLocalTurnState] = useState(turnState)
  const { requestEnd, respondToEndRequest, cancelEndRequest } = useEndRequest(
    roomId,
    localTurnState,
    setLocalTurnState
  )

  const refreshChat = useCallback(async () => {
    // Refresh is handled by realtime subscriptions in child hooks
  }, [])

  const value: LiveChatContext = {
    messages,
    turnState: localTurnState || turnState,
    activePause,
    pauseCounts,
    isMyTurn,
    isPaused,
    pauseTimeLeft,
    myPausesRemaining,
    endRequestPending,
    endRequestedByMe,
    loading,
    error,
    sendMessage,
    checkTone,
    triggerPause,
    endPauseEarly,
    requestEnd,
    respondToEndRequest,
    cancelEndRequest,
    refreshChat,
  }

  return <LiveChatCtx.Provider value={value}>{children}</LiveChatCtx.Provider>
}

export function useLiveChat() {
  const context = useContext(LiveChatCtx)
  if (!context) {
    throw new Error('useLiveChat must be used within a LiveChatProvider')
  }
  return context
}
