# Clarifai

Clarifai is a Next.js 16 relationship mediation app that helps couples and roommates move through conflict with AI-guided, evidence-based conversation support.

## What It Does

- Create or join a private room with a shareable code
- Submit perspectives from both participants
- Get AI analysis and suggested compromises
- Move into a turn-based live chat with real-time guidance
- End sessions with anonymized research aggregation

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Supabase (Auth, Postgres, Realtime, RLS)
- OpenRouter (Claude Haiku 4.5) for analysis and guidance
- Tailwind CSS v4 + Radix UI

## Core Flow

1. Create room (`/create`) or join (`/join` or `/r/[code]`)
2. Submit entries (`/room/[roomId]`)
3. AI analysis (`/room/[roomId]/waiting`)
4. Reveal insights (`/room/[roomId]/reveal`)
5. Live chat (`/room/[roomId]/chat`)
6. Complete (`/room/[roomId]/complete`)

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (URL + anon key + service role key)
- OpenRouter API key

### Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
```

### Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Project Notes

- Room access is enforced with Supabase RLS and `requireRoomMember()` auth middleware.
- Tone checks fail closed: if AI is unavailable, messages are warned rather than allowed.
- Realtime subscriptions must be cleaned up to avoid leaked channels.

## Manual QA

Create room -> Join -> Submit -> Analyze -> Reveal -> Chat -> Pause -> End session.

## Deployment

Build and run with:

```bash
npm run build
npm run start
```
