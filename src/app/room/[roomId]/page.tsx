'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useRoom } from '@/hooks/useRoom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Users, Check, AlertCircle } from 'lucide-react'

export default function RoomEntryPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string
  const { room, myEntry, partnerEntry, memberCount, bothSubmitted, loading, error, currentUserId, refreshRoom } = useRoom()
  
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Initialize text from existing entry
  useEffect(() => {
    if (myEntry?.text) {
      setText(myEntry.text)
    }
  }, [myEntry?.text])

  // Auto-navigate when both submitted
  useEffect(() => {
    if (bothSubmitted && room?.status === 'ready') {
      router.push(`/room/${roomId}/waiting`)
    }
  }, [bothSubmitted, room?.status, roomId, router])

  // Auto-navigate if already revealed
  useEffect(() => {
    if (room?.status === 'revealed' || room?.status === 'in_progress') {
      router.push(`/room/${roomId}/reveal`)
    }
    if (room?.status === 'flagged') {
      router.push('/resources')
    }
  }, [room?.status, roomId, router])

  const handleSubmit = async () => {
    if (!text.trim()) return
    
    setSubmitting(true)
    setSaveError(null)
    
    try {
      const res = await fetch(`/api/rooms/${roomId}/entry`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, submit: true }),
      })
      
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit')
      }

       await refreshRoom()
       router.push(`/room/${roomId}/waiting`)

    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sage-500 animate-spin" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
        <p className="text-warm-700">{error}</p>
      </main>
    )
  }

  const hasSubmitted = !!myEntry?.submitted_at
  const partnerHasSubmitted = !!partnerEntry?.submitted_at

  return (
    <main className="min-h-screen flex flex-col px-6 py-8">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Badge variant="outline" className="border-sage-300 text-sage-600">
            <Users className="w-3 h-3 mr-1" />
            {memberCount}/2 joined
          </Badge>
          
          {room?.code && (
            <Badge variant="outline" className="border-warm-300 text-warm-600 font-mono">
              {room.code}
            </Badge>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex gap-2 mb-6">
          <div className={`flex-1 p-3 rounded-lg ${hasSubmitted ? 'bg-sage-100' : 'bg-warm-100'}`}>
            <div className="flex items-center gap-2">
              {hasSubmitted ? (
                <Check className="w-4 h-4 text-sage-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-warm-400" />
              )}
              <span className="text-sm text-warm-700">You</span>
            </div>
          </div>
          <div className={`flex-1 p-3 rounded-lg ${partnerHasSubmitted ? 'bg-sage-100' : memberCount < 2 ? 'bg-warm-50' : 'bg-warm-100'}`}>
            <div className="flex items-center gap-2">
              {partnerHasSubmitted ? (
                <Check className="w-4 h-4 text-sage-600" />
              ) : memberCount < 2 ? (
                <div className="w-4 h-4 rounded-full border-2 border-dashed border-warm-300" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-warm-400 animate-pulse-soft" />
              )}
              <span className="text-sm text-warm-700">
                {memberCount < 2 ? 'Waiting for partner...' : 'Partner'}
              </span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <Card className="flex-1 flex flex-col bg-white/80 backdrop-blur-sm border-warm-200">
          <CardHeader>
            <CardTitle className="text-xl text-warm-900">
              {hasSubmitted ? 'You\'ve submitted' : 'What\'s on your mind?'}
            </CardTitle>
            <p className="text-warm-500 text-sm">
              {hasSubmitted 
                ? 'Waiting for your partner to submit their perspective.'
                : 'Write about the issue you\'d like to discuss. Be honest—your partner won\'t see this until you both submit.'
              }
            </p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {hasSubmitted ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-sage-100 flex items-center justify-center mb-4 animate-breathe">
                    <Check className="w-8 h-8 text-sage-500" />
                  </div>
                  <p className="text-warm-600">
                    {partnerHasSubmitted 
                      ? 'Both submitted! Preparing your insights...'
                      : 'Your perspective has been saved securely.'
                    }
                  </p>
                </div>
              </div>
            ) : (
              <>
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="I've been feeling frustrated because..."
                    className="flex-1 min-h-[200px] resize-none bg-white border-warm-200 focus:border-sage-300 text-warm-800 placeholder:text-warm-400"
                  />


                {/* Tip */}
                <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                  <p className="text-amber-700 text-sm">
                    <strong>Tip:</strong> Focus on how you feel and what you need, not what the other person did wrong.
                  </p>
                </div>

                {saveError && (
                  <p className="mt-3 text-sm text-red-600">{saveError}</p>
                )}

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={!text.trim() || submitting}
                    className="flex-1 bg-sage-500 hover:bg-sage-400 text-white"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
