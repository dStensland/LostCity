# PRD-006: Specials Around Destinations

**Status:** Proposed  
**Date:** 2026-02-11  
**Owner:** Product + Web + Crawlers

---

## 1. Strategy Alignment (Current)

This experience is directly aligned with current strategy:

- **Destination-first** is a core principle, not a feature add-on (`STRATEGIC_PRINCIPLES.md`).
- **Specials are the differentiation layer** for hotel/corridor portals (`prds/005a-forth-strategy-context.md`).
- **Hotel vertical routing is already active** and can host a bespoke destination-specials UX (`web/app/[portal]/page.tsx`).

Design intent: make destinations the primary unit, with specials as live state on those destinations.

---

## 2. Current Architecture Snapshot (As Implemented)

### 2.1 Data Layer

- `venue_specials` exists with timing semantics (`days_of_week`, `time_start`, `time_end`, `start_date`, `end_date`) and confidence/source metadata.
- RLS allows public read and service-role write.
- `venues` has enrichment fields used by specials scraping (`menu_url`, `reservation_url`, `last_verified_at`).

### 2.2 Ingestion Layer

- `crawlers/scrape_venue_specials.py` already crawls venue pages and LLM-extracts specials/hours/menu/reservation data, then upserts to DB.
- Corridor data cleanup/seed migrations exist for FORTH context (`database/migrations/168`, `171`, `172`).

### 2.3 API Layer

- `/api/specials` exists with proximity and `active_now` filtering and returns proximity tier metadata (`walkable`, `close`, `destination`).
- `/api/spots` exists but is neighborhood/city-filter driven and does **not** support geo-center distance ranking or specials joins.
- `/api/portals/[slug]/feed` powers event sections but currently does not enrich feed items with distance/specials context.

### 2.4 Frontend Layer (Hotel)

- Hotel template is active via portal vertical switch (`vertical=hotel`).
- Current hotel feed still uses:
  - Hardcoded amenities,
  - Hardcoded neighborhood list for spots fetch,
  - No specials API integration,
  - Static section ordering.

---

## 3. Gap Summary

1. **Specials data exists but is orphaned from destination UX.**
2. **Destination feed is still neighborhood-string based instead of geo-center based.**
3. **No merged model of destination + live/off-hours special state.**
4. **No time-aware section lead logic despite strategy requiring it.**
5. **FORTH hotel amenities are still static copy, not DB-backed venue entities.**

---

## 4. Product Design: “Destination Specials Graph”

### 4.1 Core UX Principle

Users do not think in separate objects:
- They choose a **destination**,
- Then evaluate **what is happening there now/soon**.

So the UI should rank and render by destination, with specials as state badges/cards.

### 4.2 Experience Structure (Hotel Vertical)

1. **Right Now Near You** (new lead section)
- Destination cards with active specials only.
- Sorted by: proximity tier -> time remaining -> confidence -> quality signals.
- Card payload: venue, special title, price note, time remaining, proximity label.

2. **Tonight Picks**
- Existing event-forward section, but each card gets destination context (distance + active special preview when available).

3. **Neighborhood / Destination Explorer**
- Destination cards grouped by `walkable`, `close`, `destination`.
- Each destination shows one of:
  - `Live now` special,
  - `Starts at X` upcoming special,
  - `No current specials` fallback.

4. **Where to Eat / Where to Drink**
- Kept as category slices, but ordered by “special relevance now” + proximity.

5. **FORTH Hotel Venues**
- Replace hardcoded amenities with canonical venue records and their current service windows/specials.

### 4.3 Time-Aware Reordering

Section order shifts by daypart (content not hidden):
- 7-10am: coffee/brunch destinations first.
- 2-5pm: “starting soon” specials first.
- 5-8pm: active specials + tonight events first.
- 8pm-12am: nightlife/event-night specials first.

---

## 5. Technical Design

### 5.1 API Contract (New)

Add portal-scoped destination-specials endpoint:

`GET /api/portals/[slug]/destinations/specials`

Query params:
- `active_now=true|false` (default false)
- `include_upcoming_hours=2` (default 2)
- `radius_km` (default from portal `filters.geo_radius_km`)
- `types=happy_hour,brunch,event_night`
- `tiers=walkable,close,destination`
- `limit`

Response shape:
- `destinations[]`
  - `venue` (id, slug, name, type, neighborhood, image, distance, proximity)
  - `special_state` (`active_now` | `starting_soon` | `none`)
  - `top_special` (single object)
  - `specials[]` (optional for expanded card)
  - `social_proof` (follower/recommendation counts)
- `meta` (center, radius, tier counts, active counts)

Why new route (vs only `/api/specials`):
- `/api/specials` is special-first; this experience is destination-first.
- We need one destination row with computed special state + best special selection.

### 5.2 API Contract (Extend Existing)

Extend `/api/spots` with optional geo params:
- `center_lat`, `center_lng`, `radius_km`, `sort=distance|special_relevance|hybrid`
- return `distance_km`, `walking_minutes`, `proximity_tier`, `proximity_label`

This removes hardcoded neighborhood dependencies and enables shared destination behavior beyond hotel portals.

### 5.3 Ranking Logic

Per destination score (default `hybrid`):

`score = proximity_weight + special_state_weight + freshness_weight + quality_weight + social_weight`

Weights:
- `proximity_weight`: walkable > close > destination
- `special_state_weight`: active_now > starting_soon > none
- `freshness_weight`: higher when `last_verified_at` recent
- `quality_weight`: confidence high > medium > low
- `social_weight`: light bonus from follows/recommendations

Guardrail:
- For `destination` tier, require marquee threshold (high confidence OR high social proof OR known premium venue type).

### 5.4 Data Model (Minimal Additions)

No table rewrite required. Add only if needed after v1:
- `venue_specials.last_seen_at` (crawler recency)
- `venue_specials.portal_override_priority` (optional local boosting)
- `venue_specials.is_marquee` (optional explicit destination-tier inclusion)

V1 can ship with current schema.

---

## 6. Frontend Plan (Hotel v1)

In `HotelConciergeFeed`:

1. Replace spots fetch with portal-geo endpoint call.
2. Add `RightNowSpecialsSection` above Tonight.
3. Replace hardcoded `AMENITIES` with DB-backed FORTH venue query.
4. Apply daypart-based section ordering function.
5. Add compact special badge on destination cards:
- `Now · $6 cocktails · until 7 PM`
- `Starts 4 PM · Happy Hour`

UI behavior:
- No badge clutter.
- One primary special per destination card.
- Expand to see more specials only on interaction.

---

## 7. Rollout Plan

### Phase A (2-3 days): Wire existing data
- Hook hotel UI to `/api/specials` + portal geo center.
- Replace hardcoded amenities with real venue rows.
- Add basic “Right Now” section.

### Phase B (3-4 days): Destination-first endpoint
- Implement `/api/portals/[slug]/destinations/specials`.
- Extend `/api/spots` geo filters and proximity fields.
- Add ranking + tier grouping.

### Phase C (2-3 days): Polish and correctness
- Daypart reordering.
- Time remaining formatting and overnight edge cases.
- Empty-state and stale-data handling.

### Phase D (ongoing): Data quality loop
- Weekly scraper pass for high-impact corridors.
- Confidence and freshness audits.
- Expand to PCM/BeltLine with same API contract.

---

## 8. Acceptance Criteria

1. Hotel homepage shows active specials within 1 request cycle after load.
2. No hardcoded neighborhood filters in hotel destination fetch path.
3. No hardcoded FORTH amenities in frontend source.
4. Destination cards display proximity + special state in all dayparts.
5. `walkable/close/destination` tiers visible and coherent.
6. At least 80% of shown specials have non-null `source_url` and confidence metadata.

---

## 9. Risks and Mitigations

- **Risk:** stale or wrong specials reduce trust.
  - **Mitigation:** freshness weight + confidence labeling + source URL traceability.

- **Risk:** noisy low-quality destination tier cards.
  - **Mitigation:** marquee threshold for `destination` tier.

- **Risk:** overfitting to FORTH-only logic.
  - **Mitigation:** keep portal-scoped endpoint generic; reuse for PCM and future hotel/corridor portals.

---

## 10. Immediate Build Order Recommendation

1. Ship Phase A quickly to make specials visible in hotel UX now.
2. Start Phase B in parallel so destination-first API becomes the long-term contract.
3. Use FORTH as validation; template the same behavior for PCM without branching logic.
