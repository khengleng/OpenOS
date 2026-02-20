-- Apple Health sync connection + daily metrics

create table if not exists public.apple_health_connections (
    user_id uuid primary key references auth.users (id) on delete cascade,
    ingest_key_hash text,
    key_last4 text,
    enabled boolean not null default true,
    last_sync_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.apple_health_daily_metrics (
    user_id uuid not null references auth.users (id) on delete cascade,
    metric_date date not null,
    steps integer not null default 0,
    active_calories numeric(10,2),
    resting_heart_rate numeric(6,2),
    sleep_hours numeric(5,2),
    source text not null default 'apple-health',
    raw_payload jsonb,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    primary key (user_id, metric_date)
);

alter table public.apple_health_connections enable row level security;
alter table public.apple_health_daily_metrics enable row level security;

drop policy if exists "Users can read own Apple Health connection" on public.apple_health_connections;
create policy "Users can read own Apple Health connection"
on public.apple_health_connections
for select
using (auth.uid() = user_id);

drop policy if exists "Users can manage own Apple Health connection" on public.apple_health_connections;
create policy "Users can manage own Apple Health connection"
on public.apple_health_connections
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own Apple Health metrics" on public.apple_health_daily_metrics;
create policy "Users can read own Apple Health metrics"
on public.apple_health_daily_metrics
for select
using (auth.uid() = user_id);

drop policy if exists "Users can write own Apple Health metrics" on public.apple_health_daily_metrics;
create policy "Users can write own Apple Health metrics"
on public.apple_health_daily_metrics
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own Apple Health metrics" on public.apple_health_daily_metrics;
create policy "Users can update own Apple Health metrics"
on public.apple_health_daily_metrics
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
