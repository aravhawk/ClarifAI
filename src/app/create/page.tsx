'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Copy, Check } from 'lucide-react'
import { RelationshipSelector } from '@/components/forms/RelationshipSelector'

export default function CreatePage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [relationship, setRelationship] = useState('')
  const [relationshipOther, setRelationshipOther] = useState('')
  const [loading, setLoading] = useState(false)
  const [roomData, setRoomData] = useState<{ roomId: string; code: string; shareUrl: string } | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolvedRelationship = relationship === 'other' ? relationshipOther.trim() : relationship

  const handleCreate = async () => {
    if (!agreed) return

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
      const res = await fetch('/api/rooms', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationship: resolvedRelationship, displayName: trimmedName })
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create room')
      }

      setRoomData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyLink = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleContinue = () => {
    if (roomData) {
      router.push(`/room/${roomData.roomId}`)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        {/* Back button */}
        <Link href="/" className="inline-flex items-center gap-2 text-warm-500 hover:text-warm-700 mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </Link>

        {!roomData ? (
          <Card className="bg-white/80 backdrop-blur-sm border-warm-200 animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl text-warm-900">Start a Session</CardTitle>
              <p className="text-warm-500 text-sm mt-2">
                Create a private room for you and your partner to work through a disagreement.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
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
                  autoFocus
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
                onClick={handleCreate}
                disabled={!agreed || loading}
                className="w-full h-12 bg-sage-500 hover:bg-sage-400 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Room'
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/80 backdrop-blur-sm border-warm-200 animate-slide-up">
            <CardHeader>
              <CardTitle className="text-2xl text-warm-900">Room Created!</CardTitle>
              <p className="text-warm-500 text-sm mt-2">
                Share this code with your partner so they can join.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Room code display */}
              <div className="text-center p-6 bg-sage-50 rounded-xl">
                <p className="text-xs text-warm-500 uppercase tracking-wide mb-2">Room Code</p>
                <p className="text-4xl font-mono font-bold text-sage-600 tracking-widest">
                  {roomData.code}
                </p>
              </div>

              {/* Copy buttons */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => handleCopyCode(roomData.code)}
                  className="w-full h-11 border-warm-300"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-sage-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Code
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleCopyLink(roomData.shareUrl)}
                  className="w-full h-11 border-warm-300"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-sage-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>

              <Button 
                onClick={handleContinue}
                className="w-full h-12 bg-sage-500 hover:bg-sage-400 text-white"
              >
                Continue to Room
              </Button>

              <p className="text-xs text-warm-400 text-center">
                Your partner can join at{' '}
                <span className="font-medium">{process.env.NEXT_PUBLIC_APP_URL}/join</span>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
