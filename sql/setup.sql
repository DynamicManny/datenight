-- Date Night: shared tables for all games.
-- Run this once in Supabase: SQL Editor, New query, paste, Run.

create table if not exists public.rooms (
  code        text primary key,
  game        text not null,
  seed        text not null,
  p0_name     text,
  p1_name     text,
  created_at  timestamptz not null default now()
);

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  room        text not null references public.rooms(code) on delete cascade,
  seq         int  not null,
  player      int  not null check (player in (0, 1)),
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (room, seq)
);

create index if not exists events_room_seq_idx on public.events (room, seq);

alter table public.rooms  enable row level security;
alter table public.events enable row level security;

-- Anyone holding the room code can play. These are tiny game rooms, not private data.
drop policy if exists rooms_select  on public.rooms;
drop policy if exists rooms_insert  on public.rooms;
drop policy if exists rooms_update  on public.rooms;
drop policy if exists events_select on public.events;
drop policy if exists events_insert on public.events;

create policy rooms_select  on public.rooms  for select to anon using (true);
create policy rooms_insert  on public.rooms  for insert to anon with check (game <> '' and length(code) between 4 and 12);
create policy rooms_update  on public.rooms  for update to anon using (true) with check (true);
create policy events_select on public.events for select to anon using (true);
create policy events_insert on public.events for insert to anon with check (length(kind) <= 24);

-- Live updates between the two phones.
do $$
begin
  begin
    alter publication supabase_realtime add table public.events;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.rooms;
  exception when duplicate_object then null;
  end;
end $$;

-- Make the new tables visible to the API right away.
notify pgrst, 'reload schema';

-- Optional tidy-up: delete rooms older than 30 days (run by hand whenever you like).
-- delete from public.rooms where created_at < now() - interval '30 days';
