import { useState, useEffect } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { RoomTurnState } from '@/types/room'

export function useTurnState(roomId: string, currentUserId: string) {
  const [turnState, setTurnState] = useState<RoomTurnState | null>(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'rooms', roomId, 'turnState', 'main'),
      (snap) => {
        if (snap.exists()) {
          setTurnState({ id: 'main', room_id: roomId, ...snap.data() } as unknown as RoomTurnState)
        } else {
          setTurnState(null)
        }
      }
    )
    return unsubscribe
  }, [roomId])

  const isMyTurn = turnState?.current_user_id === currentUserId

  return { turnState, isMyTurn }
}
