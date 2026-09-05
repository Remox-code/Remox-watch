create table if not exists public.watchlist (
  id bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  original_name text,
  poster_path text,
  backdrop_path text,
  season integer not null default 1,
  episode integer not null default 0,
  total_seasons integer not null default 0,
  latest_episode integer not null default 0,
  latest_season integer not null default 0,
  first_air_date text,
  status text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  check (season >= 0),
  check (episode >= 0)
);

alter table public.watchlist enable row level security;

drop policy if exists "Users can read their own watchlist" on public.watchlist;
drop policy if exists "Users can insert their own watchlist" on public.watchlist;
drop policy if exists "Users can update their own watchlist" on public.watchlist;
drop policy if exists "Users can delete their own watchlist" on public.watchlist;

create policy "Users can read their own watchlist"
on public.watchlist for select
using (auth.uid() = user_id);

create policy "Users can insert their own watchlist"
on public.watchlist for insert
with check (auth.uid() = user_id);

create policy "Users can update their own watchlist"
on public.watchlist for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own watchlist"
on public.watchlist for delete
using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.watchlist to authenticated;

create index if not exists watchlist_user_updated_idx
on public.watchlist(user_id, updated_at desc);
