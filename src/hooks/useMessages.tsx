import { useState, useEffect, useCallback } from 'react'
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { RoomMessage, ToneCheckResponse } from '@/types/room'

export function useMessages(roomId: string) {
  const [messages, setMessages] = useState<RoomMessage[]>([])

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'rooms', roomId, 'messages'), orderBy('created_at', 'asc')),
      (snap) => {
        setMessages(snap.docs.map(d => ({ id: d.id, room_id: roomId, ...d.data() } as RoomMessage)))
      }
    )
    return unsubscribe
  }, [roomId])

  const sendMessage = useCallback(async (text: string, toneLabels: string[]) => {
    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, toneLabels }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to send message')
    }
  }, [roomId])

  const checkTone = useCallback(async (text: string, toneLabels: string[]): Promise<ToneCheckResponse> => {
    const res = await fetch(`/api/rooms/${roomId}/messages/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, toneLabels }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Tone check failed')
    }

    const data = await res.json()
    return data.result
  }, [roomId])

  return { messages, sendMessage, checkTone }
}
