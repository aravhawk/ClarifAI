import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/server'
import { createAiGatewayClient, AI_MODEL } from '@/lib/ai-gateway'
import { COACH_SYSTEM_PROMPT, buildCoachPrompt } from '@/lib/prompts'
import { requireRoomMember } from '@/lib/api/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { statement, context } = await request.json()

    if (!statement) {
      return new Response(JSON.stringify({ error: 'Statement required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const gateway = createAiGatewayClient()

    // Log coach usage event
    await adminDb.collection(`rooms/${roomId}/events`).add({
      user_id: uid,
      type: 'coach_used',
      metadata: {},
      created_at: new Date().toISOString(),
    })

    // Stream response from Kilo Gateway
    const response = await gateway.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: COACH_SYSTEM_PROMPT },
        { role: 'user', content: buildCoachPrompt(statement, context) },
      ],
      max_tokens: 1000,
      stream: true,
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(encoder.encode(content))
            }
          }
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Coach error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
