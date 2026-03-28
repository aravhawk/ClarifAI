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
      return
    }

    const resumeAt = new Date(activePause.resume_at).getTime()
    const initialRemaining = Math.max(0, Math.floor((resumeAt - Date.now()) / 1000))

    if (initialRemaining <= 0) {
      // Avoid calling setActivePause inside an effect that depends on it
      // Let the snapshot handle state changes when possible.
      return
    }

    // Initialize timer only once per active pause
    let mounted = true
    let currentRemaining = initialRemaining

    const interval = setInterval(() => {
      if (!mounted) return

      currentRemaining -= 1

      if (currentRemaining <= 0) {
        setPauseTimeLeft(null)
        clearInterval(interval)
      } else {
        setPauseTimeLeft(currentRemaining)
      }
    }, 1000)

    // Initialize state within setTimeout to avoid synchronous setState inside effect
    setTimeout(() => {
      if (mounted) {
        setPauseTimeLeft(initialRemaining)
      }
    }, 0)

    return () => {
      mounted = false
      clearInterval(interval)
    }
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
