// AI analysis and guidance types

import type { SafetyLevel } from './entities'

export interface AIAnalysis {
  neutralAgenda: string
  personA: PersonAnalysis
  personB: PersonAnalysis
  sharedNeeds: string[]
  script: ScriptSection[]
  compromises: Compromise[]
  conflictCategory: string
  safetyLevel: SafetyLevel
  safetyNotes?: string
}

export interface PersonAnalysis {
  feelings: string[]
  underlyingNeeds: string[]
  patterns: PatternDetection[]
  nvcTranslation: NVCTranslation
  suggestedOpener: string
  sentimentScore: number
}

export interface PatternDetection {
  type: 'criticism' | 'contempt' | 'defensiveness' | 'stonewalling'
  evidence: string
  severity: 'mild' | 'moderate' | 'strong'
  reframe: string
}

export interface NVCTranslation {
  observation: string
  feeling: string
  need: string
  request: string
}

export interface ScriptSection {
  id: string
  phase: 'share' | 'reflect' | 'bridge' | 'resolve'
  speaker: 'you' | 'partner' | 'both'
  durationSeconds: number
  prompt: string
  guidance: string
}

export interface Compromise {
  id: string
  title: string
  description: string
  requiresFromYou: string
  requiresFromPartner: string
}

export interface LiveGuidance {
  forCurrentSpeaker?: {
    acknowledgment: string
    replyIdeas: string[]
    whatToTry: string
  }
  forPartner?: {
    interpretation: string
    replyIdeas: string[]
    whatToTry: string
  }
  conversationInsight?: string
  resolved?: boolean
  resolutionReason?: string
  suggestBreak?: boolean
  breakMessage?: string
  initialized?: boolean
  firstSpeaker?: 'A' | 'B'
  reason?: string
}

export interface ToneCheckResponse {
  decision: 'allow' | 'warn' | 'block'
  toneSummary: string
  suggestedLabels: string[]
  warning?: string
  reframeSuggestion?: string
}
