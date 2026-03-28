'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function ShareLinkPage() {
  const router = useRouter()
  const params = useParams()
  const code = params.code as string

  useEffect(() => {
    if (code) {
      router.replace(`/join?code=${code}`)
    }
  }, [code, router])

  if (!code) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <p className="text-warm-600">Missing room code</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <Loader2 className="w-8 h-8 text-sage-500 animate-spin" />
      <p className="mt-4 text-warm-500">Joining room...</p>
    </main>
  )
}
