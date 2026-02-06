# Crawler Architecture v3

This document defines the target crawler architecture before we rebuild the system. It focuses on extracting high-quality event details (tags, photos, descriptions, and ticket links), keeping a consistent pipeline across sources, and using LLMs only when traditional extraction fails.

## Goals
- Maximize field coverage and correctness (ticket URL, image(s), description, tags, artists).
- Standardize extraction across sources with clear phase contracts.
- Track field-level provenance and confidence for QA and ranking.
- Support daily runs with stable change detection.

## Non-goals (for v3)
- Real-time crawling or sub-hourly updates.
- Full automation for sources that are hostile to crawling.
- Eliminating all LLM use (LLM is allowed as fallback).

## Pipeline Phases
Each phase has a strict input/output contract. Later phases should not “guess” what earlier phases didn’t provide unless explicitly allowed.

1. Discovery
   - Input: source profile + list URLs or API endpoints.
   - Output: DiscoveredEvent[]
   - Required fields: source_id, title (or title_hint), start_date (or date_hint), detail_url (preferred).

2. Detail Fetch
   - Input: DiscoveredEvent[]
   - Output: FetchedDetail[]
   - Required fields: detail_url, fetched_at, status, html or json.

3. Extraction
   - Input: FetchedDetail[]
   - Output: ExtractedEvent
   - Includes: field_sources + confidence_by_field.

4. Normalization
   - Input: ExtractedEvent
   - Output: NormalizedEvent
   - Tasks: canonical URL resolution, timezone normalization, price normalization, tag mapping.

5. Entity Linking
   - Input: NormalizedEvent
   - Output: PersistableEvent (event + artists + images + links)
   - Tasks: link artists, venues, organizations, series.

6. Persist + Dedupe + Change Detection
   - Input: PersistableEvent
   - Output: DB upserts + change notifications.

7. Post-run Metrics
   - Coverage and quality metrics per source, stored as snapshots.

## Extraction Precedence
Order of trust for each field (highest first):
1. API (native source API or partner API)
2. JSON-LD (schema.org Event)
3. Microdata
4. Targeted selectors
5. OpenGraph/Twitter meta
6. Heuristic extraction
7. LLM fallback

## Source Acquisition Priority
When choosing how to onboard or refresh a source, use this order before building bespoke crawlers:
1. First-party org/venue API.
2. Aggregator APIs (Ticketmaster, Eventbrite) when the venue has no API or the aggregator data is materially better.
3. Structured feeds (ICS/RSS/ical).
4. Schema.org-only ingestion (JSON-LD Event required; skip pages without it).
5. Deterministic HTML crawlers (selectors + JSON-LD + microdata).
6. LLM-powered crawler (LLM drives discovery + extraction) for sources that cannot be parsed deterministically.
7. LLM extraction (HTML -> structured) as fallback inside deterministic crawlers.
8. Browser automation (Playwright) when content requires JS or interaction.
9. User submissions.

## Data Model (v3 Target)
Events:
- Add field_provenance JSONB (per-field source + URL + extractor)
- Add field_confidence JSONB (per-field numeric confidence)
- Add extraction_version TEXT (pipeline version for audits)

Event artists:
- event_artists(event_id, name, billing_order, role, is_headliner, created_at)

Event images:
- event_images(event_id, url, width, height, type, source, confidence, is_primary, created_at)
- Keep events.image_url as optional primary image for compatibility.

Event links:
- event_links(event_id, type, url, source, confidence, created_at)
- type: event | ticket | organizer | other

## Source Profiles
Profiles are config-first and must be deterministic. YAML or JSON allowed.

Required fields:
- version
- slug
- name
- integration_method
- discovery
- detail
- defaults
- llm_policy

Discovery types supported: list, html (LLM), api, feed (RSS/Atom/ICS).

Example:
```
version: 1
slug: the-earl
name: The Earl
integration_method: html
defaults:
  venue_name: The Earl
  category: music
  subcategory: music.live
  tags: [music, live]
discovery:
  enabled: true
  type: list
  urls:
    - https://badearl.com/show-calendar/
  event_card: ".event-card"
  fields:
    title: ".event-title"
    date: ".event-date"
    time: ".event-time"
    detail_url: "a@href"
detail:
  enabled: true
  jsonld_only: false
  selectors:
    description: ".event-description"
    ticket_url: "a:has-text('Tickets')@href"
    image_url: ".event-hero img@src"
    artists:
      - "#headliner-contain .headliner"
      - "#support-contain .support"
  use_jsonld: true
  use_open_graph: true
  use_heuristic: true
llm_policy:
  mode: fallback
  triggers:
    - missing:title
    - missing:start_date
    - missing:ticket_url
    - missing:image_url
  max_calls: 25
  max_cost_usd: 5
```

## LLM Policy
LLM is a last-ditch extraction option, unless a source is explicitly marked as LLM-required.

Modes:
- off: never call LLM.
- fallback: only when extraction quality is below thresholds.
- required: for sources that cannot be parsed deterministically.

LLM triggers:
- Missing title or date.
- Missing ticket_url or image_url.
- Low confidence on key fields.

LLM-required sources:
- Track in a registry and review separately.
- Evaluate alternative strategies regularly.

## Confidence Scoring
Confidence is per-field and derived from extractor reliability:
- API: 0.95
- JSON-LD: 0.90
- Microdata: 0.85
- Targeted selectors: 0.80
- OpenGraph/Twitter: 0.65
- Heuristic: 0.55
- LLM: 0.50 (baseline, can be adjusted)

## Quality Gates
Minimum targets before a source is migrated:
- ticket_url coverage >= 85%
- image coverage >= 75%
- description coverage >= 80%
- artist extraction accuracy >= 80% on a sample

## Scheduling
- Daily runs.
- Detail refresh on future events in a rolling window.

## Change Detection
Detect:
- Time/date changes
- Cancellations
- Ticket URL changes

On change:
- Record event update
- Notify interested users
