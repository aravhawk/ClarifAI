import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createOpenRouterClient, AI_MODEL } from '@/lib/openrouter'
import { LIVE_GUIDANCE_SYSTEM_PROMPT, buildLiveGuidancePrompt, shouldBlockMessage, type PersonInfo } from '@/lib/prompts'
import type { LiveGuidanceResult } from '@/lib/prompts'
import { GUIDANCE_MAX_TOKENS } from '@/lib/constants'
import { requireRoomMember } from '@/lib/api/auth'
import { validateMessage, validateToneLabels } from '@/lib/api/validation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { message, toneLabels, toneAnalysis } = await request.json()

    const messageValidation = validateMessage(message)
    if (!messageValidation.valid) {
      return NextResponse.json({ error: messageValidation.error }, { status: 400 })
    }

    const toneLabelsValidation = validateToneLabels(toneLabels)
    if (!toneLabelsValidation.valid) {
      return NextResponse.json({ error: toneLabelsValidation.error }, { status: 400 })
    }

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { user, member, adminClient } = authResult

    // Check turn state
    const { data: turnState } = await adminClient
      .from('room_turn_state')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (!turnState) {
      return NextResponse.json({ error: 'Chat not started' }, { status: 400 })
    }

    if (turnState.current_user_id !== user.id) {
      return NextResponse.json({ error: 'Not your turn' }, { status: 403 })
    }

    // Check for active pause
    const { data: activePause } = await adminClient
      .from('room_pauses')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .single()

    if (activePause) {
      const resumeAt = new Date(activePause.resume_at)
      if (resumeAt > new Date()) {
        return NextResponse.json({ error: 'Chat is paused' }, { status: 403 })
      }
      await adminClient
        .from('room_pauses')
        .update({ status: 'completed' })
        .eq('id', activePause.id)
    }

    // Final safety check
    if (shouldBlockMessage(message)) {
      return NextResponse.json({ error: 'Message blocked for safety' }, { status: 400 })
    }

    // Get members to determine A/B (with names and relationships)
    const { data: members } = await adminClient
      .from('room_members')
      .select('user_id, display_name, relationship_to_other')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })

    const userAId = members?.[0]?.user_id
    const userBId = members?.[1]?.user_id
    const currentSpeaker = user.id === userAId ? 'A' : 'B'
    const nextUserId = user.id === userAId ? userBId : userAId

    // Build person info for AI prompts
    const personA: PersonInfo | undefined = members?.[0] ? {
      name: members[0].display_name || 'Person A',
      relationship: members[0].relationship_to_other,
    } : undefined
    const personB: PersonInfo | undefined = members?.[1] ? {
      name: members[1].display_name || 'Person B',
      relationship: members[1].relationship_to_other,
    } : undefined

    // Insert message
    const { data: newMessage, error: msgError } = await adminClient
      .from('room_messages')
      .insert({
        room_id: roomId,
        user_id: user.id,
        text: message,
        tone_labels: toneLabels,
        tone_analysis: toneAnalysis || {},
        blocked: false,
      })
      .select()
      .single()

    if (msgError) {
      console.error('Message insert error:', msgError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Get all messages for guidance
    const { data: allMessages } = await adminClient
      .from('room_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })

    // Get analysis for context
    const { data: analysis } = await adminClient
      .from('room_ai_analysis')
      .select('analysis_json')
      .eq('room_id', roomId)
      .single()

    const contextSummary = analysis?.analysis_json?.neutralAgenda || 'A conflict resolution conversation'

    // Build message history for AI
    const messageHistory = (allMessages || []).map(m => ({
      speaker: (m.user_id === userAId ? 'A' : 'B') as 'A' | 'B',
      text: m.text,
      toneLabels: m.tone_labels || [],
    }))

    // Call AI for guidance
    let guidance: LiveGuidanceResult | null = null
    try {
      const openrouter = createOpenRouterClient()
      const response = await openrouter.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: LIVE_GUIDANCE_SYSTEM_PROMPT },
          { role: 'user', content: buildLiveGuidancePrompt(messageHistory, currentSpeaker, contextSummary, personA, personB) },
        ],
        max_tokens: GUIDANCE_MAX_TOKENS,
      })

      const content = response.choices[0]?.message?.content
      if (content) {
        const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim()
        guidance = JSON.parse(cleanedContent)
      }
    } catch (err) {
      console.error('Guidance AI error:', err)
      // Continue without guidance
    }

    // Update turn state
    const updateData: Record<string, unknown> = {
      current_user_id: nextUserId,
      last_turn_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (guidance) {
      updateData.ai_guidance = guidance
      updateData.resolved_by_ai = guidance.resolved
      updateData.resolution_reason = guidance.resolutionReason || null
      updateData.suggest_break = guidance.suggestBreak
      updateData.break_message = guidance.breakMessage || null
    }

    await adminClient
      .from('room_turn_state')
      .update(updateData)
      .eq('room_id', roomId)

    // Log event
    await adminClient
      .from('room_events')
      .insert({
        room_id: roomId,
        user_id: user.id,
        type: 'message_sent',
        metadata: { messageId: newMessage.id, toneLabels },
      })

    return NextResponse.json({ 
      message: newMessage,
      guidance,
    })
  } catch (error) {
    console.error('Send message error:', error)
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
    const { user, member, adminClient } = authResult

    // Get all messages
    const { data: messages } = await adminClient
      .from('room_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })

    return NextResponse.json({ messages: messages || [] })
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
