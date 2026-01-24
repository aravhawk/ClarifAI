import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createAiGatewayClient, AI_MODEL, REASONING_TOKENS, MAX_TOKENS } from '@/lib/ai-gateway'
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt, detectSafetyLevel, validateAnalysis } from '@/lib/prompts'
import { requireRoomMember } from '@/lib/api/auth'
import type { AiGatewayChatCompletionCreateParams } from '@/lib/ai-gateway.types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { user, member, adminClient } = authResult

    const gateway = createAiGatewayClient()

    // Check if analysis already exists
    const { data: existingAnalysis } = await adminClient
      .from('room_ai_analysis')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (existingAnalysis) {
      return NextResponse.json({ 
        analysis: existingAnalysis.analysis_json,
        cached: true 
      })
    }

    const { data: members } = await adminClient
      .from('room_members')
      .select('user_id, relationship_to_other')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })

    // Get all entries
    const { data: entries } = await adminClient
      .from('room_entries')
      .select('*')
      .eq('room_id', roomId)

    if (!entries || entries.length !== 2) {
      return NextResponse.json({ error: 'Both entries required' }, { status: 400 })
    }

    // Ensure both are submitted
    if (!entries.every(e => e.submitted_at)) {
      return NextResponse.json({ error: 'Both entries must be submitted' }, { status: 400 })
    }

    // Get member order to determine A/B
    const orderedMembers = members || []

    const userAId = orderedMembers[0]?.user_id
    const userBId = orderedMembers[1]?.user_id

    const relationshipA = orderedMembers[0]?.relationship_to_other
    const relationshipB = orderedMembers[1]?.relationship_to_other

    const entryA = entries.find(e => e.user_id === userAId)?.text || ''
    const entryB = entries.find(e => e.user_id === userBId)?.text || ''

    // Pre-check safety
    const safetycheckA = detectSafetyLevel(entryA)
    const safetycheckB = detectSafetyLevel(entryB)
    const preSafetyLevel = safetycheckA === 'critical' || safetycheckB === 'critical' 
      ? 'critical' 
      : safetycheckA === 'warning' || safetycheckB === 'warning'
        ? 'warning'
        : 'normal'

    // If critical safety, don't call AI - return immediately
    if (preSafetyLevel === 'critical') {
      const criticalAnalysis = {
        room_id: roomId,
        analysis_json: {
          neutralAgenda: 'This conversation requires professional support.',
          personA: { feelings: [], underlyingNeeds: [], patterns: [], nvcTranslation: { observation: '', feeling: '', need: '', request: '' }, suggestedOpener: '', sentimentScore: 0 },
          personB: { feelings: [], underlyingNeeds: [], patterns: [], nvcTranslation: { observation: '', feeling: '', need: '', request: '' }, suggestedOpener: '', sentimentScore: 0 },
          sharedNeeds: [],
          script: [],
          compromises: [],
          conflictCategory: 'other',
          safetyLevel: 'critical',
          safetyNotes: 'Safety concerns detected. Please reach out to professional resources.',
        },
        safety_level: 'critical',
        horsemen: [],
        conflict_category: 'other',
      }

      await adminClient.from('room_ai_analysis').insert(criticalAnalysis)
      await adminClient.from('rooms').update({ status: 'flagged' }).eq('id', roomId)

      return NextResponse.json({ 
        analysis: criticalAnalysis.analysis_json,
        safetyLevel: 'critical'
      })
    }

    // Call Vercel AI Gateway with extended reasoning token budget
    const completionParams: AiGatewayChatCompletionCreateParams = {
      model: AI_MODEL,
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: buildAnalysisPrompt(entryA, entryB, relationshipA, relationshipB) },
      ],
      max_tokens: MAX_TOKENS,
      reasoning: {
        max_tokens: REASONING_TOKENS,
      },
    }
    const response = await gateway.chat.completions.create(completionParams)

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'AI response empty' }, { status: 500 })
    }

    // Parse JSON response
    let analysis
    try {
      // Clean potential markdown code blocks
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim()
      analysis = JSON.parse(cleanedContent)
    } catch (parseError) {
      console.error('JSON parse error:', parseError, content)
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    // Validate response
    if (!validateAnalysis(analysis)) {
      console.error('Invalid analysis structure:', analysis)
      return NextResponse.json({ error: 'Invalid AI response structure' }, { status: 500 })
    }

    // Override safety level if AI detected something worse
    const finalSafetyLevel = analysis.safetyLevel === 'critical' ? 'critical' :
      analysis.safetyLevel === 'warning' || preSafetyLevel === 'warning' ? 'warning' : 'normal'

    // Extract horsemen patterns
    const horsemen = [
      ...analysis.personA.patterns.map(p => p.type),
      ...analysis.personB.patterns.map(p => p.type),
    ]

    // Save to database
    const analysisRecord = {
      room_id: roomId,
      analysis_json: analysis,
      safety_level: finalSafetyLevel,
      horsemen,
      conflict_category: analysis.conflictCategory,
      sentiment_before_a: analysis.personA.sentimentScore,
      sentiment_before_b: analysis.personB.sentimentScore,
    }

    await adminClient.from('room_ai_analysis').insert(analysisRecord)

    // Update room status
    const newStatus = finalSafetyLevel === 'critical' ? 'flagged' : 'revealed'
    await adminClient.from('rooms').update({ status: newStatus }).eq('id', roomId)

    // Log event
    await adminClient.from('room_events').insert({
      room_id: roomId,
      user_id: user.id,
      type: 'analyzed',
      metadata: { safetyLevel: finalSafetyLevel },
    })

    return NextResponse.json({ 
      analysis,
      safetyLevel: finalSafetyLevel
    })
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
