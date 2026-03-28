import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/server'
import { requireAuth } from '@/lib/api/auth'
import { generateRoomCode } from '@/lib/utils/room'

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { relationship, displayName } = await request.json()

    if (!relationship || typeof relationship !== 'string') {
      return NextResponse.json({ error: 'Relationship required' }, { status: 400 })
    }

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return NextResponse.json({ error: 'Display name required' }, { status: 400 })
    }

    // Generate unique room code
    let code = generateRoomCode()
    let attempts = 0

    while (attempts < 10) {
      const existing = await adminDb.collection('rooms').where('code', '==', code).limit(1).get()
      if (existing.empty) break
      code = generateRoomCode()
      attempts++
    }

    if (attempts >= 10) {
      return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 })
    }

    const now = new Date().toISOString()

    // Create room
    const roomRef = await adminDb.collection('rooms').add({
      code,
      status: 'waiting',
      created_at: now,
      completed_at: null,
      delete_at: null,
      consent_version: '1.0',
    })

    const roomId = roomRef.id
    console.log(`Room created: id=${roomId} code=${code} uid=${uid}`)

    // Add creator as first member
    try {
      await adminDb.doc(`rooms/${roomId}/members/${uid}`).set({
        joined_at: now,
        consented_at: now,
        relationship_to_other: relationship,
        display_name: displayName.trim(),
      })
    } catch (memberError) {
      console.error('Member creation error:', memberError)
      await roomRef.delete()
      return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
    }

    // Create empty entry for creator
    await adminDb.doc(`rooms/${roomId}/entries/${uid}`).set({
      text: '',
      updated_at: now,
      submitted_at: null,
    })

    // Log event
    await adminDb.collection(`rooms/${roomId}/events`).add({
      user_id: uid,
      type: 'created',
      metadata: {},
      created_at: now,
    })

    return NextResponse.json({
      roomId,
      code,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/r/${code}`,
    })
  } catch (error) {
    console.error('Create room error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
