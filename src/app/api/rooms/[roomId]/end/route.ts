import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoomMember } from '@/lib/api/auth'

// POST - Request to end the session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { user, member, adminClient } = authResult

    // Get turn state
    const { data: turnState, error: turnError } = await adminClient
      .from('room_turn_state')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (turnError || !turnState) {
      return NextResponse.json({ error: 'Chat not started' }, { status: 400 })
    }

    // Check if there's already a pending end request
    if (turnState.end_request_pending) {
      return NextResponse.json({ error: 'End request already pending' }, { status: 400 })
    }

    // Update turn state with end request
    const { data: updatedTurnState, error: updateError } = await adminClient
      .from('room_turn_state')
      .update({
        end_requested_by: user.id,
        end_request_pending: true,
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .select()
      .single()

    if (updateError) {
      console.error('End request error:', updateError)
      return NextResponse.json({ error: 'Failed to request end' }, { status: 500 })
    }

    // Log event
    await adminClient
      .from('room_events')
      .insert({
        room_id: roomId,
        user_id: user.id,
        type: 'end_requested',
      })

    return NextResponse.json({ 
      turnState: updatedTurnState,
      message: 'End request sent to partner',
    })
  } catch (error) {
    console.error('End request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Accept or decline end request
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { action } = await request.json() // 'accept' or 'decline'

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { user, member, adminClient } = authResult

    // Get turn state
    const { data: turnState, error: turnError } = await adminClient
      .from('room_turn_state')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (turnError || !turnState) {
      return NextResponse.json({ error: 'Chat not started' }, { status: 400 })
    }

    // Verify there's a pending request and user is not the requester
    if (!turnState.end_request_pending) {
      return NextResponse.json({ error: 'No pending end request' }, { status: 400 })
    }

    if (turnState.end_requested_by === user.id) {
      return NextResponse.json({ error: 'Cannot respond to your own request' }, { status: 403 })
    }

    if (action === 'accept') {
      // Mark room as completed
      await adminClient
        .from('rooms')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', roomId)

      // Update turn state
      await adminClient
        .from('room_turn_state')
        .update({
          end_request_pending: false,
          end_requested_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', roomId)

      // Log event
      await adminClient
        .from('room_events')
        .insert({
          room_id: roomId,
          user_id: user.id,
          type: 'end_accepted',
        })

      return NextResponse.json({ 
        accepted: true,
        message: 'Session ended by mutual agreement',
      })
    } else {
      // Decline - clear the request
      const { data: updatedTurnState } = await adminClient
        .from('room_turn_state')
        .update({
          end_requested_by: null,
          end_request_pending: false,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', roomId)
        .select()
        .single()

      // Log event
      await adminClient
        .from('room_events')
        .insert({
          room_id: roomId,
          user_id: user.id,
          type: 'end_declined',
        })

      return NextResponse.json({ 
        accepted: false,
        turnState: updatedTurnState,
        message: 'End request declined',
      })
    }
  } catch (error) {
    console.error('End response error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Cancel own end request
export async function DELETE(
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

    if (!turnState || !turnState.end_request_pending) {
      return NextResponse.json({ error: 'No pending end request' }, { status: 400 })
    }

    if (turnState.end_requested_by !== user.id) {
      return NextResponse.json({ error: 'Can only cancel your own request' }, { status: 403 })
    }

    // Clear the request
    const { data: updatedTurnState } = await adminClient
      .from('room_turn_state')
      .update({
        end_requested_by: null,
        end_request_pending: false,
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .select()
      .single()

    // Log event
    await adminClient
      .from('room_events')
      .insert({
        room_id: roomId,
        user_id: user.id,
        type: 'end_request_cancelled',
      })

    return NextResponse.json({ 
      turnState: updatedTurnState,
      message: 'End request cancelled',
    })
  } catch (error) {
    console.error('Cancel end request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
