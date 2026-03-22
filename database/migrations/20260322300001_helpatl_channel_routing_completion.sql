-- HelpATL channel routing completion
-- Reactivates volunteer-opportunities-atl, adds missing source rules to
-- georgia-democracy-watch, atlanta-city-government, and school-board-watch,
-- and removes exact duplicate rules from georgia-democracy-watch.
--
-- Channel UUIDs (HelpATL portal_id = 8d479b53-bab7-433f-8df6-b26cf412cd1d):
--   volunteer-opportunities-atl  = 7b22c1b3-39c3-4801-b0f0-56995be2a31b
--   georgia-democracy-watch      = f5258c2b-4aaa-42cb-b476-23f06465427d
--   atlanta-city-government      = c6dc5877-2577-46b0-9a09-bcf6fd818d6e
--   school-board-watch           = 93e5fc33-2899-441a-9f0d-42874900cb23
--
-- Source IDs added:
--   mobilize-us               = 1217 (already in civic-engagement; deserves democracy watch too)
--   fair-fight                = 1338
--   fair-count                = 1336
--   new-georgia-project       = 376
--   common-cause-georgia      = 1243
--   lwv-atlanta               = 1088
--   atlanta-city-council      = 1787
--   clayton-county-schools    = 1785
--   cherokee-county-schools   = 1786

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Reactivate volunteer-opportunities-atl
-- ──────────────────────────────────────────────────────────────────────────────
UPDATE interest_channels
SET is_active = true, updated_at = now()
WHERE id = '7b22c1b3-39c3-4801-b0f0-56995be2a31b'
  AND is_active = false;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Remove duplicate rules in georgia-democracy-watch
--    (identical source rules were inserted twice for source_ids 1466 and 1566)
-- ──────────────────────────────────────────────────────────────────────────────
DELETE FROM interest_channel_rules
WHERE id IN (
  '27acb1bc-49eb-42da-857f-d41068dd8ccc',  -- duplicate georgia-ethics-commission (1466)
  '5b6fac98-9b76-4a51-ab8a-d2cb63c06814'   -- duplicate georgia-general-assembly (1566)
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Add source rules to georgia-democracy-watch
--    Guards: skip if a rule for the same source_id already exists in this channel
-- ──────────────────────────────────────────────────────────────────────────────

-- mobilize-us (1217)
INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
SELECT 'f5258c2b-4aaa-42cb-b476-23f06465427d', 'source',
       '{"source_id": 1217, "source_slug": "mobilize-us"}'::jsonb,
       10, true
WHERE NOT EXISTS (
  SELECT 1 FROM interest_channel_rules
  WHERE channel_id = 'f5258c2b-4aaa-42cb-b476-23f06465427d'
    AND rule_type = 'source'
    AND rule_payload->>'source_id' = '1217'
);

-- fair-fight (1338)
INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
SELECT 'f5258c2b-4aaa-42cb-b476-23f06465427d', 'source',
       '{"source_id": 1338, "source_slug": "fair-fight"}'::jsonb,
       10, true
WHERE NOT EXISTS (
  SELECT 1 FROM interest_channel_rules
  WHERE channel_id = 'f5258c2b-4aaa-42cb-b476-23f06465427d'
    AND rule_type = 'source'
    AND rule_payload->>'source_id' = '1338'
);

-- fair-count (1336)
INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
SELECT 'f5258c2b-4aaa-42cb-b476-23f06465427d', 'source',
       '{"source_id": 1336, "source_slug": "fair-count"}'::jsonb,
       10, true
WHERE NOT EXISTS (
  SELECT 1 FROM interest_channel_rules
  WHERE channel_id = 'f5258c2b-4aaa-42cb-b476-23f06465427d'
    AND rule_type = 'source'
    AND rule_payload->>'source_id' = '1336'
);

-- new-georgia-project (376)
INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
SELECT 'f5258c2b-4aaa-42cb-b476-23f06465427d', 'source',
       '{"source_id": 376, "source_slug": "new-georgia-project"}'::jsonb,
       10, true
WHERE NOT EXISTS (
  SELECT 1 FROM interest_channel_rules
  WHERE channel_id = 'f5258c2b-4aaa-42cb-b476-23f06465427d'
    AND rule_type = 'source'
    AND rule_payload->>'source_id' = '376'
);

-- common-cause-georgia (1243)
INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
SELECT 'f5258c2b-4aaa-42cb-b476-23f06465427d', 'source',
       '{"source_id": 1243, "source_slug": "common-cause-georgia"}'::jsonb,
       10, true
WHERE NOT EXISTS (
  SELECT 1 FROM interest_channel_rules
  WHERE channel_id = 'f5258c2b-4aaa-42cb-b476-23f06465427d'
    AND rule_type = 'source'
    AND rule_payload->>'source_id' = '1243'
);

-- lwv-atlanta (1088)
INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
SELECT 'f5258c2b-4aaa-42cb-b476-23f06465427d', 'source',
       '{"source_id": 1088, "source_slug": "lwv-atlanta"}'::jsonb,
       10, true
WHERE NOT EXISTS (
  SELECT 1 FROM interest_channel_rules
  WHERE channel_id = 'f5258c2b-4aaa-42cb-b476-23f06465427d'
    AND rule_type = 'source'
    AND rule_payload->>'source_id' = '1088'
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Add atlanta-city-council (1787) to atlanta-city-government
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
SELECT 'c6dc5877-2577-46b0-9a09-bcf6fd818d6e', 'source',
       '{"source_id": 1787, "source_slug": "atlanta-city-council"}'::jsonb,
       10, true
WHERE NOT EXISTS (
  SELECT 1 FROM interest_channel_rules
  WHERE channel_id = 'c6dc5877-2577-46b0-9a09-bcf6fd818d6e'
    AND rule_type = 'source'
    AND rule_payload->>'source_id' = '1787'
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Add new school board sources to school-board-watch
--    (APS/1185, Fulton/1186, DeKalb/1187, Gwinnett/1783, Cobb/1782 already present)
-- ──────────────────────────────────────────────────────────────────────────────

-- clayton-county-schools-board (1785)
INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
SELECT '93e5fc33-2899-441a-9f0d-42874900cb23', 'source',
       '{"source_id": 1785, "source_slug": "clayton-county-schools-board"}'::jsonb,
       10, true
WHERE NOT EXISTS (
  SELECT 1 FROM interest_channel_rules
  WHERE channel_id = '93e5fc33-2899-441a-9f0d-42874900cb23'
    AND rule_type = 'source'
    AND rule_payload->>'source_id' = '1785'
);

-- cherokee-county-schools-board (1786)
INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
SELECT '93e5fc33-2899-441a-9f0d-42874900cb23', 'source',
       '{"source_id": 1786, "source_slug": "cherokee-county-schools-board"}'::jsonb,
       10, true
WHERE NOT EXISTS (
  SELECT 1 FROM interest_channel_rules
  WHERE channel_id = '93e5fc33-2899-441a-9f0d-42874900cb23'
    AND rule_type = 'source'
    AND rule_payload->>'source_id' = '1786'
);

COMMIT;

-- DOWN (to reverse this migration):
-- DELETE FROM interest_channel_rules
--   WHERE channel_id = 'f5258c2b-4aaa-42cb-b476-23f06465427d'
--     AND rule_type = 'source'
--     AND (rule_payload->>'source_id')::int IN (1217, 1338, 1336, 376, 1243, 1088);
-- DELETE FROM interest_channel_rules
--   WHERE channel_id = 'c6dc5877-2577-46b0-9a09-bcf6fd818d6e'
--     AND rule_type = 'source'
--     AND rule_payload->>'source_id' = '1787';
-- DELETE FROM interest_channel_rules
--   WHERE channel_id = '93e5fc33-2899-441a-9f0d-42874900cb23'
--     AND rule_type = 'source'
--     AND (rule_payload->>'source_id')::int IN (1785, 1786);
-- UPDATE interest_channels SET is_active = false, updated_at = now()
--   WHERE id = '7b22c1b3-39c3-4801-b0f0-56995be2a31b';
-- (The deleted duplicate rules cannot be restored without their original UUIDs)
