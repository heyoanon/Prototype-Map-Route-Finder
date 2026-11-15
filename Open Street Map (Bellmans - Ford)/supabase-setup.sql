create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
  on public.user_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile"
  on public.user_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, update on public.user_profiles to authenticated;

create or replace function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.create_user_profile();

insert into public.user_profiles (user_id, display_name)
select
  id,
  coalesce(raw_user_meta_data ->> 'display_name', '')
from auth.users
on conflict (user_id) do nothing;

create table if not exists public.map_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_type text not null
    check (activity_type in ('search', 'map_style', 'overlay', 'selected_place')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists map_activity_user_created_idx
  on public.map_activity (user_id, created_at desc);

alter table public.map_activity enable row level security;

drop policy if exists "Users can read their own map activity" on public.map_activity;
create policy "Users can read their own map activity"
  on public.map_activity for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own map activity" on public.map_activity;
create policy "Users can add their own map activity"
  on public.map_activity for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own map activity" on public.map_activity;
create policy "Users can delete their own map activity"
  on public.map_activity for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.map_activity to authenticated;
