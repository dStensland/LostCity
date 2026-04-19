-- Regression canary: Migration 617 — plans consolidation.
-- Pins: tables exist, generated column works, constraint fires, view exists,
-- sweep function is callable, and all 8 RLS policies are present.
-- Does NOT test data-layer correctness (covered by consumer rewrites Task 1.12–1.19).

BEGIN;
SELECT plan(18);

-- -------------------------------------------------------------------------
-- 1. plans table exists with expected columns
-- -------------------------------------------------------------------------
SELECT has_table('public', 'plans', 'plans table exists');

SELECT has_column('public', 'plans', 'id',               'plans.id exists');
SELECT has_column('public', 'plans', 'creator_id',        'plans.creator_id exists');
SELECT has_column('public', 'plans', 'portal_id',         'plans.portal_id exists');
SELECT has_column('public', 'plans', 'anchor_event_id',   'plans.anchor_event_id exists');
SELECT has_column('public', 'plans', 'anchor_place_id',   'plans.anchor_place_id exists');
SELECT has_column('public', 'plans', 'anchor_series_id',  'plans.anchor_series_id exists');
SELECT has_column('public', 'plans', 'anchor_type',       'plans.anchor_type (generated) exists');
SELECT has_column('public', 'plans', 'status',            'plans.status exists');
SELECT has_column('public', 'plans', 'starts_at',         'plans.starts_at exists');
SELECT has_column('public', 'plans', 'visibility',        'plans.visibility exists');

-- -------------------------------------------------------------------------
-- 2. plan_invitees table exists with expected columns
-- -------------------------------------------------------------------------
SELECT has_table('public', 'plan_invitees', 'plan_invitees table exists');

SELECT has_column('public', 'plan_invitees', 'plan_id',      'plan_invitees.plan_id exists');
SELECT has_column('public', 'plan_invitees', 'user_id',      'plan_invitees.user_id exists');
SELECT has_column('public', 'plan_invitees', 'rsvp_status',  'plan_invitees.rsvp_status exists');
SELECT has_column('public', 'plan_invitees', 'responded_at', 'plan_invitees.responded_at exists');

-- -------------------------------------------------------------------------
-- 3. anchor_type is a generated (stored) column
-- -------------------------------------------------------------------------
SELECT is(
  (SELECT is_generated
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'plans'
     AND column_name  = 'anchor_type'),
  'ALWAYS',
  'anchor_type is GENERATED ALWAYS AS'
);

-- -------------------------------------------------------------------------
-- 4. plans_exactly_one_anchor CHECK rejects zero-anchor insert
--    We need a portal and a profile to satisfy the NOT NULL FKs.
--    All inserts run inside this transaction and roll back at ROLLBACK.
-- -------------------------------------------------------------------------

-- Minimal fixture portal (ON CONFLICT = skip if already present from other tests)
INSERT INTO portals (id, slug, name, portal_type)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'pgtap-plans', 'Plans PgTAP', 'city')
ON CONFLICT (id) DO NOTHING;

-- Minimal fixture profile
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        'pgtap-plans-creator@example.test', '', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'pgtap-plans-creator')
ON CONFLICT (id) DO NOTHING;

-- Zero-anchor insert must fail
SELECT throws_ok(
  $$
    INSERT INTO plans (creator_id, portal_id, starts_at, visibility)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc',
            'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            now() + interval '1 day',
            'friends')
  $$,
  'plans_exactly_one_anchor violated: zero-anchor insert raises'
);

-- -------------------------------------------------------------------------
-- 5. event_rsvps view exists
-- -------------------------------------------------------------------------
SELECT has_view('public', 'event_rsvps', 'event_rsvps compat view exists');

-- -------------------------------------------------------------------------
-- 6. expire_stale_plans() function exists and returns TABLE(expired_count int)
-- -------------------------------------------------------------------------
SELECT has_function(
  'public',
  'expire_stale_plans',
  ARRAY[]::text[],
  'expire_stale_plans() function exists'
);

-- Calling it must not throw (returns 0 when nothing to expire in test DB)
SELECT lives_ok(
  $$ SELECT expired_count FROM expire_stale_plans() $$,
  'expire_stale_plans() is callable and returns without error'
);

-- -------------------------------------------------------------------------
-- 7. All 8 RLS policies exist
-- -------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  IN ('plans', 'plan_invitees')),
  8,
  '8 RLS policies present across plans + plan_invitees'
);

SELECT * FROM finish();
ROLLBACK;
