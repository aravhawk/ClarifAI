'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useRoom } from '@/hooks/useRoom'
import { Loader2 } from 'lucide-react'
import { STATUS_POLL_INTERVAL } from '@/lib/constants'

export default function WaitingPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string
  const { room, bothSubmitted, analysis, refreshRoom } = useRoom()
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Trigger analysis when both submitted
  useEffect(() => {
    const triggerAnalysis = async () => {
      if (bothSubmitted && !analysis && !analyzing) {
        setAnalyzing(true)
        try {
          const res = await fetch(`/api/rooms/${roomId}/analyze`, { method: 'POST' })
          const data = await res.json()
          
          if (!res.ok) {
            throw new Error(data.error || 'Analysis failed')
          }

          if (data.safetyLevel === 'critical') {
            router.push('/resources')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to analyze')
        }
      }
    }

    triggerAnalysis()
  }, [bothSubmitted, analysis, analyzing, roomId, router])

  // Navigate when analysis is ready
  useEffect(() => {
    if (analysis || room?.status === 'revealed') {
      router.push(`/room/${roomId}/reveal`)
    }
    if (room?.status === 'flagged') {
      router.push('/resources')
    }
  }, [analysis, room?.status, roomId, router])

  useEffect(() => {
    if (analysis || room?.status === 'revealed' || room?.status === 'flagged') {
      return
    }

    const interval = setInterval(() => {
      refreshRoom()
    }, STATUS_POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [analysis, room?.status, refreshRoom])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-sage-100 flex items-center justify-center mb-8 animate-breathe">
          <Loader2 className="w-10 h-10 text-sage-500 animate-spin" />
        </div>

        <h1 className="text-2xl font-semibold text-warm-900 mb-3">
          {analyzing ? 'Understanding your perspectives...' : 'Preparing insights...'}
        </h1>

        <p className="text-warm-500 mb-8">
          {analyzing 
            ? 'Our AI is finding common ground and crafting your conversation guide.'
            : 'Both of you have shared. Analysis will begin shortly.'
          }
        </p>

        {/* Progress indicators */}
        <div className="space-y-3 text-left max-w-xs mx-auto">
          {[
            'Reading both perspectives',
            'Identifying feelings & needs',
            'Finding common ground',
            'Crafting your conversation guide',
          ].map((step, i) => (
            <div 
              key={i}
              className="flex items-center gap-3 p-3 bg-white/60 rounded-lg"
              style={{ animationDelay: `${i * 0.5}s` }}
            >
              <div className={`w-2 h-2 rounded-full ${analyzing ? 'bg-sage-400 animate-pulse' : 'bg-warm-300'}`} />
              <span className="text-sm text-warm-600">{step}</span>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-6 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
        )}
      </div>
    </main>
  )
}
