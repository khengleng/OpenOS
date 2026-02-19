create extension if not exists "uuid-ossp";

create table if not exists public.coworker_tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assigned_agent text,
  result_summary text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists coworker_tasks_user_created_idx on public.coworker_tasks(user_id, created_at desc);
create index if not exists coworker_tasks_user_status_idx on public.coworker_tasks(user_id, status);

alter table public.coworker_tasks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='coworker_tasks' and policyname='Users can view their own coworker tasks.'
  ) then
    create policy "Users can view their own coworker tasks." on public.coworker_tasks
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='coworker_tasks' and policyname='Users can insert their own coworker tasks.'
  ) then
    create policy "Users can insert their own coworker tasks." on public.coworker_tasks
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='coworker_tasks' and policyname='Users can update their own coworker tasks.'
  ) then
    create policy "Users can update their own coworker tasks." on public.coworker_tasks
      for update using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='coworker_tasks' and policyname='Users can delete their own coworker tasks.'
  ) then
    create policy "Users can delete their own coworker tasks." on public.coworker_tasks
      for delete using (auth.uid() = user_id);
  end if;
end $$;
