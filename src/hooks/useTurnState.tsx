import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RoomTurnState } from '@/types/room'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useTurnState(roomId: string, currentUserId: string) {
  const [turnState, setTurnState] = useState<RoomTurnState | null>(null)
  const supabase = createClient()

  // Fetch initial turn state
  const fetchTurnState = useCallback(async () => {
    const { data } = await supabase
      .from('room_turn_state')
      .select('*')
      .eq('room_id', roomId)
      .single()
    setTurnState(data || null)
  }, [roomId, supabase])

  // Set up realtime subscription
  useEffect(() => {
    fetchTurnState()

    const channel: RealtimeChannel = supabase
      .channel(`turn:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_turn_state', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setTurnState(payload.new as RoomTurnState)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, fetchTurnState, supabase])

  const isMyTurn = turnState?.current_user_id === currentUserId

  return {
    turnState,
    isMyTurn,
  }
}
