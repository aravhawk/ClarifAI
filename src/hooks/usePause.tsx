import { useState, useEffect, useCallback } from 'react'
import { onSnapshot, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { RoomPause } from '@/types/room'
import { MAX_PAUSES_PER_USER } from '@/lib/constants'

export function usePause(roomId: string, currentUserId: string) {
  const [activePause, setActivePause] = useState<RoomPause | null>(null)
  const [pauseCounts, setPauseCounts] = useState<Record<string, number>>({})
  const [pauseTimeLeft, setPauseTimeLeft] = useState<number | null>(null)

  // Subscribe to pauses subcollection
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'rooms', roomId, 'pauses'),
      (snap) => {
        const pauses = snap.docs.map(d => ({ id: d.id, room_id: roomId, ...d.data() } as RoomPause))

        // Find active pause
        const active = pauses.find(p => p.status === 'active') || null
        setActivePause(active)

        // Count per user
        const counts: Record<string, number> = {}
        for (const p of pauses) {
          counts[p.initiated_by] = (counts[p.initiated_by] || 0) + 1
        }
        setPauseCounts(counts)
      }
    )
    return unsubscribe
  }, [roomId])

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
    // onSnapshot will update state automatically
  }, [roomId])

  const endPauseEarly = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/pause`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to end pause')
    }
    // onSnapshot will update state automatically
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
