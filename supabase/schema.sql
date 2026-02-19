-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (Users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  username text unique,
  avatar_url text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- RLS for Profiles
alter table profiles enable row level security;
create policy "Users can view their own profile." on profiles for select using (auth.uid() = id);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- Trigger to create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username)
  values (new.id, new.email, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- HABITS (Daily Pulse)
create table habits (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  streak_count int default 0,
  last_completed date,
  created_at timestamp with time zone default now()
);

-- RLS for Habits
alter table habits enable row level security;
create policy "Users can view their own habits." on habits for select using (auth.uid() = user_id);
create policy "Users can insert their own habits." on habits for insert with check (auth.uid() = user_id);
create policy "Users can update their own habits." on habits for update using (auth.uid() = user_id);
create policy "Users can delete their own habits." on habits for delete using (auth.uid() = user_id);

-- EXPENSES (The Flow)
create table expenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  amount decimal not null,
  category text,
  description text,
  created_at timestamp with time zone default now()
);

-- RLS for Expenses
alter table expenses enable row level security;
create policy "Users can view their own expenses." on expenses for select using (auth.uid() = user_id);
create policy "Users can insert their own expenses." on expenses for insert with check (auth.uid() = user_id);
create policy "Users can update their own expenses." on expenses for update using (auth.uid() = user_id);

-- LOCAL POSTS (The Mesh)
create table local_posts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  content text,
  location_lat float,
  location_long float,
  post_type text check (post_type in ('borrow', 'lend', 'alert')),
  created_at timestamp with time zone default now()
);

-- RLS for Local Posts
alter table local_posts enable row level security;
create policy "Authenticated users can view local posts." on local_posts for select using (auth.uid() is not null);
create policy "Users can insert their own posts." on local_posts for insert with check (auth.uid() = user_id);

-- COWORKER TASKS (Agentic task lifecycle)
create table coworker_tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assigned_agent text,
  result_summary text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);

create index coworker_tasks_user_created_idx on coworker_tasks(user_id, created_at desc);
create index coworker_tasks_user_status_idx on coworker_tasks(user_id, status);

-- RLS for Coworker Tasks
alter table coworker_tasks enable row level security;
create policy "Users can view their own coworker tasks." on coworker_tasks for select using (auth.uid() = user_id);
create policy "Users can insert their own coworker tasks." on coworker_tasks for insert with check (auth.uid() = user_id);
create policy "Users can update their own coworker tasks." on coworker_tasks for update using (auth.uid() = user_id);
create policy "Users can delete their own coworker tasks." on coworker_tasks for delete using (auth.uid() = user_id);
