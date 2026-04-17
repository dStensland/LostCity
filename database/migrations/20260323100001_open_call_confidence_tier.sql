-- Add confidence tier to open_calls for source quality signal
ALTER TABLE open_calls
  ADD COLUMN IF NOT EXISTS confidence_tier TEXT
    CHECK (confidence_tier IN ('verified', 'aggregated', 'discovered'))
    DEFAULT 'discovered';

COMMENT ON COLUMN open_calls.confidence_tier IS
  'verified = crawled from issuing org, aggregated = from CaFE/EntryThingy/etc, discovered = social/newsletters/less structured';
