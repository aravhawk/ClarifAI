# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clarifai is a Next.js 16 relationship mediation application that helps couples and roommates have productive conversations through AI-guided conflict resolution. The app uses Supabase for real-time data, OpenRouter/Claude for AI analysis, and follows evidence-based conflict resolution methods (Gottman Method, Nonviolent Communication).

## Development Commands

**Package Manager**: Use `pnpm` exclusively (not npm or yarn).

```bash
# Development
pnpm dev                    # Start dev server on localhost:3000

# Building
pnpm build                  # Production build with webpack

# Code Quality
pnpm lint                   # Run ESLint

# Production
pnpm start                  # Start production server (requires build first)
```

## Core Architecture

### Application Flow

1. **Room Creation** (`/create`) → User creates room, gets shareable code
2. **Room Joining** (`/join` or `/r/[code]`) → Partner joins with code
3. **Entry Submission** (`/room/[roomId]`) → Both users submit their perspectives
4. **AI Analysis** (`/room/[roomId]/waiting`) → AI analyzes entries, detects patterns
5. **Analysis Reveal** (`/room/[roomId]/reveal`) → Shows AI insights, compromises
6. **Live Chat** (`/room/[roomId]/chat`) → Turn-based conversation with live AI guidance
7. **Session Complete** (`/room/[roomId]/complete`) → Final feedback, research contribution

### Database Architecture (Supabase)

**Core Tables**:
- `rooms` - Room state machine (waiting → ready → revealed → in_progress → completed/flagged)
- `room_members` - Max 2 users per room (enforced by RLS)
- `room_entries` - User perspectives (one per member)
- `room_ai_analysis` - Cached AI analysis (JSONB with AIAnalysis type)
- `room_events` - Event log for realtime updates

**Live Chat Tables**:
- `room_messages` - Chat messages with tone labels and analysis
- `room_turn_state` - Current speaker, end requests, AI guidance
- `room_pauses` - 5-minute breaks (max 2 per user)

**Row Level Security**: All tables use RLS. Helper function `is_room_member(room_id)` enforces access control.

### Type Organization

Types are split into focused modules in `src/types/`:

- **entities.ts** - Database entities (Room, RoomMember, RoomMessage, etc.)
- **ai.ts** - AI analysis types (AIAnalysis, PersonAnalysis, LiveGuidance, etc.)
- **contexts.ts** - React context types (RoomContext, LiveChatContext)
- **room.ts** - Re-exports all types for backward compatibility

Always import from `@/types/room` for consistency.

### Hook Architecture

**Room State Management** (`src/hooks/`):

- `useRoom.tsx` - Main room context (members, entries, analysis, room status)
- `useLiveChat.tsx` - Orchestrates 4 focused hooks for live chat:
  - `useMessages.tsx` - Message state, send, tone checking
  - `useTurnState.tsx` - Turn management, isMyTurn
  - `usePause.tsx` - Pause state, countdown timer
  - `useEndRequest.tsx` - End request flow (request, respond, cancel)

All hooks use Supabase realtime subscriptions for live updates.

### API Route Structure

**Authentication Pattern**: All `/api/rooms/[roomId]/*` routes use centralized auth middleware:

```typescript
import { requireRoomMember } from '@/lib/api/auth'

const authResult = await requireRoomMember(roomId)
if (authResult instanceof NextResponse) return authResult
const { user, member, adminClient } = authResult
```

**Validation Pattern**: Use centralized validators from `@/lib/api/validation`:

```typescript
import { validateMessage, validateToneLabels } from '@/lib/api/validation'

const messageValidation = validateMessage(message)
if (!messageValidation.valid) {
  return NextResponse.json({ error: messageValidation.error }, { status: 400 })
}
```

**Key API Routes**:
- `/api/rooms` - Create room
- `/api/rooms/join` - Join existing room
- `/api/rooms/[roomId]/analyze` - Trigger AI analysis (uses OpenRouter with reasoning tokens)
- `/api/rooms/[roomId]/messages` - Send/fetch messages
- `/api/rooms/[roomId]/messages/check` - Tone check (FAILS CLOSED on AI error)
- `/api/rooms/[roomId]/pause` - Pause management
- `/api/rooms/[roomId]/turn` - Initialize/fetch turn state
- `/api/rooms/[roomId]/end` - End request flow
- `/api/rooms/[roomId]/complete` - Session completion, anonymization

### AI Integration

**OpenRouter Configuration**:
- Model: `anthropic/claude-haiku-4.5` (defined in `src/lib/openrouter.ts`)
- Uses extended reasoning API for analysis (4000 reasoning tokens)
- Constants in `src/lib/constants.ts`: `REASONING_TOKENS`, `GUIDANCE_MAX_TOKENS`

**AI Prompt System** (`src/lib/prompts.ts`):
- `ANALYSIS_SYSTEM_PROMPT` - Initial analysis using Gottman Method + NVC
- `LIVE_GUIDANCE_SYSTEM_PROMPT` - Real-time conversation guidance
- `TONE_CHECK_SYSTEM_PROMPT` - Message tone validation
- `COACH_SYSTEM_PROMPT` - Statement refinement coaching

**Safety Levels**:
- `normal` - Standard mediation
- `warning` - Concerning patterns detected
- `critical` - Session should not continue (violence, coercion, self-harm)

### Constants & Configuration

Centralized in `src/lib/constants.ts`:

```typescript
// Polling intervals
CHAT_POLL_INTERVAL = 2000        // End request polling
STATUS_POLL_INTERVAL = 4000      // Room status polling

// Pause configuration
PAUSE_DURATION_MS = 5 * 60 * 1000  // 5 minutes
MAX_PAUSES_PER_USER = 2

// AI token limits
REASONING_TOKENS = 4000
GUIDANCE_MAX_TOKENS = 2000

// Relationship options (shared by create/join)
RELATIONSHIP_OPTIONS = [...]
```

### Middleware & Auth

- `middleware.ts` - Supabase session management on all routes (excludes static assets)
- `src/lib/supabase/` - Client/server/middleware Supabase clients
- Auth is handled via Supabase Auth (anonymous users allowed)

### Styling

- **Tailwind 4** with custom theme in `src/app/globals.css`
- Custom color palette: `--warm-*` (browns/tans), `--sage-*` (greens), `--sky-*` (blues), `--amber-*` (warnings)
- Component library: Radix UI primitives in `src/components/ui/`
- Icons: lucide-react

## Important Implementation Notes

### Realtime Subscriptions

All hooks using Supabase realtime must properly clean up channels:

```typescript
useEffect(() => {
  const channel = supabase.channel('channel-name')
    .on('postgres_changes', {...}, handler)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [deps])
```

### Security

- **Tone Check Fails Closed**: `/messages/check` returns `warn` decision if AI fails (never `allow`)
- **RLS Enforcement**: Always use admin client for privileged operations
- **Auth Middleware**: Never duplicate auth logic; use `requireRoomMember()`

### Turn-Based Chat

- Only current speaker can send messages (enforced server-side)
- Turn automatically switches after each message
- End requests require both users' consent
- Pauses freeze turn state for 5 minutes

### Data Anonymization

On session completion (`/api/rooms/[roomId]/complete`):
- Personal details replaced with placeholders via `anonymizeText()` from `@/lib/utils/room`
- Stored in `research_aggregate` table (no foreign keys to rooms)

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
```

## Common Patterns

### Room Status Checks

```typescript
const { room, bothSubmitted, analysis } = useRoom()

// Check if ready for analysis
if (bothSubmitted && !analysis) {
  // Trigger analysis
}

// Navigate based on status
if (room?.status === 'revealed') router.push(`/room/${roomId}/reveal`)
if (room?.status === 'in_progress') router.push(`/room/${roomId}/chat`)
```

### Error Handling in API Routes

```typescript
try {
  // ... operation
} catch (error) {
  console.error('Descriptive error:', error)
  return NextResponse.json({ error: 'User-friendly message' }, { status: 500 })
}
```

### Component Structure

- Keep page components under 200 lines
- Extract reusable UI into `src/components/ui/`
- Extract form components into `src/components/forms/`
- Extract domain components into `src/components/chat/`, `src/components/room/`

## Testing Notes

- No test suite currently configured
- Manual testing flow: Create room → Join → Submit entries → View analysis → Start chat → Use pause → End session
- Test safety detection with keywords like "violence", "hurt", "threaten"
