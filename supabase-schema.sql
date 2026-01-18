-- ClarifAI Database Schema
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Rooms table
create table public.rooms (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  status text not null default 'waiting' check (status in ('waiting', 'ready', 'revealed', 'in_progress', 'completed', 'flagged')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  delete_at timestamptz,
  consent_version text default '1.0'
);

-- Room members (max 2 per room, enforced by RLS)
create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  consented_at timestamptz not null default now(),
  relationship_to_other text,
  display_name text,
  primary key (room_id, user_id)
);

-- Optional migration for existing projects
-- alter table public.room_members add column if not exists relationship_to_other text;
-- alter table public.room_members add column if not exists display_name text;

-- Room entries (one per member)
create table public.room_entries (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  text text not null default '',
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- AI analysis results (cached to avoid re-billing)
create table public.room_ai_analysis (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  analysis_json jsonb not null,
  safety_level text not null default 'normal' check (safety_level in ('normal', 'warning', 'critical')),
  horsemen text[] default '{}',
  conflict_category text,
  sentiment_before_a float,
  sentiment_before_b float,
  sentiment_after_a float,
  sentiment_after_b float,
  created_at timestamptz not null default now()
);

-- Room events (for realtime updates + research)
create table public.room_events (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid,
  type text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Research aggregate (anonymized, no foreign keys)
create table public.research_aggregate (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  conflict_category text,
  horsemen text[] default '{}',
  sentiment_shift_user_a float,
  sentiment_shift_user_b float,
  sentiment_shift_ai float,
  session_outcome text check (session_outcome in ('completed', 'abandoned', 'paused', 'flagged')),
  resolution_time_seconds int,
  pause_count int default 0,
  compromise_selected text,
  anonymized_text_a text,
  anonymized_text_b text
);

-- Enable Row Level Security
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_entries enable row level security;
alter table public.room_ai_analysis enable row level security;
alter table public.room_events enable row level security;
alter table public.research_aggregate enable row level security;

-- Helper function: check if user is a member of a room
create or replace function public.is_room_member(room_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.room_members
    where room_members.room_id = $1
    and room_members.user_id = auth.uid()
  );
$$ language sql security definer;

-- Helper function: count room members
create or replace function public.room_member_count(room_id uuid)
returns int as $$
  select count(*)::int from public.room_members
  where room_members.room_id = $1;
$$ language sql security definer;

-- Helper function: check if partner has submitted
create or replace function public.partner_has_submitted(p_room_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.room_entries
    where room_entries.room_id = p_room_id
    and room_entries.user_id != auth.uid()
    and room_entries.submitted_at is not null
  );
$$ language sql security definer;

-- RLS Policies

-- Rooms: members can read
create policy "Members can view room"
  on public.rooms for select
  using (public.is_room_member(id));

-- Rooms: authenticated users can create
create policy "Authenticated users can create rooms"
  on public.rooms for insert
  with check (auth.uid() is not null);

-- Rooms: members can update status
create policy "Members can update room"
  on public.rooms for update
  using (public.is_room_member(id));

-- Room members: can view if member
create policy "Members can view members"
  on public.room_members for select
  using (public.is_room_member(room_id));

-- Room members: can join if room has < 2 members
create policy "Can join if room not full"
  on public.room_members for insert
  with check (
    auth.uid() is not null
    and public.room_member_count(room_id) < 2
    and user_id = auth.uid()
  );

-- Room entries: members can view all entries in their room
create policy "Members can view entries"
  on public.room_entries for select
  using (public.is_room_member(room_id));

-- Room entries: can insert own entry
create policy "Can insert own entry"
  on public.room_entries for insert
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and public.is_room_member(room_id)
  );

-- Room entries: can update own entry if partner hasn't submitted
create policy "Can update own entry before partner submits"
  on public.room_entries for update
  using (
    user_id = auth.uid()
    and public.is_room_member(room_id)
    and not public.partner_has_submitted(room_id)
  );

-- AI analysis: members can view
create policy "Members can view analysis"
  on public.room_ai_analysis for select
  using (public.is_room_member(room_id));

-- Room events: members can view
create policy "Members can view events"
  on public.room_events for select
  using (public.is_room_member(room_id));

-- Room events: members can insert
create policy "Members can insert events"
  on public.room_events for insert
  with check (
    auth.uid() is not null
    and public.is_room_member(room_id)
  );

-- Research aggregate: no public access (service role only)
-- No policies = service role only

-- Enable Realtime for necessary tables
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.room_entries;
alter publication supabase_realtime add table public.room_ai_analysis;
alter publication supabase_realtime add table public.room_events;

-- Create index for room code lookups
create index idx_rooms_code on public.rooms(code);
create index idx_room_events_room_id on public.room_events(room_id);

-- =============================================
-- LIVE CHAT TABLES (added for turn-based chat)
-- =============================================

-- Room messages (persisted for research)
create table public.room_messages (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  text text not null,
  tone_labels text[] not null default '{}',
  tone_analysis jsonb default '{}',
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Room turn state (tracks whose turn, resolution status)
create table public.room_turn_state (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  current_user_id uuid not null,
  last_turn_at timestamptz not null default now(),
  resolved_by_ai boolean not null default false,
  resolution_reason text,
  suggest_break boolean not null default false,
  break_message text,
  user_a_confirmed boolean not null default false,
  user_b_confirmed boolean not null default false,
  end_requested_by uuid,
  end_request_pending boolean not null default false,
  ai_guidance jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Room pauses (2 per user, 5 minutes each)
create table public.room_pauses (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  initiated_by uuid not null,
  pause_index int not null check (pause_index in (1, 2)),
  paused_at timestamptz not null default now(),
  resume_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

-- Enable RLS on new tables
alter table public.room_messages enable row level security;
alter table public.room_turn_state enable row level security;
alter table public.room_pauses enable row level security;

-- RLS Policies for room_messages
create policy "Members can view messages"
  on public.room_messages for select
  using (public.is_room_member(room_id));

create policy "Members can insert messages"
  on public.room_messages for insert
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and public.is_room_member(room_id)
  );

-- RLS Policies for room_turn_state
create policy "Members can view turn state"
  on public.room_turn_state for select
  using (public.is_room_member(room_id));

create policy "Members can insert turn state"
  on public.room_turn_state for insert
  with check (
    auth.uid() is not null
    and public.is_room_member(room_id)
  );

create policy "Members can update turn state"
  on public.room_turn_state for update
  using (public.is_room_member(room_id));

-- RLS Policies for room_pauses
create policy "Members can view pauses"
  on public.room_pauses for select
  using (public.is_room_member(room_id));

create policy "Members can insert pauses"
  on public.room_pauses for insert
  with check (
    auth.uid() is not null
    and initiated_by = auth.uid()
    and public.is_room_member(room_id)
  );

create policy "Members can update pauses"
  on public.room_pauses for update
  using (public.is_room_member(room_id));

-- Enable Realtime for new tables
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.room_turn_state;
alter publication supabase_realtime add table public.room_pauses;

-- Indexes for performance
create index idx_room_messages_room_id on public.room_messages(room_id);
create index idx_room_messages_created_at on public.room_messages(room_id, created_at);
create index idx_room_pauses_room_id on public.room_pauses(room_id);
create index idx_room_pauses_active on public.room_pauses(room_id, status) where status = 'active';
