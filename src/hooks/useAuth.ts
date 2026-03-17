'use client'

import { useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged, signInAnonymously as firebaseSignInAnonymously, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'

async function syncSessionCookie(user: User) {
  try {
    const idToken = await user.getIdToken()
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
  } catch {
    // Non-fatal: API routes will return 401 until cookie is set
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        await syncSessionCookie(firebaseUser)
      } else {
        // Auto sign in anonymously
        try {
          await firebaseSignInAnonymously(auth)
          // onAuthStateChanged will fire again with the new user
        } catch (err) {
          console.error('Anonymous sign-in failed:', err)
        }
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signInAnonymously = useCallback(async () => {
    const result = await firebaseSignInAnonymously(auth)
    return result
  }, [])

  return { user, loading, signInAnonymously }
}
