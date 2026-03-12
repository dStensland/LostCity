-- Editorial Mentions + Occasion Taxonomy
-- Aggregates restaurant/venue reviews from editorial publications (Eater, Infatuation, Rough Draft, Atlanta Eats)
-- and builds LostCity's own "Perfect For" occasion classification on venues.
-- Part of the Destinations-as-first-class-citizen initiative.

-- ─── 1. editorial_mentions ───────────────────────────────────────────────────
-- Tracks when a venue appears in a curated editorial publication.
-- We store a link and syndication-safe snippet only — we do not reproduce content.
-- venue_id is nullable: we may ingest an article before the venue is matched.
-- article_url is the dedup key.

CREATE TABLE IF NOT EXISTS editorial_mentions (
  id             SERIAL PRIMARY KEY,
  venue_id       INT REFERENCES venues(id) ON DELETE CASCADE,
  source_key     TEXT        NOT NULL,
  article_url    TEXT        NOT NULL,
  article_title  TEXT        NOT NULL,
  mention_type   TEXT        NOT NULL DEFAULT 'feature',
  published_at   TIMESTAMPTZ,
  guide_name     TEXT,
  snippet        TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT editorial_mentions_source_key_check CHECK (
    source_key IN (
      'eater_atlanta',
      'infatuation_atlanta',
      'rough_draft_atlanta',
      'atlanta_eats'
    )
  ),

  CONSTRAINT editorial_mentions_mention_type_check CHECK (
    mention_type IN (
      'review',
      'guide_inclusion',
      'best_of',
      'opening',
      'closing',
      'feature'
    )
  ),

  CONSTRAINT editorial_mentions_snippet_length CHECK (
    snippet IS NULL OR length(snippet) <= 500
  ),

  UNIQUE (article_url)
);

-- Venue detail page: all active mentions for a given venue
CREATE INDEX IF NOT EXISTS idx_editorial_mentions_venue_id
  ON editorial_mentions(venue_id)
  WHERE is_active = true;

-- "Just reviewed" feed section: recent articles with a matched venue
CREATE INDEX IF NOT EXISTS idx_editorial_mentions_published
  ON editorial_mentions(published_at DESC)
  WHERE is_active = true AND venue_id IS NOT NULL;

-- Source-specific queries (e.g. "show all Eater picks")
CREATE INDEX IF NOT EXISTS idx_editorial_mentions_source
  ON editorial_mentions(source_key);

-- Auto-update updated_at on row change
CREATE TRIGGER update_editorial_mentions_updated_at
  BEFORE UPDATE ON editorial_mentions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── 2. venue_occasions ──────────────────────────────────────────────────────
-- LostCity's "Perfect For" classification on venues.
-- confidence: 1.0 = editorial/manual, 0.5–0.8 = inferred from tags/attributes.
-- source: 'manual' (curator-set), 'inferred' (pipeline), 'editorial' (from a mention).
-- One row per (venue_id, occasion) — UNIQUE enforces no duplicate tags per venue.

CREATE TABLE IF NOT EXISTS venue_occasions (
  id          SERIAL PRIMARY KEY,
  venue_id    INT         NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  occasion    TEXT        NOT NULL,
  confidence  DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  source      TEXT        NOT NULL DEFAULT 'manual',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT venue_occasions_occasion_check CHECK (
    occasion IN (
      'date_night',
      'groups',
      'solo',
      'outdoor_dining',
      'late_night',
      'quick_bite',
      'special_occasion',
      'beltline',
      'pre_game',
      'brunch',
      'family_friendly',
      'dog_friendly',
      'live_music'
    )
  ),

  CONSTRAINT venue_occasions_source_check CHECK (
    source IN ('manual', 'inferred', 'editorial')
  ),

  CONSTRAINT venue_occasions_confidence_range CHECK (
    confidence >= 0.0 AND confidence <= 1.0
  ),

  UNIQUE (venue_id, occasion)
);

-- "Perfect For" filter: find all venues for a given occasion
CREATE INDEX IF NOT EXISTS idx_venue_occasions_occasion
  ON venue_occasions(occasion);

-- Venue detail page: all occasions for a given venue
CREATE INDEX IF NOT EXISTS idx_venue_occasions_venue
  ON venue_occasions(venue_id);
