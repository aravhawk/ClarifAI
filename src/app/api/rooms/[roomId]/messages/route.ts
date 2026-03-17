import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/server'
import { createAiGatewayClient, AI_MODEL } from '@/lib/ai-gateway'
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
    const { uid } = authResult

    // Check turn state
    const turnSnap = await adminDb.doc(`rooms/${roomId}/turnState/main`).get()
    if (!turnSnap.exists) {
      return NextResponse.json({ error: 'Chat not started' }, { status: 400 })
    }
    const turnState = turnSnap.data()!

    if (turnState.current_user_id !== uid) {
      return NextResponse.json({ error: 'Not your turn' }, { status: 403 })
    }

    // Check for active pause
    const activePauseSnap = await adminDb.collection(`rooms/${roomId}/pauses`).where('status', '==', 'active').limit(1).get()
    if (!activePauseSnap.empty) {
      const activePause = activePauseSnap.docs[0].data()
      const resumeAt = new Date(activePause.resume_at)
      if (resumeAt > new Date()) {
        return NextResponse.json({ error: 'Chat is paused' }, { status: 403 })
      }
      await activePauseSnap.docs[0].ref.update({ status: 'completed' })
    }

    // Final safety check
    if (shouldBlockMessage(message)) {
      return NextResponse.json({ error: 'Message blocked for safety' }, { status: 400 })
    }

    // Get members ordered by joined_at
    const membersSnap = await adminDb.collection(`rooms/${roomId}/members`).orderBy('joined_at', 'asc').get()
    const memberDocs = membersSnap.docs.map(d => ({ user_id: d.id, ...d.data() })) as any[]

    const userAId = memberDocs[0]?.user_id
    const userBId = memberDocs[1]?.user_id
    const currentSpeaker = uid === userAId ? 'A' : 'B'
    const nextUserId = uid === userAId ? userBId : userAId

    const personA: PersonInfo | undefined = memberDocs[0] ? {
      name: memberDocs[0].display_name || 'Person A',
      relationship: memberDocs[0].relationship_to_other,
    } : undefined
    const personB: PersonInfo | undefined = memberDocs[1] ? {
      name: memberDocs[1].display_name || 'Person B',
      relationship: memberDocs[1].relationship_to_other,
    } : undefined

    const now = new Date().toISOString()

    // Insert message
    let newMessageRef
    try {
      newMessageRef = await adminDb.collection(`rooms/${roomId}/messages`).add({
        user_id: uid,
        text: message,
        tone_labels: toneLabels,
        tone_analysis: toneAnalysis || {},
        blocked: false,
        created_at: now,
      })
    } catch (msgError) {
      console.error('Message insert error:', msgError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Get all messages for guidance
    const allMessagesSnap = await adminDb.collection(`rooms/${roomId}/messages`).orderBy('created_at', 'asc').get()
    const allMessages = allMessagesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]

    // Get analysis for context
    const analysisSnap = await adminDb.doc(`rooms/${roomId}/analysis/main`).get()
    const contextSummary = analysisSnap.exists
      ? (analysisSnap.data()!.analysis_json?.neutralAgenda || 'A conflict resolution conversation')
      : 'A conflict resolution conversation'

    const messageHistory = allMessages.map(m => ({
      speaker: (m.user_id === userAId ? 'A' : 'B') as 'A' | 'B',
      text: m.text,
      toneLabels: m.tone_labels || [],
    }))

    // Call AI for guidance
    let guidance: LiveGuidanceResult | null = null
    try {
      const gateway = createAiGatewayClient()
      const response = await gateway.chat.completions.create({
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
    }

    // Update turn state
    const updateData: Record<string, unknown> = {
      current_user_id: nextUserId,
      last_turn_at: now,
      updated_at: now,
    }
    if (guidance) {
      updateData.ai_guidance = guidance
      updateData.resolved_by_ai = guidance.resolved
      updateData.resolution_reason = guidance.resolutionReason || null
      updateData.suggest_break = guidance.suggestBreak
      updateData.break_message = guidance.breakMessage || null
    }

    await adminDb.doc(`rooms/${roomId}/turnState/main`).update(updateData)

    await adminDb.collection(`rooms/${roomId}/events`).add({
      user_id: uid,
      type: 'message_sent',
      metadata: { messageId: newMessageRef.id, toneLabels },
      created_at: now,
    })

    return NextResponse.json({
      message: { id: newMessageRef.id, user_id: uid, text: message, tone_labels: toneLabels, tone_analysis: toneAnalysis || {}, blocked: false, created_at: now, room_id: roomId },
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

    const messagesSnap = await adminDb.collection(`rooms/${roomId}/messages`).orderBy('created_at', 'asc').get()
    const messages = messagesSnap.docs.map(d => ({ id: d.id, room_id: roomId, ...d.data() }))

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
