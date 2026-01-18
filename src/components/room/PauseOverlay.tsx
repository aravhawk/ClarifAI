'use client'

import { useState, useEffect } from 'react'

interface PauseOverlayProps {
  onResume: () => void
  initialTime?: number // in seconds
}

export function PauseOverlay({ onResume, initialTime }: PauseOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(initialTime ?? 5 * 60) // 5 minutes default

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onResume()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [onResume])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return (
    <div className="fixed inset-0 z-50 bg-cream/95 backdrop-blur-md flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {/* Breathing circle */}
        <div className="mb-10">
          <div className="w-40 h-40 mx-auto rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center animate-breathe shadow-lg shadow-amber-100/50">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-200 to-amber-300 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-light text-amber-700 tabular-nums">
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-warm-900 mb-3">
          Taking a Pause
        </h1>
        
        <p className="text-warm-500 mb-8 leading-relaxed">
          Take a few deep breaths. It&apos;s okay to step away and return with a clearer mind.
        </p>

        {/* Breathing guide */}
        <div className="bg-white/60 rounded-2xl p-6 mb-8">
          <p className="text-warm-600 text-sm mb-4">Try this breathing pattern:</p>
          <div className="flex justify-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-light text-sage-600">4s</div>
              <div className="text-xs text-warm-500 mt-1">Inhale</div>
            </div>
            <div className="text-warm-300">→</div>
            <div className="text-center">
              <div className="text-2xl font-light text-sage-600">4s</div>
              <div className="text-xs text-warm-500 mt-1">Hold</div>
            </div>
            <div className="text-warm-300">→</div>
            <div className="text-center">
              <div className="text-2xl font-light text-sage-600">4s</div>
              <div className="text-xs text-warm-500 mt-1">Exhale</div>
            </div>
          </div>
        </div>

        <p className="text-warm-400 text-sm mb-4">
          The conversation will resume when the timer ends
        </p>

        {/* Skip button - only show after half time */}
        {timeLeft < 150 && (
          <button
            onClick={onResume}
            className="text-warm-500 hover:text-warm-700 text-sm underline underline-offset-2"
          >
            We&apos;re ready to continue
          </button>
        )}
      </div>
    </div>
  )
}
