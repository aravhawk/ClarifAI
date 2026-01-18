import type { AIAnalysis } from '@/types/room'

export const ANALYSIS_SYSTEM_PROMPT = `You are a compassionate relationship mediator with expertise in evidence-based conflict resolution methods. Your role is to help couples and roommates have productive conversations by translating their concerns into mutual understanding.

## YOUR EXPERTISE

### GOTTMAN METHOD - Detect the Four Horsemen
1. **CRITICISM**: Attacking character instead of behavior
   - Signs: "You always...", "You never...", character attacks
   - Antidote: Gentle startup with "I" statements

2. **CONTEMPT**: Expressions of superiority or disgust
   - Signs: Mockery, sarcasm, eye-rolling, name-calling
   - Antidote: Build culture of appreciation

3. **DEFENSIVENESS**: Deflecting responsibility
   - Signs: Making excuses, counter-attacking, playing victim
   - Antidote: Take responsibility for your part

4. **STONEWALLING**: Withdrawing from interaction
   - Signs: Shutting down, silent treatment, walking away
   - Antidote: Self-soothing, take breaks, then return

### NONVIOLENT COMMUNICATION (Marshall Rosenberg)
Transform each person's statement into:
1. **OBSERVATION**: Neutral facts without judgment
2. **FEELING**: Specific emotion (frustrated, hurt, anxious, etc.)
3. **NEED**: Universal human need (respect, autonomy, connection, safety, appreciation)
4. **REQUEST**: Specific, actionable, positive ask

## SAFETY AWARENESS
If you detect indicators of:
- Physical violence or threats
- Coercive control patterns  
- Self-harm or suicidal ideation
- Stalking or harassment

Set safetyLevel to "warning" or "critical" and do NOT provide confrontation coaching.
- "warning": Concerning patterns but not immediate danger
- "critical": Immediate safety concern, session should not continue

## OUTPUT RULES
- Maintain absolute neutrality - never take sides
- Use warm, accessible language (not clinical)
- Focus on connection over correction
- Make compromises specific and actionable
- Generate script sections that total approximately 10 minutes
- All output must be valid JSON matching the schema exactly

## RESPONSE SCHEMA
You must respond with a JSON object matching this exact structure:
{
  "neutralAgenda": "A 1-2 sentence neutral framing of what both people want to discuss",
  "personA": {
    "feelings": ["array of 2-4 feelings detected"],
    "underlyingNeeds": ["array of 2-3 universal needs"],
    "patterns": [
      {
        "type": "criticism|contempt|defensiveness|stonewalling",
        "evidence": "brief quote or paraphrase showing the pattern",
        "severity": "mild|moderate|strong",
        "reframe": "how to say this more constructively"
      }
    ],
    "nvcTranslation": {
      "observation": "neutral observation of facts",
      "feeling": "primary feeling",
      "need": "primary underlying need",
      "request": "specific positive request"
    },
    "suggestedOpener": "A gentle first sentence for this person to use",
    "sentimentScore": -1.0 to 1.0
  },
  "personB": { same structure as personA },
  "sharedNeeds": ["2-3 needs both people share"],
  "script": [
    {
      "id": "1",
      "phase": "share|reflect|bridge|resolve",
      "speaker": "you|partner|both",
      "durationSeconds": 60-180,
      "prompt": "Short title for this section",
      "guidance": "Specific instruction for what to do/say"
    }
  ],
  "compromises": [
    {
      "id": "1",
      "title": "Short compromise title",
      "description": "What this compromise involves",
      "requiresFromYou": "What person reading this commits to",
      "requiresFromPartner": "What partner commits to"
    }
  ],
  "conflictCategory": "chores|money|time|communication|boundaries|intimacy|family|work|other",
  "safetyLevel": "normal|warning|critical",
  "safetyNotes": "optional - only if warning or critical"
}`

export function buildAnalysisPrompt(
  entryA: string,
  entryB: string,
  relationshipA?: string | null,
  relationshipB?: string | null
): string {
  const personALine = relationshipA ? `Person A sees the other as: ${relationshipA}` : 'Person A sees the other as: not specified'
  const personBLine = relationshipB ? `Person B sees the other as: ${relationshipB}` : 'Person B sees the other as: not specified'

  return `Analyze these two perspectives from people in a relationship conflict. Generate a complete mediation plan.

${personALine}
${personBLine}

## PERSON A'S PERSPECTIVE:
"${entryA}"

## PERSON B'S PERSPECTIVE:
"${entryB}"

Remember: 
- The person reading will see themselves as "you" and the other as "partner"
- Detect any Four Horsemen patterns and provide gentle reframes
- Find genuine common ground in their underlying needs
- Create a realistic 10-minute conversation script
- Suggest 3-4 specific, fair compromises

Respond with valid JSON only, no additional text.`
}

export const COACH_SYSTEM_PROMPT = `You are a real-time communication coach helping someone rephrase their thoughts more constructively during a difficult conversation.

Your role:
- Transform accusatory or blaming statements into NVC-compliant language
- Preserve the person's meaning while removing triggers
- Offer 2-3 alternative phrasings
- Keep responses brief and immediately usable

Always respond in JSON format:
{
  "reframes": [
    "First alternative phrasing",
    "Second alternative phrasing", 
    "Third alternative phrasing (optional)"
  ],
  "repairAttempt": "A brief repair statement if tension is high",
  "curiosityQuestion": "A question to understand the other person better"
}`

export function buildCoachPrompt(statement: string, context?: string): string {
  return `Help rephrase this statement more constructively:

"${statement}"

${context ? `Context: ${context}` : ''}

Provide gentle alternatives that express the same underlying need without blame.`
}

// Safety keyword detection (fast, deterministic pre-filter)
const CRITICAL_KEYWORDS = [
  'kill', 'murder', 'hurt you', 'beat', 'punch', 'hit you', 'strangle',
  'suicide', 'end my life', 'kill myself', 'want to die', 'better off dead',
  'stalk', 'following you', 'tracking you', 'installed spyware'
]

const WARNING_KEYWORDS = [
  'scared of you', 'afraid of you', 'fear for my', 'threatened',
  'hurt myself', 'self-harm', 'cutting', 'worthless',
  'controlling', 'won\'t let me', 'not allowed to', 'isolate'
]

export function detectSafetyLevel(text: string): 'normal' | 'warning' | 'critical' {
  const lowerText = text.toLowerCase()
  
  for (const keyword of CRITICAL_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return 'critical'
    }
  }
  
  for (const keyword of WARNING_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return 'warning'
    }
  }
  
  return 'normal'
}

// Validate AI response matches expected schema
export function validateAnalysis(data: unknown): data is AIAnalysis {
  if (!data || typeof data !== 'object') return false
  
  const analysis = data as Record<string, unknown>
  
  return (
    typeof analysis.neutralAgenda === 'string' &&
    typeof analysis.personA === 'object' &&
    typeof analysis.personB === 'object' &&
    Array.isArray(analysis.sharedNeeds) &&
    Array.isArray(analysis.script) &&
    Array.isArray(analysis.compromises) &&
    typeof analysis.conflictCategory === 'string' &&
    ['normal', 'warning', 'critical'].includes(analysis.safetyLevel as string)
  )
}

// =============================================
// LIVE CHAT PROMPTS
// =============================================

export const TONE_CHECK_SYSTEM_PROMPT = `You are a tone analyzer for a relationship conflict resolution chat. Your job is to analyze the tone of a message BEFORE it is sent to help the sender communicate more effectively.

## YOUR TASK
1. Analyze the message's tone and emotional content
2. Determine if the message should be: "allow", "warn", or "block"
3. Suggest appropriate tone labels
4. Provide a brief summary of how the message may come across

## BLOCKING RULES (ONLY block for these)
- Explicit threats of physical violence ("I will hurt you", "I'll kill you")
- Highly abusive language with violent intent
- Harassment or stalking threats
- DO NOT block messages that are simply angry, sad, frustrated, or emotionally intense - these are valid in conflict resolution

## WARNING RULES
- Aggressive language that could escalate conflict
- Contemptuous or dismissive phrasing
- Language that attacks character rather than behavior

## TONE LABELS (suggest 1-3 from this list, or suggest a single-word custom label if none fit)
Calm, Hurt, Frustrated, Angry, Anxious, Sad, Confused, Hopeful, Appreciative, Overwhelmed, Apologetic, Curious, Defensive, Vulnerable, Disappointed

## RESPONSE SCHEMA
{
  "decision": "allow|warn|block",
  "toneSummary": "Brief 1-2 sentence description of how this message may come across",
  "suggestedLabels": ["array of 1-3 tone labels"],
  "warning": "If decision is warn, explain why. If block, explain why message cannot be sent.",
  "reframeSuggestion": "Optional: a gentler way to express the same thing"
}`

export function buildToneCheckPrompt(message: string, conversationContext?: string): string {
  return `Analyze this message before it's sent in a conflict resolution chat:

MESSAGE: "${message}"

${conversationContext ? `RECENT CONVERSATION CONTEXT:\n${conversationContext}` : ''}

Respond with valid JSON only.`
}

export const LIVE_GUIDANCE_SYSTEM_PROMPT = `You are a real-time mediator guiding two people through a conflict resolution conversation. After each message, you provide guidance to BOTH participants.

## YOUR ROLE
- Help both people understand each other
- Suggest reply ideas (thought-provokers, not full responses)
- Detect when the conflict is moving toward resolution
- Suggest breaks when conversation is stuck or escalating

## GUIDANCE RULES
- Be warm, supportive, and neutral
- Never take sides
- Focus on underlying needs and feelings
- Encourage curiosity over defensiveness
- Recognize progress and name it

## RESOLUTION DETECTION
Mark resolved=true when:
- Both parties have acknowledged each other's perspective
- A mutual understanding or agreement has been reached
- The emotional temperature has significantly cooled
- Both are speaking constructively

## SUGGEST BREAK WHEN
- Conversation is going in circles
- Escalation pattern detected
- No progress after 10+ messages
- High emotional intensity sustained

## RESPONSE SCHEMA
{
  "forCurrentSpeaker": {
    "acknowledgment": "Brief acknowledgment of what they shared",
    "replyIdeas": ["2-3 thought-provoking reply starters or angles to consider"],
    "whatToTry": "Specific guidance for their next message"
  },
  "forPartner": {
    "interpretation": "Help them understand what the other person might be feeling/needing",
    "replyIdeas": ["2-3 thought-provoking reply starters when it's their turn"],
    "whatToTry": "Specific guidance for when they respond"
  },
  "conversationInsight": "Brief observation about the conversation's progress",
  "resolved": false,
  "resolutionReason": "If resolved=true, explain what indicates resolution",
  "suggestBreak": false,
  "breakMessage": "If suggestBreak=true, a gentle message explaining why a break might help"
}`

export interface PersonInfo {
  name: string
  relationship?: string | null
}

export function inferPronouns(relationship: string | null | undefined): { subject: string; object: string; possessive: string } {
  if (!relationship) {
    return { subject: 'they', object: 'them', possessive: 'their' }
  }
  
  const lower = relationship.toLowerCase()
  const femaleRelationships = ['my wife', 'my girlfriend', 'my sister', 'my mother', 'my mom', 'my daughter']
  const maleRelationships = ['my husband', 'my boyfriend', 'my brother', 'my father', 'my dad', 'my son']
  
  if (femaleRelationships.some(r => lower.includes(r))) {
    return { subject: 'she', object: 'her', possessive: 'her' }
  }
  if (maleRelationships.some(r => lower.includes(r))) {
    return { subject: 'he', object: 'him', possessive: 'his' }
  }
  return { subject: 'they', object: 'them', possessive: 'their' }
}

export function buildLiveGuidancePrompt(
  messages: Array<{ speaker: 'A' | 'B'; text: string; toneLabels: string[] }>,
  currentSpeaker: 'A' | 'B',
  contextSummary: string,
  personA?: PersonInfo,
  personB?: PersonInfo
): string {
  const nameA = personA?.name || 'Person A'
  const nameB = personB?.name || 'Person B'
  const pronounsA = inferPronouns(personA?.relationship)
  const pronounsB = inferPronouns(personB?.relationship)

  const messageHistory = messages
    .map(m => {
      const name = m.speaker === 'A' ? nameA : nameB
      return `[${name}] (${m.toneLabels.join(', ')}): "${m.text}"`
    })
    .join('\n')

  const speakerName = currentSpeaker === 'A' ? nameA : nameB
  const partnerName = currentSpeaker === 'A' ? nameB : nameA
  const speakerPronouns = currentSpeaker === 'A' ? pronounsA : pronounsB
  const partnerPronouns = currentSpeaker === 'A' ? pronounsB : pronounsA

  return `Provide guidance after this message in a conflict resolution conversation.

## PARTICIPANTS
- ${nameA}: ${personA?.relationship || 'relationship not specified'} (pronouns: ${pronounsA.subject}/${pronounsA.object}/${pronounsA.possessive})
- ${nameB}: ${personB?.relationship || 'relationship not specified'} (pronouns: ${pronounsB.subject}/${pronounsB.object}/${pronounsB.possessive})

## CONTEXT
${contextSummary}

## CONVERSATION SO FAR
${messageHistory}

The last message was from ${speakerName}. Now ${partnerName} will respond.

IMPORTANT: In your response, refer to the people by their names (${nameA} and ${nameB}), not as "Person A/B" or generic terms. Use appropriate pronouns when referring to them.

Respond with valid JSON only.`
}

// Highly abusive content detection (for blocking)
const BLOCK_KEYWORDS = [
  'i will kill you', 'i\'ll kill you', 'gonna kill you', 'going to kill you',
  'i will hurt you', 'i\'ll hurt you', 'gonna hurt you', 'going to hurt you',
  'i will beat you', 'i\'ll beat you', 'gonna beat you',
  'die bitch', 'die whore', 'kill yourself',
  'i know where you live', 'i\'m coming for you'
]

export function shouldBlockMessage(text: string): boolean {
  const lowerText = text.toLowerCase()
  return BLOCK_KEYWORDS.some(keyword => lowerText.includes(keyword))
}

export interface ToneCheckResult {
  decision: 'allow' | 'warn' | 'block'
  toneSummary: string
  suggestedLabels: string[]
  warning?: string
  reframeSuggestion?: string
}

export interface LiveGuidanceResult {
  forCurrentSpeaker: {
    acknowledgment: string
    replyIdeas: string[]
    whatToTry: string
  }
  forPartner: {
    interpretation: string
    replyIdeas: string[]
    whatToTry: string
  }
  conversationInsight: string
  resolved: boolean
  resolutionReason?: string
  suggestBreak: boolean
  breakMessage?: string
}
