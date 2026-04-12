import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/server'
import { ANALYSIS_MAX_TOKENS, createTaskCompletion } from '@/lib/ai-gateway'
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt, detectSafetyLevel, validateAnalysis } from '@/lib/prompts'
import { requireRoomMember } from '@/lib/api/auth'

const MAX_PARSE_ATTEMPTS = 3
const JSON_FENCE_PATTERN = /```(?:json)?\s*|\s*```/gi

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) return undefined
  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

function extractTextContent(content: unknown): string | null {
  if (typeof content === 'string') {
    const trimmed = content.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (!Array.isArray(content)) {
    return null
  }

  const joined = content
    .map((part) => {
      if (typeof part === 'string') return part
      if (!part || typeof part !== 'object' || !('text' in part)) return ''
      const text = (part as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    .join('')
    .trim()

  return joined.length > 0 ? joined : null
}

function extractJsonCandidate(content: string): string {
  const cleaned = content.replace(JSON_FENCE_PATTERN, '').trim()
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1)
  }

  return cleaned
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params

    const authResult = await requireRoomMember(roomId)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    // Check if analysis already exists
    const existingAnalysis = await adminDb.doc(`rooms/${roomId}/analysis/main`).get()
    if (existingAnalysis.exists) {
      return NextResponse.json({
        analysis: existingAnalysis.data()!.analysis_json,
        cached: true,
      })
    }

    // Get members ordered by joined_at
    const membersSnap = await adminDb.collection(`rooms/${roomId}/members`).orderBy('joined_at', 'asc').get()
    const orderedMembers = membersSnap.docs.map(d => ({ user_id: d.id, ...d.data() })) as { user_id: string; relationship_to_other?: string }[]
    if (orderedMembers.length !== 2) {
      return NextResponse.json({ error: 'Two room members are required before analysis can start' }, { status: 400 })
    }

    // Get all entries
    const entriesSnap = await adminDb.collection(`rooms/${roomId}/entries`).get()
    const entries = entriesSnap.docs.map(d => ({ user_id: d.id, ...d.data() })) as { user_id: string; text?: string; submitted_at?: string }[]

    if (entries.length !== 2) {
      return NextResponse.json({ error: 'Both entries required' }, { status: 400 })
    }

    if (!entries.every((e) => e.submitted_at)) {
      return NextResponse.json({ error: 'Both entries must be submitted' }, { status: 400 })
    }

    const userAId = orderedMembers[0]?.user_id
    const userBId = orderedMembers[1]?.user_id
    const relationshipA = orderedMembers[0]?.relationship_to_other
    const relationshipB = orderedMembers[1]?.relationship_to_other

    const entryA = entries.find((e) => e.user_id === userAId)?.text || ''
    const entryB = entries.find((e) => e.user_id === userBId)?.text || ''
    if (!entryA.trim() || !entryB.trim()) {
      return NextResponse.json({ error: 'Both submitted entries must include text before analysis can start' }, { status: 400 })
    }

    // Pre-check safety
    const safetycheckA = detectSafetyLevel(entryA)
    const safetycheckB = detectSafetyLevel(entryB)
    const preSafetyLevel = safetycheckA === 'critical' || safetycheckB === 'critical'
      ? 'critical'
      : safetycheckA === 'warning' || safetycheckB === 'warning'
        ? 'warning'
        : 'normal'

    const now = new Date().toISOString()

    if (preSafetyLevel === 'critical') {
      const criticalAnalysisJson = {
        neutralAgenda: 'This conversation requires professional support.',
        personA: { feelings: [], underlyingNeeds: [], patterns: [], nvcTranslation: { observation: '', feeling: '', need: '', request: '' }, suggestedOpener: '', sentimentScore: 0 },
        personB: { feelings: [], underlyingNeeds: [], patterns: [], nvcTranslation: { observation: '', feeling: '', need: '', request: '' }, suggestedOpener: '', sentimentScore: 0 },
        sharedNeeds: [],
        script: [],
        compromises: [],
        conflictCategory: 'other',
        safetyLevel: 'critical',
        safetyNotes: 'Safety concerns detected. Please reach out to professional resources.',
      }

      await adminDb.doc(`rooms/${roomId}/analysis/main`).set({
        analysis_json: criticalAnalysisJson,
        safety_level: 'critical',
        horsemen: [],
        conflict_category: 'other',
        created_at: now,
      })
      await adminDb.doc(`rooms/${roomId}`).update({ status: 'flagged' })

      return NextResponse.json({ analysis: criticalAnalysisJson, safetyLevel: 'critical' })
    }

    let analysis: unknown
    let parsed = false
    let lastRawContent: string | null = null
    for (let parseAttempt = 1; parseAttempt <= MAX_PARSE_ATTEMPTS; parseAttempt++) {
      const response = await createTaskCompletion('analysis', {
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: buildAnalysisPrompt(entryA, entryB, relationshipA, relationshipB) },
        ],
        max_tokens: ANALYSIS_MAX_TOKENS,
      })

      const content = extractTextContent(response.choices[0]?.message?.content)
      if (!content) {
        return NextResponse.json({ error: 'AI response empty' }, { status: 500 })
      }

      lastRawContent = content
      try {
        const cleanedContent = extractJsonCandidate(content)
        analysis = JSON.parse(cleanedContent)
        parsed = true
        break
      } catch (parseError) {
        console.error(`JSON parse error (attempt ${parseAttempt}/${MAX_PARSE_ATTEMPTS}):`, parseError)
        console.error(`Raw analysis content (attempt ${parseAttempt}/${MAX_PARSE_ATTEMPTS}):`, content)
      }
    }

    if (!parsed) {
      console.error('Final raw analysis content after parse retries:', lastRawContent)
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    if (!validateAnalysis(analysis)) {
      console.error('Invalid analysis structure:', analysis)
      return NextResponse.json({ error: 'Invalid AI response structure' }, { status: 500 })
    }

    const finalSafetyLevel = analysis.safetyLevel === 'critical' ? 'critical' :
      analysis.safetyLevel === 'warning' || preSafetyLevel === 'warning' ? 'warning' : 'normal'

    const horsemen = [
      ...analysis.personA.patterns.map((p: { type: string }) => p.type),
      ...analysis.personB.patterns.map((p: { type: string }) => p.type),
    ]

    await adminDb.doc(`rooms/${roomId}/analysis/main`).set({
      analysis_json: analysis,
      safety_level: finalSafetyLevel,
      horsemen,
      conflict_category: analysis.conflictCategory,
      sentiment_before_a: analysis.personA.sentimentScore,
      sentiment_before_b: analysis.personB.sentimentScore,
      created_at: now,
    })

    const newStatus = finalSafetyLevel === 'critical' ? 'flagged' : 'revealed'
    await adminDb.doc(`rooms/${roomId}`).update({ status: newStatus })

    await adminDb.collection(`rooms/${roomId}/events`).add({
      user_id: uid,
      type: 'analyzed',
      metadata: { safetyLevel: finalSafetyLevel },
      created_at: now,
    })

    return NextResponse.json({ analysis, safetyLevel: finalSafetyLevel })
  } catch (error) {
    console.error('Analyze error:', error)
    const message = getErrorMessage(error)
    const status = getErrorStatus(error)

    if (message === 'LLAMA_API_KEY is not set') {
      return NextResponse.json(
        { error: 'AI analysis is not configured on the server' },
        { status: 503 }
      )
    }

    if (status === 429) {
      return NextResponse.json(
        { error: 'AI analysis is temporarily rate limited. Please retry.' },
        { status: 503 }
      )
    }

    if (typeof status === 'number' && status >= 500) {
      return NextResponse.json(
        { error: 'AI analysis provider failed. Please retry.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
