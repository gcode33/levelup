-- LevelUp schema + Row Level Security (from SPEC.md)

-- profiles: a user's current state, derived from their resume
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume_path text,
  current_title text,
  level_band text check (level_band in ('Junior', 'Mid', 'Senior', 'Staff')),
  current_pay integer,
  skills jsonb not null default '[]'::jsonb,
  years_exp integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text,
  background text,
  updated_at timestamptz not null default now()
);

create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_role text not null,
  target_pay integer,
  levels jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create index roadmaps_user_id_idx on public.roadmaps (user_id);

create table public.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  current_level_index integer not null default 0,
  completed jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, roadmap_id)
);

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  url text,
  min_level_index integer not null default 0,
  source text,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.roadmaps enable row level security;
alter table public.progress enable row level security;
alter table public.job_postings enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id);

create policy "prefs_select_own" on public.user_preferences for select using (auth.uid() = user_id);
create policy "prefs_insert_own" on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "prefs_update_own" on public.user_preferences for update using (auth.uid() = user_id);

create policy "roadmaps_select_own" on public.roadmaps for select using (auth.uid() = user_id);
create policy "roadmaps_insert_own" on public.roadmaps for insert with check (auth.uid() = user_id);
create policy "roadmaps_update_own" on public.roadmaps for update using (auth.uid() = user_id);
create policy "roadmaps_delete_own" on public.roadmaps for delete using (auth.uid() = user_id);

create policy "progress_select_own" on public.progress for select using (auth.uid() = user_id);
create policy "progress_insert_own" on public.progress for insert with check (auth.uid() = user_id);
create policy "progress_update_own" on public.progress for update using (auth.uid() = user_id);

create policy "job_postings_read_all" on public.job_postings for select to authenticated using (true);

-- Onboarding: auto-create profile + preferences on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Grants
grant usage on schema public to authenticated, service_role;
grant all on table public.profiles to authenticated, service_role;
grant all on table public.user_preferences to authenticated, service_role;
grant all on table public.roadmaps to authenticated, service_role;
grant all on table public.progress to authenticated, service_role;
grant select on table public.job_postings to authenticated;
grant all on table public.job_postings to service_role;
