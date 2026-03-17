import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/server'
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

    // Check if turn state already exists
    const existingTurn = await adminDb.doc(`rooms/${roomId}/turnState/main`).get()
    if (existingTurn.exists) {
      return NextResponse.json({ turnState: { id: 'main', ...existingTurn.data() } })
    }

    // Get analysis to determine who goes first (based on sentiment)
    const analysisSnap = await adminDb.doc(`rooms/${roomId}/analysis/main`).get()
    if (!analysisSnap.exists) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 400 })
    }
    const analysis = analysisSnap.data()!

    // Get members in order
    const membersSnap = await adminDb.collection(`rooms/${roomId}/members`).orderBy('joined_at', 'asc').get()
    if (membersSnap.size !== 2) {
      return NextResponse.json({ error: 'Room must have 2 members' }, { status: 400 })
    }

    const userAId = membersSnap.docs[0].id
    const userBId = membersSnap.docs[1].id

    const sentimentA = analysis.analysis_json?.personA?.sentimentScore ?? 0
    const sentimentB = analysis.analysis_json?.personB?.sentimentScore ?? 0
    const firstSpeakerId = sentimentA <= sentimentB ? userAId : userBId

    const now = new Date().toISOString()
    const turnStateData = {
      current_user_id: firstSpeakerId,
      ai_guidance: {
        initialized: true,
        firstSpeaker: firstSpeakerId === userAId ? 'A' : 'B',
        reason: 'Based on initial sentiment analysis',
      },
      end_request_pending: false,
      end_requested_by: null,
      resolved_by_ai: false,
      resolution_reason: null,
      suggest_break: false,
      break_message: null,
      updated_at: now,
    }

    await adminDb.doc(`rooms/${roomId}/turnState/main`).set(turnStateData)
    await adminDb.doc(`rooms/${roomId}`).update({ status: 'in_progress' })

    await adminDb.collection(`rooms/${roomId}/events`).add({
      user_id: uid,
      type: 'chat_started',
      metadata: { firstSpeaker: firstSpeakerId },
      created_at: now,
    })

    return NextResponse.json({ turnState: { id: 'main', ...turnStateData } })
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

    const turnSnap = await adminDb.doc(`rooms/${roomId}/turnState/main`).get()
    const turnState = turnSnap.exists ? { id: 'main', ...turnSnap.data() } : null

    return NextResponse.json({ turnState })
  } catch (error) {
    console.error('Turn get error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
