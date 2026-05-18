-- Friendships: one-way "follow" style relationship between profiles.
-- Idempotent and safe to re-run.

-- 1. Table
create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

-- 2. No self-friend constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'friendships_no_self_ck'
  ) then
    alter table public.friendships
      add constraint friendships_no_self_ck check (user_id <> friend_id);
  end if;
end$$;

-- 3. Index for reverse lookup (who follows me)
create index if not exists friendships_friend_id_idx on public.friendships (friend_id);

-- 4. RLS
alter table public.friendships enable row level security;

drop policy if exists "friendships-own-read" on public.friendships;
create policy "friendships-own-read"
  on public.friendships for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "friendships-own-insert" on public.friendships;
create policy "friendships-own-insert"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "friendships-own-delete" on public.friendships;
create policy "friendships-own-delete"
  on public.friendships for delete
  to authenticated
  using (auth.uid() = user_id);
