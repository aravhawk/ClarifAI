import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateRoomCode } from '@/lib/utils/room'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { relationship, displayName } = await request.json()

    if (!relationship || typeof relationship !== 'string') {
      return NextResponse.json({ error: 'Relationship required' }, { status: 400 })
    }

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return NextResponse.json({ error: 'Display name required' }, { status: 400 })
    }

    // Generate unique room code
    let code = generateRoomCode()
    let attempts = 0
    const adminClient = await createAdminClient()
    
    // Ensure code is unique
    while (attempts < 10) {
      const { data: existing } = await adminClient
        .from('rooms')
        .select('id')
        .eq('code', code)
        .single()
      
      if (!existing) break
      code = generateRoomCode()
      attempts++
    }

    if (attempts >= 10) {
      return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 })
    }

    // Create room
    const { data: room, error: roomError } = await adminClient
      .from('rooms')
      .insert({ code })
      .select()
      .single()

    if (roomError) {
      console.error('Room creation error:', roomError)
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
    }

    // Add creator as first member
    const { error: memberError } = await adminClient
      .from('room_members')
      .insert({
        room_id: room.id,
        user_id: user.id,
        relationship_to_other: relationship,
        display_name: displayName.trim(),
      })

    if (memberError) {
      console.error('Member creation error:', memberError)
      // Clean up room
      await adminClient.from('rooms').delete().eq('id', room.id)
      return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
    }


    // Create empty entry for creator
    await adminClient
      .from('room_entries')
      .insert({
        room_id: room.id,
        user_id: user.id,
        text: '',
      })

    // Log event
    await adminClient
      .from('room_events')
      .insert({
        room_id: room.id,
        user_id: user.id,
        type: 'created',
      })

    return NextResponse.json({ 
      roomId: room.id, 
      code: room.code,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/r/${room.code}`
    })
  } catch (error) {
    console.error('Create room error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
