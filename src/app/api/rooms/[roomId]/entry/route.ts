import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/server'
import { requireRoomMember } from '@/lib/api/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { text, submit } = await request.json()
    const normalizedText = typeof text === 'string' ? text : ''

    if (submit && normalizedText.trim().length === 0) {
      return NextResponse.json({ error: 'Entry text is required before submitting' }, { status: 400 })
    }

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = {
      text: normalizedText,
      updated_at: now,
    }

    if (submit) {
      updateData.submitted_at = now
    }

    try {
      await adminDb.doc(`rooms/${roomId}/entries/${uid}`).update(updateData)
    } catch (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
    }

    if (submit) {
      await adminDb.collection(`rooms/${roomId}/events`).add({
        user_id: uid,
        type: 'submitted',
        metadata: {},
        created_at: now,
      })

      // Check if both submitted
      const entriesSnap = await adminDb.collection(`rooms/${roomId}/entries`).get()
      const bothSubmitted = entriesSnap.docs.length === 2 && entriesSnap.docs.every(d => d.data().submitted_at)

      if (bothSubmitted) {
        await adminDb.doc(`rooms/${roomId}`).update({ status: 'ready' })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Entry update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
