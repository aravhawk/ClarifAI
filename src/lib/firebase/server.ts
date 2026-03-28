import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function initAdmin() {
  if (getApps().length) return getApps()[0]
  // Provide fallback fake config during build to avoid Next.js static generation errors
  const isBuild = !process.env.FIREBASE_ADMIN_PROJECT_ID

  if (isBuild) {
    // Basic initialization for build time only, bypass actual cert check
    return initializeApp({ projectId: 'demo-project' })
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  })
}

initAdmin()
export const adminAuth = getAuth()
export const adminDb = getFirestore()
