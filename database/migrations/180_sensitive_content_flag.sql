-- Migration 180: Add is_sensitive flag for privacy-first content
-- Support groups, recovery meetings, and other sensitive content
-- that should only surface in approved privacy-first portals.

-- Add is_sensitive to sources (marks entire source as sensitive)
ALTER TABLE sources ADD COLUMN IF NOT EXISTS is_sensitive boolean DEFAULT false;

-- Add is_sensitive to events (inherited from source, or set per-event)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_sensitive boolean DEFAULT false;

-- Mark existing support group sources as sensitive
UPDATE sources SET is_sensitive = true WHERE slug IN (
    'aa-atlanta',
    'griefshare-atlanta',
    'divorcecare-atlanta',
    'na-georgia'
);

-- Index for efficient filtering (most queries filter out sensitive content)
CREATE INDEX IF NOT EXISTS idx_events_is_sensitive ON events (is_sensitive) WHERE is_sensitive = true;
CREATE INDEX IF NOT EXISTS idx_sources_is_sensitive ON sources (is_sensitive) WHERE is_sensitive = true;

COMMENT ON COLUMN sources.is_sensitive IS 'Source produces sensitive content (support groups, recovery). Events inherit this flag and are excluded from public feeds.';
COMMENT ON COLUMN events.is_sensitive IS 'Sensitive content excluded from public feeds. Only shown in approved privacy-first portals with no analytics/tracking.';
