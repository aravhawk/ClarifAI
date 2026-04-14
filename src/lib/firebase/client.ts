import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const isBuild = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY

const firebaseConfig = {
  apiKey: isBuild ? 'demo-api-key' : process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: isBuild ? 'demo.firebaseapp.com' : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: isBuild ? 'demo-project' : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: isBuild ? 'demo.appspot.com' : process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: isBuild ? '123456789' : process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: isBuild ? '1:123456789:web:abcdef' : process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
// To prevent auth initialisation issues during build time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth = isBuild ? null as any : getAuth(app)
export const db = getFirestore(app)
