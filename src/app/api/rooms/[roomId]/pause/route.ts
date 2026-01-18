import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { PAUSE_DURATION_MS, MAX_PAUSES_PER_USER } from '@/lib/constants'
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

    // Check turn state - must be user's turn to pause
    const { data: turnState } = await adminClient
      .from('room_turn_state')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (!turnState) {
      return NextResponse.json({ error: 'Chat not started' }, { status: 400 })
    }

    if (turnState.current_user_id !== user.id) {
      return NextResponse.json({ error: 'You can only pause on your turn' }, { status: 403 })
    }

    // Check for active pause
    const { data: activePause } = await adminClient
      .from('room_pauses')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .single()

    if (activePause) {
      return NextResponse.json({ error: 'Already paused' }, { status: 400 })
    }

    // Count user's pauses
    const { data: userPauses } = await adminClient
      .from('room_pauses')
      .select('id')
      .eq('room_id', roomId)
      .eq('initiated_by', user.id)

    const pauseCount = userPauses?.length || 0

    if (pauseCount >= MAX_PAUSES_PER_USER) {
      return NextResponse.json({ error: 'No pauses remaining' }, { status: 400 })
    }

    const pausedAt = new Date()
    const resumeAt = new Date(pausedAt.getTime() + PAUSE_DURATION_MS)

    // Create pause
    const { data: pause, error: pauseError } = await adminClient
      .from('room_pauses')
      .insert({
        room_id: roomId,
        initiated_by: user.id,
        pause_index: pauseCount + 1,
        paused_at: pausedAt.toISOString(),
        resume_at: resumeAt.toISOString(),
        status: 'active',
      })
      .select()
      .single()

    if (pauseError) {
      console.error('Pause creation error:', pauseError)
      return NextResponse.json({ error: 'Failed to create pause' }, { status: 500 })
    }

    // Log event
    await adminClient
      .from('room_events')
      .insert({
        room_id: roomId,
        user_id: user.id,
        type: 'paused',
        metadata: { pauseIndex: pauseCount + 1, resumeAt: resumeAt.toISOString() },
      })

    return NextResponse.json({ 
      pause,
      remainingPauses: MAX_PAUSES_PER_USER - (pauseCount + 1),
    })
  } catch (error) {
    console.error('Pause error:', error)
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

    // Get active pause
    const { data: activePause } = await adminClient
      .from('room_pauses')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .single()

    // Check if pause has expired
    if (activePause) {
      const resumeAt = new Date(activePause.resume_at)
      if (resumeAt <= new Date()) {
        // Mark as completed
        await adminClient
          .from('room_pauses')
          .update({ status: 'completed' })
          .eq('id', activePause.id)
        
        return NextResponse.json({ activePause: null })
      }
    }

    // Get pause counts per user
    const { data: allPauses } = await adminClient
      .from('room_pauses')
      .select('initiated_by')
      .eq('room_id', roomId)

    const pauseCounts: Record<string, number> = {}
    for (const p of allPauses || []) {
      pauseCounts[p.initiated_by] = (pauseCounts[p.initiated_by] || 0) + 1
    }

    return NextResponse.json({ 
      activePause: activePause || null,
      pauseCounts,
      maxPauses: MAX_PAUSES_PER_USER,
    })
  } catch (error) {
    console.error('Get pause error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { user, member, adminClient } = authResult

    // Get active pause
    const { data: activePause } = await adminClient
      .from('room_pauses')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .single()

    if (!activePause) {
      return NextResponse.json({ error: 'No active pause' }, { status: 400 })
    }

    // End pause early
    await adminClient
      .from('room_pauses')
      .update({ status: 'completed' })
      .eq('id', activePause.id)

    // Log event
    await adminClient
      .from('room_events')
      .insert({
        room_id: roomId,
        user_id: user.id,
        type: 'pause_ended_early',
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('End pause error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
