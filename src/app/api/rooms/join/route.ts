import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { code, relationship, displayName } = await request.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 })
    }

    if (!relationship || typeof relationship !== 'string') {
      return NextResponse.json({ error: 'Relationship required' }, { status: 400 })
    }

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return NextResponse.json({ error: 'Display name required' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = await createAdminClient()

    // Find room by code
    const { data: room, error: roomError } = await adminClient
      .from('rooms')
      .select('*')
      .eq('code', code.toUpperCase())
      .single()

    if (roomError || !room) {
      // Generic error to prevent room enumeration
      return NextResponse.json({ error: 'Unable to join room' }, { status: 404 })
    }


    // Check if room is flagged
    if (room.status === 'flagged') {
      return NextResponse.json({ error: 'This room is no longer available' }, { status: 403 })
    }

    // Check current member count
    const { data: members } = await adminClient
      .from('room_members')
      .select('user_id')
      .eq('room_id', room.id)

    const memberCount = members?.length || 0

    // Check if user is already a member
    const isAlreadyMember = members?.some(m => m.user_id === user.id)
    if (isAlreadyMember) {
      return NextResponse.json({ 
        roomId: room.id,
        code: room.code,
        alreadyMember: true
      })
    }

    // Check if room is full
    if (memberCount >= 2) {
      return NextResponse.json({ error: 'Unable to join room' }, { status: 403 })
    }

    // Add user as member
    const { error: memberError } = await adminClient
      .from('room_members')
      .insert({
        room_id: room.id,
        user_id: user.id,
        relationship_to_other: relationship,
        display_name: displayName.trim(),
      })

    if (memberError) {
      console.error('Join error:', memberError)
      return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
    }

    // Create empty entry for joiner
    const { error: entryError } = await adminClient
      .from('room_entries')
      .insert({
        room_id: room.id,
        user_id: user.id,
        text: '',
      })

    if (entryError) {
      console.error('Entry creation error:', entryError)
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    // Log event
    await adminClient
      .from('room_events')
      .insert({
        room_id: room.id,
        user_id: user.id,
        type: 'joined',
      })

    return NextResponse.json({ 
      roomId: room.id,
      code: room.code,
      alreadyMember: false
    })
  } catch (error) {
    console.error('Join room error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
