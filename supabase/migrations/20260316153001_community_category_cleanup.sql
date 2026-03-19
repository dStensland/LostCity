-- ============================================
-- MIGRATION 531: Community category cleanup + unknown category
-- ============================================
-- Problem: ~8K events in the Atlanta portal have category_id='community' because
-- the LLM extraction prompt lacked category definitions, causing "community" to
-- be used as a catch-all for anything vaguely social. Many are actually:
--   - Outdoor/hiking/nature events → should be 'outdoors'
--   - Workshops/classes/lectures → should be 'learning'
--   - Yoga/meditation/fitness → should be 'fitness' or 'wellness'
--   - Government meetings → belong in HelpATL portal, not Atlanta
--   - Truly ambiguous events → should be 'unknown' (held from feed)
--
-- Also:
--   - Source 1067 (Roswell365) has stale 'black-history-month' tags on
--     events after February 2026
--   - The compute_is_feed_ready trigger needs to exclude 'unknown' category
--
-- Changes:
-- 1. Update compute_is_feed_ready to exclude unknown category events
-- 2. Portal attribution fixes:
--    2a. Government meetings source → HelpATL
--    2b. Healthcare sources → Atlanta Support (emory, nghs)
--    2c. Pure B2B trade show sources → Atlanta Business (new portal)
--    2d. B2B events at mixed venues (GWCC/GICC) → Atlanta Business
-- 3. Strip stale black-history-month tags
-- 4. Reclassify misclassified community events

-- ============================================================
-- STEP 1: Update compute_is_feed_ready trigger to exclude 'unknown' category
-- ============================================================

CREATE OR REPLACE FUNCTION compute_is_feed_ready() RETURNS TRIGGER AS $$
BEGIN
  -- Rule 0a: Inactive events are never feed-ready
  IF NEW.is_active = FALSE THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 0b: Sensitive events are never feed-ready (AA/NA meetings, etc.)
  IF NEW.is_sensitive = TRUE THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 0c: Unknown category events are held for human review
  IF NEW.category_id = 'unknown' THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 1: Skeleton event — no description AND no image AND no series
  IF NEW.description IS NULL AND NEW.image_url IS NULL AND NEW.series_id IS NULL THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 2: Generic title with no description AND no series
  IF NEW.description IS NULL AND NEW.series_id IS NULL AND LOWER(TRIM(NEW.title)) IN (
    'happy hour', 'open mic', 'trivia', 'trivia night', 'karaoke', 'karaoke night',
    'bingo', 'dj night', 'live music', 'brunch', 'sunday brunch', 'weekend brunch',
    'sunday brunch buffet', 'bottomless brunch', 'bottomless mimosa brunch',
    'jazz brunch', 'ladies night', 'wine night', 'date night', 'wing deal',
    'all day happy hour', 'oyster happy hour', 'taco tuesday',
    'tuesday dance night', 'drag nite', 'meditation'
  ) THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 3: Decontextualized title (Round N, Game N, Match N) with no description
  IF NEW.description IS NULL AND NEW.title ~* '^(Round|Game|Match)\s+\d+$' THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 4: Boilerplate description with no other context
  IF NEW.image_url IS NULL AND NEW.series_id IS NULL
     AND NEW.description IS NOT NULL
     AND (
       LOWER(NEW.description) LIKE '%is a live event%'
       OR LOWER(NEW.description) LIKE '%is a local event%'
       OR LOWER(NEW.description) LIKE '%is a live music event%'
       OR LOWER(NEW.description) LIKE '%is a film screening%'
       OR LOWER(NEW.description) LIKE '%is a community program%'
       OR LOWER(NEW.description) LIKE '%location details are listed%'
       OR LOWER(NEW.description) LIKE '%use the ticket link for current availability%'
       OR (LENGTH(NEW.description) < 250 AND LOWER(NEW.description) LIKE '%category: %')
     )
  THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- All rules passed
  NEW.is_feed_ready := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add category_id to the trigger's column watch list
DROP TRIGGER IF EXISTS trg_compute_feed_ready ON events;
CREATE TRIGGER trg_compute_feed_ready
  BEFORE INSERT OR UPDATE OF title, description, image_url, series_id, is_sensitive, is_active, category_id
  ON events FOR EACH ROW
  EXECUTE FUNCTION compute_is_feed_ready();

-- ============================================================
-- STEP 2a: Move government meetings source to HelpATL portal
-- ============================================================

DO $$
DECLARE
  helpatl_id UUID;
  src_id INTEGER;
  moved_count INTEGER;
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';
  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'HelpATL portal not found. Skipping government meetings move.';
    RETURN;
  END IF;

  SELECT id INTO src_id FROM sources WHERE id = 1084;
  IF src_id IS NULL THEN
    RAISE NOTICE 'Source 1084 not found. Skipping.';
    RETURN;
  END IF;

  UPDATE sources SET owner_portal_id = helpatl_id WHERE id = src_id;
  RAISE NOTICE 'Moved source % to HelpATL portal', src_id;

  UPDATE events SET portal_id = helpatl_id
  WHERE source_id = src_id AND (portal_id IS NULL OR portal_id != helpatl_id);
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled portal_id on % events', moved_count;
END $$;

-- ============================================================
-- STEP 2b: Move healthcare sources to Atlanta Support portal
-- ============================================================
-- Most healthcare/support sources are already in atlanta-support.
-- These two were missed: emory (in atlanta) and nghs (in dead emory-demo).

DO $$
DECLARE
  support_id UUID;
  moved_count INTEGER;
BEGIN
  SELECT id INTO support_id FROM portals WHERE slug = 'atlanta-support';
  IF support_id IS NULL THEN
    RAISE NOTICE 'atlanta-support portal not found. Skipping.';
    RETURN;
  END IF;

  -- emory-healthcare-community: currently in atlanta portal
  UPDATE sources SET owner_portal_id = support_id
  WHERE slug = 'emory-healthcare-community' AND owner_portal_id != support_id;

  UPDATE events SET portal_id = support_id
  WHERE source_id IN (SELECT id FROM sources WHERE slug = 'emory-healthcare-community')
    AND (portal_id IS NULL OR portal_id != support_id);
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RAISE NOTICE 'Moved emory-healthcare-community events to atlanta-support: %', moved_count;

  -- nghs-community-events: currently in dead emory-demo portal
  UPDATE sources SET owner_portal_id = support_id
  WHERE slug = 'nghs-community-events' AND owner_portal_id != support_id;

  UPDATE events SET portal_id = support_id
  WHERE source_id IN (SELECT id FROM sources WHERE slug = 'nghs-community-events')
    AND (portal_id IS NULL OR portal_id != support_id);
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RAISE NOTICE 'Moved nghs-community-events to atlanta-support: %', moved_count;
END $$;

-- ============================================================
-- STEP 2c: Move pure B2B sources to Atlanta Business portal
-- ============================================================
-- These sources are 100% trade shows / professional conferences.
-- No consumer value — move the entire source.

DO $$
DECLARE
  biz_id UUID;
  moved_src INTEGER;
  moved_evt INTEGER;
BEGIN
  SELECT id INTO biz_id FROM portals WHERE slug = 'atlanta-business';
  IF biz_id IS NULL THEN
    RAISE NOTICE 'atlanta-business portal not found. Skipping.';
    RETURN;
  END IF;

  UPDATE sources SET owner_portal_id = biz_id
  WHERE slug IN (
    'americasmart',                   -- wholesale trade mart
    'atlanta-shoe-market',            -- footwear trade show
    'transact',                       -- fintech B2B
    'modex',                          -- supply chain B2B
    'smu-steel-summit',               -- steel industry
    'naesm',                          -- environmental services mgrs
    'international-woodworking-fair', -- woodworking B2B
    'critical-materials-minerals-expo' -- mining/materials B2B
  ) AND (owner_portal_id IS NULL OR owner_portal_id != biz_id);
  GET DIAGNOSTICS moved_src = ROW_COUNT;
  RAISE NOTICE 'Moved % pure B2B sources to atlanta-business', moved_src;

  UPDATE events SET portal_id = biz_id
  WHERE source_id IN (SELECT id FROM sources WHERE slug IN (
    'americasmart', 'atlanta-shoe-market', 'transact', 'modex',
    'smu-steel-summit', 'naesm', 'international-woodworking-fair',
    'critical-materials-minerals-expo'
  )) AND (portal_id IS NULL OR portal_id != biz_id);
  GET DIAGNOSTICS moved_evt = ROW_COUNT;
  RAISE NOTICE 'Backfilled portal_id on % B2B events', moved_evt;
END $$;

-- ============================================================
-- STEP 2d: Move B2B events at mixed venues to Atlanta Business
-- ============================================================
-- GWCC, GICC, Cobb Galleria host both consumer and B2B events.
-- Can't move the source — move individual B2B events by title signal.

DO $$
DECLARE
  biz_id UUID;
  moved_count INTEGER;
BEGIN
  SELECT id INTO biz_id FROM portals WHERE slug = 'atlanta-business';
  IF biz_id IS NULL THEN
    RAISE NOTICE 'atlanta-business portal not found. Skipping.';
    RETURN;
  END IF;

  UPDATE events SET portal_id = biz_id
  WHERE source_id IN (SELECT id FROM sources WHERE slug IN ('gwcc', 'gicc', 'cobb-galleria'))
    AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(summit|tradeshow|trade show|annual meeting|symposium|leadership conference)\M'
      OR title ~* '\m(career fair|job fair|career conference|networking)\M'
      OR title ~* '\m(Cable.Tec|TechXchange|ConnectED|ASIS International|CAMX|AABB|GFI Food Expo)\M'
      OR title ~* '\m(Customer Connect|Health Innovation|Real Estate Career|NEWH.*Tradeshow)\M'
      OR title ~* '\m(Primerica|Osaic|Modern Storage Media|Numbers Too Big)\M'
    )
    -- Exclude consumer events that happen to match
    AND NOT (
      title ~* '\m(Collect.a.Con|Magic.Con|Comic.Con|Dragon.Con|Commencement|Graduation|Fan\s?Fare|Youth|Kids|Family)\M'
    );
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RAISE NOTICE 'Moved % B2B events from mixed venues to atlanta-business', moved_count;
END $$;

-- ============================================================
-- STEP 3: Strip stale black-history-month tags
-- ============================================================

UPDATE events
SET tags = array_remove(tags, 'black-history-month')
WHERE source_id = (SELECT id FROM sources WHERE slug = 'roswell365' LIMIT 1)
  AND start_date >= '2026-03-01'
  AND 'black-history-month' = ANY(tags);

-- ============================================================
-- STEP 3b: Ensure 'unknown' category exists
-- ============================================================
-- Required before Step 4 can assign events to this category.

INSERT INTO categories (id, name, display_order, icon, color)
VALUES ('unknown', 'Unknown', 999, 'question', '#666666')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 4: Reclassify misclassified community events
-- ============================================================
-- Strategy: work from most-confident to least-confident.
-- Source-level reclassifications first (entire source is wrong category),
-- then title/tag/description signal matching, then sweep remaining → unknown.
-- Based on manual review of all 624 ambiguous events on 2026-03-17.

DO $$
DECLARE
  cnt INTEGER;
  total_reclassified INTEGER := 0;
BEGIN

  -- -------------------------------------------------------
  -- 4a. SOURCE-LEVEL: entire source belongs in another category
  -- -------------------------------------------------------

  -- Outdoor clubs/nature orgs → outdoors
  UPDATE events SET category_id = 'outdoors'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'atlanta-outdoor-club',     -- 100% hiking/nature events
      'chattahoochee-riverkeeper', -- river cleanups + paddle events
      'blk-hiking-club'           -- hiking club
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  outdoor sources → outdoors: %', cnt;

  -- Healthcare/wellness sources → wellness
  UPDATE events SET category_id = 'wellness'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'emory-healthcare-community', 'piedmont-healthcare', 'piedmont-athens',
      'piedmont-classes', 'adventhealth-georgia', 'nghs-community-events',
      'northside-hospital-community', 'pulmonary-fibrosis-foundation',
      'marfan-foundation-georgia', 'mda-georgia',
      'griefshare-atlanta', 'divorcecare-atlanta',  -- open support groups
      'shepherd-center'            -- peer support / rehab community
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  healthcare sources → wellness: %', cnt;

  -- Arts/culture centers → art
  UPDATE events SET category_id = 'art'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'spruill-center-for-the-arts', 'supermarket-atl', 'castleberry-art-stroll',
      'roswell-cultural-arts', 'downtown-duluth', 'moca-ga',
      'ferst-center',              -- GT performing arts: film screenings, art exhibits, concerts
      'georgia-tech-arts',         -- same org, different source
      'wrens-nest'                 -- literary/cultural house museum
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  art sources → art: %', cnt;

  -- Gaming conventions → gaming
  UPDATE events SET category_id = 'gaming'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'dreamhack-atlanta', 'southern-fried-gaming', 'southern-fried-gaming-expo',
      'okecon-tcg'
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;

  -- Fandom/pop culture conventions → family (all-ages fan events)
  UPDATE events SET category_id = 'family'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'anime-weekend-atlanta', 'fancons', 'momocon', 'dragon-con',
      'conjuration', 'atlantacon', '221b-con', 'jordancon',
      'monsterama-con', 'toylanta', 'covington-vampire-diaries-fest',
      'furry-weekend-atlanta', 'collect-a-con-atlanta-fall',
      'atlanta-model-train-show', 'atlanta-toy-model-train-show',  -- family hobby
      'ga-renaissance-festival',   -- family entertainment
      'world-oddities-expo-atlanta' -- curiosities expo
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  conventions/family sources → family: %', cnt;

  -- Tech / professional learning → learning
  UPDATE events SET category_id = 'learning'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'atlanta-tech-village', 'render-atl', 'atlanta-tech-week',
      'georgia-technology-summit', 'red-hat-summit',
      'decatur-makers', 'the-maker-station',   -- makerspaces
      'invest-fest'                -- financial literacy conference
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  tech/maker sources → learning: %', cnt;

  -- Book/literary sources → words
  UPDATE events SET category_id = 'words'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'bookish-atlanta', 'foxtale-books', 'love-yall-book-fest',
      'national-book-club-conf', 'mjcca-book-festival',
      'jimmy-carter-library',      -- author talks + book events
      'atlanta-pen-show'           -- pen/writing community
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  book sources → words: %', cnt;

  -- Auto/sports sources → sports
  UPDATE events SET category_id = 'sports'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'caffeine-octane', 'atlanta-auto-show', 'importexpo-atlanta',
      'nascar-atlanta', 'atlanta-camping-rv-show',
      'fifa-fan-festival-atlanta'  -- World Cup fan activation
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  auto/sports sources → sports: %', cnt;

  -- Nightlife sources
  UPDATE events SET category_id = 'nightlife'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'southern-fried-queer-pride', 'frolicon',  -- parties/dance nights
      'our-bar-atl'                -- bar events (bartender battles, chef battles)
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;

  -- Food/drink sources
  UPDATE events SET category_id = 'food_drink'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'chattahoochee-food-works',  -- 100% farmers market + happy hour events
      'monday-night',              -- brewery events (beer festivals, VIP nights)
      'buckhead-village',          -- restaurant/shopping district events
      'the-works', 'the-works-atl' -- food hall: markets, taste nights, happy hours
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  food/drink sources → food_drink: %', cnt;

  -- Science/museum sources → learning
  UPDATE events SET category_id = 'learning'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'atlanta-science-festival',  -- STEM demos, family science events
      'fernbank',                  -- museum programs: hikes, bug fest, after dark
      'delta-flight-museum',       -- museum night events
      'breman-museum',             -- tours, concerts, cultural events
      'southern-museum'            -- history museum events
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  museum/science sources → learning: %', cnt;

  -- DV awareness org → community (correct category, but mark these civic)
  -- wrcdv stays community — already there

  -- Roswell365: mixed-use city calendar. Mostly learning/family/community.
  -- Keep as community — it's a city source with civic character.
  -- (Individual events that match title signals will still be caught below)

  -- MJCCA: Jewish community center — mix of fitness, learning, social, family.
  -- Keep as community — community center programming IS community.

  -- AA/NA meetings should be sensitive, not community
  UPDATE events SET is_sensitive = true, category_id = 'community'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'aa-atlanta', 'na-georgia'
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  AA/NA meetings → sensitive: %', cnt;

  -- Fashion/streetwear shows → art (consumer-facing creative events)
  UPDATE events SET category_id = 'art'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND source_id IN (SELECT id FROM sources WHERE slug IN (
      'black-fashion-weekend', 'atlanta-streetwear-market'
    ));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  fashion/streetwear → art: %', cnt;

  -- NOTE: Pure B2B sources (americasmart, transact, etc.) already moved to
  -- atlanta-business portal in Step 2c. Consumer shows (scott-antique-markets,
  -- blade-show, stamp-scrapbook-expo, home shows, etc.) stay in Atlanta as
  -- community — they're genuine community shopping/hobby events.
  -- GWCC/GICC B2B events moved to atlanta-business in Step 2d; remaining
  -- consumer events stay in Atlanta and get categorized by title signals below.

  -- Remap existing 'other' category → unknown
  UPDATE events SET category_id = 'unknown'
  WHERE category_id = 'other' AND start_date >= CURRENT_DATE AND is_active = true;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  other → unknown: %', cnt;

  -- -------------------------------------------------------
  -- 4b. TITLE/TAG/DESCRIPTION signal matching (cross-source)
  -- -------------------------------------------------------

  -- Outdoor signals (expanded from review: "Morning Hikes", Yonah Summit, etc.)
  UPDATE events SET category_id = 'outdoors'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(hike|hiking|trail|climb|kayak|paddle|paddleboard|bike|cycling|trek|backpack|canoe|fishing|birding|wildflower|rafting|creek|river walk)\M'
      OR title ~* '\m(nature walk|nature hike|outdoor adventure|guided walk|bird walk|morning hike|forest walk|sunrise .* mountain|summit)\M'
      OR title ~* '\m(sweep the hooch|paddle cleanup|open streets|beltline.*walk)\M'
      OR tags && ARRAY['outdoor', 'hiking', 'adventure', 'nature', 'trail']
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → outdoors: %', cnt;

  -- Learning signals (expanded: blacksmithing, calligraphy, AI, eBay, Windows, etc.)
  UPDATE events SET category_id = 'learning'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(workshop|class|lecture|seminar|webinar|tutorial|training|certification|course|101|lessons?)\M'
      OR title ~* '\m(tech help|coding|sewing|writing|welding|stained glass|3d printing|makerspace|open build)\M'
      OR title ~* '\m(blacksmith|forging|calligraphy|journal making|leather making|knitting|ChatGPT|Windows|eBay|intro to)\M'
      OR title ~* '\m(masterclass|demo day|film festival|film screening|screening of)\M'
      OR tags && ARRAY['workshop', 'class', 'educational', 'lecture', 'professional-development', 'seminar']
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → learning: %', cnt;

  -- Fitness signals (expanded: bocce, tennis, turf burn, serve & social)
  UPDATE events SET category_id = 'fitness'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(yoga|pilates|tai chi|martial arts|CrossFit|bootcamp|HIIT|zumba|spin|aqua fitness|swim|boxing|kickboxing|crush hour|jiu.?jitsu)\M'
      OR title ~* '\m(bocce|tennis|pickleball|volleyball|badminton|turf burn|serve.*social)\M'
      OR tags && ARRAY['fitness', 'yoga', 'exercise', 'gym', 'workout']
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → fitness: %', cnt;

  -- Wellness signals (expanded: Coping with Cancer, healing, ayahuasca, sound healing)
  UPDATE events SET category_id = 'wellness'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(meditation|mindfulness|health fair|support group|therapy|counseling|CPR|first aid|blood drive|mental health|wellness)\M'
      OR title ~* '\m(cancer screen|maternity|breastfeeding|infant safety|coping with|healing circle|sound healing|ayahuasca|retreat)\M'
      OR title ~* '\m(walk with a doc|prostate|mammography|sensory morning)\M'
      OR tags && ARRAY['wellness', 'meditation', 'health', 'mindfulness', 'self-care']
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → wellness: %', cnt;

  -- Words signals (expanded: Roswell Reads, in conversation with)
  UPDATE events SET category_id = 'words'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(book club|poetry|author|storytelling|literary|reading group|book fair|book fest)\M'
      OR title ~* '\m(in conversation with|book tour|book salon|pen show|reads presents)\M'
      OR title ~* '\m(delve into|book swap)\M'
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → words: %', cnt;

  -- Food/drink signals (expanded: farmers market misspelling, paella, chocolate)
  UPDATE events SET category_id = 'food_drink'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(farmer.?s? market|famers market|food fest|taco|bbq|chili|cook.?off|brunch market|food hall)\M'
      OR title ~* '\m(wine tasting|happy hour|beer school|tap list|paella|chocolate making|foodie|steakbar)\M'
      OR title ~* '\m(taste night|coffee pop.up|easter brunch|flower arranging)\M'
      OR tags && ARRAY['market'] AND title ~* '\m(market)\M'
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → food_drink: %', cnt;

  -- Art signals (expanded: portrait, drawing, art crawl, clough art)
  UPDATE events SET category_id = 'art'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(art walk|art stroll|art market|gallery|exhibition|studio tour|art show|portrait session|figure drawing|art afternoon)\M'
      OR title ~* '\m(art crawl|art fest|prismatic|open call.*photo)\M'
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → art: %', cnt;

  -- Music signals (expanded: Samantha Fish, Tab Benoit, Emily West)
  UPDATE events SET category_id = 'music'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(jazz|concert|live music|symphony|choir|klezmer|jam session|open mic)\M'
      OR title ~* '\m(spring concert series|jazz invitational)\M'
      OR tags && ARRAY['live-music', 'music']
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → music: %', cnt;

  -- Family signals (expanded: egg hunt, easter, lantern parade, prom, commencement)
  UPDATE events SET category_id = 'family'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(kids|children|family|preschool|camp|youth|teen|easter egg|trick.or.treat)\M'
      OR title ~* '\m(egg hunt|eggstravaganza|mother.?son dance|lantern parade|prom|commencement|graduation)\M'
      OR title ~* '\m(little acorns|easter bunny|back to school)\M'
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → family: %', cnt;

  -- Sports signals (expanded: dance competition, skating)
  UPDATE events SET category_id = 'sports'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(car show|gun show|dog show|horse show|5k|marathon|golf tournament|olympics|basketball league)\M'
      OR title ~* '\m(dance competition|dance regionals|athletic championships)\M'
      OR tags && ARRAY['sports']
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → sports: %', cnt;

  -- Religious signals
  UPDATE events SET category_id = 'religious'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(worship|prayer|easter sunrise|passover|seder|shabbat|chapel|bible study|church service)\M'
      OR title ~* '\m(kabbalah|eid celebration|convocation|baccalaureate)\M'
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → religious: %', cnt;

  -- Nightlife signals (game night at bars, bingo at bars, D&D at bars, speed dating)
  UPDATE events SET category_id = 'nightlife'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(speed dating|dating game|poker night|battle of the bartenders)\M'
      OR title ~* '\m(game night|bingo night|bingo)\M' AND tags && ARRAY['21+']
      OR title ~* '\m(D&D|DnD|warhammer|MTG commander|MTG pauper)\M'
      OR title ~* '\m(skate night|block party|day.party)\M'
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → nightlife: %', cnt;

  -- Film signals (movie night, screening)
  UPDATE events SET category_id = 'film'
  WHERE category_id = 'community' AND start_date >= CURRENT_DATE AND is_active = true
    AND (
      title ~* '\m(movie night|movies by moonlight|film screening)\M'
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  title signal → film: %', cnt;

  -- -------------------------------------------------------
  -- 4c. SWEEP: remaining non-civic community events → unknown
  -- -------------------------------------------------------
  -- Civic sources and civic-signaled events stay as community.
  -- Everything else that wasn't caught above → unknown (held from feed).

  UPDATE events SET category_id = 'unknown'
  WHERE category_id = 'community'
    AND start_date >= CURRENT_DATE
    AND is_active = true
    -- Preserve community for civic-focused sources
    AND source_id NOT IN (
      SELECT id FROM sources WHERE slug IN (
        -- Volunteer / nonprofit
        'hands-on-atlanta', 'habitat-for-humanity-atlanta', 'atlanta-community-food-bank',
        'open-hand-atlanta', 'keep-atlanta-beautiful', 'aclu-georgia',
        'atlanta-mission', 'medshare', 'trees-atlanta', 'concrete-jungle',
        'pebble-tossers', 'second-helpings-atlanta', 'empowerline',
        'city-of-refuge', 'salvation-army-atl', 'big-brothers-big-sisters-atl',
        'fair-count', 'atlanta-dsa', 'mobilize-us', 'marta-army',
        'common-cause-georgia', 'indivisible-atl', 'civic-innovation-atl',
        'georgia-equality', 'warrior-alliance', 'vetlanta', 'atlvets',
        'wrcdv',                    -- DV awareness (civic/advocacy)
        -- Government / civic
        'atlanta-city-planning', 'atlanta-city-meetings', 'marta-board',
        'georgia-general-assembly', 'georgia-ethics-commission',
        'fulton-county', 'fulton-county-meetings', 'dekalb-county-meetings',
        'atlanta-public-schools', 'atlanta-public-schools-board',
        'dekalb-county-schools', 'cobb-county-schools', 'gwinnett-county-schools',
        'decatur-city', 'college-park-city', 'kennesaw-city', 'snellville-city',
        'lawrenceville-city', 'acworth-city', 'roswell-city', 'duluth-city',
        'beltline', 'piedmont-auxiliary', 'college-park-main-street',
        'lwv-atlanta', 'lwv-atlanta-fulton',
        -- Neighborhood associations
        'ormewood-park-neighborhood', 'peoplestown-neighborhood',
        'mechanicsville-neighborhood', 'vine-city-neighborhood',
        'east-lake-neighborhood', 'west-end-neighborhood',
        -- Animal rescue (civic/volunteer nature)
        'furkids', 'lifeline-animal-project', 'paws-atlanta', 'atlanta-humane-society',
        -- Parks conservancies (civic/volunteer nature)
        'grant-park-conservancy', 'park-pride', 'autrey-mill',
        'chastain-park-conservancy',
        -- Community festivals (genuinely community events)
        'atlanta-pride', 'atlanta-caribbean-carnival', 'juneteenth-atlanta',
        'atlanta-streets-alive', 'inman-park-festival', 'candler-park-fall-fest',
        'east-atlanta-strut', 'l5p-halloween', 'virginia-highland-summerfest',
        'canton-street-roswell', 'big-shanty-festival', 'beltline-lantern-parade',
        'canton-riverfest', 'dogwood-festival', 'brookhaven-cherry-blossom',
        'conyers-cherry-blossom', 'lilburn-daze', 'duluth-fall-festival',
        'decatur-beach-party', 'decatur-watchfest', 'geranium-festival',
        'suwanee-arts-festival', 'cumming-country-fair', 'chomp-and-stomp',
        'stone-mountain-highland-games', 'atlanta-greek-festival',
        'atlanta-greek-picnic', 'atlanta-korean-festival',
        'johns-creek-diwali', 'stone-mountain-latino-fest',
        'atlanta-christkindl-market', 'lake-lanier-oktoberfest',
        'pigs-and-peaches-bbq', 'dahlonega-gold-rush-days',
        'dahlonega-arts-wine', 'blue-ridge-trout-fest',
        'snellville-days-festival', 'culture-collision',
        'north-georgia-state-fair', 'gwinnett-county-fair',
        'cherry-blossom-festival-macon', 'native-american-festival-and-pow-wow',
        -- College events (campus community)
        'spelman-college', 'clark-atlanta', 'morehouse-college',
        -- Community centers with mixed programming (keep as community)
        'mjcca', 'roswell365', 'city-springs', 'cobb-parks-rec',
        'atlanta-recurring-social', 'atlanta-botanical-garden',
        'stone-mountain-park', 'avalon-alpharetta',
        'pittsburgh-yards', 'lindbergh-city-center',
        'oakland-cemetery', 'ponce-city-market', 'atlantic-station',
        'krog-street-market', 'l5p-community-center', 'pullman-yards',
        'central-presbyterian', 'chabad-intown', 'boggs-social',
        'oddities-museum', 'neighbors-pub', 'callanwolde',
        'stone-mountain-christmas', 'garden-lights-holiday-nights',
        -- Convention centers (B2B events already moved to atlanta-business in Step 2d;
        -- remaining consumer events stay community, title signals catch specifics)
        'gwcc', 'gicc', 'cobb-galleria', 'atlanta-expo-centers',
        -- Consumer hobby/home shows (genuine community shopping events)
        'scott-antique-markets', 'blade-show', 'stamp-scrapbook-expo',
        'southeastern-stamp-expo', 'front-row-card-show-atlanta',
        'ga-mineral-society-show', 'atlanta-home-show',
        'atlanta-home-and-remodeling-show'
      )
    )
    -- Preserve community for events with civic title signals
    AND NOT (
      title ~* '\m(volunteer|meeting|council|board|hearing|town hall|civic|cleanup|beautif|drive|fundraiser|gala|benefit|neighborhood|association|NPU|committee|march|rally|protest|advocacy|organizing)\M'
      OR tags && ARRAY['volunteer', 'civic', 'government', 'nonprofit', 'fundraiser', 'community-service']
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  total_reclassified := total_reclassified + cnt;
  RAISE NOTICE '  remaining ambiguous → unknown: %', cnt;

  RAISE NOTICE 'Total events reclassified: %', total_reclassified;
END $$;

-- Safety: force trigger on any unknown events that slipped through
UPDATE events SET title = title
WHERE category_id = 'unknown' AND is_feed_ready = true AND start_date >= CURRENT_DATE;
