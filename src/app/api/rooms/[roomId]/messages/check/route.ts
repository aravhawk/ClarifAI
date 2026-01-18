import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createOpenRouterClient, AI_MODEL } from '@/lib/openrouter'
import { TONE_CHECK_SYSTEM_PROMPT, buildToneCheckPrompt, shouldBlockMessage } from '@/lib/prompts'
import type { ToneCheckResult } from '@/lib/prompts'
import { requireRoomMember } from '@/lib/api/auth'
import { validateMessage, validateToneLabels } from '@/lib/api/validation'

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
    const { user, member, adminClient } = authResult

    // Check turn state - must be user's turn
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
        return NextResponse.json({ error: 'Chat is paused', resumeAt: activePause.resume_at }, { status: 403 })
      }
      // Pause has expired, mark as completed
      await adminClient
        .from('room_pauses')
        .update({ status: 'completed' })
        .eq('id', activePause.id)
    }

    // Fast pre-check for highly abusive content
    if (shouldBlockMessage(message)) {
      return NextResponse.json({
        result: {
          decision: 'block',
          toneSummary: 'This message contains language that cannot be sent.',
          suggestedLabels: toneLabels,
          warning: 'Messages containing threats of violence or highly abusive language cannot be sent. Please rephrase your message.',
        } as ToneCheckResult
      })
    }

    // Get recent messages for context
    const { data: recentMessages } = await adminClient
      .from('room_messages')
      .select('text, user_id')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(5)

    const conversationContext = recentMessages && recentMessages.length > 0
      ? recentMessages.reverse().map(m => `- "${m.text}"`).join('\n')
      : undefined

    // Call AI for tone analysis
    const openrouter = createOpenRouterClient()
    const response = await openrouter.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: TONE_CHECK_SYSTEM_PROMPT },
        { role: 'user', content: buildToneCheckPrompt(message, conversationContext) },
      ],
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      // Fail closed - warn if AI fails
      return NextResponse.json({
        result: {
          decision: 'warn',
          toneSummary: 'Tone analysis unavailable. Please review your message carefully before sending.',
          suggestedLabels: toneLabels,
          warning: 'Our tone analysis system is temporarily unavailable. Please ensure your message is respectful and constructive.',
        } as ToneCheckResult
      })
    }

    let result: ToneCheckResult
    try {
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim()
      result = JSON.parse(cleanedContent)
    } catch {
      // Fail closed on parse error
      return NextResponse.json({
        result: {
          decision: 'warn',
          toneSummary: 'Tone analysis unavailable. Please review your message carefully before sending.',
          suggestedLabels: toneLabels,
          warning: 'Our tone analysis system is temporarily unavailable. Please ensure your message is respectful and constructive.',
        } as ToneCheckResult
      })
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Tone check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
