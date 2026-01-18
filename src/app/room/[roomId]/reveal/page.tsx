'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useRoom } from '@/hooks/useRoom'
import { STATUS_POLL_INTERVAL } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle, ArrowRight, Heart, MessageCircle } from 'lucide-react'
import type { AIAnalysis, PersonAnalysis } from '@/types/room'

export default function RevealPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string
  const { room, analysis, loading, currentUserId, members, refreshRoom } = useRoom()

  // Determine which person "I" am (creator = A, joiner = B)
  const isCreator = members.length > 0 && members[0].user_id === currentUserId
  const myAnalysis: PersonAnalysis | null = analysis?.analysis_json 
    ? (isCreator ? analysis.analysis_json.personA : analysis.analysis_json.personB)
    : null
  const partnerAnalysis: PersonAnalysis | null = analysis?.analysis_json
    ? (isCreator ? analysis.analysis_json.personB : analysis.analysis_json.personA)
    : null
  const aiData: AIAnalysis | null = analysis?.analysis_json || null

  useEffect(() => {
    if (room?.status === 'flagged') {
      router.push('/resources')
    }
  }, [room?.status, router])

  useEffect(() => {
    if (analysis || room?.status === 'flagged') {
      return
    }

    const interval = setInterval(() => {
      refreshRoom()
    }, STATUS_POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [analysis, room?.status, refreshRoom])

  if (loading || !analysis) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sage-500 animate-spin" />
      </main>
    )
  }

  const handleContinue = () => {
    router.push(`/room/${roomId}/chat`)
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="max-w-2xl mx-auto stagger">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge className="bg-sage-100 text-sage-700 border-sage-200 mb-4">
            Your Conversation Guide
          </Badge>
          <h1 className="text-2xl font-semibold text-warm-900 mb-2">
            {aiData?.neutralAgenda}
          </h1>
        </div>

        {/* Safety warning if applicable */}
        {analysis.safety_level === 'warning' && (
          <Alert className="mb-6 border-amber-300 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              This conversation touches on sensitive topics. Remember: you can pause anytime.
              If you ever feel unsafe, please visit our{' '}
              <a href="/resources" className="underline font-medium">resources page</a>.
            </AlertDescription>
          </Alert>
        )}

        {/* Shared needs */}
        <Card className="mb-6 bg-white/80 border-warm-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-warm-600 uppercase tracking-wide flex items-center gap-2">
              <Heart className="w-4 h-4 text-sage-500" />
              What You Both Need
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {aiData?.sharedNeeds.map((need, i) => (
                <Badge key={i} variant="outline" className="border-sage-300 text-sage-700 bg-sage-50">
                  {need}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Your translation */}
        <Card className="mb-6 bg-sky-50/50 border-sky-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-sky-700 uppercase tracking-wide">
              What You&apos;re Really Saying
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myAnalysis && (
              <>
                <div>
                  <p className="text-xs text-warm-500 mb-1">You&apos;re feeling</p>
                  <div className="flex flex-wrap gap-1.5">
                    {myAnalysis.feelings.map((f, i) => (
                      <Badge key={i} variant="outline" className="border-sky-300 text-sky-700">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-warm-500 mb-1">You need</p>
                  <div className="flex flex-wrap gap-1.5">
                    {myAnalysis.underlyingNeeds.map((n, i) => (
                      <Badge key={i} variant="outline" className="border-sky-300 text-sky-700">
                        {n}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-sky-200">
                  <p className="text-xs text-warm-500 mb-2">Try saying</p>
                  <p className="text-warm-800 italic bg-white/60 p-3 rounded-lg">
                    &ldquo;{myAnalysis.suggestedOpener}&rdquo;
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Partner translation */}
        <Card className="mb-6 bg-sage-50/50 border-sage-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-sage-700 uppercase tracking-wide">
              What Your Partner Is Really Saying
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {partnerAnalysis && (
              <>
                <div>
                  <p className="text-xs text-warm-500 mb-1">They&apos;re feeling</p>
                  <div className="flex flex-wrap gap-1.5">
                    {partnerAnalysis.feelings.map((f, i) => (
                      <Badge key={i} variant="outline" className="border-sage-300 text-sage-700">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-warm-500 mb-1">They need</p>
                  <div className="flex flex-wrap gap-1.5">
                    {partnerAnalysis.underlyingNeeds.map((n, i) => (
                      <Badge key={i} variant="outline" className="border-sage-300 text-sage-700">
                        {n}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pattern warnings */}
        {((myAnalysis?.patterns?.length ?? 0) > 0 || (partnerAnalysis?.patterns?.length ?? 0) > 0) && (
          <Card className="mb-6 bg-amber-50/50 border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-amber-700 uppercase tracking-wide flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Communication Patterns Detected
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {myAnalysis?.patterns?.map((p, i) => (
                <div key={`my-${i}`} className="p-3 bg-white/60 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs">
                      {p.type}
                    </Badge>
                    <span className="text-xs text-warm-500">in your message</span>
                  </div>
                  <p className="text-sm text-warm-600 mb-2">&ldquo;{p.evidence}&rdquo;</p>
                  <p className="text-sm text-sage-700">
                    <strong>Try instead:</strong> {p.reframe}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Continue button */}
        <Button 
          onClick={handleContinue}
          className="w-full h-12 bg-sage-500 hover:bg-sage-400 text-white"
        >
          Start Live Conversation
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </main>
  )
}
