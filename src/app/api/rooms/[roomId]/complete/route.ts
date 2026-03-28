import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/server'
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
    const { uid } = authResult

    // Get room, analysis, entries, members
    const [roomSnap, analysisSnap, membersSnap, entriesSnap] = await Promise.all([
      adminDb.doc(`rooms/${roomId}`).get(),
      adminDb.doc(`rooms/${roomId}/analysis/main`).get(),
      adminDb.collection(`rooms/${roomId}/members`).orderBy('joined_at', 'asc').get(),
      adminDb.collection(`rooms/${roomId}/entries`).get(),
    ])

    if (!roomSnap.exists || !analysisSnap.exists || entriesSnap.size !== 2) {
      return NextResponse.json({ error: 'Room data incomplete' }, { status: 400 })
    }

    const room = roomSnap.data()!
    const analysis = analysisSnap.data()!
    const entries = entriesSnap.docs.map(d => ({ user_id: d.id, ...d.data() })) as { user_id: string; text?: string }[]
    const userAId = membersSnap.docs[0]?.id

    const entryA = entries.find(e => e.user_id === userAId)
    const entryB = entries.find(e => e.user_id !== userAId)

    const createdAt = new Date(room.created_at)
    const completedAt = new Date()
    const resolutionTimeSeconds = Math.floor((completedAt.getTime() - createdAt.getTime()) / 1000)

    // Create anonymized research record
    await adminDb.collection('researchAggregate').add({
      conflict_category: analysis.conflict_category,
      horsemen: analysis.horsemen,
      sentiment_shift_user_a: sentimentAfterA != null ? sentimentAfterA - (analysis.sentiment_before_a || 0) : null,
      sentiment_shift_user_b: sentimentAfterB != null ? sentimentAfterB - (analysis.sentiment_before_b || 0) : null,
      sentiment_shift_ai: null,
      session_outcome: analysis.safety_level === 'critical' ? 'flagged' : 'completed',
      resolution_time_seconds: resolutionTimeSeconds,
      pause_count: pauseCount || 0,
      compromise_selected: compromiseSelected || null,
      anonymized_text_a: anonymizeText(entryA?.text || ''),
      anonymized_text_b: anonymizeText(entryB?.text || ''),
      created_at: completedAt.toISOString(),
    })

    // Update room status
    await adminDb.doc(`rooms/${roomId}`).update({
      status: 'completed',
      completed_at: completedAt.toISOString(),
      delete_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })

    // Update analysis with post-sentiment if provided
    if (sentimentAfterA != null || sentimentAfterB != null) {
      await adminDb.doc(`rooms/${roomId}/analysis/main`).update({
        sentiment_after_a: sentimentAfterA ?? null,
        sentiment_after_b: sentimentAfterB ?? null,
      })
    }

    await adminDb.collection(`rooms/${roomId}/events`).add({
      user_id: uid,
      type: 'completed',
      metadata: { compromiseSelected, pauseCount },
      created_at: completedAt.toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Complete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
