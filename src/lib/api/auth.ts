import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/lib/firebase/server'
import type { RoomMember } from '@/types/room'

export interface AuthResult {
  uid: string
}

export interface RoomAuthResult extends AuthResult {
  member: RoomMember
}

export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    return { uid: decoded.uid }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function requireRoomMember(roomId: string): Promise<RoomAuthResult | NextResponse> {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const { uid } = authResult

  const memberSnap = await adminDb.doc(`rooms/${roomId}/members/${uid}`).get()
  if (!memberSnap.exists) {
    return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
  }

  const member = { ...memberSnap.data(), room_id: roomId, user_id: uid } as RoomMember
  return { uid, member }
}
