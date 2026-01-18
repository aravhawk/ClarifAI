'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Room, RoomMember, RoomEntry, RoomAIAnalysis, RoomContext } from '@/types/room'
import type { RealtimeChannel } from '@supabase/supabase-js'

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

  const supabase = createClient()

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      setCurrentUserId(user.id)

      // Fetch room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single()

      if (roomError) {
        setError('Room not found or access denied')
        setLoading(false)
        return
      }
      setRoom(roomData)

      // Fetch members
      const { data: membersData } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', roomId)
      setMembers(membersData || [])

      // Fetch entries
      const { data: entriesData } = await supabase
        .from('room_entries')
        .select('*')
        .eq('room_id', roomId)
      setEntries(entriesData || [])

      // Fetch analysis if exists
      const { data: analysisData } = await supabase
        .from('room_ai_analysis')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle()
      setAnalysis(analysisData || null)

      setLoading(false)
    } catch (err) {
      setError('Failed to load room data')
      setLoading(false)
      console.error(err)
    }
  }, [roomId, supabase])

  // Set up realtime subscriptions
  useEffect(() => {
    fetchData()

    let channel: RealtimeChannel

    const setupRealtime = async () => {
      channel = supabase
        .channel(`room:${roomId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              setRoom(payload.new as Room)
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
          (payload) => {
            setMembers(prev => [...prev, payload.new as RoomMember])
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'room_entries', filter: `room_id=eq.${roomId}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setEntries(prev => [...prev, payload.new as RoomEntry])
            } else if (payload.eventType === 'UPDATE') {
              setEntries(prev => prev.map(e => 
                e.user_id === (payload.new as RoomEntry).user_id ? payload.new as RoomEntry : e
              ))
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'room_ai_analysis', filter: `room_id=eq.${roomId}` },
          (payload) => {
            setAnalysis(payload.new as RoomAIAnalysis)
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [roomId, fetchData, supabase])

  const refreshRoom = useCallback(async () => {
    await fetchData()
  }, [fetchData])

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
