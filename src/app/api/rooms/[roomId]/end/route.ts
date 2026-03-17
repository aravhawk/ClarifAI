import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/server'
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
    const { uid } = authResult

    const turnSnap = await adminDb.doc(`rooms/${roomId}/turnState/main`).get()
    if (!turnSnap.exists) {
      return NextResponse.json({ error: 'Chat not started' }, { status: 400 })
    }
    const turnState = turnSnap.data()!

    if (turnState.end_request_pending) {
      return NextResponse.json({ error: 'End request already pending' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updates = { end_requested_by: uid, end_request_pending: true, updated_at: now }

    try {
      await adminDb.doc(`rooms/${roomId}/turnState/main`).update(updates)
    } catch (updateError) {
      console.error('End request error:', updateError)
      return NextResponse.json({ error: 'Failed to request end' }, { status: 500 })
    }

    await adminDb.collection(`rooms/${roomId}/events`).add({ user_id: uid, type: 'end_requested', metadata: {}, created_at: now })

    return NextResponse.json({ turnState: { id: 'main', ...turnState, ...updates }, message: 'End request sent to partner' })
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
    const { action } = await request.json()

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const turnSnap = await adminDb.doc(`rooms/${roomId}/turnState/main`).get()
    if (!turnSnap.exists) {
      return NextResponse.json({ error: 'Chat not started' }, { status: 400 })
    }
    const turnState = turnSnap.data()!

    if (!turnState.end_request_pending) {
      return NextResponse.json({ error: 'No pending end request' }, { status: 400 })
    }

    if (turnState.end_requested_by === uid) {
      return NextResponse.json({ error: 'Cannot respond to your own request' }, { status: 403 })
    }

    const now = new Date().toISOString()

    if (action === 'accept') {
      await adminDb.doc(`rooms/${roomId}`).update({ status: 'completed', completed_at: now })
      await adminDb.doc(`rooms/${roomId}/turnState/main`).update({ end_request_pending: false, end_requested_by: null, updated_at: now })
      await adminDb.collection(`rooms/${roomId}/events`).add({ user_id: uid, type: 'end_accepted', metadata: {}, created_at: now })

      return NextResponse.json({ accepted: true, message: 'Session ended by mutual agreement' })
    } else {
      const updates = { end_requested_by: null, end_request_pending: false, updated_at: now }
      await adminDb.doc(`rooms/${roomId}/turnState/main`).update(updates)
      await adminDb.collection(`rooms/${roomId}/events`).add({ user_id: uid, type: 'end_declined', metadata: {}, created_at: now })

      return NextResponse.json({ accepted: false, turnState: { id: 'main', ...turnState, ...updates }, message: 'End request declined' })
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
    const { uid } = authResult

    const turnSnap = await adminDb.doc(`rooms/${roomId}/turnState/main`).get()
    if (!turnSnap.exists) {
      return NextResponse.json({ error: 'No pending end request' }, { status: 400 })
    }
    const turnState = turnSnap.data()!

    if (!turnState.end_request_pending) {
      return NextResponse.json({ error: 'No pending end request' }, { status: 400 })
    }

    if (turnState.end_requested_by !== uid) {
      return NextResponse.json({ error: 'Can only cancel your own request' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const updates = { end_requested_by: null, end_request_pending: false, updated_at: now }
    await adminDb.doc(`rooms/${roomId}/turnState/main`).update(updates)
    await adminDb.collection(`rooms/${roomId}/events`).add({ user_id: uid, type: 'end_request_cancelled', metadata: {}, created_at: now })

    return NextResponse.json({ turnState: { id: 'main', ...turnState, ...updates }, message: 'End request cancelled' })
  } catch (error) {
    console.error('Cancel end request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
