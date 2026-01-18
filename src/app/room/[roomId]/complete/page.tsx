'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useRoom } from '@/hooks/useRoom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2, Heart, Home } from 'lucide-react'

function SentimentSlider({ 
  label, 
  value, 
  onChange 
}: { 
  label: string
  value: number
  onChange: (v: number) => void 
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-warm-700">{label}</Label>
        <span className="text-sm text-warm-500">
          {value < -0.3 ? '😔' : value > 0.3 ? '😊' : '😐'}
        </span>
      </div>
      <input
        type="range"
        min="-1"
        max="1"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-warm-200 rounded-lg appearance-none cursor-pointer accent-sage-500"
      />
      <div className="flex justify-between text-xs text-warm-400">
        <span>Worse</span>
        <span>Same</span>
        <span>Better</span>
      </div>
    </div>
  )
}

function CompletePageContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const roomId = params.roomId as string
  const { loading } = useRoom()

  const [sentimentA, setSentimentA] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)

  const compromiseSelected = searchParams.get('compromise')

  const handleComplete = async () => {
    setSubmitting(true)
    
    try {
      const res = await fetch(`/api/rooms/${roomId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compromiseSelected,
          sentimentAfterA: sentimentA,
          sentimentAfterB: null, // Partner would submit their own
          pauseCount: 0, // Would track this in state
        }),
      })

      if (res.ok) {
        setCompleted(true)
      }
    } catch (err) {
      console.error(err)
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

  if (completed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center animate-fade-in">
          {/* Success icon */}
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto rounded-full bg-sage-100 flex items-center justify-center">
              <Heart className="w-12 h-12 text-sage-500" />
            </div>
          </div>

          <h1 className="text-3xl font-semibold text-warm-900 mb-3">
            Well Done
          </h1>
          
          <p className="text-warm-500 text-lg mb-8 leading-relaxed">
            You&apos;ve completed a difficult conversation with care. That takes courage.
          </p>

          {/* Reminders */}
          <Card className="mb-8 bg-white/60 border-warm-200">
            <CardContent className="pt-6 text-left">
              <h2 className="text-sm font-medium text-warm-600 uppercase tracking-wide mb-4">
                Remember
              </h2>
              <ul className="space-y-3">
                {[
                  'Change takes time — be patient with each other',
                  'It\'s okay to revisit this conversation later',
                  'Small steps forward are still progress',
                  'You showed up, and that matters',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-sage-400 mt-2 flex-shrink-0" />
                    <span className="text-warm-700 text-sm leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Button asChild className="w-full h-12 bg-warm-800 hover:bg-warm-900 text-white">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>

          <p className="text-warm-400 text-xs mt-6">
            This session data will be deleted in 7 days
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-warm-900 mb-2">
            How Do You Feel?
          </h1>
          <p className="text-warm-500">
            Your feedback helps us improve and contributes to relationship research.
          </p>
        </div>

        <Card className="mb-8 bg-white/80 border-warm-200">
          <CardContent className="pt-6 space-y-6">
            <SentimentSlider
              label="How are you feeling now compared to before?"
              value={sentimentA}
              onChange={setSentimentA}
            />
          </CardContent>
        </Card>

        <Button 
          onClick={handleComplete}
          disabled={submitting}
          className="w-full h-12 bg-sage-500 hover:bg-sage-400 text-white"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Complete Session'
          )}
        </Button>

        <button
          onClick={() => { setCompleted(true) }}
          className="w-full mt-3 text-warm-500 hover:text-warm-700 text-sm"
        >
          Skip feedback
        </button>
      </div>
    </main>
  )
}

export default function CompletePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sage-500 animate-spin" />
      </main>
    }>
      <CompletePageContent />
    </Suspense>
  )
}
