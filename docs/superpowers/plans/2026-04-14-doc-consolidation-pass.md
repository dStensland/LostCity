# Doc Consolidation Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate doc drift between agent-facing strategy/best-practice documentation and the actual shipped architecture, and consolidate authority so future drift is harder.

**Architecture:** Six phases applied in order: (1) surgical CLAUDE.md fixes for concrete drift, (2) north-star refresh, (3) top-level root doc triage and archive, (4) shipped plans archived, (5) agent definition refresh, (6) verification grep + final commit. Each phase produces one or two atomic commits. Reads and edits are done in-place; deletes never happen — stale docs get moved to an `archive/` subfolder with a header note.

**Tech Stack:** Markdown only. No code changes. No migrations. Verification via `grep -r` for known stale terminology.

---

## Background — What Drifted

These architectural shifts shipped between ~2026-03-01 and 2026-04-14 and are not yet reflected in the doc surface:

1. **`venues` → `places` rename** (migration `20260328200001_places_final_rename.sql`) — table renamed, `venue_type → place_type`, `active → is_active`, all FK columns renamed (`venue_id → place_id`, etc.). PostGIS `location` geography column added in `20260328100001_places_refactor_foundation.sql`.
2. **`web/lib/entity-urls.ts`** — new centralized URL builder (commit `1bf91dbe`). Exports `buildEventUrl`, `buildSpotUrl`, `buildSeriesUrl`, `buildFestivalUrl`, `buildExhibitionUrl`, `buildArtistUrl`, `buildOrgUrl`. Takes a `'feed' | 'page'` context arg that determines overlay vs canonical URL. Already documented in `web/CLAUDE.md` line 36 — but the rest of the doc surface hasn't been updated.
3. **`search_unified()` RPC** (migration `20260413000007_search_unified.sql`) — single-point-of-control search across events + places with mandatory `p_portal_id` enforcement. Replaces the deleted "legacy unified-search stack".
4. **Exhibitions as first-class entity** — own table, own `search_vector` (migration `20260413100001_exhibitions_search_vector.sql`), own `ExhibitionResultCard`, own `buildExhibitionUrl()`. North-star still uses three-entity model (events / destinations / programs) — exhibitions need to be acknowledged as a first-class noun under the Arts pillar.
5. **`content_kind='exhibit'` deprecation in flight** — The `events.exhibition_id` FK shipped 2026-04-14 (migration `20260413100003_events_exhibition_id.sql`, commit `838b9052`). Exhibition CTEs are live in `search_unified()` (commit `bd9cd223`). `crawlers/ARCHITECTURE.md` was updated 2026-04-14 (commit `89026d9b`) to mark `content_kind='exhibit'` as deprecated. The feed-query filter on `content_kind='exhibit'` (commits `b5a3344e`, `0bb667ab`) remains as protection for legacy rows, but **new code must never set this flag**. Exhibition-related events (opening nights, artist talks) must use `exhibition_id` to link to the parent exhibition.
6. **Routing canonicalization rule** — overlay links (`?spot=`, `?venue=`) only valid in `'feed'` context. Standalone detail pages link canonical (commits `ca712c22`, `c48620fb`, `d5958e2b`).
7. **`civic-routing.ts` exists** — earlier audit suggested this might be missing; I verified `web/lib/civic-routing.ts` IS present. The reference in `web/CLAUDE.md` line 36 is correct. **Do not "fix" this.**
8. **`crawlers/ARCHITECTURE.md` is the authoritative crawler data-model contract** — 312 lines, more detailed than `crawlers/CLAUDE.md`. Was updated 2026-04-14 (commit `89026d9b`) for `content_kind='exhibit'` deprecation but still contains 8 stale `venues`/`venue_id`/`venue_type` references (lines 10-11, 36-44, 77, 108, 172-174). Highest-drift single file in the doc surface. Addressed in new Task 1.6.

## Background — Triage Decisions Locked In

From the doc inventory subagent:

**Top-level root strategy docs (9 total):**

| File | Verdict | Action |
|---|---|---|
| `STRATEGIC_PRINCIPLES.md` | Authoritative | Keep |
| `DEV_PLAN.md` | Authoritative (2026-04-04) | Keep |
| `WORKSTREAM.md` | Authoritative | Keep |
| `AGENTS.md` | Authoritative | Keep |
| `ACTIVE_WORK.md` | Authoritative (live) | Keep |
| `BACKLOG.md` | Redundant — header already says "active roadmap is DEV_PLAN.md" | **Archive** |
| `NEXT_MOVES.md` | Fully stale (2026-02-10, predates consumer-ready shift) | **Archive** |
| `ARCHITECTURE_PLAN.md` | Partially stale (places refs, pre-entity-urls) | **Refresh** |
| `TECH_DEBT.md` | Partially stale (2026-03-05 audit, items not rescored since) | **Refresh** |

**Plans triage:** 25 SHIPPED plans in `docs/superpowers/plans/` — see Phase 4 manifest below.

**Agent definition files (9 in `.claude/agents/`):** All last touched Feb 25, 2026 — predate places refactor, entity-urls, exhibitions, search_unified. All need refresh. See Phase 5.

---

## File Structure — What Gets Touched

**Created:**
- `docs/superpowers/plans/shipped/` (new directory)
- `docs/archive/root-strategy-2026-Q1/` (new directory)
- `.claude/agents/_shared-architecture-context.md` (new — shared appendix all agents reference)

**Modified:**
- `web/CLAUDE.md` (add architectural shifts appendix; spot-check for stale terms)
- `crawlers/CLAUDE.md` (venues→places; venue_data→place_data; add exhibitions/programs note)
- `crawlers/ARCHITECTURE.md` (venues→places across 6 line ranges; soften transitional framing on content_kind='exhibit' now that FK has shipped)
- `database/CLAUDE.md` (venues→places in schema list and "Adding a New Source"; add search_unified note)
- `.claude/north-star.md` (add exhibitions; note places-as-first-class; mention entity-urls canonical-vs-overlay; add "Last refreshed" date)
- `ARCHITECTURE_PLAN.md` (places terminology + reference entity-urls and search_unified)
- `TECH_DEBT.md` (add "Status as of 2026-04-14" header, mark items reviewed)
- All 9 files in `.claude/agents/` (add a "Current architecture context" link to shared appendix)

**Moved (with archive header inserted):**
- `BACKLOG.md` → `docs/archive/root-strategy-2026-Q1/BACKLOG.md`
- `NEXT_MOVES.md` → `docs/archive/root-strategy-2026-Q1/NEXT_MOVES.md`
- 25 shipped plans → `docs/superpowers/plans/shipped/` (preserving filenames)

**Untouched (verify only):**
- `web/lib/entity-urls.ts`, `web/lib/civic-routing.ts` (verify they exist; do not edit)
- `STRATEGIC_PRINCIPLES.md`, `DEV_PLAN.md`, `WORKSTREAM.md`, `AGENTS.md`, `ACTIVE_WORK.md` (deferred — separate review)

---

## Phase 1 — CLAUDE.md Surgical Fixes

### Task 1.1: Verify civic-routing.ts and entity-urls.ts exist

**Files:**
- Verify: `web/lib/civic-routing.ts`
- Verify: `web/lib/entity-urls.ts`

- [ ] **Step 1: Confirm both files exist**

Run:
```bash
ls -la /Users/coach/Projects/LostCity/web/lib/civic-routing.ts /Users/coach/Projects/LostCity/web/lib/entity-urls.ts
```

Expected: Both files listed without error. If either is missing, STOP and escalate — the plan assumes both exist.

- [ ] **Step 2: Read entity-urls.ts to confirm the public API**

Run: Read `/Users/coach/Projects/LostCity/web/lib/entity-urls.ts` in full.

Expected: file exports at minimum `buildEventUrl`, `buildSpotUrl`, `buildExhibitionUrl`, and accepts a `'feed' | 'page'` context arg. Note the actual exported function names — Phase 2 references them.

If any function names differ from those listed, update Task 2.1's content block to match reality before applying it.

### Task 1.2: Fix `database/CLAUDE.md` venues → places

**Files:**
- Modify: `database/CLAUDE.md`

- [ ] **Step 1: Replace the schema list entry on line 78**

Find:
```
- `venues` - Normalized venue data with aliases
```

Replace with:
```
- `places` - Normalized destination/venue data with aliases (renamed from `venues` in 2026-03; PostGIS `location` geography column for spatial queries)
```

- [ ] **Step 2: Replace the "Venue INSERT" line in "Adding a New Source"**

Find (around line 139):
```
   - Venue INSERT (`venues` table): name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, phone, description, vibes
```

Replace with:
```
   - Place INSERT (`places` table): name, slug, address, neighborhood, city, state, zip, lat, lng, place_type, spot_type, website, phone, description, vibes. Set `is_active = true`. The `location` geography column is auto-populated by trigger from lat/lng.
```

- [ ] **Step 3: Append the architectural shifts appendix**

Add this section at the end of the file (after line 166):

```markdown

## Recent Architectural Shifts (as of 2026-04-14)

When working on database changes, be aware these landed recently and older docs may not reflect them:

- **`venues` → `places` rename** (`20260328200001_places_final_rename.sql`). The table is now `places`. `venue_type` is now `place_type`. `active` is now `is_active`. All foreign keys renamed: `events.venue_id → events.place_id`, `series.venue_id → series.place_id`, etc. Code is fully migrated; if you find a doc, comment, or migration that still says `venues`, update it.
- **PostGIS spatial column** (`20260328100001_places_refactor_foundation.sql`). `places.location` is a `geography(Point, 4326)` auto-populated by trigger from `lat`/`lng`. Use it for spatial queries (`ST_DWithin`, etc.); don't recompute distance from raw lat/lng.
- **Portal isolation enforcement.** Sources have `owner_portal_id NOT NULL` enforced by CHECK constraint. Events inherit `portal_id` from their source via DB trigger. Cross-portal queries should use the portal_id column, never join through sources.
- **`search_unified()` RPC** (`20260413000007_search_unified.sql`). Single point-of-control for search across events + places. **Always pass `p_portal_id`** — portal isolation is enforced inside the RPC. Do not write new search queries that bypass this. Filter args: `p_query`, `p_portal_id`, `p_categories`, `p_neighborhoods`, `p_date_from`, `p_date_to`. Returns events and places in a unified result shape.
- **`exhibitions` table is first-class — mechanically so.** Has its own `search_vector` (`20260413100001_exhibitions_search_vector.sql`) and is wired into `search_unified()` via exhibition CTEs (commit `bd9cd223`). The `events.exhibition_id` FK shipped 2026-04-14 (`20260413100003_events_exhibition_id.sql`, commit `838b9052`) — opening nights, artist talks, and other exhibition-related events set `exhibition_id` to link to the parent exhibition. `content_kind='exhibit'` is **deprecated** (see `crawlers/ARCHITECTURE.md` and commit `89026d9b`); the filter on feed/event queries remains only as protection for legacy rows. **Do not create new `content_kind='exhibit'` rows.** New exhibitions go directly in the `exhibitions` table.
```

- [ ] **Step 4: Verify no remaining `venues` references in database/CLAUDE.md**

Run:
```bash
grep -n 'venues\|venue_type\|venue_id' /Users/coach/Projects/LostCity/database/CLAUDE.md
```

Expected: Only matches inside the architectural shifts appendix (where they're explicitly historical references). Any other match means an update was missed.

- [ ] **Step 5: Commit**

```bash
git add database/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(database): update CLAUDE.md for places refactor and search_unified

Replace stale venues references with places throughout. Add architectural
shifts appendix covering places refactor, PostGIS location column, portal
isolation enforcement, search_unified RPC, and exhibitions as first-class
entity.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.3: Fix `crawlers/CLAUDE.md` venues → places

**Files:**
- Modify: `crawlers/CLAUDE.md`

- [ ] **Step 1: Replace the `VENUE_DATA` example block (around line 113-130)**

Find:
```python
VENUE_DATA = {
    "name": "Venue Name",
    "slug": "venue-slug",              # Unique, used for dedup
    "address": "123 Main St",
    "neighborhood": "Midtown",         # Important for filtering
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7834,                    # Required for map placement
    "lng": -84.3831,
    "venue_type": "bar",               # bar, restaurant, music_venue, etc.
    "spot_type": "bar",                # Used for spot filtering in the app
    "website": "https://venue.com",
    "vibes": ["dive-bar", "live-music", "late-night"],  # Discovery tags
}
```

Replace with:
```python
PLACE_DATA = {
    "name": "Venue Name",
    "slug": "venue-slug",              # Unique, used for dedup
    "address": "123 Main St",
    "neighborhood": "Midtown",         # Important for filtering
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7834,                    # Required — auto-populates places.location (PostGIS)
    "lng": -84.3831,
    "place_type": "bar",               # bar, restaurant, music_venue, etc. (renamed from venue_type)
    "spot_type": "bar",                # Used for spot filtering in the app
    "website": "https://venue.com",
    "vibes": ["dive-bar", "live-music", "late-night"],  # Discovery tags
}

# Note: as of 2026-03 the `venues` table was renamed to `places` and `venue_type`
# to `place_type`. Use `db.get_or_create_place(PLACE_DATA)`. Older crawlers may
# still pass the variable as `VENUE_DATA` — both work, but new code should use
# the new names.
```

- [ ] **Step 2: Update the section header above the block**

Find:
```
### Venue Data (CRITICAL — always complete)
```

Replace with:
```
### Place Data (CRITICAL — always complete)
```

- [ ] **Step 3: Update the "Venue Types" header**

Find:
```
### Venue Types
```

Replace with:
```
### Place Types (the `place_type` taxonomy)
```

- [ ] **Step 4: Update the First-Pass Validation Checklist VENUE_DATA reference**

Find:
```
- [ ] `VENUE_DATA` has all fields filled (name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, website, vibes)
```

Replace with:
```
- [ ] `PLACE_DATA` has all fields filled (name, slug, address, neighborhood, city, state, zip, lat, lng, place_type, website, vibes)
```

- [ ] **Step 5: Update the "Minimum Venue Data" table header**

Find:
```
### Minimum Venue Data (when creating via `get_or_create_place`)
```

Replace with:
```
### Minimum Place Data (when creating via `get_or_create_place`)
```

- [ ] **Step 6: Update the venue_type row in that table**

Find:
```
| venue_type | Yes | From valid taxonomy above |
```

Replace with:
```
| place_type | Yes | From valid taxonomy above (renamed from venue_type) |
```

- [ ] **Step 7: Append the architectural shifts appendix**

Add at the end of the file:

```markdown

## Recent Architectural Shifts (as of 2026-04-14)

When building or updating crawlers, be aware these landed recently:

- **`venues` → `places` rename.** The destination table is now `places`. `venue_type` → `place_type`. `active` → `is_active`. Use `db.get_or_create_place(place_data)` (the function name was already correct). New crawlers should use `PLACE_DATA` as the dict variable name, but `VENUE_DATA` still works.
- **Exhibitions are first-class — create them in the `exhibitions` table, never as events.** If you crawl a museum/gallery/art space, use `exhibition_utils.py` to create exhibitions. Events related to an exhibition (opening nights, artist talks, walkthroughs) should set `events.exhibition_id` to link back to the parent exhibition — the FK landed in commit `838b9052` and is live. **Do not set `content_kind='exhibit'` on new events** — it's deprecated (see `crawlers/ARCHITECTURE.md` and commit `89026d9b`); the feed filter on it remains only for legacy rows pending migration.
- **First-pass capture rule still applies.** Capture specials, hours, programs, and venue metadata in the same pass. The places refactor did not change this — every enrichment script is still a crawler failure.
- **Portal attribution is mandatory.** `sources.owner_portal_id` must be set; events inherit `portal_id` via trigger. Don't bypass this when seeding test data.
- **Programs are a real entity.** If a venue offers structured classes/lessons/camps with sessions and registration, those are programs (or events with `series_hint`), not loose events. See the Series Grouping section above.
```

- [ ] **Step 8: Verify no remaining stale `venue_type` or unqualified `venues` references**

Run:
```bash
grep -n 'venue_type\|VENUE_DATA' /Users/coach/Projects/LostCity/crawlers/CLAUDE.md
```

Expected: All matches should be inside the architectural shifts appendix or the explicit "renamed from venue_type" / "still works" notes. If you find an unqualified `venue_type` outside those contexts, update it.

- [ ] **Step 9: Commit**

```bash
git add crawlers/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(crawlers): update CLAUDE.md for places refactor and exhibitions

Rename VENUE_DATA → PLACE_DATA, venue_type → place_type. Add architectural
shifts appendix noting the rename, exhibitions as first-class entity, and
the in-flight content_kind='exhibit' → exhibition_id FK migration.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.4: Append architectural shifts appendix to `web/CLAUDE.md`

**Files:**
- Modify: `web/CLAUDE.md`

`web/CLAUDE.md` already correctly references `lib/entity-urls.ts` and `lib/civic-routing.ts` (line 36) and the surface architecture rules are current. We add only the architectural shifts appendix so future agents see the recent pivots immediately.

- [ ] **Step 1: Find the end of the file**

Run:
```bash
wc -l /Users/coach/Projects/LostCity/web/CLAUDE.md
```

Note the line count. The appendix gets appended after the last existing line.

- [ ] **Step 2: Append the architectural shifts appendix**

Add at the very end of the file:

```markdown

---

## Recent Architectural Shifts (as of 2026-04-14)

When working in `web/`, be aware these landed recently and older patterns are stale:

- **`web/lib/entity-urls.ts` is the canonical URL builder.** Never hand-build entity URLs. Public API: `buildEventUrl(id, portal, context)`, `buildSpotUrl(slug, portal, context)`, `buildSeriesUrl(slug, portal, seriesType?)`, `buildFestivalUrl(slug, portal)`, `buildExhibitionUrl(slug, portal)`, `buildArtistUrl(slug, portal)`. Only `buildEventUrl` and `buildSpotUrl` take a `LinkContext` arg (`'feed' | 'page'`) — `'feed'` returns an overlay URL (e.g., `?event=123`, `?spot=high-museum`), `'page'` returns the canonical detail page URL. **Standalone detail pages must always pass `'page'`.** Other entity URLs (series, festival, exhibition, artist) are always canonical — no overlay mode. Civic events use `getCivicEventHref()` from `lib/civic-routing.ts` as a pre-check before `buildEventUrl` (pattern: `getCivicEventHref(event, portal, vertical) ?? buildEventUrl(id, portal, context)`).
- **`places`, not `venues`.** The DB table is `places`. The frontend type is `Place`. Joins use `place_id`, not `venue_id`. The user-facing route is `/{portal}/spots/[id]`, not `/{portal}/venues/[id]`. If you find a stale `venues` table reference in code, fix it; if it's in a comment, update it.
- **`search_unified()` RPC for all search.** The legacy unified-search stack was deleted (commit `38fdc561`). New search code calls `search_unified()` via the server loader pattern — never write a client-side query that bypasses it. Portal isolation is enforced inside the RPC; you must pass `p_portal_id`.
- **Exhibitions are a first-class entity.** Has its own `ExhibitionResultCard`, `buildExhibitionUrl()`, `exhibitions.search_vector`, and exhibition CTEs in `search_unified()` (commit `bd9cd223`). Treat exhibitions as a noun on the same level as events and places, especially in the Arts portal. The `events.exhibition_id` FK is live (commit `838b9052`) — use it to link opening nights, artist talks, etc. to their parent exhibition.
- **Overlay vs canonical link rule.** Inside feed/explore/calendar surfaces (the `'feed'` context), entity links open as overlay (modal) for in-place browsing. On standalone detail pages and in shared/permalink contexts, links must be canonical (`'page'` context). The wrong context here causes infinite overlay nesting on detail pages.
- **`content_kind='exhibit'` is deprecated.** Do not create new events with this flag. The filter on feed and event queries (commits `b5a3344e`, `0bb667ab`) remains as protection for legacy rows; new code should never need to set or unset this flag. If you're linking an event to an exhibition, set `events.exhibition_id` instead.
```

- [ ] **Step 3: Commit**

```bash
git add web/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(web): add recent architectural shifts appendix to CLAUDE.md

Document entity-urls.ts canonical URL builder, places refactor, search_unified
RPC, exhibitions as first-class entity, overlay-vs-canonical link rule, and
content_kind='exhibit' filter pattern. Surface architecture rules already
correct on line 36; this is purely additive.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.5: Cross-CLAUDE.md grep audit

- [ ] **Step 1: Grep for any remaining unqualified stale terminology**

Run:
```bash
grep -n -E '\bvenues table\b|\bvenue_type\b' /Users/coach/Projects/LostCity/web/CLAUDE.md /Users/coach/Projects/LostCity/database/CLAUDE.md /Users/coach/Projects/LostCity/crawlers/CLAUDE.md
```

Expected: zero matches outside the explicit "renamed from venue_type" / appendix contexts.

If you find an unexpected match, fix it in-place and amend the relevant Phase 1 commit (or add a small follow-up commit if amend is risky).

### Task 1.6: Fix `crawlers/ARCHITECTURE.md` venues → places and update exhibition framing

**Files:**
- Modify: `crawlers/ARCHITECTURE.md`

Context: `crawlers/ARCHITECTURE.md` is the 312-line authoritative crawler data-model contract (more detailed than `crawlers/CLAUDE.md`). It was just updated 2026-04-14 (commit `89026d9b`) to mark `content_kind='exhibit'` as deprecated, but the `venues` → `places` rename never propagated. 8 stale references remain across 6 line ranges. This is the single highest-drift file in the doc surface.

The file uses `venues` in three distinct senses:
1. **Schema references** (e.g., "Move data into the correct entity lane: `events`, `series`, `venues`, …") — must become `places`.
2. **"venue metadata" / "destination metadata"** language — keep the generic English word "venue" where it's descriptive prose, but update schema references.
3. **`venue_specials` table name** — this table is NOT renamed. It stays `venue_specials`. Do NOT touch references to `venue_specials`.

- [ ] **Step 1: Read the file to confirm current state**

Read `/Users/coach/Projects/LostCity/crawlers/ARCHITECTURE.md` in full. Verify the specific stale references are still present at the lines the plan references; if a later commit has already touched any of them, update only what's still stale.

- [ ] **Step 2: Update the Goals section entity lane list (line 10-11)**

Find:
```
- Move data into the correct entity lane: `events`, `series`, `venues`,
  `venue_specials`, `programs`, `exhibitions`, opportunity lanes, and festival
  structures.
```

Replace with:
```
- Move data into the correct entity lane: `events`, `series`, `places`,
  `venue_specials`, `programs`, `exhibitions`, opportunity lanes, and festival
  structures.
```

Note: `venue_specials` stays unchanged — the table name was not renamed.

- [ ] **Step 3: Update the Current Model Alignment section (lines 34-44)**

Find:
```
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
```

Replace with:
```
- `venue_specials` is the correct home for operating offers, happy hours, and
  recurring deals. Do not model them as `content_kind='special'` events.
- `places` (the table renamed from `venues` in 2026-03) carry destination metadata such as `hours`, `image_url`,
  `location_designator`, and `planning_notes`. The `place_type` field replaces `venue_type`. A PostGIS `location` geography column is auto-populated from `lat`/`lng`.
- Destination usefulness is broader than event calendars. Parking notes,
  transit/walkability context, reservation friction, accessibility details, and
  allergy-sensitive planning guidance are all part of product quality when the
  source and schema support them.
- `sources` are coverage units. `owner_portal_id`, `health_tags`,
  `expected_event_count`, `active_months`, and `last_crawled_at` are part of
  the operating model, not optional bookkeeping.
```

- [ ] **Step 4: Update the Entity Linking phase contract (line 77)**

Find:
```
5. Entity Linking
   - Input: NormalizedEvent
   - Output: Persistable payloads for `events`, `series`, `venues`, `event_artists`,
     `event_images`, `event_links`, and any additional typed entity lanes emitted
     by the source
```

Replace with:
```
5. Entity Linking
   - Input: NormalizedEvent
   - Output: Persistable payloads for `events`, `series`, `places`, `event_artists`,
     `event_images`, `event_links`, and any additional typed entity lanes emitted
     by the source
```

- [ ] **Step 5: Update the Entity Lanes section (line 108)**

Find:
```
- `venue_specials`: happy hours, recurring food/drink deals, operational promos.
- `venues`: destination metadata, planning metadata, and map/discovery completeness.
```

Replace with:
```
- `venue_specials`: happy hours, recurring food/drink deals, operational promos.
- `places`: destination metadata, planning metadata, and map/discovery completeness. (Table renamed from `venues` in 2026-03; `place_type` replaces `venue_type`.)
```

- [ ] **Step 6: Update the Data Model (Live Contract) section — Venues heading + body (lines 172-174)**

Find:
```
Venues:
- Treat `website`, `image_url`, `hours`, `location_designator`, and
  `planning_notes` as part of destination quality, not optional nice-to-haves.
```

Replace with:
```
Places (the table formerly known as `venues`):
- Treat `website`, `image_url`, `hours`, `location_designator`, and
  `planning_notes` as part of destination quality, not optional nice-to-haves.
- `place_type` replaces `venue_type` (both field and taxonomy).
- `location` is a PostGIS `geography(Point, 4326)` column auto-populated by trigger from `lat`/`lng`. Use it for spatial queries instead of recomputing distance from raw coordinates.
```

- [ ] **Step 7: Update the Typed entity outputs section near the bottom (the line that says "Near-term target lanes")**

Find:
```
- Near-term target lanes: `events`, `programs`, `exhibitions`,
  `destination_details`, concrete opportunity tables, `venue_specials`, and
  destination-attached feature/enrichment lanes.
```

Replace with:
```
- Near-term target lanes: `events`, `programs`, `exhibitions`, `places`,
  `destination_details`, concrete opportunity tables, `venue_specials`, and
  destination-attached feature/enrichment lanes.
```

- [ ] **Step 8: Verify no remaining stale schema references**

Run:
```bash
grep -n '\bvenues\b\|\bvenue_type\b\|\bvenue_id\b' /Users/coach/Projects/LostCity/crawlers/ARCHITECTURE.md
```

Expected matches (these are acceptable — do NOT "fix" them):
- `venue_specials` — table name, not renamed
- `venue_name` / "venue name" in generic English prose where it means "the name of the place"
- Any explicit "renamed from `venues`" / "formerly known as" context introduced in Steps 3-6

Any OTHER match — especially `venues` appearing as a standalone schema reference or `venue_type`/`venue_id` as field references — means a spot was missed. Fix before committing.

- [ ] **Step 9: Commit**

```bash
git add crawlers/ARCHITECTURE.md
git commit -m "$(cat <<'EOF'
docs(crawlers): update ARCHITECTURE.md for places refactor

Rename venues table references to places throughout the data-model contract.
Update entity lanes list, current model alignment, entity linking phase
output, and Data Model (Live Contract) section. Add note on place_type
replacing venue_type and PostGIS location column. venue_specials table is
unchanged (was not renamed).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — North Star Refresh

### Task 2.1: Update `.claude/north-star.md`

**Files:**
- Modify: `.claude/north-star.md`

The current north-star (Feb 25, 2026) lists three first-class entity types: events, destinations, programs. It does not mention exhibitions, places-as-the-canonical-name, entity-urls, or portal isolation enforcement via search_unified. We add these without rewriting the existing strategic content.

- [ ] **Step 1: Replace the entity description block (lines 9-15)**

Find:
```
The core question we answer is **"What should I go do?"** — and the answer is three first-class entity types working together:
- **Events**: What's happening — concerts, openings, classes, meetups, festivals. Temporal, crawled, comprehensive.
- **Destinations**: Where to go — restaurants, bars, parks, museums, trails, campgrounds. Persistent, enriched, opinionated. Not just containers for events, but independently discoverable places worth going to.
- **Programs**: What to join — swim lessons, summer camps, rec league basketball, pottery classes. Structured activities with sessions, age ranges, and registration. The bridge between events (one-off) and destinations (always there).

Events tell you what's happening *right now*. Destinations tell you where's worth going *anytime*. Programs tell you what's worth committing to *this season*. Together they're the complete answer.
```

Replace with:
```
The core question we answer is **"What should I go do?"** — and the answer is four first-class entity types working together:
- **Events**: What's happening — concerts, openings, classes, meetups, festivals. Temporal, crawled, comprehensive.
- **Places** (formerly "destinations" in older docs, now `places` in code): Where to go — restaurants, bars, parks, museums, trails, campgrounds. Persistent, enriched, opinionated. Not just containers for events, but independently discoverable places worth going to. Stored in the `places` table with PostGIS spatial data.
- **Programs**: What to join — swim lessons, summer camps, rec league basketball, pottery classes. Structured activities with sessions, age ranges, and registration. The bridge between events (one-off) and places (always there).
- **Exhibitions**: What to see — gallery shows, museum exhibitions, installations. Persistent like places, but with run dates like events. Each lives in the `exhibitions` table with its own search vector and detail surface. Exhibitions are the unique entity the Arts portal produces; expect more vertical-specific entity types as other portals mature.

Events tell you what's happening *right now*. Places tell you where's worth going *anytime*. Programs tell you what's worth committing to *this season*. Exhibitions tell you what's worth seeing *while it's up*. Together they're the complete answer.
```

- [ ] **Step 2: Add a "Current architecture (as of 2026-04-14)" section after the "Brand Architecture" section (after line 51)**

Insert this new section between the Brand Architecture and Current Priorities sections:

```markdown

## Current Architecture Anchor (as of 2026-04-14)

Strategy without grounding becomes fiction. These are the load-bearing technical realities that shape what's possible. If you're proposing work that ignores them, the work is wrong.

- **The `places` table is the canonical destination model.** Renamed from `venues` in March 2026. PostGIS `location` column for spatial queries. All FKs use `place_id`. New work must use these names.
- **`web/lib/entity-urls.ts` builds all entity URLs.** Never hand-build a URL to an event, place, exhibition, series, or festival. The `'feed' | 'page'` context arg controls overlay vs canonical — overlay is feed-only, canonical is everywhere else. This rule prevents infinite overlay nesting and broken share links.
- **`search_unified()` is the single search entry point.** Replaces all prior search stacks. Portal isolation is enforced inside the RPC via mandatory `p_portal_id`. New search features wrap this RPC; do not bypass it.
- **Portal isolation is enforced at the database layer.** `sources.owner_portal_id` is `NOT NULL` and CHECK-constrained. Events inherit `portal_id` via trigger. Cross-portal data leakage is a P0 trust failure — if a query needs to span portals, it must do so explicitly, never accidentally.
- **Exhibitions are first-class — and mechanically so.** The `exhibitions` table has its own identity, `search_vector`, and detail surface. The `events.exhibition_id` FK shipped 2026-04-14 (commit `838b9052`), `search_unified()` exposes exhibitions directly (commit `bd9cd223`), and `content_kind='exhibit'` is deprecated (commit `89026d9b`). Exhibitions are a noun on the same level as events and places, not a flag on events. New exhibition-related events link via `exhibition_id`; new exhibitions live in the `exhibitions` table.
```

- [ ] **Step 3: Add a "Last refreshed" footer at the very bottom of the file**

Append after the last existing line:

```markdown

---

**Last refreshed:** 2026-04-14 — added places-as-first-class, exhibitions as fourth entity, current architecture anchor section. Previous refresh: 2026-02-25 (initial). Re-review whenever a major architectural shift lands.
```

- [ ] **Step 4: Commit**

```bash
git add .claude/north-star.md
git commit -m "$(cat <<'EOF'
docs(north-star): refresh for places refactor, exhibitions, search_unified

Add exhibitions as the fourth first-class entity. Rename "destinations" to
"places" to match the code. Add a "Current Architecture Anchor" section that
locks in the load-bearing technical realities (places table, entity-urls,
search_unified, portal isolation). Add Last refreshed footer.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Top-Level Root Doc Triage

### Task 3.1: Create archive directory and move stale top-level docs

**Files:**
- Create: `docs/archive/root-strategy-2026-Q1/` (directory)
- Move: `BACKLOG.md` → `docs/archive/root-strategy-2026-Q1/BACKLOG.md`
- Move: `NEXT_MOVES.md` → `docs/archive/root-strategy-2026-Q1/NEXT_MOVES.md`

- [ ] **Step 1: Create the archive directory**

Run:
```bash
mkdir -p /Users/coach/Projects/LostCity/docs/archive/root-strategy-2026-Q1
```

Expected: directory created without error. Verify with `ls -la /Users/coach/Projects/LostCity/docs/archive/`.

- [ ] **Step 2: Move BACKLOG.md to archive**

Run:
```bash
git mv /Users/coach/Projects/LostCity/BACKLOG.md /Users/coach/Projects/LostCity/docs/archive/root-strategy-2026-Q1/BACKLOG.md
```

Expected: `git status` shows the rename as `R BACKLOG.md -> docs/archive/root-strategy-2026-Q1/BACKLOG.md`.

- [ ] **Step 3: Move NEXT_MOVES.md to archive**

Run:
```bash
git mv /Users/coach/Projects/LostCity/NEXT_MOVES.md /Users/coach/Projects/LostCity/docs/archive/root-strategy-2026-Q1/NEXT_MOVES.md
```

- [ ] **Step 4: Prepend archive header to BACKLOG.md**

Read the archived file first to find its current first line (Read tool). Then prepend (use Edit tool with old_string = the current first line, new_string = the header block + that first line):

Header block to prepend (with a blank line between the header and original content):

```markdown
> **ARCHIVED 2026-04-14.** This document is no longer authoritative. The active roadmap lives in `DEV_PLAN.md` (operational status), `STRATEGIC_PRINCIPLES.md` (principles), and `.claude/north-star.md` (mission). Do not use this document as a source of truth for current priorities. Kept for historical reference only.

---

```

- [ ] **Step 5: Prepend archive header to NEXT_MOVES.md**

Same approach as Step 4. Header block to prepend:

```markdown
> **ARCHIVED 2026-04-14.** This document predates the consumer-ready shift (March 2026), the places refactor, exhibitions as a first-class entity, and search_unified. The "moat builder" feature ideas are not active work. The active priorities live in `DEV_PLAN.md` and `.claude/north-star.md`. Kept for historical reference only.

---

```

- [ ] **Step 6: Update inbound references to BACKLOG.md and NEXT_MOVES.md**

Run:
```bash
grep -rn 'BACKLOG\.md\|NEXT_MOVES\.md' /Users/coach/Projects/LostCity --include='*.md' --include='*.ts' --include='*.tsx' --include='*.py' 2>/dev/null
```

For each match outside the archived files themselves:
- If it's in a CLAUDE.md or strategy doc, update the path to the archived location, OR replace the reference with a pointer to `DEV_PLAN.md` if the link was about active work.
- If it's in a code comment, just update the path.
- The references in `web/CLAUDE.md`, `crawlers/CLAUDE.md`, and `database/CLAUDE.md` likely say "See `BACKLOG.md` for the full prioritized roadmap" — replace these with "See `DEV_PLAN.md` for the active execution status."

Concrete edits:
- `web/CLAUDE.md` — find `See \`BACKLOG.md\` for the full prioritized roadmap with implementation status.` and replace with `See \`DEV_PLAN.md\` for the active execution status. (Historical roadmap archived to \`docs/archive/root-strategy-2026-Q1/BACKLOG.md\`.)`
- `crawlers/CLAUDE.md` — same find/replace.
- `database/CLAUDE.md` — same find/replace.

- [ ] **Step 7: Verify no broken references**

Run:
```bash
grep -rn 'BACKLOG\.md\|NEXT_MOVES\.md' /Users/coach/Projects/LostCity --include='*.md' 2>/dev/null | grep -v 'docs/archive/root-strategy-2026-Q1'
```

Expected: only matches that point to the new archive location, or matches that were intentionally rewritten to reference DEV_PLAN.md instead.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
docs: archive BACKLOG.md and NEXT_MOVES.md to docs/archive/

BACKLOG.md is superseded by DEV_PLAN.md (its own header already said so).
NEXT_MOVES.md predates the consumer-ready shift and is fully stale. Both
get archive headers explaining what to read instead. Inbound CLAUDE.md
references repointed to DEV_PLAN.md.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.2: Refresh `ARCHITECTURE_PLAN.md` for places terminology

**Files:**
- Modify: `ARCHITECTURE_PLAN.md`

This file is "Partially Stale" per the triage. It still references `venues` table in places. Update the terminology and add a dated status header. Do not rewrite the gap analysis sections — those are still strategically valid.

- [ ] **Step 1: Read the file fully**

Read `/Users/coach/Projects/LostCity/ARCHITECTURE_PLAN.md` in full so you know what's there.

- [ ] **Step 2: Add a "Status as of 2026-04-14" header at the top**

Insert as a new block right after the title (the first `# ARCHITECTURE_PLAN` heading):

```markdown
> **Status as of 2026-04-14:** Last full refresh was 2026-03-21. Since then: `venues` table renamed to `places` (PostGIS spatial column added), `web/lib/entity-urls.ts` centralized URL building, `search_unified()` RPC replaced the legacy search stack, exhibitions added as first-class entity. Strategic gap analysis below remains valid; some terminology has been updated inline. For active execution status see `DEV_PLAN.md`. For mission see `.claude/north-star.md`.

```

- [ ] **Step 3: Replace stale `venues` references**

Run:
```bash
grep -n '\bvenues\b\|\bvenue_id\b\|\bvenue_type\b' /Users/coach/Projects/LostCity/ARCHITECTURE_PLAN.md
```

For each match that refers to the table or schema (not a generic English use of "venue"):
- `venues` (referring to the table) → `places`
- `venue_id` → `place_id`
- `venue_type` → `place_type`

Use Edit tool with `replace_all=false` for each unique match, or `replace_all=true` only if the term is unambiguously the schema reference. When in doubt, edit one at a time.

- [ ] **Step 4: Add an "Architecture decisions since last refresh" subsection**

Find a natural insertion point — likely just after the Status header or at the end of an early "Current State" section. Add:

```markdown

## Architecture Decisions Since 2026-03-21 (Inline Refresh)

These are the architectural decisions that have shipped since this document's last full refresh. They are reflected in code but the gap analysis below still uses the older framing in some places.

- **Centralized URL building.** `web/lib/entity-urls.ts` is now the single source of entity URLs. Overlay vs canonical is controlled by a `'feed' | 'page'` context arg. The legacy hand-built URL pattern is deprecated.
- **Single search RPC.** `search_unified()` replaces the legacy unified-search stack. Portal isolation is enforced inside the RPC. The frontend wraps this via the server-loader pattern.
- **`places`, not `venues`.** Table renamed, FKs renamed, `place_type` taxonomy. PostGIS `location` column auto-populated by trigger.
- **Exhibitions as first-class entity.** New table, own search vector, own URL builder. The Arts portal is the producing pillar. The transitional `content_kind='exhibit'` filter exists only until the `exhibition_id` FK migration ships.
- **Portal isolation hardening.** `owner_portal_id NOT NULL` + CHECK constraint on sources. Events inherit `portal_id` via trigger. The "no NULL portal_id" rule from `2026-02-14-portal-data-isolation.md` is now mechanically enforced, not just convention.
```

- [ ] **Step 5: Verify**

Run:
```bash
grep -n '\bvenues table\b\|\bvenue_type\b\|\bvenue_id\b' /Users/coach/Projects/LostCity/ARCHITECTURE_PLAN.md
```

Expected: zero matches. If a match remains in a context where "venues" is used as a generic English word (e.g., "music venues"), that's fine — only schema references should be replaced.

- [ ] **Step 6: Commit**

```bash
git add ARCHITECTURE_PLAN.md
git commit -m "$(cat <<'EOF'
docs: refresh ARCHITECTURE_PLAN.md for 2026-Q2 architecture state

Add Status header noting refresh date. Replace venues table references with
places. Add inline subsection summarizing architecture decisions since the
2026-03-21 refresh: entity-urls, search_unified, places refactor, exhibitions,
portal isolation hardening. Strategic gap analysis sections preserved.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.3: Refresh `TECH_DEBT.md` with status-as-of header

**Files:**
- Modify: `TECH_DEBT.md`

This is "Partially Stale" — many items may have been fixed since the 2026-03-05 audit but were never re-scored. Don't audit individual items in this pass; just add a clear "Status as of" header that warns readers to verify before treating any item as current.

- [ ] **Step 1: Read the file's first 50 lines**

Read `/Users/coach/Projects/LostCity/TECH_DEBT.md` (offset 0, limit 50).

- [ ] **Step 2: Insert a Status header after the title**

After the first `# TECH_DEBT` (or whatever the top-level heading is), insert:

```markdown
> **Status as of 2026-04-14:** This document was last fully audited on 2026-03-05. Many items may have been fixed since then (places refactor, search rebuild, entity-urls consolidation, and exhibition system have all landed since). **Before treating any item below as current, verify it against the actual codebase.** A re-audit is queued as a follow-up in `docs/superpowers/plans/2026-04-14-doc-consolidation-pass.md` (Phase 6 follow-up) — until that lands, treat this list as a starting point, not a punch list.

```

- [ ] **Step 3: Commit**

```bash
git add TECH_DEBT.md
git commit -m "$(cat <<'EOF'
docs: add status-as-of header to TECH_DEBT.md

Warn readers that the 2026-03-05 audit predates major architecture shifts
(places refactor, search rebuild, entity-urls, exhibitions). Items must be
verified before being treated as current. Full re-audit queued as follow-up.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Shipped Plans Archive

### Task 4.1: Create `shipped/` subfolder and move 25 plans

**Files:**
- Create: `docs/superpowers/plans/shipped/`
- Move 25 files (manifest below)

**Manifest (from plans triage subagent, updated 2026-04-14 post-recalibration):**

```
2026-04-14-exhibition-system-completion.md      → SHIPPED — all 3 DB migrations + crawler doc update landed in commits 67378314, bd9cd223, 838b9052, 89026d9b (2026-04-14). Currently UNTRACKED in working tree; must be committed before it can be moved. See Step 3 below.
2026-04-14-detail-page-link-repair.md           → SHIPPED — overlay→canonical fixes and stale venues cleanup landed in commits ca712c22, c48620fb, d5958e2b, 4f69ef2b. Currently UNTRACKED in working tree; must be committed before it can be moved. See Step 3 below.
2026-04-14-routing-hygiene-feed-filter.md       → SHIPPED (1bf91dbe, b5a3344e)
2026-04-13-search-elevation-phase-0.md          → SHIPPED (Phase 0 complete)
2026-04-10-exhibition-system-launch.md          → SHIPPED
2026-04-13-goblin-queue-groups.md               → SHIPPED
2026-04-13-on-the-horizon-redesign.md           → SHIPPED
2026-04-13-music-tab-redesign.md                → SHIPPED
2026-04-10-goblin-queue-sharing.md              → SHIPPED
2026-04-10-goblin-watchlist.md                  → SHIPPED
2026-04-10-goblin-ranking-spy-hud.md            → SHIPPED
2026-04-09-goblin-ranking-games.md              → SHIPPED
2026-04-09-exhibition-pipeline-quality.md       → SHIPPED
2026-04-09-exhibition-schema-evolution.md       → SHIPPED
2026-04-09-zod-posthog-integration.md           → SHIPPED
2026-04-09-animation-architecture.md            → SHIPPED
2026-04-09-crawler-health-monitoring.md         → SHIPPED
2026-04-06-goblin-summary-sharing.md            → SHIPPED
2026-04-05-goblin-theme-matrix.md               → SHIPPED
2026-04-10-animation-remediation-polish.md      → SHIPPED
2026-04-10-exhibition-critical-blockers.md      → SHIPPED
2026-04-10-exhibition-data-quality-fixes.md     → SHIPPED
2026-04-10-venue-feature-image-pipeline.md      → SHIPPED
2026-04-10-feed-header-variants.md              → SHIPPED
2026-04-10-atlanta-coverage-gaps.md             → SHIPPED
2026-04-10-future-session-remaining-gaps.md     → SHIPPED
```

**Recalibration 2026-04-14:** The original triage called `2026-04-14-exhibition-system-completion.md` in-flight, but commits `67378314`, `bd9cd223`, `838b9052`, and `89026d9b` (all landed 2026-04-14) shipped all of its tasks. It is shipped. Similarly, `2026-04-14-detail-page-link-repair.md` is shipped per `ca712c22`, `c48620fb`, `d5958e2b`, `4f69ef2b`. Both files are **currently UNTRACKED** in the working tree (they were never committed). They must be committed on the doc-consolidation branch BEFORE being moved to `shipped/`. Total archive count is **26** (original 24 + 2 recalibrated).

- [ ] **Step 1: Create the shipped subfolder**

Run:
```bash
mkdir -p /Users/coach/Projects/LostCity/docs/superpowers/plans/shipped
```

- [ ] **Step 1b: Commit the two untracked plan files (exhibition-system-completion, detail-page-link-repair) first**

These plan files are in the working tree but were never committed. They need to be committed on the doc-consolidation branch before they can be `git mv`'d to `shipped/`. Check whether they're actually present (they may have been brought over during worktree setup, or they may not be — if not, skip this step):

```bash
ls /Users/coach/Projects/LostCity/docs/superpowers/plans/2026-04-14-exhibition-system-completion.md \
   /Users/coach/Projects/LostCity/docs/superpowers/plans/2026-04-14-detail-page-link-repair.md 2>&1
```

If both files exist and are untracked (`git status` shows them as untracked):
```bash
git add /Users/coach/Projects/LostCity/docs/superpowers/plans/2026-04-14-exhibition-system-completion.md \
        /Users/coach/Projects/LostCity/docs/superpowers/plans/2026-04-14-detail-page-link-repair.md
git commit -m "$(cat <<'EOF'
docs(plans): commit shipped plan files for exhibition system and detail page repair

Both plans were executed (commits 67378314/bd9cd223/838b9052/89026d9b for
exhibitions; ca712c22/c48620fb/d5958e2b/4f69ef2b for detail page links) but
the plan files themselves were never committed. Committing them now so the
next step can archive them to shipped/.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

If one or both files don't exist in the worktree (which can happen because they were untracked in the original working tree and weren't included in the worktree), create them by copying from the original working tree:
```bash
cp /Users/coach/Projects/LostCity/docs/superpowers/plans/2026-04-14-exhibition-system-completion.md \
   $(pwd)/docs/superpowers/plans/2026-04-14-exhibition-system-completion.md
cp /Users/coach/Projects/LostCity/docs/superpowers/plans/2026-04-14-detail-page-link-repair.md \
   $(pwd)/docs/superpowers/plans/2026-04-14-detail-page-link-repair.md
```
Then commit as above. If the files can't be found in either place, skip them in the manifest and note it — don't fabricate content.

- [ ] **Step 2: Verify each candidate file exists before moving**

Run:
```bash
for f in \
  2026-04-14-exhibition-system-completion.md \
  2026-04-14-detail-page-link-repair.md \
  2026-04-14-routing-hygiene-feed-filter.md \
  2026-04-13-search-elevation-phase-0.md \
  2026-04-10-exhibition-system-launch.md \
  2026-04-13-goblin-queue-groups.md \
  2026-04-13-on-the-horizon-redesign.md \
  2026-04-13-music-tab-redesign.md \
  2026-04-10-goblin-queue-sharing.md \
  2026-04-10-goblin-watchlist.md \
  2026-04-10-goblin-ranking-spy-hud.md \
  2026-04-09-goblin-ranking-games.md \
  2026-04-09-exhibition-pipeline-quality.md \
  2026-04-09-exhibition-schema-evolution.md \
  2026-04-09-zod-posthog-integration.md \
  2026-04-09-animation-architecture.md \
  2026-04-09-crawler-health-monitoring.md \
  2026-04-06-goblin-summary-sharing.md \
  2026-04-05-goblin-theme-matrix.md \
  2026-04-10-animation-remediation-polish.md \
  2026-04-10-exhibition-critical-blockers.md \
  2026-04-10-exhibition-data-quality-fixes.md \
  2026-04-10-venue-feature-image-pipeline.md \
  2026-04-10-feed-header-variants.md \
  2026-04-10-atlanta-coverage-gaps.md \
  2026-04-10-future-session-remaining-gaps.md \
; do
  path="/Users/coach/Projects/LostCity/docs/superpowers/plans/$f"
  if [ -f "$path" ]; then
    echo "EXISTS: $f"
  else
    echo "MISSING: $f"
  fi
done
```

Expected: All 26 files report `EXISTS`. If any report `MISSING`, the triage was wrong on that filename — drop that file from the move list and continue. If more than 3 are missing, STOP and re-run the plans triage subagent before proceeding. Note: the exhibition-system-completion and detail-page-link-repair files depend on Step 1b having committed them first.

- [ ] **Step 3: Move each existing file with `git mv`**

For each file confirmed `EXISTS` in Step 2, run individually (do NOT shell-glob — explicit moves only):

```bash
git mv /Users/coach/Projects/LostCity/docs/superpowers/plans/<filename>.md \
       /Users/coach/Projects/LostCity/docs/superpowers/plans/shipped/<filename>.md
```

Run all 26 commands sequentially. Verify with `git status` after each batch of ~6 to catch errors early.

- [ ] **Step 4: Add a README in the shipped/ folder**

Create `/Users/coach/Projects/LostCity/docs/superpowers/plans/shipped/README.md`:

```markdown
# Shipped Plans Archive

This directory holds plans whose work has shipped to `main`. Plans are moved here, not deleted, so the historical record is preserved.

**Convention:**
- A plan is "shipped" when the work it describes has landed in the `main` branch (verifiable via git log).
- A plan is "in-flight" if work is ongoing on a branch — keep these in the parent `plans/` directory.
- A plan is "abandoned" if it was superseded by a later plan or the scope was dropped — these stay in the parent `plans/` directory with a note in the plan body explaining what happened, OR they get archived to `../../archive/` if the entire approach is dead.

**Triage criteria:** Verify against `git log --oneline --since=<plan_date>` before moving. If you can't point to commits that implement the plan, it's not shipped.

The initial archive batch was created 2026-04-14 as part of `docs/superpowers/plans/2026-04-14-doc-consolidation-pass.md` Phase 4.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
docs: archive 26 shipped plans to docs/superpowers/plans/shipped/

Move plans whose work has landed in main into a shipped/ subfolder, preserving
the historical record. Add a README explaining the archive convention. Includes
exhibition-system-completion and detail-page-link-repair, whose work shipped on
2026-04-14 but whose plan files were never committed until Step 1b of this
phase.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Agent Definition Refresh

### Task 5.1: Create shared architecture context file

**Files:**
- Create: `.claude/agents/_shared-architecture-context.md`

Rather than editing each of 9 agent definition files with the same architecture appendix, create one shared context file and have each agent reference it. This is DRY and means the next refresh is one file, not nine.

- [ ] **Step 1: Create the file**

Write `/Users/coach/Projects/LostCity/.claude/agents/_shared-architecture-context.md`:

```markdown
# Shared Architecture Context

**For all LostCity agents.** This file captures the load-bearing architectural realities every agent should know before starting work. Read this in addition to `.claude/north-star.md` and the relevant `CLAUDE.md` files.

**Last refreshed:** 2026-04-14

## First-class entity types

The platform models four first-class nouns. All agent work should respect these distinctions; collapsing them is a category error.

- **Events** — Temporal. Stored in `events`. Crawled comprehensively. The `events.place_id` FK links to a place.
- **Places** — Persistent destinations. Stored in `places` (renamed from `venues` in March 2026). PostGIS `location` column for spatial queries. The `place_type` field replaces `venue_type`.
- **Programs** — Structured activities with sessions, age ranges, registration. Stored in their own table with cohort-aware fields.
- **Exhibitions** — Persistent like places, but with run dates like events. Stored in `exhibitions`. Has its own `search_vector`. The Arts portal is the producing pillar.

## Canonical patterns

- **URL building → `web/lib/entity-urls.ts`.** Public API: `buildEventUrl(id, portal, context)`, `buildSpotUrl(slug, portal, context)`, `buildSeriesUrl(slug, portal, seriesType?)`, `buildFestivalUrl(slug, portal)`, `buildExhibitionUrl(slug, portal)`, `buildArtistUrl(slug, portal)`, `buildOrgUrl(slug, portal)`. Only `buildEventUrl` and `buildSpotUrl` take a `LinkContext` arg (`'feed' | 'page'`); `'feed'` returns an overlay URL, `'page'` returns the canonical detail page URL. Standalone detail pages must pass `'page'`. Other builders are always canonical (no overlay mode). Civic events pre-check via `getCivicEventHref()` from `lib/civic-routing.ts` before calling `buildEventUrl`.
- **Search → `search_unified()` RPC.** Single point of entry. Pass `p_portal_id` always — portal isolation is enforced inside the RPC. The legacy unified-search stack was deleted; do not write code against it.
- **Mutations → API routes only.** Never client-side Supabase mutations from React components. Use `withAuth` / `withAuthAndParams` wrappers in `lib/api-middleware.ts`.
- **Portal attribution → `sources.owner_portal_id` is `NOT NULL` + CHECK-constrained.** Events inherit `portal_id` via DB trigger. Cross-portal data leakage is a P0 trust failure.
- **Server-loader pattern → mandatory.** Pages and RSCs import server loaders directly. API routes wrap the same loaders. Never fetch your own API from the server.

## Transitional state (verify before extending)

- **`content_kind='exhibit'` is deprecated.** The `events.exhibition_id` FK shipped 2026-04-14 (commit `838b9052`); exhibitions are now first-class end-to-end. The feed-query filter on `content_kind='exhibit'` remains as protection for legacy rows, but **new code must never set this flag**. Link exhibition-related events via `exhibition_id`.
- **TECH_DEBT.md** was last audited 2026-03-05 and may be partially stale. Verify before treating any item as current.

## Where to look

- **Mission and priorities:** `.claude/north-star.md` (always check before starting work)
- **Active execution status:** `DEV_PLAN.md`
- **Strategic principles:** `STRATEGIC_PRINCIPLES.md`
- **Live agent claims (parallel work):** `ACTIVE_WORK.md`
- **Decision records:** `docs/decisions/`
- **In-flight plans:** `docs/superpowers/plans/` (excluding `shipped/` subfolder)
- **Web frontend conventions:** `web/CLAUDE.md`
- **Crawler conventions:** `crawlers/CLAUDE.md`
- **Database conventions:** `database/CLAUDE.md`
- **Archived/historical strategy docs:** `docs/archive/root-strategy-2026-Q1/`
```

### Task 5.2: Add shared-context reference to each agent definition

**Files:**
- Modify: all 9 files in `.claude/agents/`
  - `business-strategist.md`
  - `crawler-dev.md`
  - `data-specialist.md`
  - `full-stack-dev.md`
  - `lint-fixer.md`
  - `pr-reviewer.md`
  - `product-designer.md`
  - `qa.md`
  - `test-runner.md`

Each agent file gets a small reference block added near the top so the agent knows to load the shared context. Do not rewrite the agent definitions — they are role-specific, and rewriting them is out of scope.

- [ ] **Step 1: For each of the 9 agent files, read the existing top-of-file content**

For each file, Read the first ~30 lines. You're looking for: where the agent role is described, where to insert the context reference. Typically these files have YAML frontmatter then a description; insert the reference block immediately after the frontmatter or first heading.

- [ ] **Step 2: For each agent file, add the context reference block**

After the YAML frontmatter (or after the first `#` heading if no frontmatter), insert:

```markdown

> **Architecture context:** Before starting any task, read `.claude/agents/_shared-architecture-context.md` for current first-class entity types, canonical patterns, and load-bearing technical realities. Always read `.claude/north-star.md` for mission alignment.

```

Use the Edit tool with `replace_all=false` for each file. The exact `old_string` is the line immediately after the frontmatter (likely the first line of body content); the `new_string` is the reference block + that same line.

If a file already has a similar reference (e.g., already says "read north-star.md"), augment that existing reference instead of duplicating it. Use judgment: the goal is one block, not two.

- [ ] **Step 3: Verify all 9 files have the reference**

Run:
```bash
grep -L '_shared-architecture-context\.md' /Users/coach/Projects/LostCity/.claude/agents/*.md
```

Expected: prints only `_shared-architecture-context.md` itself (since `grep -L` lists files that DO NOT contain the pattern, and the shared context file references itself in the filename only). If any of the 9 agent files appear in the output, they're missing the reference — fix them.

Alternative explicit check:
```bash
for f in business-strategist crawler-dev data-specialist full-stack-dev lint-fixer pr-reviewer product-designer qa test-runner; do
  if grep -q '_shared-architecture-context' /Users/coach/Projects/LostCity/.claude/agents/$f.md; then
    echo "OK: $f"
  else
    echo "MISSING: $f"
  fi
done
```

Expected: all 9 print `OK`.

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/
git commit -m "$(cat <<'EOF'
docs(agents): add shared architecture context reference

Create .claude/agents/_shared-architecture-context.md as a single source of
load-bearing architectural realities (first-class entities, canonical patterns,
transitional state). Add a reference block to all 9 agent definition files so
each agent loads the shared context. Future architecture refreshes are now
one-file edits, not nine.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Verification and Final Commit

### Task 6.1: Cross-doc grep for residual stale terminology

- [ ] **Step 1: Grep the entire docs surface for the most likely drift markers**

Run each of these and capture matches:

```bash
# The places-not-venues check — should ONLY return matches in archived files, appendix sections, generic English uses, or venue_specials (unchanged table name)
grep -rn '\bvenues table\b\|\bvenue_type\b\|VENUE_DATA' \
  /Users/coach/Projects/LostCity/web/CLAUDE.md \
  /Users/coach/Projects/LostCity/database/CLAUDE.md \
  /Users/coach/Projects/LostCity/crawlers/CLAUDE.md \
  /Users/coach/Projects/LostCity/crawlers/ARCHITECTURE.md \
  /Users/coach/Projects/LostCity/.claude/north-star.md \
  /Users/coach/Projects/LostCity/.claude/agents/_shared-architecture-context.md \
  /Users/coach/Projects/LostCity/ARCHITECTURE_PLAN.md
```

Expected: the only matches should be inside an explicit "renamed from" / "formerly" / archive context. If a match is in a load-bearing instruction line (e.g., "create a row in the venues table"), it's drift — fix it.

- [ ] **Step 2: Grep for references to deleted legacy patterns**

```bash
grep -rn 'unified-search\|legacy-result-types\|HeaderSearchButton' \
  /Users/coach/Projects/LostCity/web/CLAUDE.md \
  /Users/coach/Projects/LostCity/database/CLAUDE.md \
  /Users/coach/Projects/LostCity/crawlers/CLAUDE.md \
  /Users/coach/Projects/LostCity/.claude/north-star.md \
  /Users/coach/Projects/LostCity/.claude/agents/
```

Expected: zero matches. These are all deleted code paths.

- [ ] **Step 3: Verify entity-urls is mentioned in all the right places**

```bash
grep -l 'entity-urls' \
  /Users/coach/Projects/LostCity/web/CLAUDE.md \
  /Users/coach/Projects/LostCity/.claude/north-star.md \
  /Users/coach/Projects/LostCity/.claude/agents/_shared-architecture-context.md
```

Expected: all three files listed.

- [ ] **Step 4: Verify search_unified is mentioned in all the right places**

```bash
grep -l 'search_unified' \
  /Users/coach/Projects/LostCity/web/CLAUDE.md \
  /Users/coach/Projects/LostCity/database/CLAUDE.md \
  /Users/coach/Projects/LostCity/.claude/north-star.md \
  /Users/coach/Projects/LostCity/.claude/agents/_shared-architecture-context.md
```

Expected: all four files listed.

- [ ] **Step 5: Verify the archived files have headers**

```bash
head -3 /Users/coach/Projects/LostCity/docs/archive/root-strategy-2026-Q1/BACKLOG.md
head -3 /Users/coach/Projects/LostCity/docs/archive/root-strategy-2026-Q1/NEXT_MOVES.md
```

Expected: both first lines start with `> **ARCHIVED 2026-04-14.**`

- [ ] **Step 6: Verify the shipped/ archive has its README and ~24 plans**

```bash
ls /Users/coach/Projects/LostCity/docs/superpowers/plans/shipped/ | wc -l
ls /Users/coach/Projects/LostCity/docs/superpowers/plans/shipped/README.md
```

Expected: file count of 25 (24 plans + 1 README); README.md exists.

- [ ] **Step 7: Run the existing test suites to confirm nothing broke**

This is doc work, but doc paths get referenced in tests sometimes. Run:

```bash
cd /Users/coach/Projects/LostCity && npm --prefix web run lint 2>&1 | tail -20
```

Expected: no new lint errors. If lint flags broken markdown links, fix them in the relevant phase commit.

- [ ] **Step 8: If any verification step failed, fix the underlying issue and amend the relevant phase commit (or add a small follow-up commit if amend is risky). Then re-run all verification steps.**

### Task 6.2: Update root-level documentation index (if one exists)

- [ ] **Step 1: Check if a top-level docs index exists**

```bash
ls /Users/coach/Projects/LostCity/README.md /Users/coach/Projects/LostCity/docs/README.md 2>&1
```

If `README.md` at the repo root or in `docs/` references any of the moved files (BACKLOG, NEXT_MOVES, the shipped plans), update the references.

- [ ] **Step 2: Grep for references to the old paths**

```bash
grep -rn 'BACKLOG\.md\|NEXT_MOVES\.md' /Users/coach/Projects/LostCity/README.md /Users/coach/Projects/LostCity/docs/README.md 2>/dev/null
```

If matches, update them to point to the archived locations or to `DEV_PLAN.md` as appropriate.

- [ ] **Step 3: If any updates were made, commit**

```bash
git add README.md docs/README.md
git commit -m "$(cat <<'EOF'
docs: update README references after Phase 3 archive moves

Repoint stale references to BACKLOG.md and NEXT_MOVES.md after they were
moved to docs/archive/root-strategy-2026-Q1/.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

If no changes were needed, skip the commit and proceed.

### Task 6.3: Surface follow-up backlog items

The consolidation pass intentionally did NOT do these things — they would expand scope beyond what the user agreed to. Surface them to the user as follow-ups so nothing is silently dropped.

- [ ] **Step 1: Append a follow-up section to this plan document**

Edit `/Users/coach/Projects/LostCity/docs/superpowers/plans/2026-04-14-doc-consolidation-pass.md` and append at the very end:

```markdown

---

## Follow-Ups Surfaced (Not Done in This Plan)

These items were identified during the consolidation pass but intentionally left out of scope. Surface them to the user; do not silently start them.

1. **TECH_DEBT.md re-audit.** Phase 3.3 added a Status header but did not audit individual items. Many may have been fixed since 2026-03-05 (places refactor, search rebuild, entity-urls, exhibitions all landed). A proper re-score is its own ~1-session task.
2. **STRATEGIC_PRINCIPLES.md / DEV_PLAN.md / WORKSTREAM.md / AGENTS.md / ACTIVE_WORK.md refresh.** All triaged as Authoritative, but "authoritative" doesn't mean "verified line-by-line against current code." A spot-check pass would catch any drifted concrete claims (file paths, function signatures, table names).
3. **130+ PRDs in `prds/`.** Roughly 70% are exploratory or completed per the inventory subagent. None were touched in this pass. A consolidation pass on PRDs is its own project.
4. **9 root-level operational guides** (`SOURCES.md`, `GLOBAL_ATLANTA_README.md`, `PORTAL_FOUNDATION_HARDENING_PLAN.md`, `CONTENT_QUALITY_AUDIT.md`, `CRAWLER_FIXES_NEEDED.md`, `MONETIZATION_PLAYBOOK.md`, `SALES_ENABLEMENT.md`, `COMPETITIVE_INTEL.md`, `README.md`) were not triaged. Some are likely stale; some are still operational. Worth a quick pass.
5. **Other 80+ plans in `docs/superpowers/plans/`** that are NOT-STARTED or HISTORICAL/REFERENCE per the triage. Phase 4 only moved the 24 clearly-shipped ones. Consider a backlog cleanup pass.
6. **Decision record archive convention.** `docs/decisions/` has 10 entries, all still relevant. No archive policy exists. When decisions get superseded, do they get a header note, or move to an archive folder? Worth deciding before the next decision lands.
7. **`crawlers/CLAUDE.md` source-list of files** (e.g., `marys_bar.py` in the project structure tree) — not verified file-by-file. Some may have been deleted or renamed. Worth a one-shot validation grep.
8. **`web/CLAUDE.md` Pencil component IDs** (lines 700+) — not verified against the actual `.pen` file. The Pencil MCP would be needed to verify; out of scope for this pass.

If any of these matter to ship now, ask the user to prioritize them as a follow-up plan. Otherwise, file them as backlog.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-04-14-doc-consolidation-pass.md
git commit -m "$(cat <<'EOF'
docs: append follow-up backlog to doc consolidation plan

Surface intentionally-out-of-scope items (TECH_DEBT re-audit, remaining
strategy doc spot-check, PRD consolidation, operational guides triage,
remaining plans backlog cleanup, decision archive convention, source-list
file verification, Pencil component ID verification). Do not silently drop.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist (run before declaring plan complete)

- [ ] Every file modified is listed in the "File Structure" section at the top.
- [ ] Every architectural shift in the "Background" section has at least one task that documents it.
- [ ] No task contains "TBD", "TODO", "implement later", or placeholder language.
- [ ] Every CLAUDE.md edit specifies the exact `old_string` content to find.
- [ ] Every git commit step includes a HEREDOC commit message.
- [ ] The `2026-04-14-exhibition-system-completion.md` plan is explicitly NOT moved in Phase 4.
- [ ] Phase 6 verification grep covers all the load-bearing terms (places, entity-urls, search_unified, legacy stacks).
- [ ] Follow-ups are surfaced explicitly so the user knows what's been deferred.
