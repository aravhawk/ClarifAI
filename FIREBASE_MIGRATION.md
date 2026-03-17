# Supabase → Firebase Migration Plan

## Overview

Full replacement of Supabase (Auth + PostgreSQL + Realtime) with Firebase (Auth + Firestore + onSnapshot).
Zero-downtime is achievable because all users are **anonymous and ephemeral** — sessions auto-expire in 7 days and there are no persistent user accounts. A Vercel atomic deployment is the cutover mechanism.

---

## What Changes

### Packages

**Remove:**
```
@supabase/supabase-js
@supabase/ssr
```
**Add:**
```
firebase
firebase-admin
```

### Environment Variables

**Remove:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```
**Add:**
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
```

---

## Firestore Data Model

Maps directly from the existing Supabase tables:

```
/rooms/{roomId}                          ← rooms table
  /members/{userId}                      ← room_members table
  /entries/{userId}                      ← room_entries table
  /analysis/main                         ← room_ai_analysis table (singleton)
  /messages/{messageId}                  ← room_messages table
  /turnState/main                        ← room_turn_state table (singleton)
  /pauses/{pauseId}                      ← room_pauses table
  /events/{eventId}                      ← room_events table

/researchAggregate/{docId}               ← research_aggregate table
```

All fields map 1:1. JSONB fields (`analysis_json`, `ai_guidance`, `tone_analysis`) become native Firestore Maps — no serialization needed.

---

## Authentication Pattern

**Current (Supabase):**
- Middleware calls `signInAnonymously()` on every unauthenticated request
- Session stored in cookies via `@supabase/ssr`
- Server reads session from cookies via `createServerClient()`
- API routes call `supabase.auth.getUser()` to get user

**New (Firebase):**
- Client calls `signInAnonymously()` once → stores Firebase ID token in HttpOnly cookie (`__session`)
- Middleware verifies the `__session` cookie with Admin SDK; if absent, sets a flag but does NOT block (auth happens client-side)
- API routes extract `Authorization: Bearer <token>` header OR `__session` cookie, verify with `adminAuth.verifyIdToken()` / `verifySessionCookie()`
- Session cookies are refreshed client-side (Firebase handles ID token auto-refresh every hour)

---

## Files Deleted

```
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/middleware.ts
```

## Files Created

```
src/lib/firebase/client.ts          Firebase Web SDK app init + getAuth/getFirestore
src/lib/firebase/server.ts          Firebase Admin SDK init (auth + firestore)
src/lib/firebase/middleware.ts      Cookie-based session verification helper
```

## Files Rewritten (20 total)

| File | Change |
|------|--------|
| `middleware.ts` | Verify Firebase session cookie; auto-pass if missing (client handles) |
| `src/lib/api/auth.ts` | `requireAuth` / `requireRoomMember` use Admin SDK token verification |
| `src/hooks/useAuth.ts` | Firebase `signInAnonymously`, `onAuthStateChanged`, token→cookie |
| `src/hooks/useRoom.tsx` | Firestore `getDoc`/`getDocs` + `onSnapshot` instead of Supabase realtime |
| `src/hooks/useMessages.tsx` | `onSnapshot` on messages subcollection |
| `src/hooks/useTurnState.tsx` | `onSnapshot` on `turnState/main` doc |
| `src/hooks/usePause.tsx` | `onSnapshot` on pauses subcollection |
| `src/app/api/rooms/route.ts` | Admin Firestore instead of Supabase admin client |
| `src/app/api/rooms/join/route.ts` | Same |
| `src/app/api/rooms/[roomId]/analyze/route.ts` | Same |
| `src/app/api/rooms/[roomId]/entry/route.ts` | Same |
| `src/app/api/rooms/[roomId]/messages/route.ts` | Same |
| `src/app/api/rooms/[roomId]/messages/check/route.ts` | Same |
| `src/app/api/rooms/[roomId]/turn/route.ts` | Same |
| `src/app/api/rooms/[roomId]/pause/route.ts` | Same |
| `src/app/api/rooms/[roomId]/end/route.ts` | Same |
| `src/app/api/rooms/[roomId]/complete/route.ts` | Same |
| `src/app/api/rooms/[roomId]/coach/route.ts` | Same |
| `src/types/entities.ts` | Minor: remove Supabase-specific field comments |

---

## Key API Mapping

| Supabase | Firebase |
|----------|----------|
| `supabase.from('rooms').select('*').eq('id', id).single()` | `db.doc('rooms/' + id).get()` |
| `adminClient.from('rooms').insert({...})` | `db.collection('rooms').add({...})` |
| `adminClient.from('rooms').update({...}).eq('id', id)` | `db.doc('rooms/' + id).update({...})` |
| `adminClient.from('room_members').select('*').eq('room_id', id)` | `db.collection('rooms/' + id + '/members').get()` |
| `adminClient.from('room_ai_analysis').insert(...)` | `db.doc('rooms/' + id + '/analysis/main').set(...)` |
| `adminClient.from('room_turn_state').update(...).eq('room_id', id)` | `db.doc('rooms/' + id + '/turnState/main').update(...)` |
| `supabase.channel().on('postgres_changes').subscribe()` | `onSnapshot(docRef / collectionRef, handler)` |
| `supabase.removeChannel(channel)` | `unsubscribe()` (returned by onSnapshot) |
| `supabase.auth.getUser()` | `auth.currentUser` (client) |
| `adminAuth.verifyIdToken(token)` | replaces `supabase.auth.getUser()` on server |

---

## Firestore Security Rules

Replace Supabase RLS with these Firestore rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper: is the caller a member of this room?
    function isRoomMember(roomId) {
      return exists(/databases/$(database)/documents/rooms/$(roomId)/members/$(request.auth.uid));
    }

    match /rooms/{roomId} {
      allow read: if isRoomMember(roomId);
      allow write: if false; // all writes via API routes (Admin SDK bypasses rules)

      match /members/{userId} {
        allow read: if isRoomMember(roomId);
        allow write: if false;
      }
      match /entries/{userId} {
        allow read: if isRoomMember(roomId);
        allow write: if false;
      }
      match /analysis/main {
        allow read: if isRoomMember(roomId);
        allow write: if false;
      }
      match /messages/{messageId} {
        allow read: if isRoomMember(roomId);
        allow write: if false;
      }
      match /turnState/main {
        allow read: if isRoomMember(roomId);
        allow write: if false;
      }
      match /pauses/{pauseId} {
        allow read: if isRoomMember(roomId);
        allow write: if false;
      }
      match /events/{eventId} {
        allow read: if isRoomMember(roomId);
        allow write: if false;
      }
    }

    match /researchAggregate/{docId} {
      allow read, write: if false; // server-only
    }
  }
}
```

All reads from hooks use the **client SDK** (governed by these rules).
All writes from API routes use the **Admin SDK** (bypasses rules — same as Supabase's service role key).

---

## Realtime: Supabase → onSnapshot

Supabase realtime uses `postgres_changes` events (channel per topic).
Firebase `onSnapshot` is a direct, simpler equivalent.

**Before (useRoom):**
```ts
channel = supabase.channel(`room:${roomId}`)
  .on('postgres_changes', { table: 'rooms', filter: `id=eq.${roomId}` }, handler)
  .subscribe()
return () => supabase.removeChannel(channel)
```

**After:**
```ts
const unsub = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
  setRoom({ id: snap.id, ...snap.data() } as Room)
})
return unsub
```

---

## Session Cookie Flow

1. App loads → `useAuth` calls `signInAnonymously()` if no `auth.currentUser`
2. After sign-in: `getIdToken()` → POST to `/api/auth/session` → sets HttpOnly `__session` cookie via Admin SDK `createSessionCookie()`
3. Middleware reads `__session` cookie, verifies with `adminAuth.verifySessionCookie()` — if invalid/missing, continues (client will handle re-auth)
4. API routes: extract Bearer token from `Authorization` header OR `__session` cookie, call `adminAuth.verifyIdToken()` / `verifySessionCookie()` to get `uid`

---

## Zero-Downtime Strategy

Since all users are anonymous and rooms expire in 7 days:

1. **Branch**: Do all work on `feat/firebase-migration` branch
2. **Parallel Firebase project**: Set up Firebase project alongside Supabase (no conflict)
3. **Feature-flag deploy** *(optional)*: Deploy with `ENABLE_FIREBASE=false` env var to test infra without routing traffic
4. **Atomic cutover**: Merge + deploy to Vercel — new deployment serves new code instantly
5. **Accept**: Users mid-session (~minutes window) will hit a soft error and need to start a new room. Given anonymous sessions, this is acceptable.
6. **Rollback**: Revert commit + redeploy restores Supabase in ~2 minutes

True dual-write zero-downtime (no session disruption at all) would require 3× the complexity for ephemeral anonymous sessions — not worth it.

---

## Implementation Order

1. Set up Firebase project + enable Anonymous Auth + Firestore
2. Install packages, add env vars
3. Create `src/lib/firebase/` (client, server, middleware)
4. Rewrite `src/lib/api/auth.ts`
5. Rewrite `middleware.ts`
6. Rewrite `useAuth.ts` + add `/api/auth/session` route for cookie management
7. Rewrite all API routes (can be done in parallel by file)
8. Rewrite all hooks (useRoom, useMessages, useTurnState, usePause)
9. Delete `src/lib/supabase/`
10. Deploy Firestore security rules
11. Test full flow manually: Create → Join → Entry → Analysis → Chat → Pause → End
12. Remove Supabase packages, update env vars in Vercel dashboard
