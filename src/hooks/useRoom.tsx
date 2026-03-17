'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { onSnapshot, doc, collection, query, orderBy } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/lib/firebase/client'
import type { Room, RoomMember, RoomEntry, RoomAIAnalysis, RoomContext } from '@/types/room'

const RoomCtx = createContext<RoomContext | null>(null)

interface RoomProviderProps {
  children: ReactNode
  roomId: string
}

export function RoomProvider({ children, roomId }: RoomProviderProps) {
  const [room, setRoom] = useState<Room | null>(null)
  const [members, setMembers] = useState<RoomMember[]>([])
  const [entries, setEntries] = useState<RoomEntry[]>([])
  const [analysis, setAnalysis] = useState<RoomAIAnalysis | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid)
      } else {
        setError('Not authenticated')
        setLoading(false)
      }
    })
    return unsub
  }, [])

  // Set up Firestore onSnapshot subscriptions once we have a user
  useEffect(() => {
    if (!currentUserId) return

    const unsubscribers: (() => void)[] = []

    // Room document
    const unsubRoom = onSnapshot(
      doc(db, 'rooms', roomId),
      (snap) => {
        if (!snap.exists()) {
          setError('Room not found or access denied')
          setLoading(false)
          return
        }
        setRoom({ id: snap.id, ...snap.data() } as Room)
        setLoading(false)
      },
      () => {
        setError('Room not found or access denied')
        setLoading(false)
      }
    )
    unsubscribers.push(unsubRoom)

    // Members subcollection
    const unsubMembers = onSnapshot(
      query(collection(db, 'rooms', roomId, 'members'), orderBy('joined_at', 'asc')),
      (snap) => {
        setMembers(snap.docs.map(d => ({ room_id: roomId, user_id: d.id, ...d.data() } as RoomMember)))
      }
    )
    unsubscribers.push(unsubMembers)

    // Entries subcollection
    const unsubEntries = onSnapshot(
      collection(db, 'rooms', roomId, 'entries'),
      (snap) => {
        setEntries(snap.docs.map(d => ({ room_id: roomId, user_id: d.id, ...d.data() } as RoomEntry)))
      }
    )
    unsubscribers.push(unsubEntries)

    // Analysis singleton doc
    const unsubAnalysis = onSnapshot(
      doc(db, 'rooms', roomId, 'analysis', 'main'),
      (snap) => {
        if (snap.exists()) {
          setAnalysis({ room_id: roomId, ...snap.data() } as RoomAIAnalysis)
        } else {
          setAnalysis(null)
        }
      }
    )
    unsubscribers.push(unsubAnalysis)

    return () => unsubscribers.forEach(u => u())
  }, [roomId, currentUserId])

  const refreshRoom = useCallback(async () => {
    // onSnapshot keeps data live; this is a no-op kept for API compatibility
  }, [])

  // Derived state
  const partnerId = members.find(m => m.user_id !== currentUserId)?.user_id || null
  const myEntry = entries.find(e => e.user_id === currentUserId) || null
  const partnerEntry = entries.find(e => e.user_id === partnerId) || null
  const isCreator = members.length > 0 && members[0].user_id === currentUserId
  const memberCount = members.length
  const bothSubmitted = !!(myEntry?.submitted_at && partnerEntry?.submitted_at)

  const value: RoomContext = {
    room,
    members,
    entries,
    analysis,
    currentUserId,
    partnerId,
    myEntry,
    partnerEntry,
    isCreator,
    memberCount,
    bothSubmitted,
    loading,
    error,
    refreshRoom,
  }

  return <RoomCtx.Provider value={value}>{children}</RoomCtx.Provider>
}

export function useRoom() {
  const context = useContext(RoomCtx)
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider')
  }
  return context
}
