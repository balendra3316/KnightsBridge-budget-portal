-- 012_seed_google_test_user.sql   ***TEST DATA — for verifying Google login***
-- Seeds vinay626397@gmail.com so the "Continue with Google" button has a match.
-- RUN THIS ONLY AFTER 008_supabase_auth_roles.sql, in the Supabase SQL editor.
--
--   vinay626397@gmail.com   role = creator   (no password — Google only)
--
-- HOW IT WORKS: we insert the auth user with email_confirmed_at set (a confirmed
-- email) but NO password and NO email identity. Because the email is confirmed,
-- the first time you sign in with this Google account Supabase AUTO-CREATES the
-- google identity and links it to this same user — so you log in with no password
-- ever set, and the role below is preserved. The on_auth_user_created trigger
-- (migration 008) fills public.profiles automatically.
--
-- To make this user an admin instead, change 'creator' to 'admin' in BOTH places
-- below before running (the raw_user_meta_data role and the final UPDATE).
-- Re-running is safe; an existing email is skipped.

do $$
declare
  new_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'vinay626397@gmail.com') then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_id, 'authenticated', 'authenticated', 'vinay626397@gmail.com',
    now(), now(), now(),
    '{"provider":"google","providers":["google"]}'::jsonb,
    jsonb_build_object('name', 'Vinay', 'role', 'creator'),
    '', '', '', ''
  );
end $$;

-- Safety net: ensure the role is correct even if the user already existed.
update public.profiles set role = 'creator' where email = 'vinay626397@gmail.com';
