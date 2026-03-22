-- Extraction cache: skip LLM calls when HTML hasn't changed
-- Keyed on (source_slug, content_hash) — reuse extraction results
-- for sources that update infrequently. Expected hit rate 50-80%.

create table if not exists extraction_cache (
  source_slug text not null,
  content_hash text not null,
  extraction_result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (source_slug, content_hash)
);

comment on table extraction_cache is
  'Cache LLM extraction results keyed by HTML content hash. Reduces LLM costs 50-80%.';
