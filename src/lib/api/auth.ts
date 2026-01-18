import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { RoomMember } from '@/types/room'

export interface AuthResult {
  user: User
  supabase: Awaited<ReturnType<typeof createClient>>
}

export interface RoomAuthResult extends AuthResult {
  member: RoomMember
  adminClient: Awaited<ReturnType<typeof createAdminClient>>
}

export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { user, supabase }
}

export async function requireRoomMember(roomId: string): Promise<RoomAuthResult | NextResponse> {
  const authResult = await requireAuth()

  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { user, supabase } = authResult
  const adminClient = await createAdminClient()

  const { data: member } = await adminClient
    .from('room_members')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
  }

  return { user, supabase, member, adminClient }
}
