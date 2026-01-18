import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RoomMessage, ToneCheckResponse } from '@/types/room'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useMessages(roomId: string) {
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const supabase = createClient()

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('room_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }, [roomId, supabase])

  // Set up realtime subscription for new messages
  useEffect(() => {
    fetchMessages()

    const channel: RealtimeChannel = supabase
      .channel(`messages:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as RoomMessage])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, fetchMessages, supabase])

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

  return {
    messages,
    sendMessage,
    checkTone,
  }
}
