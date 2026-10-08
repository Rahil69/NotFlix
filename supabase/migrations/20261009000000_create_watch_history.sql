create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  title text not null check (char_length(title) between 1 and 200),
  poster_path text,
  season_number integer not null default 0 check (season_number >= 0),
  episode_number integer not null default 0 check (episode_number >= 0),
  position_seconds double precision not null default 0 check (position_seconds >= 0),
  duration_seconds double precision not null default 0 check (duration_seconds >= 0),
  is_completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, media_type, tmdb_id, season_number, episode_number)
);

create index if not exists watch_history_user_updated_idx
  on public.watch_history (user_id, updated_at desc);

alter table public.watch_history enable row level security;

revoke all on public.watch_history from anon;
grant select, insert, update, delete on public.watch_history to authenticated;

drop policy if exists "Users can manage their own watch history" on public.watch_history;
create policy "Users can manage their own watch history"
  on public.watch_history
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
