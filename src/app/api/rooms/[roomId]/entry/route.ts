import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoomMember } from '@/lib/api/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { text, submit } = await request.json()

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { user, member, adminClient } = authResult

    // Update entry
    const updateData: Record<string, unknown> = {
      text: text || '',
      updated_at: new Date().toISOString(),
    }

    if (submit) {
      updateData.submitted_at = new Date().toISOString()
    }

    const { error: updateError } = await adminClient
      .from('room_entries')
      .update(updateData)
      .eq('room_id', roomId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
    }

    // If submitting, check if both have now submitted
    if (submit) {
      // Log event
      await adminClient
        .from('room_events')
        .insert({
          room_id: roomId,
          user_id: user.id,
          type: 'submitted',
        })

      // Check if both submitted
      const { data: allEntries } = await adminClient
        .from('room_entries')
        .select('submitted_at')
        .eq('room_id', roomId)

      const bothSubmitted = allEntries?.every(e => e.submitted_at)

      if (bothSubmitted) {
        // Update room status to ready
        await adminClient
          .from('rooms')
          .update({ status: 'ready' })
          .eq('id', roomId)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Entry update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
