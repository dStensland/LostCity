-- Migration: 605_dedup_network_sources.sql
-- Date: 2026-04-16
-- Purpose: Deduplicate network_sources pairs and consolidate posts.
--
-- Rough Draft Atlanta was registered twice:
--   id=1  slug=rough-draft-atlanta       (canonical, 395 posts)
--   id=39 slug=rough-draft-atlanta-civic (duplicate, 338 posts)
--
-- The Atlanta Voice was registered twice:
--   id=25 slug=the-atlanta-voice (canonical, 86 posts)
--   id=40 slug=atlanta-voice     (duplicate, 86 posts)
--
-- Pre-dedup overlap:
--   Rough Draft:    334/338 dup posts matched canonical by url/guid; 4 unique migrated
--   Atlanta Voice:  86/86 dup posts matched canonical; 0 unique migrated
--
-- Action:
--   1. Delete conflicting (url-duplicate) posts from dup sources
--   2. Reassign remaining unique posts to canonical sources
--   3. Deactivate dup source records
--
-- Note on re-duplication risk:
--   The dup slugs (rough-draft-atlanta-civic, atlanta-voice) differ from canonical slugs.
--   If the RSS crawler is slug-keyed, deactivating these records prevents re-registration
--   only if the crawler looks up by slug before inserting. Recommend adding a
--   UNIQUE(name, portal_id) or UNIQUE(slug) constraint on network_sources to enforce
--   this at the DB level. Not applied in this migration — evaluate separately.

BEGIN;

-- Step 1: Delete source-39 (rough-draft-atlanta-civic) posts that duplicate source-1
DELETE FROM network_posts np39
WHERE np39.source_id = 39
  AND EXISTS (
    SELECT 1 FROM network_posts np1
    WHERE np1.source_id = 1 AND np1.url = np39.url
  );

-- Step 2: Reassign remaining unique source-39 posts to canonical source-1
UPDATE network_posts SET source_id = 1 WHERE source_id = 39;

-- Step 3: Delete source-40 (atlanta-voice) posts that duplicate source-25
DELETE FROM network_posts np40
WHERE np40.source_id = 40
  AND EXISTS (
    SELECT 1 FROM network_posts np1
    WHERE np1.source_id = 25 AND np1.url = np40.url
  );

-- Step 4: Reassign remaining unique source-40 posts to canonical source-25 (0 expected)
UPDATE network_posts SET source_id = 25 WHERE source_id = 40;

-- Step 5: Deactivate duplicate source records
UPDATE network_sources SET is_active = false WHERE id IN (39, 40);

COMMIT;

-- Verification query (run after applying):
-- SELECT id, name, slug, is_active,
--        (SELECT COUNT(*) FROM network_posts WHERE source_id = ns.id) AS post_count
-- FROM network_sources ns WHERE id IN (1, 25, 39, 40);
-- Expected: id=1 → 399 posts, id=25 → 86 posts, id=39 → 0 posts (inactive), id=40 → 0 posts (inactive)
