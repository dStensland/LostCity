# LostCity Location Audit (Neighborhoods + City Data)

Date: 2026-02-19
Scope: Production venue/event location quality plus code-path audit
Data source: live Supabase via crawler client (`crawlers/db.py`)

## Executive summary

Location quality is currently constrained by a free-text model (`venues.neighborhood`, `venues.city`) plus exact-string filtering across API paths. We have meaningful coverage, but too much drift to support reliable neighborhood-based discovery at scale.

Headline findings:

- 4,083 venues total.
- 19,552 future canonical events; 19,307 linked to venues.
- 860 venues missing neighborhood (`21.1%`).
- 641 venues missing coordinates (`15.7%`).
- 2,416 future events linked to venues with missing neighborhood (`12.5%` of venue-linked future events).
- 1,219 future events linked to venues with missing coordinates (`6.3%` of venue-linked future events).
- 336 Atlanta venues use neighborhood values outside the canonical list/aliases.
- 141 distinct `city` values and 241 distinct `neighborhood` values, with clear normalization drift.

Net: neighborhood UX cannot be made robust by frontend filtering alone; this needs ingestion normalization plus a normalized location entity layer.

## Quantitative snapshot

### Venue/event completeness

- `venues_total`: 4,083
- `future_events_total` (canonical): 19,552
- `future_events_with_venue`: 19,307
- `future_events_no_venue`: 245
- `venues_missing_city`: 84
- `venues_missing_neighborhood`: 860
- `venues_missing_any_coord`: 641
- `future_events_with_venue_missing_neighborhood`: 2,416
- `future_events_with_venue_missing_coords`: 1,219

### Location designator split

- `standard`: 3,777 venues / 14,454 future events
- `recovery_meeting`: 303 venues / 4,427 future events
- `private_after_signup`: 2 venues / 211 future events
- `virtual`: 1 venue / 196 future events

Important: missing neighborhood/coords are not only expected virtual/private records.

- `standard` venues missing neighborhood: 857
- `standard` venues missing coords: 638
- Future events on `standard` venues missing neighborhood: 2,140
- Future events on `standard` venues missing coords: 914

### Distribution signals

Top cities by venue count:

- Atlanta: 2,231
- Nashville: 385
- Decatur: 177
- Sandy Springs: 98
- Marietta: 87
- Missing city: 84

Top neighborhoods by venue count:

- Missing neighborhood: 860
- Midtown: 420
- Downtown: 281
- Sandy Springs: 199
- Druid Hills: 173

Top neighborhoods by future event count:

- Missing neighborhood: 2,416
- Midtown: 1,219
- Downtown: 1,092
- Morningside: 949
- Stone Mountain: 714

## High-risk quality issues

### 1) Free-text neighborhood and city drift

- 336 Atlanta venues are not in the canonical neighborhood list/alias map.
- Distinct city values: 141 (for 4,083 venues).
- Distinct neighborhood values: 241.
- Neighborhood variant example:
  - `Virginia Highland` and `Virginia-Highland` both present.
- City variant examples:
  - `Atlanta` and `atlanta`
  - `Nashville` and `NASHVILLE`
  - `Union City` and `Union city`

### 2) Geo integrity issues from repeated coordinates

Top repeated coordinate appears 21 times:

- `(33.754466, -84.389815)` used by unrelated venues with contradictory neighborhoods (Athens, Clarkston, Decatur, Cumberland, Midtown, Sweet Auburn, etc.).

Other coordinate reuse clusters also exist, suggesting fallback/geocode pollution in ingestion/enrichment.

### 3) Cross-field contamination

Invalid/suspicious non-location values are stored in location fields:

- One `city` value is a long website/government boilerplate string.
- Invalid `state` examples include:
  - `Georgia`
  - `GA 30303`
  - `GA 30310`
  - `GA 30312 (Historic Fourth Ward Skatepark Field)`
- Invalid `zip` examples include:
  - `GA 30322-1013`
  - `T2H 2B5`

### 4) Event impact concentration by source

Top sources with events on venues missing coordinates:

- `mobilize-api`: 699
- `eventbrite`: 180
- `griefshare-atlanta`: 88
- `aa-atlanta`: 70

Top sources with events on venues missing neighborhood:

- `mobilize-api`: 697
- `mjcca`: 318
- `fulton-library`: 304
- `dice-and-diversions`: 221

Future events with no `venue_id` are concentrated in:

- `gsu-athletics`: 99
- `meetup`: 53
- `eventbrite-nashville`: 33

## Code-path findings (why drift persists)

1. The core schema uses free-text location fields (`neighborhood`, `city`) on `venues` with no canonical FK model.
   - `database/schema.sql:18`
   - `database/schema.sql:23`
   - `database/schema.sql:24`

2. Venue writes/upserts in crawler DB layer do not normalize neighborhood/city before insert.
   - `crawlers/db.py:829`
   - `crawlers/db.py:988`

3. API filtering uses exact string equality/inclusion for neighborhood and city.
   - `web/app/api/venues/search/route.ts:61`
   - `web/app/api/venues/search/route.ts:66`
   - `web/app/api/around-me/route.ts:335`
   - `web/app/api/around-me/route.ts:528`
   - `web/lib/search.ts:319`
   - `web/lib/search.ts:334`
   - `web/lib/spots.ts:108`
   - `web/lib/spots.ts:110`

4. Canonical neighborhood normalization helpers exist but are not the write-path source of truth.
   - `web/config/neighborhoods.ts:391`
   - `web/config/neighborhoods.ts:419`

5. Multiple independent neighborhood lists/configs exist.
   - Canonical UI config: `web/config/neighborhoods.ts:12`
   - Separate crawler copy with divergent naming (`Virginia Highland`): `crawlers/venue_enrich.py:49`
   - Additional static list in onboarding flow: `web/app/welcome/page.tsx:132`

6. Schema/migration governance is split for search RPC city scoping:
   - `database/migrations/049_search_rpc_functions.sql:137` (no `p_city`)
   - `supabase/migrations/20260216700001_search_venue_city_filter.sql:4` (adds `p_city`)

7. A separate `places/neighborhoods` model exists outside main migration flow, but it is not the canonical venue location contract.
   - `database/places-schema.sql:11`
   - `database/places-schema.sql:28`

## Proposed redesign direction

### Target model

Introduce normalized location entities and keep denormalized display fields only as cache:

- New table: `location_areas`
  - `id` (UUID), `slug`, `name`, `type` (`city`, `neighborhood`, `district`, `region`), `parent_id`, `lat`, `lng`, `radius_m`, `aliases`, `is_active`
- `venues` additions:
  - `city_area_id` FK to `location_areas`
  - `neighborhood_area_id` FK to `location_areas` (nullable)
  - Keep `city`/`neighborhood` text temporarily for compatibility/backfill
- Optional bridge:
  - `venue_location_history` (for quality/audit and manual corrections)

### Write-path policy

- All ingest/write paths run a single shared resolver:
  - normalize raw city/neighborhood text
  - resolve by alias table
  - if unresolved, classify as `unknown` + enqueue review, never silent free-text drift
- Coordinate sanity gate:
  - reject or quarantine writes where coordinates are implausible for the claimed area
  - block known fallback coordinate hot spots unless explicitly reviewed

### Read-path policy

- Query/filter by `*_area_id` (or canonical slug), not raw text.
- Support text input only as a resolver layer (`input -> canonical area`), then query by ID.

## Action plan

### Phase 0 (immediate, 1-2 days)

- Establish baseline dashboards:
  - missing neighborhood/city/coords by source
  - coordinate hotspot frequency
  - non-canonical neighborhood values by city
- Fix highest-impact bad records:
  - top venues with many future events and missing neighborhood/coords
  - invalid state/zip/city contamination rows

### Phase 1 (1 sprint)

- Add shared normalization utility consumed by:
  - crawler venue writes
  - auto-approve venue writes
  - manual/admin venue edits
- Replace duplicated neighborhood lists with imports from one canonical config.
- Standardize city casing (`Initcap`) and neighborhood alias mappings.

### Phase 2 (2-3 sprints)

- Introduce `location_areas` + FK columns.
- Backfill all venues:
  - exact canonical matches
  - alias matches
  - review queue for unresolved values
- Update API filters and search RPCs to use canonical IDs/slugs.

### Phase 3 (hardening)

- Add CI/data gates:
  - fail if new non-canonical neighborhood values exceed threshold
  - fail if fallback coordinate hotspots increase
- Weekly automated location audit report in `reports/`.

## Immediate candidates for cleanup

High-event venues with missing neighborhood/coords should be first-pass corrected:

- `MJCCA` (319 future events, missing neighborhood)
- `Atlanta Marriott Northwest at Galleria` (220 future events, missing neighborhood)
- `Online / Virtual Event` (expected special case; ensure it is excluded from neighborhood UX)
- `This event's address is private. Sign up for more details` (expected private case; exclude from neighborhood UX)
- `Community Location` (expected private case; exclude from neighborhood UX)

## Notes

- This audit uses a live data snapshot taken on 2026-02-19; counts will change as crawlers run.
- The location redesign should preserve current portal attribution/scope rules while moving matching/filtering to canonical location entities.
