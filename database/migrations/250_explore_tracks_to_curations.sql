-- 250_explore_tracks_to_curations.sql
-- Convert 5 selected explore tracks into open editorial curations.
-- Copies data from explore_tracks + explore_track_venues into lists + list_items.
-- Explore tables are left intact (copy, not move).

DO $$
DECLARE
  v_portal_id UUID;
  v_creator_id UUID;
  v_track_id UUID;
  v_list_id UUID;
  v_rec RECORD;
BEGIN
  -- =========================================================================
  -- 1. Resolve portal and creator
  -- =========================================================================

  SELECT id INTO v_portal_id FROM portals WHERE slug = 'atlanta';
  IF v_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found — skipping explore-to-curation migration';
    RETURN;
  END IF;

  -- Reuse the creator of an existing active list, or fall back to first profile
  SELECT COALESCE(
    (SELECT creator_id FROM lists WHERE status = 'active' LIMIT 1),
    (SELECT id FROM profiles LIMIT 1)
  ) INTO v_creator_id;

  IF v_creator_id IS NULL THEN
    RAISE NOTICE 'No user found for editorial curations — skipping migration';
    RETURN;
  END IF;

  -- =========================================================================
  -- 2. Iterate selected tracks and insert curations
  -- =========================================================================

  FOR v_rec IN
    SELECT *
    FROM (VALUES
      ('welcome-to-atlanta',             'Welcome to Atlanta',              'best_of'::text,          ARRAY['atlanta', 'essential', 'first-timer']::text[]),
      ('the-itis',                        'What''ll Ya Have?',              'best_of',                ARRAY['food', 'classic', 'southern']),
      ('city-in-a-forest',                'City in a Forest',               'best_of',                ARRAY['outdoor', 'parks', 'nature']),
      ('up-on-the-roof',                  'Up on the Roof',                 'with_friends',           ARRAY['rooftop', 'drinks', 'views']),
      ('artefacts-of-the-lost-city',      'Artefacts of the Lost City',     'hidden_gems',            ARRAY['landmarks', 'history', 'curiosities'])
    ) AS t(track_slug, curation_title, curation_category, vibe_tags)
  LOOP
    -- Look up the explore track
    SELECT id INTO v_track_id
    FROM explore_tracks
    WHERE slug = v_rec.track_slug;

    -- Guard: skip if track doesn't exist
    IF v_track_id IS NULL THEN
      RAISE NOTICE 'Explore track "%" not found — skipping', v_rec.track_slug;
      CONTINUE;
    END IF;

    -- Guard: skip if curation slug already exists for this portal (idempotent)
    IF EXISTS (
      SELECT 1 FROM lists
      WHERE slug = v_rec.track_slug AND portal_id = v_portal_id
    ) THEN
      RAISE NOTICE 'Curation "%" already exists — skipping', v_rec.track_slug;
      CONTINUE;
    END IF;

    -- -----------------------------------------------------------------------
    -- Insert the curation (list)
    -- -----------------------------------------------------------------------
    INSERT INTO lists (
      portal_id, creator_id, title, slug, description,
      cover_image_url, accent_color, category,
      owner_type, is_public, submission_mode, is_pinned,
      vibe_tags, status
    )
    SELECT
      v_portal_id,
      v_creator_id,
      v_rec.curation_title,
      et.slug,
      -- Combine description + quote as italic attribution footer
      CASE
        WHEN et.quote IS NOT NULL AND et.quote != '' AND et.quote_source IS NOT NULL AND et.quote_source != ''
          THEN COALESCE(et.description, '') || E'\n\n"' || et.quote || E'" \u2014 ' || et.quote_source
        WHEN et.quote IS NOT NULL AND et.quote != ''
          THEN COALESCE(et.description, '') || E'\n\n"' || et.quote || '"'
        ELSE et.description
      END,
      et.banner_image_url,
      et.accent_color,
      v_rec.curation_category,
      'editorial',
      true,
      'open',
      true,
      v_rec.vibe_tags,
      'active'
    FROM explore_tracks et
    WHERE et.id = v_track_id
    RETURNING id INTO v_list_id;

    -- -----------------------------------------------------------------------
    -- Insert venue items from explore_track_venues
    -- -----------------------------------------------------------------------
    INSERT INTO list_items (
      list_id, item_type, venue_id, blurb,
      position, upvote_count, status,
      added_by, submitted_by
    )
    SELECT
      v_list_id,
      'venue',
      etv.venue_id,
      etv.editorial_blurb,
      ROW_NUMBER() OVER (ORDER BY etv.sort_order ASC, etv.created_at ASC),
      COALESCE(etv.upvote_count, 0),
      'approved',
      v_creator_id,
      v_creator_id
    FROM explore_track_venues etv
    WHERE etv.track_id = v_track_id
      AND etv.status = 'approved';

    -- -----------------------------------------------------------------------
    -- Set list-level upvote_count as sum of item upvotes
    -- -----------------------------------------------------------------------
    UPDATE lists
    SET upvote_count = COALESCE(
      (SELECT SUM(li.upvote_count) FROM list_items li WHERE li.list_id = v_list_id),
      0
    )
    WHERE id = v_list_id;

    RAISE NOTICE 'Created curation "%" (%) with items from track "%"',
      v_rec.curation_title, v_list_id, v_rec.track_slug;
  END LOOP;

  -- =========================================================================
  -- 3. Summary
  -- =========================================================================
  RAISE NOTICE 'Explore-to-curation migration complete. Run verification:';
  RAISE NOTICE '  SELECT title, slug, category, owner_type, array_length(vibe_tags,1) as tag_count';
  RAISE NOTICE '  FROM lists WHERE owner_type = ''editorial'' ORDER BY title;';
END;
$$;
