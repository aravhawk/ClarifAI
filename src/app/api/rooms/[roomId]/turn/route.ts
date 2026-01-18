import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoomMember } from '@/lib/api/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { user, member, adminClient } = authResult

    // Check if turn state already exists
    const { data: existingTurn } = await adminClient
      .from('room_turn_state')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (existingTurn) {
      return NextResponse.json({ turnState: existingTurn })
    }

    // Get analysis to determine who goes first (based on sentiment)
    const { data: analysis } = await adminClient
      .from('room_ai_analysis')
      .select('analysis_json')
      .eq('room_id', roomId)
      .single()

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 400 })
    }

    // Get members in order
    const { data: members } = await adminClient
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })

    if (!members || members.length !== 2) {
      return NextResponse.json({ error: 'Room must have 2 members' }, { status: 400 })
    }

    const userAId = members[0].user_id
    const userBId = members[1].user_id

    // Determine who goes first based on sentiment
    // The person with the lower (more negative) sentiment speaks first
    // This gives them a chance to express themselves
    const sentimentA = analysis.analysis_json?.personA?.sentimentScore ?? 0
    const sentimentB = analysis.analysis_json?.personB?.sentimentScore ?? 0

    const firstSpeakerId = sentimentA <= sentimentB ? userAId : userBId

    // Create turn state
    const { data: turnState, error: turnError } = await adminClient
      .from('room_turn_state')
      .insert({
        room_id: roomId,
        current_user_id: firstSpeakerId,
        ai_guidance: {
          initialized: true,
          firstSpeaker: firstSpeakerId === userAId ? 'A' : 'B',
          reason: 'Based on initial sentiment analysis'
        }
      })
      .select()
      .single()

    if (turnError) {
      console.error('Turn state creation error:', turnError)
      return NextResponse.json({ error: 'Failed to create turn state' }, { status: 500 })
    }

    // Update room status to in_progress
    await adminClient
      .from('rooms')
      .update({ status: 'in_progress' })
      .eq('id', roomId)

    // Log event
    await adminClient
      .from('room_events')
      .insert({
        room_id: roomId,
        user_id: user.id,
        type: 'chat_started',
        metadata: { firstSpeaker: firstSpeakerId }
      })

    return NextResponse.json({ turnState })
  } catch (error) {
    console.error('Turn init error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { user, member, adminClient } = authResult

    // Get turn state
    const { data: turnState } = await adminClient
      .from('room_turn_state')
      .select('*')
      .eq('room_id', roomId)
      .single()

    return NextResponse.json({ turnState: turnState || null })
  } catch (error) {
    console.error('Turn get error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
