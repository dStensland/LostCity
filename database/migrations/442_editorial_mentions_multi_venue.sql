-- Migration: Allow multiple venue matches per editorial article
--
-- The original UNIQUE(article_url) constraint meant a "Best 14 Restaurants"
-- article could only link to ONE venue. This changes it to UNIQUE(article_url, venue_id)
-- so each venue mentioned in an article gets its own row.
-- Unmatched articles (venue_id IS NULL) get a partial unique index to prevent dupes.

-- Drop the old single-column unique constraint
ALTER TABLE editorial_mentions DROP CONSTRAINT IF EXISTS editorial_mentions_article_url_key;

-- Add composite unique: one row per (article, venue) pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_editorial_mentions_article_venue
  ON editorial_mentions(article_url, venue_id);

-- Prevent duplicate unmatched articles (venue_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_editorial_mentions_article_unmatched
  ON editorial_mentions(article_url)
  WHERE venue_id IS NULL;
