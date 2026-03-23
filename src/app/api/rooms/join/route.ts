import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/server'
import { requireAuth } from '@/lib/api/auth'

export async function POST(request: NextRequest) {
  try {
    const { code, relationship, displayName } = await request.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 })
    }

    if (!relationship || typeof relationship !== 'string') {
      return NextResponse.json({ error: 'Relationship required' }, { status: 400 })
    }

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return NextResponse.json({ error: 'Display name required' }, { status: 400 })
    }

    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    // Find room by code
    const normalizedCode = code.toUpperCase()
    const roomSnap = await adminDb.collection('rooms').where('code', '==', normalizedCode).limit(1).get()

    if (roomSnap.empty) {
      console.error(`Join: room not found for code="${normalizedCode}" uid=${uid}`)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const roomDoc = roomSnap.docs[0]
    const room = roomDoc.data()
    const roomId = roomDoc.id

    // Check if room is flagged
    if (room.status === 'flagged') {
      return NextResponse.json({ error: 'This room is no longer available' }, { status: 403 })
    }

    // Check if user is already a member
    const myMemberSnap = await adminDb.doc(`rooms/${roomId}/members/${uid}`).get()
    if (myMemberSnap.exists) {
      return NextResponse.json({ roomId, code: room.code, alreadyMember: true })
    }

    // Check current member count
    const membersSnap = await adminDb.collection(`rooms/${roomId}/members`).get()
    if (membersSnap.size >= 2) {
      console.error(`Join: room ${roomId} is full (${membersSnap.size} members) uid=${uid}`)
      return NextResponse.json({ error: 'Room is full' }, { status: 403 })
    }

    const now = new Date().toISOString()

    // Add user as member
    try {
      await adminDb.doc(`rooms/${roomId}/members/${uid}`).set({
        joined_at: now,
        consented_at: now,
        relationship_to_other: relationship,
        display_name: displayName.trim(),
      })
    } catch (memberError) {
      console.error('Join error:', memberError)
      return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
    }

    // Create empty entry for joiner
    try {
      await adminDb.doc(`rooms/${roomId}/entries/${uid}`).set({
        text: '',
        updated_at: now,
        submitted_at: null,
      })
    } catch (entryError) {
      console.error('Entry creation error:', entryError)
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    // Log event
    await adminDb.collection(`rooms/${roomId}/events`).add({
      user_id: uid,
      type: 'joined',
      metadata: {},
      created_at: now,
    })

    // If this is the second member, update room status to ready-ish (still waiting for entries)
    // Room stays 'waiting' until both submit entries

    return NextResponse.json({ roomId, code: room.code, alreadyMember: false })
  } catch (error) {
    console.error('Join room error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
