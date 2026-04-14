# Crawler Architecture v3

This document defines the crawler architecture against the live LostCity data
model, not the legacy one. The goal is not just to "find events", but to move
the right information into the right tables with quality signals that support
ranking, portal isolation, and downstream presentation.

## Goals
- Maximize future-facing coverage and correctness, not lifetime row counts.
- Move data into the correct entity lane: `events`, `series`, `venues`,
  `venue_specials`, `programs`, `exhibitions`, opportunity lanes, and festival
  structures.
- Treat destinations as first-class product data. A venue can be healthy and
  valuable even when it has zero upcoming events if it helps people decide
  where to meet, eat, stay, gather before/after, or support regular hangs.
- Standardize extraction across sources with clear phase contracts.
- Track field-level provenance, confidence, and `data_quality` for QA and ranking.
- Preserve portal attribution via `sources.owner_portal_id` and `events.portal_id`.
- Support daily runs with stable change detection and source health feedback.

## Non-goals (for v3)
- Real-time crawling or sub-hourly updates.
- Full automation for sources that are hostile to crawling.
- Eliminating all LLM use (LLM is allowed as fallback).

## Current Model Alignment

The crawler system is constrained by the current live schema and write path:

- `events.category_id` is the canonical category column.
  `category` remains an input alias only.
- `events.content_kind` distinguishes `event` from `exhibit`.
  Permanent attractions are not events.
- `venue_specials` is the correct home for operating offers, happy hours, and
  recurring deals. Do not model them as `content_kind='special'` events.
- `venues` carry destination metadata such as `hours`, `image_url`,
  `location_designator`, and `planning_notes`.
- Destination usefulness is broader than event calendars. Parking notes,
  transit/walkability context, reservation friction, accessibility details, and
  allergy-sensitive planning guidance are all part of product quality when the
  source and schema support them.
- `sources` are coverage units. `owner_portal_id`, `health_tags`,
  `expected_event_count`, `active_months`, and `last_crawled_at` are part of
  the operating model, not optional bookkeeping.
- `field_provenance`, `field_confidence`, `extraction_version`, and
  `data_quality` are first-class quality signals.
- `series` and festival hierarchy should absorb recurring and structural
  repetition instead of emitting duplicate flat events.

## Pipeline Phases
Each phase has a strict input/output contract. Later phases should not guess
what earlier phases did not provide unless explicitly allowed.

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
   - Tasks: canonical URL resolution, timezone normalization, price normalization,
     `category_id` mapping, `content_kind` inference, and destination-vs-event separation.

5. Entity Linking
   - Input: NormalizedEvent
   - Output: Persistable payloads for `events`, `series`, `venues`, `event_artists`,
     `event_images`, `event_links`, and any additional typed entity lanes emitted
     by the source
   - Tasks: link artists, venues, organizations, series, and portal/source attribution.

6. Persist + Dedupe + Change Detection
   - Input: Persistable payloads
   - Output: DB upserts + change notifications.
   - Tasks: content hash dedupe, smart merge, quality scoring, and source health updates.

7. Post-run Metrics
   - Coverage and quality metrics per source, venue class, and portal scope.

## Entity Lanes

Use the storage lane that matches the user-visible contract:

- `events`: dated happenings that belong in the feed.
- ~~`events` + `content_kind='exhibit'`~~: **DEPRECATED.** See note below.
- `series`: recurring classes, weekly shows, festival programs, film runs.
- `programs`: structured enrollment-based activities with registration state.
- `exhibitions`: exhibition runs that deserve independent identity beyond event cards.
  **All exhibitions must be created in this table** (via `exhibition_utils.py`),
  never as events with `content_kind='exhibit'`. Events related to an exhibition
  (opening nights, artist talks) should set `exhibition_id` to link to the parent
  exhibition record. `content_kind='exhibit'` is filtered from all event feeds.
- `destination_details`: reusable destination-intelligence extensions for drive
  time, commitment, conditions fit, and practical planning.
- concrete opportunity tables: deadline- or commitment-driven actionables such
  as `open_calls` and `volunteer_opportunities`.
- `venue_specials`: happy hours, recurring food/drink deals, operational promos.
- `venues`: destination metadata, planning metadata, and map/discovery completeness.
- destination-attached features: durable things you can do, see, or experience at
  a place that should not be flattened into feed events.

Healthy coverage therefore has two parallel outputs:

- feed health: events/exhibits/series users can attend
- destination health: places users can choose before, after, or instead of an event
- typed-entity health: programs, exhibitions, destination details, concrete
  opportunity families, and destination features represented in their correct
  storage lane instead of event-shaped fallbacks

Coverage work that ignores these boundaries creates noise, dedupe failures, and
bad feed quality.

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

## Editorial Curator Policy
- Editorial calendars and tourism boards are discovery-only inputs, not canonical ingestion sources.
- Examples: Discover Atlanta, Access Atlanta, ArtsATL, Creative Loafing, Nashville Scene, Time Out, tourism-board event calendars.
- Allowed use: identify missing venues, organizers, festivals, and metadata/UI patterns we should support.
- Disallowed use: storing curator detail URLs as `source_url`, treating curator copies as authoritative event records, or using them to outrank direct venue/organizer sources in dedupe.
- Narrow exception: ticketing and registration platforms such as Ticketmaster and Eventbrite remain allowed when they materially improve coverage for venues without first-party calendars.

## Data Model (Live Contract)

Events:
- `category_id` is canonical.
- `content_kind` must be explicitly correct for museum/gallery sources.
- `field_provenance`, `field_confidence`, `extraction_version`, and `data_quality`
  should be populated whenever possible.
- `portal_id` should be inherited from `sources.owner_portal_id` or set explicitly.

Event artists:
- `event_artists(event_id, name, billing_order, role, is_headliner, created_at)`

Event images:
- `event_images(event_id, url, width, height, type, source, confidence, is_primary, created_at)`
- Keep `events.image_url` as optional primary image for compatibility.

Event links:
- `event_links(event_id, type, url, source, confidence, created_at)`
- `type`: `event`, `ticket`, `organizer`, `other`

Venues:
- Treat `website`, `image_url`, `hours`, `location_designator`, and
  `planning_notes` as part of destination quality, not optional nice-to-haves.

Venue specials:
- Use `venue_specials` for deals and operational recurring offers.
- Coverage quality for hotel/concierge surfaces depends on this table as much as
  the event feed.

Typed entity outputs:
- The crawler contract should increasingly classify extracted records into
  explicit typed payload lanes instead of assuming every row becomes an event.
- Near-term target lanes: `events`, `programs`, `exhibitions`,
  `destination_details`, concrete opportunity tables, `venue_specials`, and
  destination-attached feature/enrichment lanes.

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

Coverage gates beyond source extraction:
- `category_id` should be populated on essentially all visible future events.
- Museum/gallery crawlers must separate `event` vs `exhibit` correctly.
- New sources should improve future active coverage, not just backfill historical rows.
- Venue metadata hydration should be tracked alongside event extraction quality.

## Operating Loop

High-quality coverage should follow this order:

1. Fix source acquisition and write-path failures.
2. Fix entity classification (`category_id`, `content_kind`, series, portal attribution).
3. Hydrate destination metadata on `venues`.
4. Hydrate `venue_specials` where the portal surface benefits from them.
5. Run quality audits against future active inventory and source health.

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
