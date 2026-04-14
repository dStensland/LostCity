-- Regression test: insert_recent_search MUST enforce self-auth.
-- Migration 20260413000009 added an auth.uid() check inside the SECURITY DEFINER
-- function so even if a client calls it with a spoofed p_user_id, only the
-- authenticated user's history can be written. This test pins that behavior.
--
-- Setup notes:
--   * We simulate an authenticated session by setting `request.jwt.claims` via
--     set_config. PostgREST normally populates this; in tests we forge it.
--   * The function RAISES on mismatch (it does NOT silently no-op). We assert
--     that with throws_ok / lives_ok.
--   * Runs inside a transaction and rolls back, so any inserted rows and the
--     forged JWT claim are ephemeral.

BEGIN;
SELECT plan(4);

-- Create two synthetic auth.users so the FK on user_recent_searches is satisfied.
-- We use deterministic UUIDs so the assertions are easy to read.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pgtap-self@example.test', '', now(), now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pgtap-other@example.test', '', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- Forge an authenticated JWT for user A. auth.uid() reads the `sub` claim.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',
  true
);

-- Assertion 1: caller A inserting for caller A succeeds (lives_ok = no exception).
SELECT lives_ok(
  $$ SELECT insert_recent_search(
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
       'jazz brunch',
       NULL::jsonb,
       50
     ) $$,
  'self-auth: caller may write own history'
);

-- Assertion 2: that insert produced exactly one row for user A.
SELECT is(
  (SELECT count(*)::int FROM public.user_recent_searches
     WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
       AND query = 'jazz brunch'),
  1,
  'self-auth: row was actually inserted for own user'
);

-- Assertion 3: caller A trying to write for user B raises.
-- Match against the function's RAISE message text.
SELECT throws_ok(
  $$ SELECT insert_recent_search(
       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
       'malicious write',
       NULL::jsonb,
       50
     ) $$,
  'P0001',
  'insert_recent_search: caller may only write own history',
  'self-auth: caller cannot write someone else''s history'
);

-- Assertion 4: no row was created for user B by the rejected call.
SELECT is(
  (SELECT count(*)::int FROM public.user_recent_searches
     WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0,
  'self-auth: no leaked row for the targeted victim'
);

SELECT * FROM finish();
ROLLBACK;
