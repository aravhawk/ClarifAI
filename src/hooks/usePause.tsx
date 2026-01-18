import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RoomPause } from '@/types/room'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { MAX_PAUSES_PER_USER } from '@/lib/constants'

export function usePause(roomId: string, currentUserId: string) {
  const [activePause, setActivePause] = useState<RoomPause | null>(null)
  const [pauseCounts, setPauseCounts] = useState<Record<string, number>>({})
  const [pauseTimeLeft, setPauseTimeLeft] = useState<number | null>(null)
  const supabase = createClient()

  // Fetch initial pause data
  const fetchPauseData = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/pause`)
    if (res.ok) {
      const data = await res.json()
      setActivePause(data.activePause)
      setPauseCounts(data.pauseCounts || {})
    }
  }, [roomId])

  // Set up realtime subscription for pauses
  useEffect(() => {
    fetchPauseData()

    const channel: RealtimeChannel = supabase
      .channel(`pauses:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_pauses', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPause = payload.new as RoomPause
            if (newPause.status === 'active') {
              setActivePause(newPause)
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedPause = payload.new as RoomPause
            if (updatedPause.status === 'completed') {
              setActivePause(null)
            } else {
              setActivePause(updatedPause)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, fetchPauseData, supabase])

  // Client-side countdown timer
  useEffect(() => {
    if (!activePause) {
      setPauseTimeLeft(null)
      return
    }

    const resumeAt = new Date(activePause.resume_at).getTime()
    const initialRemaining = Math.max(0, Math.floor((resumeAt - Date.now()) / 1000))

    if (initialRemaining <= 0) {
      setActivePause(null)
      setPauseTimeLeft(null)
      return
    }

    setPauseTimeLeft(initialRemaining)

    const interval = setInterval(() => {
      setPauseTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          setActivePause(null)
          clearInterval(interval)
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [activePause])

  const triggerPause = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/pause`, { method: 'POST' })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to pause')
    }

    const data = await res.json()
    setActivePause(data.pause)
    setPauseCounts(prev => ({
      ...prev,
      [currentUserId]: (prev[currentUserId] || 0) + 1,
    }))
  }, [roomId, currentUserId])

  const endPauseEarly = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/pause`, { method: 'DELETE' })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to end pause')
    }

    setActivePause(null)
    setPauseTimeLeft(null)
  }, [roomId])

  const myPausesRemaining = MAX_PAUSES_PER_USER - (pauseCounts[currentUserId] || 0)
  const isPaused = !!activePause

  return {
    activePause,
    pauseCounts,
    pauseTimeLeft,
    isPaused,
    myPausesRemaining,
    triggerPause,
    endPauseEarly,
  }
}
