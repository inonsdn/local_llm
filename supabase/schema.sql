-- Run this in your Supabase SQL editor to set up the schema

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  preview text not null default '',
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

alter table public.chat_rooms enable row level security;

create policy "Users can manage their own rooms"
  on public.chat_rooms
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "Users can manage messages in their rooms"
  on public.chat_messages
  for all
  using (
    exists (
      select 1 from public.chat_rooms
      where id = chat_messages.room_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_rooms
      where id = chat_messages.room_id and user_id = auth.uid()
    )
  );

create index if not exists chat_rooms_user_id_idx on public.chat_rooms(user_id);
create index if not exists chat_messages_room_id_idx on public.chat_messages(room_id);

-- Image generation jobs
create table if not exists public.image_jobs (
  job_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  negative text,
  status text not null default 'pending' check (status in ('pending', 'done', 'error')),
  image_count int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.image_jobs enable row level security;

create policy "Users can manage their own image jobs"
  on public.image_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists image_jobs_user_id_idx on public.image_jobs(user_id, created_at desc);

-- Add seed to image_jobs (idempotent — safe to re-run)
alter table public.image_jobs add column if not exists seed bigint;

-- Characters (reference image sets for IP-Adapter)
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ref_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.characters enable row level security;

create policy "Users can manage their own characters"
  on public.characters
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists characters_user_id_idx on public.characters(user_id, created_at desc);
