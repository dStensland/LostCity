-- ============================================
-- MIGRATION 510: Fix itinerary_participants RLS infinite recursion
-- ============================================
-- The SELECT policy on itinerary_participants references itself via a subquery,
-- causing Postgres error 42P17 (infinite recursion) on every query that touches
-- itinerary_participants through RLS — including notifications (joins itineraries
-- which triggers itineraries_invitees_read which queries itinerary_participants).
--
-- Fix: SECURITY DEFINER helper that checks membership without triggering RLS,
-- then rewrite all 4 self-referential policies to use it.

-- ─── 1. Helper function (bypasses RLS) ────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_itinerary_member(p_itinerary_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM itinerary_participants
    WHERE itinerary_id = p_itinerary_id AND user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION is_itinerary_member(UUID, UUID) IS
  'SECURITY DEFINER helper to check itinerary membership without triggering RLS. Used by RLS policies on itinerary_participants, itinerary_participant_stops, itineraries, and itinerary_items.';

-- ─── 2. Fix itinerary_participants SELECT policy ──────────────────────────────
-- Was: self-referential subquery on itinerary_participants → infinite recursion

DROP POLICY IF EXISTS itin_participants_select ON itinerary_participants;

CREATE POLICY itin_participants_select ON itinerary_participants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM itineraries i
    WHERE i.id = itinerary_participants.itinerary_id
    AND (
      i.user_id = auth.uid()
      OR is_itinerary_member(i.id, auth.uid())
    )
  )
);

-- ─── 3. Fix itinerary_participant_stops SELECT policy ─────────────────────────
-- Was: joined itinerary_participants which triggered the recursive policy

DROP POLICY IF EXISTS itin_pstops_select ON itinerary_participant_stops;

CREATE POLICY itin_pstops_select ON itinerary_participant_stops FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM itinerary_participants ip
    JOIN itineraries i ON i.id = ip.itinerary_id
    WHERE ip.id = itinerary_participant_stops.participant_id
    AND (
      i.user_id = auth.uid()
      OR is_itinerary_member(i.id, auth.uid())
    )
  )
);

-- ─── 4. Fix itineraries invitees read policy ──────────────────────────────────
-- Was: queried itinerary_participants directly, triggering the recursive policy

DROP POLICY IF EXISTS itineraries_invitees_read ON itineraries;

CREATE POLICY itineraries_invitees_read ON itineraries FOR SELECT USING (
  visibility = 'invitees'
  AND is_itinerary_member(itineraries.id, auth.uid())
);

-- ─── 5. Fix itinerary_items invitees read policy ──────────────────────────────
-- Was: nested subquery through itineraries + itinerary_participants

DROP POLICY IF EXISTS itinerary_items_invitees_read ON itinerary_items;

CREATE POLICY itinerary_items_invitees_read ON itinerary_items FOR SELECT USING (
  itinerary_id IN (
    SELECT id FROM itineraries
    WHERE visibility = 'invitees'
    AND is_itinerary_member(itineraries.id, auth.uid())
  )
);
