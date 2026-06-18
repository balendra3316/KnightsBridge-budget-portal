-- 009_seed_test_users.sql   ***TEST DATA ONLY — do not use in production***
-- Creates one login per role so you can test the app immediately.
-- RUN THIS ONLY AFTER 008_supabase_auth_roles.sql.
--
--   creator@kb.com   / password123   role = creator
--   approver@kb.com  / password123   role = approver
--   admin@kb.com     / password123   role = admin
--
-- The on_auth_user_created trigger (from migration 008) reads the role out of
-- raw_user_meta_data below and fills in public.profiles automatically — so after
-- this runs, all three users exist AND have the right role. Re-running is safe;
-- existing emails are skipped.
--
-- NOTE: passwords are hashed with pgcrypto, which Supabase installs in the
-- `extensions` schema (hence extensions.crypt / extensions.gen_salt below). If
-- you get "function crypt does not exist", run:  create extension if not exists pgcrypto with schema extensions;

do $$
declare
  u record;
  new_id uuid;
begin
  for u in
    select * from (values
      ('creator@kb.com',  'creator',  'Demo Creator'),
      ('approver@kb.com', 'approver', 'Demo Approver'),
      ('admin@kb.com',    'admin',    'Demo Admin')
    ) as t(email, role, name)
  loop
    if exists (select 1 from auth.users where email = u.email) then
      continue;
    end if;

    new_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('password123', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', u.name, 'role', u.role),
      '', '', '', ''
    );

    -- Email/password identity row (required by recent GoTrue versions).
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), new_id,
      jsonb_build_object('sub', new_id::text, 'email', u.email),
      'email', u.email, now(), now(), now()
    );
  end loop;
end $$;

-- Safety net: if any of these users already existed before 008's trigger was in
-- place, make sure their roles are correct.
update public.profiles set role = 'creator'  where email = 'creator@kb.com';
update public.profiles set role = 'approver' where email = 'approver@kb.com';
update public.profiles set role = 'admin'    where email = 'admin@kb.com';
