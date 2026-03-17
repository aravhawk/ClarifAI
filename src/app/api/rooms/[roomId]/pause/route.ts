import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/server'
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
    const { uid } = authResult

    // Check turn state - must be user's turn to pause
    const turnSnap = await adminDb.doc(`rooms/${roomId}/turnState/main`).get()
    if (!turnSnap.exists) {
      return NextResponse.json({ error: 'Chat not started' }, { status: 400 })
    }

    if (turnSnap.data()!.current_user_id !== uid) {
      return NextResponse.json({ error: 'You can only pause on your turn' }, { status: 403 })
    }

    // Check for active pause
    const activePauseSnap = await adminDb.collection(`rooms/${roomId}/pauses`).where('status', '==', 'active').limit(1).get()
    if (!activePauseSnap.empty) {
      return NextResponse.json({ error: 'Already paused' }, { status: 400 })
    }

    // Count user's pauses
    const userPausesSnap = await adminDb.collection(`rooms/${roomId}/pauses`).where('initiated_by', '==', uid).get()
    const pauseCount = userPausesSnap.size

    if (pauseCount >= MAX_PAUSES_PER_USER) {
      return NextResponse.json({ error: 'No pauses remaining' }, { status: 400 })
    }

    const pausedAt = new Date()
    const resumeAt = new Date(pausedAt.getTime() + PAUSE_DURATION_MS)
    const now = pausedAt.toISOString()

    let pauseRef
    try {
      pauseRef = await adminDb.collection(`rooms/${roomId}/pauses`).add({
        initiated_by: uid,
        pause_index: pauseCount + 1,
        paused_at: now,
        resume_at: resumeAt.toISOString(),
        status: 'active',
      })
    } catch (pauseError) {
      console.error('Pause creation error:', pauseError)
      return NextResponse.json({ error: 'Failed to create pause' }, { status: 500 })
    }

    await adminDb.collection(`rooms/${roomId}/events`).add({
      user_id: uid,
      type: 'paused',
      metadata: { pauseIndex: pauseCount + 1, resumeAt: resumeAt.toISOString() },
      created_at: now,
    })

    return NextResponse.json({
      pause: { id: pauseRef.id, initiated_by: uid, pause_index: pauseCount + 1, paused_at: now, resume_at: resumeAt.toISOString(), status: 'active' },
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

    // Get active pause
    const activePauseSnap = await adminDb.collection(`rooms/${roomId}/pauses`).where('status', '==', 'active').limit(1).get()

    let activePause = null
    if (!activePauseSnap.empty) {
      const doc = activePauseSnap.docs[0]
      const data = doc.data()
      const resumeAt = new Date(data.resume_at)
      if (resumeAt <= new Date()) {
        await doc.ref.update({ status: 'completed' })
      } else {
        activePause = { id: doc.id, ...data }
      }
    }

    // Get pause counts per user
    const allPausesSnap = await adminDb.collection(`rooms/${roomId}/pauses`).get()
    const pauseCounts: Record<string, number> = {}
    for (const d of allPausesSnap.docs) {
      const initiated_by = d.data().initiated_by
      pauseCounts[initiated_by] = (pauseCounts[initiated_by] || 0) + 1
    }

    return NextResponse.json({ activePause, pauseCounts, maxPauses: MAX_PAUSES_PER_USER })
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
    const { uid } = authResult

    const activePauseSnap = await adminDb.collection(`rooms/${roomId}/pauses`).where('status', '==', 'active').limit(1).get()
    if (activePauseSnap.empty) {
      return NextResponse.json({ error: 'No active pause' }, { status: 400 })
    }

    await activePauseSnap.docs[0].ref.update({ status: 'completed' })

    await adminDb.collection(`rooms/${roomId}/events`).add({
      user_id: uid,
      type: 'pause_ended_early',
      metadata: {},
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('End pause error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
