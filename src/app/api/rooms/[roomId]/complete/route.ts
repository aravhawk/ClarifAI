import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { anonymizeText } from '@/lib/utils/room'
import { requireRoomMember } from '@/lib/api/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { compromiseSelected, sentimentAfterA, sentimentAfterB, pauseCount } = await request.json()

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { user, member, adminClient } = authResult

    // Get room and analysis
    const { data: room } = await adminClient
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    const { data: analysis } = await adminClient
      .from('room_ai_analysis')
      .select('*')
      .eq('room_id', roomId)
      .single()

    const { data: entries } = await adminClient
      .from('room_entries')
      .select('*')
      .eq('room_id', roomId)

    const { data: members } = await adminClient
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })

    if (!room || !analysis || !entries || entries.length !== 2) {
      return NextResponse.json({ error: 'Room data incomplete' }, { status: 400 })
    }

    const userAId = members?.[0]?.user_id
    const entryA = entries.find(e => e.user_id === userAId)
    const entryB = entries.find(e => e.user_id !== userAId)

    // Calculate resolution time
    const createdAt = new Date(room.created_at)
    const completedAt = new Date()
    const resolutionTimeSeconds = Math.floor((completedAt.getTime() - createdAt.getTime()) / 1000)

    // Create anonymized research record
    const researchRecord = {
      conflict_category: analysis.conflict_category,
      horsemen: analysis.horsemen,
      sentiment_shift_user_a: sentimentAfterA != null ? sentimentAfterA - (analysis.sentiment_before_a || 0) : null,
      sentiment_shift_user_b: sentimentAfterB != null ? sentimentAfterB - (analysis.sentiment_before_b || 0) : null,
      sentiment_shift_ai: null, // Could be computed if we did post-analysis
      session_outcome: analysis.safety_level === 'critical' ? 'flagged' : 'completed',
      resolution_time_seconds: resolutionTimeSeconds,
      pause_count: pauseCount || 0,
      compromise_selected: compromiseSelected || null,
      anonymized_text_a: anonymizeText(entryA?.text || ''),
      anonymized_text_b: anonymizeText(entryB?.text || ''),
    }

    await adminClient.from('research_aggregate').insert(researchRecord)

    // Update room status
    await adminClient
      .from('rooms')
      .update({ 
        status: 'completed',
        completed_at: completedAt.toISOString(),
        delete_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .eq('id', roomId)

    // Update analysis with post-sentiment if provided
    if (sentimentAfterA != null || sentimentAfterB != null) {
      await adminClient
        .from('room_ai_analysis')
        .update({
          sentiment_after_a: sentimentAfterA,
          sentiment_after_b: sentimentAfterB,
        })
        .eq('room_id', roomId)
    }

    // Log event
    await adminClient.from('room_events').insert({
      room_id: roomId,
      user_id: user.id,
      type: 'completed',
      metadata: { compromiseSelected, pauseCount },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Complete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
