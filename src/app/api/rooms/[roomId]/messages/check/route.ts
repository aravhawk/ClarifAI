import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/server'
import { createTaskCompletion } from '@/lib/ai-gateway'
import { TONE_CHECK_SYSTEM_PROMPT, buildToneCheckPrompt, shouldBlockMessage } from '@/lib/prompts'
import type { ToneCheckResult } from '@/lib/prompts'
import { requireRoomMember } from '@/lib/api/auth'
import { validateMessage, validateToneLabels } from '@/lib/api/validation'

const FAIL_CLOSED: ToneCheckResult = {
  decision: 'warn',
  toneSummary: 'Tone analysis unavailable. Please review your message carefully before sending.',
  suggestedLabels: [],
  warning: 'Our tone analysis system is temporarily unavailable. Please ensure your message is respectful and constructive.',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { message, toneLabels } = await request.json()

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

    // Check turn state - must be user's turn
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
        return NextResponse.json({ error: 'Chat is paused', resumeAt: activePause.resume_at }, { status: 403 })
      }
      await activePauseSnap.docs[0].ref.update({ status: 'completed' })
    }

    // Fast pre-check for highly abusive content
    if (shouldBlockMessage(message)) {
      return NextResponse.json({
        result: {
          decision: 'block',
          toneSummary: 'This message contains language that cannot be sent.',
          suggestedLabels: toneLabels,
          warning: 'Messages containing threats of violence or highly abusive language cannot be sent. Please rephrase your message.',
        } as ToneCheckResult,
      })
    }

    // Get recent messages for context
    const recentSnap = await adminDb.collection(`rooms/${roomId}/messages`)
      .orderBy('created_at', 'desc').limit(5).get()
    const recentMessages = recentSnap.docs.map(d => d.data()).reverse()
    const conversationContext = recentMessages.length > 0
      ? recentMessages.map((m) => `- "${m.text}"`).join('\n')
      : undefined

    // Call AI for tone analysis
    const response = await createTaskCompletion('tone-check', {
      messages: [
        { role: 'system', content: TONE_CHECK_SYSTEM_PROMPT },
        { role: 'user', content: buildToneCheckPrompt(message, conversationContext) },
      ],
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ result: { ...FAIL_CLOSED, suggestedLabels: toneLabels } })
    }

    let result: ToneCheckResult
    try {
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim()
      result = JSON.parse(cleanedContent)
    } catch {
      return NextResponse.json({ result: { ...FAIL_CLOSED, suggestedLabels: toneLabels } })
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Tone check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
