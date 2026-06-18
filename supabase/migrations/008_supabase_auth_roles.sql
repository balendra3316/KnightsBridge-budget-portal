-- 008_supabase_auth_roles.sql
-- Real Supabase Auth + role-based access (creator / approver / admin) + RLS.
--
-- HOW TO RUN (Supabase dashboard):
--   1. Run this entire file once in the SQL editor:
--        https://supabase.com/dashboard/project/_/sql
--   2. Create the actual login users under Authentication > Users > "Add user"
--      (tick "Auto Confirm User" so they can log in immediately). NO sign-up page
--      exists by design — you create accounts here.
--   3. After creating a user, give them a role (the trigger below defaults new
--      users to 'creator'). To make someone an approver, run:
--        update public.profiles set role = 'approver' where email = 'boss@kb.com';
--      Roles: 'creator', 'approver', 'admin'.
--
-- This replaces the old fake `admins` table. That table is left in place (not
-- dropped) so nothing breaks mid-deploy; you can drop it once you've confirmed
-- the new login works:  drop table if exists admins;

-- ---------------------------------------------------------------------------
-- 1) profiles: one row per auth user, holds their role + display name.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text,
  role       text not null default 'creator'
             check (role in ('creator', 'approver', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) Auto-create a profile whenever a new auth user is added (dashboard or API).
--    New users default to 'creator'; promote to approver/admin with an UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'creator')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users that already exist (e.g. created before this
-- migration). Safe to re-run.
insert into public.profiles (id, email, name, role)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
       'creator'
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3) app_role(): the current request's role. SECURITY DEFINER so it can read
--    profiles without tripping profiles' own RLS (avoids recursion). RLS
--    policies below call this instead of joining profiles directly.
-- ---------------------------------------------------------------------------
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 4) Turn RLS ON for every table the app touches. Once enabled, a table with
--    no matching policy denies everything — so each table below gets policies.
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.invoices       enable row level security;
alter table public.clients        enable row level security;
alter table public.client_services enable row level security;
alter table public.budget_entries enable row level security;

-- profiles: you can read your own row; admins can read all. Nobody changes
-- roles from the app — do that here in SQL.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.app_role() = 'admin');

-- Reference/working data (clients, services, budget entries): any signed-in
-- user may read and write. These drive the Budget Entry screen and draft build.
drop policy if exists clients_all on public.clients;
create policy clients_all on public.clients
  for all to authenticated using (true) with check (true);

drop policy if exists client_services_all on public.client_services;
create policy client_services_all on public.client_services
  for all to authenticated using (true) with check (true);

drop policy if exists budget_entries_all on public.budget_entries;
create policy budget_entries_all on public.budget_entries
  for all to authenticated using (true) with check (true);

-- invoices: the protected resource.
--   * SELECT  — any signed-in user (creators and approvers both see the list).
--   * INSERT  — creator/approver/admin may create drafts.
--   * UPDATE  — creator/approver/admin may update; the *which transition is
--               allowed* rule (only an approver may approve/reject) is enforced
--               in the server actions. RLS here is the role gate.
--   * DELETE  — admin only.
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated
  using (true);

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (public.app_role() in ('creator', 'approver', 'admin'));

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update to authenticated
  using (public.app_role() in ('creator', 'approver', 'admin'))
  with check (public.app_role() in ('creator', 'approver', 'admin'));

drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices
  for delete to authenticated
  using (public.app_role() = 'admin');
