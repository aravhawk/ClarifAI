import { adminAuth } from './server'

/**
 * Verifies the __session cookie and returns the uid, or null if invalid/missing.
 * Used in Next.js middleware (edge-incompatible — runs in Node.js runtime only).
 */
export async function verifySessionCookie(sessionCookie: string | undefined): Promise<string | null> {
  if (!sessionCookie) return null
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    return decoded.uid
  } catch {
    return null
  }
}
