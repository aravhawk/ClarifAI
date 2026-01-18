'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { RelationshipSelector } from '@/components/forms/RelationshipSelector'

export default function JoinPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [relationship, setRelationship] = useState('')
  const [relationshipOther, setRelationshipOther] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolvedRelationship = relationship === 'other' ? relationshipOther.trim() : relationship

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const codeParam = params.get('code')
    if (codeParam) {
      const normalized = codeParam.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
      setCode(normalized)
    }
  }, [])

  const handleJoin = async () => {
    if (!agreed || !code.trim()) return

    const trimmedName = displayName.trim()
    if (!trimmedName) {
      setError('Please enter your first name.')
      return
    }

    if (!resolvedRelationship) {
      setError('Please choose your relationship type.')
      return
    }
    
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), relationship: resolvedRelationship, displayName: trimmedName }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join room')
      }

      router.push(`/room/${data.roomId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow alphanumeric, max 6 chars, auto uppercase
    const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
    setCode(value)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        {/* Back button */}
        <Link href="/" className="inline-flex items-center gap-2 text-warm-500 hover:text-warm-700 mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </Link>

        <Card className="bg-white/80 backdrop-blur-sm border-warm-200 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-2xl text-warm-900">Join a Session</CardTitle>
            <p className="text-warm-500 text-sm mt-2">
                Enter the 6-character code your partner shared with you, then tell us who they are to you.

            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Code input */}
            <div className="space-y-2">
              <Label htmlFor="code" className="text-warm-700">Room Code</Label>
              <Input
                id="code"
                value={code}
                onChange={handleCodeChange}
                placeholder="ABCD12"
                className="text-center text-2xl font-mono tracking-widest h-14 bg-white border-warm-300"
                maxLength={6}
                autoComplete="off"
                autoFocus
              />
            </div>

            {/* Name input */}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sm text-warm-700">Your first name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex"
                className="h-11 bg-white border-warm-300"
                maxLength={30}
                autoComplete="given-name"
              />
              <p className="text-xs text-warm-400">This will be shown to your partner during the conversation.</p>
            </div>

            <RelationshipSelector
              value={relationship}
              otherValue={relationshipOther}
              onChange={setRelationship}
              onOtherChange={setRelationshipOther}
            />

            {/* Consent checkbox */}
            <label htmlFor="consent" className="flex gap-3 p-4 bg-warm-50 rounded-lg cursor-pointer">
              <Checkbox 
                id="consent" 
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
                className="mt-1 shrink-0"
              />
              <span className="text-sm text-warm-700 leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" className="text-sage-600 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
                  Terms of Service
                </Link>
                {' '}and understand that anonymized data may be used for research.
              </span>
            </label>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
            )}

            <Button 
              onClick={handleJoin}
              disabled={!agreed || code.length !== 6 || !displayName.trim() || loading}
              className="w-full h-12 bg-sage-500 hover:bg-sage-400 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Room'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
