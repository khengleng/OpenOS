do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('maker', 'checker', 'admin');
  end if;
end $$;

create table if not exists public.user_roles (
  user_id uuid references auth.users on delete cascade primary key,
  role app_role not null default 'maker',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists user_roles_role_idx on public.user_roles(role);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'user_roles_touch_updated_at'
  ) then
    create trigger user_roles_touch_updated_at
    before update on public.user_roles
    for each row execute procedure public.touch_updated_at();
  end if;
end $$;

insert into public.user_roles(user_id, role)
select id, 'maker'::app_role from auth.users
on conflict (user_id) do nothing;

create or replace function public.handle_new_user_role()
returns trigger as $$
begin
  insert into public.user_roles(user_id, role)
  values (new.id, 'maker'::app_role)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created_role'
  ) then
    create trigger on_auth_user_created_role
    after insert on auth.users
    for each row execute procedure public.handle_new_user_role();
  end if;
end $$;

create or replace function public.is_admin_user(uid uuid)
returns boolean as $$
  select exists(
    select 1 from public.user_roles
    where user_id = uid and role = 'admin'::app_role
  );
$$ language sql stable security definer;

alter table public.user_roles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_roles' and policyname='Users can view own role.'
  ) then
    create policy "Users can view own role." on public.user_roles
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_roles' and policyname='Admins can view all roles.'
  ) then
    create policy "Admins can view all roles." on public.user_roles
      for select using (public.is_admin_user(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_roles' and policyname='Admins can manage roles.'
  ) then
    create policy "Admins can manage roles." on public.user_roles
      for all using (public.is_admin_user(auth.uid()));
  end if;
end $$;

