-- ============================================
-- MIGRATION 361: Social Layer for Itineraries
-- ============================================
-- Extends the itinerary system with:
-- 1. visibility enum (replaces is_public boolean)
-- 2. itinerary_participants (invites + RSVP)
-- 3. itinerary_participant_stops (per-stop availability)
-- 4. transit_mode on items (walk/drive/transit for Yonder etc.)
--
-- This unifies the "Plans" social coordination model with the
-- existing Itinerary/Playbook infrastructure. The separate `plans`
-- tables remain untouched (dormant, zero UI references).

-- ─── 1. Visibility enum on itineraries ──────────────────────────────────────

ALTER TABLE itineraries
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'invitees', 'public'));

-- Backfill from is_public
UPDATE itineraries SET visibility = 'public' WHERE is_public = true;
UPDATE itineraries SET visibility = 'private' WHERE is_public = false OR is_public IS NULL;

-- Keep is_public as a generated column for backward compat
-- (existing share endpoint checks is_public)
COMMENT ON COLUMN itineraries.is_public IS
  'Deprecated — use visibility column. Kept for backward compat with share endpoint.';

-- ─── 2. Itinerary participants ──────────────────────────────────────────────

CREATE TABLE itinerary_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,

  -- Exactly one of these is set:
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  contact TEXT,  -- email or phone for off-platform invites

  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  rsvp_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (rsvp_status IN ('pending', 'going', 'cant_go')),

  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,

  -- When an off-platform invitee signs up and claims this invite
  claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,

  CONSTRAINT itinerary_participants_target_check CHECK (
    (user_id IS NOT NULL AND contact IS NULL)
    OR (user_id IS NULL AND contact IS NOT NULL)
  ),

  CONSTRAINT itinerary_participants_user_unique
    UNIQUE (itinerary_id, user_id),
  CONSTRAINT itinerary_participants_contact_unique
    UNIQUE (itinerary_id, contact)
);

CREATE INDEX idx_itin_participants_itinerary
  ON itinerary_participants(itinerary_id);
CREATE INDEX idx_itin_participants_user
  ON itinerary_participants(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_itin_participants_contact
  ON itinerary_participants(contact) WHERE contact IS NOT NULL;

-- ─── 3. Per-stop availability ───────────────────────────────────────────────
-- "I'm joining at Bantam at 10" / "Skipping the first stop"

CREATE TABLE itinerary_participant_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES itinerary_participants(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES itinerary_items(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'joining'
    CHECK (status IN ('joining', 'skipping')),

  arrival_time TEXT,  -- optional HH:MM override ("I'll get there at 10:00")
  note TEXT,          -- "Running late, grab me a seat" / "Buzzer code: 4521"

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT itin_participant_stops_unique
    UNIQUE (participant_id, item_id)
);

CREATE INDEX idx_itin_pstops_participant
  ON itinerary_participant_stops(participant_id);
CREATE INDEX idx_itin_pstops_item
  ON itinerary_participant_stops(item_id);

-- ─── 4. Transit mode on items ───────────────────────────────────────────────
-- Needed for Yonder (drive to trailhead) and general use

ALTER TABLE itinerary_items
  ADD COLUMN transit_mode TEXT DEFAULT 'walk'
    CHECK (transit_mode IN ('walk', 'drive', 'transit', 'rideshare'));

-- ─── 5. RLS for new tables ──────────────────────────────────────────────────

ALTER TABLE itinerary_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_participant_stops ENABLE ROW LEVEL SECURITY;

-- Participants visible to itinerary owner + all participants
CREATE POLICY itin_participants_select ON itinerary_participants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM itineraries i
    WHERE i.id = itinerary_participants.itinerary_id
    AND (
      i.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM itinerary_participants ip2
        WHERE ip2.itinerary_id = i.id AND ip2.user_id = auth.uid()
      )
    )
  )
);

-- Only itinerary owner can invite
CREATE POLICY itin_participants_insert ON itinerary_participants FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM itineraries i
    WHERE i.id = itinerary_participants.itinerary_id
    AND i.user_id = auth.uid()
  )
);

-- Participants can update their own RSVP
CREATE POLICY itin_participants_update ON itinerary_participants FOR UPDATE USING (
  user_id = auth.uid()
);

-- Owner can delete (revoke) invites
CREATE POLICY itin_participants_delete ON itinerary_participants FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM itineraries i
    WHERE i.id = itinerary_participants.itinerary_id
    AND i.user_id = auth.uid()
  )
);

-- Participant stops: visible to itinerary members, editable by the participant
CREATE POLICY itin_pstops_select ON itinerary_participant_stops FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM itinerary_participants ip
    JOIN itineraries i ON i.id = ip.itinerary_id
    WHERE ip.id = itinerary_participant_stops.participant_id
    AND (
      i.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM itinerary_participants ip2
        WHERE ip2.itinerary_id = i.id AND ip2.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY itin_pstops_upsert ON itinerary_participant_stops FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM itinerary_participants ip
    WHERE ip.id = itinerary_participant_stops.participant_id
    AND ip.user_id = auth.uid()
  )
);

CREATE POLICY itin_pstops_update ON itinerary_participant_stops FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM itinerary_participants ip
    WHERE ip.id = itinerary_participant_stops.participant_id
    AND ip.user_id = auth.uid()
  )
);

-- Update itinerary read policies for invitees visibility
CREATE POLICY itineraries_invitees_read ON itineraries FOR SELECT USING (
  visibility = 'invitees'
  AND EXISTS (
    SELECT 1 FROM itinerary_participants ip
    WHERE ip.itinerary_id = itineraries.id AND ip.user_id = auth.uid()
  )
);

CREATE POLICY itinerary_items_invitees_read ON itinerary_items FOR SELECT USING (
  itinerary_id IN (
    SELECT id FROM itineraries
    WHERE visibility = 'invitees'
    AND EXISTS (
      SELECT 1 FROM itinerary_participants ip
      WHERE ip.itinerary_id = itineraries.id AND ip.user_id = auth.uid()
    )
  )
);

-- ─── 6. Helper: Get plan crew summary ───────────────────────────────────────

CREATE OR REPLACE FUNCTION get_itinerary_crew(p_itinerary_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'going', COUNT(*) FILTER (WHERE ip.rsvp_status = 'going'),
    'pending', COUNT(*) FILTER (WHERE ip.rsvp_status = 'pending'),
    'cant_go', COUNT(*) FILTER (WHERE ip.rsvp_status = 'cant_go'),
    'participants', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', ip.id,
        'user_id', ip.user_id,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'rsvp_status', ip.rsvp_status,
        'responded_at', ip.responded_at,
        'stops', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'item_id', ips.item_id,
              'status', ips.status,
              'arrival_time', ips.arrival_time,
              'note', ips.note
            )
          ), '[]'::JSONB)
          FROM itinerary_participant_stops ips
          WHERE ips.participant_id = ip.id
        )
      ) ORDER BY ip.invited_at
    ) FILTER (WHERE ip.user_id IS NOT NULL), '[]'::JSONB)
  )
  INTO v_result
  FROM itinerary_participants ip
  LEFT JOIN profiles p ON p.id = ip.user_id
  WHERE ip.itinerary_id = p_itinerary_id;

  RETURN COALESCE(v_result, jsonb_build_object(
    'total', 0, 'going', 0, 'pending', 0, 'cant_go', 0, 'participants', '[]'::JSONB
  ));
END;
$$;

COMMENT ON FUNCTION get_itinerary_crew(UUID) IS
  'Returns crew summary for an itinerary: counts by RSVP status + participant details with per-stop availability.';
