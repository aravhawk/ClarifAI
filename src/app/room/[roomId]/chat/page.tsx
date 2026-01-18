'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useRoom } from '@/hooks/useRoom'
import { LiveChatProvider, useLiveChat } from '@/hooks/useLiveChat'
import { CHAT_POLL_INTERVAL } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Loader2, 
  Send, 
  Pause, 
  AlertTriangle, 
  CheckCircle2, 
  Lightbulb,
  X,
  Coffee,
  LogOut,
  Clock
} from 'lucide-react'
import { PauseOverlay } from '@/components/room/PauseOverlay'
import { TONE_LABEL_PRESETS, type ToneCheckResponse } from '@/types/room'

function ChatContent() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string
  const { room, members, currentUserId, analysis, refreshRoom } = useRoom()
  const { 
    messages, 
    turnState, 
    isMyTurn, 
    isPaused,
    pauseTimeLeft,
    myPausesRemaining,
    endRequestPending,
    endRequestedByMe,
    loading,
    sendMessage,
    checkTone,
    triggerPause,
    endPauseEarly,
    requestEnd,
    respondToEndRequest,
    cancelEndRequest,
    refreshChat,
  } = useLiveChat()

  // Get member names
  const myMember = members.find(m => m.user_id === currentUserId)
  const partnerMember = members.find(m => m.user_id !== currentUserId)
  const myName = myMember?.display_name || 'You'
  const partnerName = partnerMember?.display_name || 'Partner'

  const [messageText, setMessageText] = useState('')
  const [selectedTones, setSelectedTones] = useState<string[]>([])
  const [customTone, setCustomTone] = useState('')
  const [showToneCheck, setShowToneCheck] = useState(false)
  const [toneCheckResult, setToneCheckResult] = useState<ToneCheckResponse | null>(null)
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const userAId = members[0]?.user_id
  const isUserA = currentUserId === userAId

  // Initialize turn state on mount
  useEffect(() => {
    const initTurn = async () => {
      if (!turnState) {
        try {
          await fetch(`/api/rooms/${roomId}/turn`, { method: 'POST' })
          await refreshChat()
        } catch (err) {
          console.error('Failed to init turn:', err)
        }
      }
    }
    initTurn()
  }, [roomId, turnState, refreshChat])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // If room is completed, navigate away
  useEffect(() => {
    if (room?.status === 'completed') {
      router.push(`/room/${roomId}/complete`)
    }
  }, [room?.status, roomId, router])

  // Poll for room status when an end request is pending
  useEffect(() => {
    if (!endRequestPending) return

    const interval = setInterval(() => {
      refreshRoom().catch(() => {
        // no-op
      })
    }, CHAT_POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [endRequestPending, refreshRoom])

  const handleToneToggle = (tone: string) => {
    setSelectedTones(prev => {
      if (prev.includes(tone)) {
        return prev.filter(t => t !== tone)
      }
      if (prev.length >= 3) {
        return prev
      }
      return [...prev, tone]
    })
  }

  const handleAddCustomTone = () => {
    const trimmed = customTone.trim()
    if (trimmed && selectedTones.length < 3 && !selectedTones.includes(trimmed)) {
      setSelectedTones(prev => [...prev, trimmed])
      setCustomTone('')
    }
  }

  const handleCheckTone = async () => {
    if (!messageText.trim() || selectedTones.length === 0) {
      setError('Please write a message and select at least one tone label')
      return
    }

    setChecking(true)
    setError(null)

    try {
      const result = await checkTone(messageText, selectedTones)
      setToneCheckResult(result)
      setShowToneCheck(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tone check failed')
    } finally {
      setChecking(false)
    }
  }

  const handleSend = async () => {
    if (!messageText.trim() || selectedTones.length === 0) return

    setSending(true)
    setError(null)

    try {
      await sendMessage(messageText, selectedTones)
      setMessageText('')
      setSelectedTones([])
      setShowToneCheck(false)
      setToneCheckResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handlePause = async () => {
    try {
      await triggerPause()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause')
    }
  }

  const handleResume = async () => {
    try {
      await endPauseEarly()
    } catch (err) {
      console.error('Failed to end pause:', err)
    }
  }

  const handleComplete = () => {
    router.push(`/room/${roomId}/complete`)
  }

  const handleRequestEnd = async () => {
    setEndingSession(true)
    try {
      await requestEnd()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request end')
    } finally {
      setEndingSession(false)
    }
  }

  const handleRespondToEnd = async (accept: boolean) => {
    setEndingSession(true)
    try {
      const result = await respondToEndRequest(accept)
      if (result.ended) {
        router.push(`/room/${roomId}/complete`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond')
    } finally {
      setEndingSession(false)
    }
  }

  const handleCancelEndRequest = async () => {
    try {
      await cancelEndRequest()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel request')
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sage-500 animate-spin" />
      </main>
    )
  }

  const guidance = turnState?.ai_guidance
  const myGuidance = isUserA ? guidance?.forCurrentSpeaker : guidance?.forPartner
  const showResolutionButton = turnState?.resolved_by_ai && !turnState.user_a_confirmed && !turnState.user_b_confirmed

  return (
    <>
      <main className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-warm-200 px-4 py-3 sticky top-0 z-10 animate-fade-in">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={isMyTurn ? 'bg-sage-100 text-sage-700' : 'bg-warm-100 text-warm-600'}>
                {isMyTurn ? `${myName}'s Turn` : `${partnerName}'s Turn`}
              </Badge>
              {turnState?.suggest_break && (
                <Badge variant="outline" className="border-amber-300 text-amber-700">
                  <Coffee className="w-3 h-3 mr-1" />
                  Break suggested
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isMyTurn && myPausesRemaining > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePause}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <Pause className="w-4 h-4 mr-1" />
                  Pause ({myPausesRemaining})
                </Button>
              )}
              {!endRequestPending && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestEnd}
                  disabled={endingSession}
                  className="border-warm-300 text-warm-600 hover:bg-warm-50"
                >
                  {endingSession ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="w-4 h-4 mr-1" />
                      End Session
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* End Request Pending Banner */}
        {endRequestPending && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 animate-slide-up">
            <div className="max-w-2xl mx-auto">
              {endRequestedByMe ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Waiting for {partnerName} to accept your request to end...</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEndRequest}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800">
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">{partnerName} wants to end the session</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRespondToEnd(false)}
                      disabled={endingSession}
                      className="border-warm-300 text-warm-600 hover:bg-warm-50"
                    >
                      Keep Going
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleRespondToEnd(true)}
                      disabled={endingSession}
                      className="bg-sage-500 hover:bg-sage-400 text-white"
                    >
                      {endingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : 'End Session'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Guidance Panel */}
        {guidance && (guidance.conversationInsight || myGuidance) && (
          <div className="bg-sage-50 border-b border-sage-200 px-4 py-3 animate-fade-in">
            <div className="max-w-2xl mx-auto">
              {guidance.conversationInsight && (
                <p className="text-sm text-sage-700 mb-2">
                  <Lightbulb className="w-4 h-4 inline mr-1" />
                  {guidance.conversationInsight}
                </p>
              )}
              {myGuidance && isMyTurn && (
                <div className="space-y-2">
                  <p className="text-sm text-warm-600">{myGuidance.whatToTry || (myGuidance as { interpretation?: string }).interpretation}</p>
                  {(myGuidance.replyIdeas?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {myGuidance.replyIdeas?.map((idea, i) => (
                        <Badge key={i} variant="outline" className="text-xs border-sage-300 text-sage-600">
                          {idea}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Break suggestion alert */}
        {turnState?.suggest_break && turnState.break_message && (
          <Alert className="mx-4 mt-4 max-w-2xl self-center border-amber-300 bg-amber-50">
            <Coffee className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              {turnState.break_message}
            </AlertDescription>
          </Alert>
        )}

        {/* AI Resolution Suggestion */}
        {showResolutionButton && !endRequestPending && (
          <div className="px-4 py-3 bg-sage-100 border-b border-sage-200 animate-slide-up">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <p className="text-sm text-sage-700">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                It looks like you&apos;ve reached an understanding. Consider wrapping up?
              </p>
              <Button
                onClick={handleRequestEnd}
                size="sm"
                disabled={endingSession}
                className="bg-sage-500 hover:bg-sage-400 text-white"
              >
                {endingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Request to End'}
              </Button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg, index) => {
              const isMine = msg.user_id === currentUserId
              const senderName = isMine ? myName : partnerName
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-slide-up`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`max-w-[80%] ${isMine ? 'order-2' : ''}`}>
                    <p className={`text-xs mb-1 ${isMine ? 'text-right text-sage-600' : 'text-left text-warm-500'}`}>
                      {senderName}
                    </p>
                    <div
                      className={`rounded-2xl px-4 py-3 transition-all ${
                        isMine
                          ? 'bg-sage-500 text-white rounded-br-md'
                          : 'bg-white border border-warm-200 text-warm-900 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                    <div className={`flex gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                      {msg.tone_labels.map((tone, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={`text-xs ${
                            isMine
                              ? 'border-sage-300 text-sage-600'
                              : 'border-warm-300 text-warm-500'
                          }`}
                        >
                          {tone}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-warm-200 px-4 py-4 animate-fade-in">
          <div className="max-w-2xl mx-auto space-y-3">
            {/* Tone selector */}
            <div className="space-y-2">
              <p className="text-xs text-warm-500">Select 1-3 tone labels for your message:</p>
              <div className="flex flex-wrap gap-1.5">
                {TONE_LABEL_PRESETS.map((tone) => (
                  <button
                    key={tone}
                    onClick={() => handleToneToggle(tone)}
                    disabled={!isMyTurn || isPaused}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                      selectedTones.includes(tone)
                        ? 'bg-sage-500 text-white border-sage-500'
                        : 'bg-white text-warm-600 border-warm-300 hover:border-sage-400'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
              {/* Custom tone input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customTone}
                  onChange={(e) => setCustomTone(e.target.value)}
                  placeholder="Custom tone..."
                  disabled={!isMyTurn || isPaused || selectedTones.length >= 3}
                  className="flex-1 px-3 py-1.5 text-sm border border-warm-300 rounded-lg disabled:opacity-50"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTone()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomTone}
                  disabled={!customTone.trim() || !isMyTurn || isPaused || selectedTones.length >= 3}
                >
                  Add
                </Button>
              </div>
              {/* Selected custom tones display */}
              {selectedTones.filter(t => !TONE_LABEL_PRESETS.includes(t as typeof TONE_LABEL_PRESETS[number])).length > 0 && (
                <div className="flex gap-1.5">
                  {selectedTones.filter(t => !TONE_LABEL_PRESETS.includes(t as typeof TONE_LABEL_PRESETS[number])).map((tone) => (
                    <Badge key={tone} className="bg-sage-500 text-white">
                      {tone}
                      <button onClick={() => handleToneToggle(tone)} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Message input */}
            <div className="flex gap-2">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={isMyTurn ? "Type your message..." : "Waiting for partner..."}
                disabled={!isMyTurn || isPaused}
                className="min-h-[80px] resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            {/* Send button */}
            <div className="flex justify-end gap-2">
              <Button
                onClick={handleCheckTone}
                disabled={!isMyTurn || isPaused || !messageText.trim() || selectedTones.length === 0 || checking}
                variant="outline"
                className="border-sage-300"
              >
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check Tone'}
              </Button>
            </div>
          </div>
        </div>

        {/* Tone check modal */}
        {showToneCheck && toneCheckResult && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
            <Card className="max-w-md w-full">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  {toneCheckResult.decision === 'block' ? (
                    <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                  ) : toneCheckResult.decision === 'warn' ? (
                    <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-sage-500 shrink-0" />
                  )}
                  <div>
                    <h3 className="font-medium text-warm-900">
                      {toneCheckResult.decision === 'block'
                        ? 'Message Blocked'
                        : toneCheckResult.decision === 'warn'
                        ? 'Tone Warning'
                        : 'Tone Analysis'}
                    </h3>
                    <p className="text-sm text-warm-600 mt-1">{toneCheckResult.toneSummary}</p>
                  </div>
                </div>

                {toneCheckResult.warning && (
                  <Alert className="border-amber-300 bg-amber-50">
                    <AlertDescription className="text-amber-800 text-sm">
                      {toneCheckResult.warning}
                    </AlertDescription>
                  </Alert>
                )}

                {toneCheckResult.reframeSuggestion && (
                  <div className="bg-sage-50 p-3 rounded-lg">
                    <p className="text-xs text-warm-500 mb-1">Consider rephrasing:</p>
                    <p className="text-sm text-sage-700 italic">&ldquo;{toneCheckResult.reframeSuggestion}&rdquo;</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowToneCheck(false)}
                    className="flex-1"
                  >
                    Edit Message
                  </Button>
                  {toneCheckResult.decision !== 'block' && (
                    <Button
                      onClick={handleSend}
                      disabled={sending}
                      className="flex-1 bg-sage-500 hover:bg-sage-400 text-white"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Anyway
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {isPaused && pauseTimeLeft !== null && (
        <PauseOverlay onResume={handleResume} initialTime={pauseTimeLeft} />
      )}
    </>
  )
}

export default function ChatPage() {
  const { currentUserId, loading } = useRoom()
  const params = useParams()
  const roomId = params.roomId as string

  if (loading || !currentUserId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sage-500 animate-spin" />
      </main>
    )
  }

  return (
    <LiveChatProvider roomId={roomId} currentUserId={currentUserId}>
      <ChatContent />
    </LiveChatProvider>
  )
}
