-- 010_seed_kbpark_users.sql
-- Creates the two real KBPark logins the manager asked for.
-- RUN THIS ONLY AFTER 008_supabase_auth_roles.sql.
--
--   shiva@kbpark.com   / Kbpark321   role = creator
--   victor@kbpark.com  / Kbpark321   role = admin
--
-- The on_auth_user_created trigger (from migration 008) reads the role out of
-- raw_user_meta_data below and fills in public.profiles automatically — so after
-- this runs, both users exist AND have the right role. Re-running is safe;
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
      ('shiva@kbpark.com',  'creator', 'Shiva'),
      ('victor@kbpark.com', 'admin',   'Victor')
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
      extensions.crypt('Kbpark321', extensions.gen_salt('bf')),
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

-- Safety net: if either user already existed before 008's trigger was in place,
-- make sure their roles are correct.
update public.profiles set role = 'creator' where email = 'shiva@kbpark.com';
update public.profiles set role = 'admin'   where email = 'victor@kbpark.com';
