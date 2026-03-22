# Crawler Pipeline Architecture: Profile-First Design

**Date:** 2026-03-21
**Status:** Approved design, pending implementation plan
**Surface:** Infrastructure (crawlers pipeline)

---

## Problem Statement

The crawler fleet has grown to 1,086 Python source files serving 1,000+ sources. Three structural problems threaten scale and quality:

1. **48% of crawlers use Playwright** (full browser) when most sites don't require JS rendering. This caps throughput at 2 concurrent workers and ~200MB RAM per browser instance.
2. **50+ enrichment scripts** exist because crawlers don't capture all data on first pass. Each script represents a crawler failure that recurs every crawl cycle.
3. **The insert path is a synchronous god function** (2,272 lines, 58 functions) that chains validation, dedup, venue resolution, tag inference, genre normalization, series linking, TMDB lookups, Spotify lookups, and blurhash generation — all blocking before a record is written.

Additionally: city is hardcoded as Atlanta in 1,036 files, health monitoring exists but has no alerting, and the multi-entity pipeline (programs, exhibitions, specials) exists at the schema level but is underutilized at the crawler level.

## Design Goals

- **Comprehensive:** Every crawl pass captures all available signal — events, programs, exhibitions, specials, venue metadata, hours — in one pass across all declared entity lanes.
- **Accurate:** LLM extraction adapts to site changes without per-source selector maintenance. Validation rejects bad data loudly. Health monitoring surfaces degradation proactively.
- **Efficient:** Static HTTP by default (not Playwright). Fast insert path (no external service calls inline). Async enrichment queue for TMDB/Spotify/series linking. 8+ concurrent workers instead of 2.

## Non-Goals

- Rewriting the Supabase data layer or API routes
- Building a new admin UI for crawler management (existing crawl_logs + new health reports suffice)
- Migrating all 1,086 legacy crawlers in a single sprint (migration is ongoing, not big-bang)

---

## Architecture

### Pipeline Flow

```
Source Profile (YAML)
    ↓
Pipeline Runner
    ↓
Fetch Layer (static HTTP by default, Playwright only if declared)
    ↓
Parse Layer (LLM extraction by default, custom parser if declared)
    ↓
Entity Router (routes to declared lanes from entity_lanes.py — see Entity Lane Model)
    ↓
Discovery Phase → Detail Phase (list page → per-item detail pages, when configured)
    ↓
Fast Insert (validate → sanitize → dedup → resolve_venue → infer_tags → infer_genres → write)
    ↓
Async Enrichment Queue (TMDB, Spotify, blurhash, Google Places images)
```

**Note on two-phase crawling:** Many sources require a list page crawl (discovery) followed by per-event detail page fetches (enrichment). The existing `pipeline_main.py` already handles this via `discover_from_list` → `enrich_from_detail`. The v2 pipeline preserves this two-phase model. The `fetch.urls` in the profile are discovery URLs; the pipeline follows detail links per-item when `detail.enabled: true`.

### Key Decisions

- **Profile-driven pipeline is the single execution path.** Every source is a YAML profile. Custom Python files exist only for sources that genuinely need procedural logic (paginated APIs, auth flows, multi-page crawls).
- **LLM extraction is the default parser.** Not a fallback — the workhorse. It handles the long tail of HTML structures without per-source selectors that break when sites change.
- **Static HTTP is the default fetch method.** Playwright is declared explicitly per-profile, only for sources that genuinely require JS rendering.
- **Fast insert, async enrichment.** The insert path keeps all fast local computations inline (validation, sanitization, category normalization, venue resolution, tag/genre inference, show signals, field metadata). Only external API calls (TMDB, Spotify, Google Places) and expensive derived work (blurhash) move to the async queue.
- **Multi-entity by default.** Profiles declare which entity lanes they produce, using the canonical lane types from `entity_lanes.py`. One crawl pass, multiple entity types routed to their respective tables.
- **City is explicit in every profile.** No hardcoded Atlanta assumption. Multi-city expansion is a batch of profiles.
- **Per-domain concurrency limits.** The worker pool ensures no two concurrent workers fetch from the same domain. Domain-keyed semaphore prevents rate limiting and IP bans from target websites.

---

## Source Profile Schema (v2)

```yaml
version: 2
slug: terminal-west
name: Terminal West
city: atlanta
portal_id: null  # null = public, or specific portal UUID

fetch:
  method: static  # static | playwright | api
  urls:
    - https://terminalwestatl.com/events
  # playwright-only:
  wait_for: null
  scroll: false

parse:
  method: llm  # llm | jsonld | api_adapter | custom
  # custom-only:
  module: null  # e.g. "sources.terminal_west"
  # api_adapter-only:
  adapter: null  # e.g. "aeg", "ticketmaster", "eventbrite", "activenet"

entity_lanes:
  - events
  - destination_details
  # Full canonical list from entity_lanes.py:
  # destinations, destination_details, events, programs, exhibitions,
  # open_calls, volunteer_opportunities, venue_features, venue_specials,
  # editorial_mentions, venue_occasions

venue:
  name: Terminal West
  address: "887 W Marietta St NW, Atlanta, GA 30318"
  neighborhood: Westside
  venue_type: music_venue
  website: https://terminalwestatl.com

defaults:
  category: music
  tags: [music, live-music, concert]

schedule:
  frequency: daily  # daily | weekly | biweekly | monthly
  priority: high    # high | normal | low
```

### Changes from v1 profiles

| Field | v1 | v2 | Why |
|-------|----|----|-----|
| `city` | Implicit (hardcoded in Python) | Explicit, required | Multi-city expansion |
| `fetch.method` | Detected at import time via source code scan | Declared in profile | Kills `_classify_sources()` hack, enables static-first default |
| `parse.method` | Implicit (Python file = custom) | Declared, `llm` is default | LLM extraction as workhorse, not fallback |
| `entity_lanes` | `data_goals` (informal) | Explicit list using canonical `entity_lanes.py` types | Pipeline only routes to declared lanes; enables first-pass completeness validation |
| `schedule.priority` | Not present | `high / normal / low` | Influences worker allocation and triage ordering |
| `module` | Implicit from filename | Only present when `parse.method: custom` | Kills `SOURCE_OVERRIDES` dict |
| `venue` block | In Python `VENUE_DATA` dict | In profile | First-pass venue metadata without code |

### Migration path for legacy crawlers

An agent generates a v2 profile from an existing Python crawler by reading:
- `VENUE_DATA` dict → `venue` block
- Import patterns (Playwright vs requests) → `fetch.method`
- Output structure → `entity_lanes`
- Category/tag defaults → `defaults`

The Python file stays as `parse.method: custom` until someone converts the parsing logic to LLM extraction. At that point the Python file is archived (not deleted — kept in `crawlers/sources/archive/` for 90 days as rollback insurance).

### v1/v2 Profile Coexistence

791 v1 profiles exist in production. The v2 schema has different field names (`entity_lanes` vs `data_goals`, `fetch.method` vs `integration_method`, etc.). Both must work during migration.

**Approach:** Version-aware loader in `pipeline/loader.py` normalizes v1 profiles into v2 shape at load time. No parallel code paths — the pipeline only speaks v2 internally.

| v1 Field | v2 Equivalent | Normalization |
|----------|---------------|---------------|
| `data_goals: [events, images]` | `entity_lanes: [events, destination_details]` | Map `images` → include `destination_details` lane |
| `integration_method: html` | `fetch.method: static`, `parse.method: llm` | Unless `discovery.render_js: true` → `fetch.method: playwright` |
| `integration_method: api` | `fetch.method: api`, `parse.method: api_adapter` | Preserve `api.adapter` config |
| `discovery.urls` | `fetch.urls` | Direct copy |
| `detail.enabled` | `detail.enabled` | Preserved — drives two-phase crawling |
| `defaults` | `defaults` | Direct copy |

The `version` field determines which normalization runs. Missing `version` implies v1. Once a profile is migrated to v2, it gets `version: 2` and skips normalization.

---

## Entity Lane Model

The canonical entity lanes are defined in `entity_lanes.py` (11 lanes). All profile `entity_lanes` values must be from this list:

| Lane | Table | Description |
|------|-------|-------------|
| `destinations` | `venues` | Venue/place records |
| `destination_details` | `venue_destination_details` | Extended venue metadata (hours, images, features) |
| `events` | `events` | Temporal happenings |
| `programs` | `programs` | Structured activities (classes, camps, lessons) |
| `exhibitions` | `exhibitions` | Time-bounded art/museum exhibitions |
| `open_calls` | `open_calls` | Deadline-driven submissions/residencies |
| `volunteer_opportunities` | `volunteer_opportunities` | Civic/volunteer slots |
| `venue_features` | `venue_features` | Venue attribute tags |
| `venue_specials` | `venue_specials` | Happy hours, daily deals |
| `editorial_mentions` | `editorial_mentions` | Press/review references |
| `venue_occasions` | `venue_occasions` | Occasion suitability (date night, groups, etc.) |

The entity router reads the profile's declared lanes and only routes extracted data to those tables. Undeclared lanes are ignored even if the LLM extracts data for them.

---

## Fast Insert + Async Enrichment Queue

### Insert path (synchronous, fast)

The insert path keeps all fast, local computations inline. Only external API calls move to the async queue.

**Stays inline (fast, no external calls):**
- Validate (structural correctness — title, date, source_id)
- Sanitize (HTML decode, title case, price range, description truncation)
- Category normalization (alias resolution)
- Content hash generation + dedup lookup
- Source resolution (DB lookup, cached)
- Venue resolution (DB lookup/upsert, cached)
- Artist parsing (regex, local)
- Tag inference (rules engine, local)
- Genre inference (rules engine, local)
- Content kind inference (local)
- Show signals derivation (local)
- Field metadata derivation (local)
- Data quality flags (local)
- DB insert/upsert
- Enqueue enrichment tasks

**Moves to async queue (external API calls or expensive compute):**
- TMDB/OMDB poster fetch (film events)
- Spotify/Deezer artist images and genres (music events)
- Google Places image fetch (venues missing image_url)
- Blurhash generation (CPU-intensive image processing)
- Series linking (DB-heavy upserts that can be batched for efficiency)

Records are visible and discoverable immediately after insert — tags, genres, categories are all present. External media enrichment catches up asynchronously.

### Enrichment queue (asynchronous, after insert)

| Task | Trigger | External Service | Priority |
|------|---------|-----------------|----------|
| Series linking | Every event insert | None (DB batch upserts) | High |
| TMDB poster fetch | Film events | TMDB API | Normal |
| Spotify artist images | Music events with artists | Spotify API | Normal |
| Google Places image | Venue missing image_url | Google Places API | Normal |
| Blurhash generation | Any record with image | Local compute | Low |

### Implementation

An `enrichment_queue` table in Postgres:

```sql
create table enrichment_queue (
  id bigint generated always as identity primary key,
  entity_type text not null,  -- 'event', 'program', 'exhibition', 'venue'
  entity_id uuid not null,
  task_type text not null,    -- 'series_linking', 'tmdb_poster', 'spotify_artist', etc.
  status text not null default 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  priority int not null default 5,  -- 1=highest, 10=lowest
  attempts int not null default 0,
  max_attempts int not null default 3,
  next_retry_at timestamptz,  -- exponential backoff: null = ready now
  locked_by text,             -- worker ID claiming this task
  locked_at timestamptz,      -- when claimed (stale lock detection: >10min = abandoned)
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create index idx_enrichment_queue_pending on enrichment_queue (priority, created_at)
  where status = 'pending' and (next_retry_at is null or next_retry_at <= now());
```

**Worker design:**
- Claims tasks via `SELECT ... WHERE status='pending' AND (next_retry_at IS NULL OR next_retry_at <= now()) ORDER BY priority, created_at LIMIT 10 FOR UPDATE SKIP LOCKED`
- Runs after each crawl batch as a post-crawl step, and also on a separate 5-minute polling schedule for retry processing
- Retry backoff: 1min → 5min → 30min (exponential). After `max_attempts`, status = `failed`
- Stale lock detection: any task locked for >10 minutes is reclaimed
- Queue depth monitoring: if pending count >1,000, log warning in health report

---

## Playwright Migration Sprint

### Problem

521 of 1,086 crawlers use Playwright. At 2 concurrent workers and ~200MB RAM per browser, this caps throughput. Most sites serve full HTML to a static HTTP GET.

### Sprint process (per crawler)

1. Fetch the source URL with `httpx` (static HTTP)
2. Compare: does the static response contain the same event data as the Playwright response?
3. If yes → convert profile to `fetch.method: static`
4. If no → check for XHR/API endpoints the page calls. If found → `fetch.method: api`
5. If genuinely JS-rendered → keep `fetch.method: playwright`, confirm in profile

### Target

521 Playwright → ~150 (genuinely JS-dependent). ~370 converted to static or API.

### Execution model

Perfectly parallelizable. Each crawler is independent. Dispatch agents in batches of 20-30. A single agent can test ~50 sources per session.

### Side benefit

Static HTTP crawlers: ~10-50x faster, ~100x less RAM, 8+ concurrent workers instead of 2. This alone roughly triples overall crawl throughput.

---

## Multi-Entity First-Pass Enforcement

### Profile-level declaration

The `entity_lanes` field declares what a source should produce. If a source's website has events, hours, specials, and programs, the profile declares all four lanes.

### Pipeline-level validation

After a crawl run, the pipeline compares declared lanes against actual output:
- Profile declares `venue_metadata` but crawl produced zero venue updates → warning
- Profile declares `programs` but only produced events → flagged for review
- Declared lane produced data → green

### Lane-aware LLM extraction

The LLM extraction prompt already handles `content_kind` (event/exhibition/program). Extend to also extract:
- Venue metadata (hours, description, image) when present on the page
- Specials (happy hours, daily deals) when present
- Programs (classes, camps, lessons with age ranges) when present

One LLM call, multiple entity types, routed to their respective lanes by the entity router.

### Enrichment script gate

- `crawlers/scripts/archive/` created for one-time scripts that have already run
- Existing backfill/enrich/fix/repair scripts triaged: move completed ones to archive, identify which represent ongoing crawler failures
- New scripts in `crawlers/scripts/` require justification for why the crawler can't capture the data directly

---

## Health, Alerting, and Source Quality

### Post-crawl health report

After every batch crawl, the pipeline writes a summary to `crawl_health_reports` in Supabase:
- Sources that returned 0 events (expected vs actual based on baseline)
- Sources where event count dropped >50% from rolling baseline
- Sources that errored (classified: network, parse, auth, rate_limit, timeout)
- Sources where declared entity lanes produced nothing
- Feed-readiness gate failures

### Source quality score

Each source gets a rolling score (0-100). Formula:

```
score = (
    run_success_score     * 0.30  +  # 0-100: consecutive successes (100 = 5+ in a row, -20 per failure)
    yield_stability_score * 0.25  +  # 0-100: abs(actual - baseline) / baseline, inverted (100 = within 10%)
    lane_completeness     * 0.20  +  # 0-100: % of declared entity lanes that produced data
    rejection_rate_score  * 0.15  +  # 0-100: 100 - (rejected / total * 100)
    freshness_score       * 0.10     # 0-100: days since last success (100 = today, -10/day, floor 0)
)
```

**Baseline calibration:** Event yield baseline is the rolling 30-day median for each source. New sources (< 5 runs) get a grace period — no yield stability penalty until baseline is established.

**Thresholds (calibrate empirically after 2 weeks of data collection):**
- Score < 40 → auto-flagged for triage (initial threshold, adjust based on score distribution)
- Score < 20 → auto-deactivated (extends existing `detect_zero_event_sources()`)
- Auto-deactivation is disabled until the scoring system has run for 14 days and thresholds are validated against the actual score distribution

### Alerting

After health report writes, check for P0 conditions:
- >5 sources newly broken in one run
- Any high-priority source down
- Fleet-wide event yield dropped >20%

Write to `system_alerts` table. Admin dashboard surfaces these. No external notification service initially — just make the data visible and queryable.

### Scheduled checks

- Hardcoded date detection: flag sources with dates within 90 days of expiry
- Stale source detection: sources not crawled in >14 days despite being active
- Profile drift: sources where Python module and YAML profile disagree on venue data

---

## LLM Extraction: Economics, Caching, and Multi-Entity Strategy

### Cost model

At ~$0.01-0.03 per extraction call (Haiku-class model with ~2-4K token HTML context):
- 1,000 daily sources = $10-30/day = $300-900/month
- With extraction caching (see below), effective cost drops 50-80% for sources that update infrequently

This is acceptable relative to the maintenance cost of 1,000+ custom parsers. A single broken selector crawler costs more engineer time to fix than a month of LLM extraction.

### Extraction caching

Before calling the LLM, hash the fetched HTML content. Check `extraction_cache` table:

```sql
create table extraction_cache (
  source_slug text not null,
  content_hash text not null,
  extraction_result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (source_slug, content_hash)
);
```

If the HTML hasn't changed since last crawl, reuse the cached extraction. This eliminates LLM calls for sources that update weekly/monthly but are crawled daily. Expected hit rate: 50-80%.

### Rate limiting

Add per-provider rate limiting in `llm_client.py`: token bucket with configurable RPM (requests per minute). Default: 60 RPM for Haiku. Burst allowance for batch crawl runs.

### Multi-entity extraction strategy

**Approach: Focused per-lane calls, not one mega-prompt.**

A single prompt extracting 5+ entity types (events, programs, exhibitions, specials, venue metadata) with different schemas is fragile and expensive (large output tokens). Instead:

1. **Primary extraction call:** Extract events/programs/exhibitions (the main content — these share similar structure). The `content_kind` field routes to the correct lane.
2. **Venue metadata extraction:** If `destination_details` or `venue_features` are in the declared lanes and the page has venue info, a second focused call extracts venue metadata (hours, description, vibes, images).
3. **Specials extraction:** If `venue_specials` is declared, a third focused call extracts specials/deals from dedicated page sections.

Most sources only declare 1-2 lanes, so most crawls make 1 LLM call. Sources declaring 3+ lanes make 2-3 focused calls. This is more reliable than a mega-prompt and easier to debug when extraction errors occur.

### Nondeterminism and dedup

LLM extraction is nondeterministic — the same HTML can produce slightly different field values between runs. To prevent phantom dedup churn:
- Content hash is computed from `(title, venue_name, start_date)` — not from the full extracted record
- The extraction cache (above) means identical HTML produces identical output, eliminating run-to-run variance for unchanged pages
- For changed pages, the dedup hash is stable because it's based on core identity fields, not description text

---

## Rollback and Recovery

### Enrichment task rollback

Enrichment tasks should be reversible. For tasks that modify existing records (series linking, tag updates), the queue worker logs the before-state:

```sql
alter table enrichment_queue add column before_state jsonb;  -- snapshot of fields before modification
```

To reverse a batch of bad enrichments: query failed/suspicious tasks, restore `before_state` values. This is a manual recovery path, not automatic rollback.

### Profile migration rollback

When a legacy Python crawler is converted to a v2 profile:
1. The Python file moves to `crawlers/sources/archive/` (not deleted)
2. The v2 profile is created alongside
3. If the v2 profile produces worse data (lower event counts, missing fields), revert by restoring the Python file and setting `parse.method: custom` in the profile

Archive retention: 90 days minimum. After 90 days of successful v2 operation, archived Python files can be deleted.

### LLM extraction quality regression

If the LLM provider updates their model and extraction quality degrades:
1. Extraction caching provides a buffer — cached results from the previous model continue serving until HTML changes
2. The health monitoring system detects fleet-wide event yield drops (>20% = P0 alert)
3. Emergency fallback: switch `parse.method` to `custom` for critical sources using their archived Python parsers
4. Long-term: pin LLM model version in `llm_client.py` config, test new versions before fleet-wide rollout

---

## Multi-City Architecture

### City in profile

Every profile declares `city`. The pipeline reads city from the profile. Legacy crawlers that hardcode city in Python `VENUE_DATA` get overridden by the profile's `city` field.

### City expansion workflow

1. Run Geographic Expansion Playbook (curators-first discovery)
2. For each discovered source: generate a v2 YAML profile with `city: nashville`, `parse.method: llm`
3. Register source row in DB
4. Pipeline fetches, LLM extracts, entities route to declared lanes
5. No Python files needed for most sources

### Nashville remediation

- Deactivate editorial aggregator crawlers (`nashville_scene.py`, `nashville_com.py`, `visit_franklin.py`, etc.)
- Expand to 40-80 profile-driven sources using LLM extraction
- Apply the same Geographic Expansion Playbook that proved out for Marietta/Decatur/College Park

### Source registration simplification

| Step | Current | New |
|------|---------|-----|
| 1 | Create Python file | Create YAML profile |
| 2 | Add DB source row | Add DB source row |
| 3 | Maybe add `SOURCE_OVERRIDES` entry | Nothing — profile is self-describing |

`SOURCE_OVERRIDES` dict dies when legacy migration reaches critical mass.

---

## Migration Strategy

### Phase ordering (dependency-based, not calendar-based)

**Track 1 — Foundation (no prerequisites, start immediately)**
- Create `enrichment_queue` table migration
- Decompose `insert_event()`: extract enrichment calls into queue-enqueue pattern
- Build enrichment worker that drains the queue
- Create `crawl_health_reports` table migration
- Wire post-crawl health report generation
- Create `scripts/archive/` and triage existing scripts

**Track 2 — Playwright Sprint (independent, parallelizable)**
- Audit all 521 Playwright crawlers: static fetch test
- Convert static-capable sources to `fetch.method: static`
- Generate v2 profiles for converted sources
- Target: 521 → ~150 Playwright

**Track 3 — Profile Pipeline (depends on Track 1 for enrichment queue)**
- Extend `pipeline_main.py` to support v2 profile schema
- Wire entity router for multi-lane extraction
- Extend LLM extraction prompt for multi-entity output (venue metadata, specials, programs)
- Build profile generation tool: reads legacy Python crawler → generates v2 YAML
- Migrate first batch of simple crawlers (static fetch + LLM parse) to profile-only

**Track 4 — Multi-City (depends on Track 3 for profile pipeline)**
- Deactivate Nashville editorial aggregator crawlers
- Run Geographic Expansion Playbook on Nashville with profile-driven sources
- Validate multi-city with 40-80 Nashville sources on new pipeline

**Track 5 — Ongoing Legacy Migration (continuous, after Track 3)**
- When a legacy crawler breaks → migrate to v2 profile instead of patching
- Batch migration sprints: agents convert crawlers in parallel
- Track progress: % of sources on v2 profiles vs legacy Python

### Immediate actions (before implementation plan)

1. Commit untracked files: `crawlers/exhibition_utils.py`, `crawlers/scripts/migrate_exhibit_events_to_exhibitions.py`
2. Deactivate editorial aggregator crawlers that violate policy: `arts_atl.py`, `artsatl.py`, `creative_loafing.py`, `discover_atlanta.py`, `access_atlanta.py`, `nashville_scene.py`, `visit_franklin.py`, `nashville_com.py`
3. Fix 8 crawlers with hardcoded 2026 dates (per `HARDCODED_DATES_TODO.md`)

---

## Success Criteria

**30 days:**
- Enrichment queue operational, `insert_event()` no longer calls external services inline
- Playwright audit complete, 300+ sources converted to static
- Health reports writing to Supabase after every crawl batch
- All 292 scripts categorized: (a) already-run-once → archived, (b) active-enrichment-covering-crawler-gap → tracked as debt with linked source slugs, (c) operational-utility → kept

**60 days:**
- v2 profile schema finalized and pipeline supporting it end-to-end
- 200+ sources running on profile-driven pipeline with LLM extraction
- Multi-entity extraction producing programs + exhibitions + venue metadata from single crawl passes
- Source quality scores visible, auto-flagging operational

**90 days:**
- Nashville expanded to 40-80 sources via profile pipeline
- 50%+ of fleet on v2 profiles
- `SOURCE_OVERRIDES` reduced from 90 → <20 entries
- Last enrichment script run was for a legitimate exception, not a crawler failure
- Fleet-wide Playwright usage <15%
