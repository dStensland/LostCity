# LostCity Agentic Dev Plan

The playbook for what to build next and how. Written for AI agents.

Each phase is a self-contained block of work an agent can pick up cold. Phases within a tier can often run in parallel. Each phase lists: goal, files changed, concrete steps, and verification criteria.

**Principles for agent-driven development:**
- Prefer brute-force over elegance. 500 crawlers > 1 smart abstraction.
- Every phase should be completable in one session with clear verification.
- Agents should be able to validate their own work (tests, type checks, data queries).
- When a phase says "for each X, do Y" — that's a parallelizable loop. Spin up agents.

**Key reference docs:**
- `BACKLOG.md` — Product roadmap
- `ARCHITECTURE_PLAN.md` — System gaps and implementation priorities
- `STRATEGIC_PRINCIPLES.md` — Core hypotheses and decision framework
- `TECH_DEBT.md` — Code-level debt items
- `prds/004-taxonomy-personalization-refactor.md` — Taxonomy + personalization bible (most detailed PRD)
- `crawlers/CLAUDE.md` — Crawler patterns and data requirements
- `web/CLAUDE.md` — Web app patterns, auth, API routes

---

## Status

| Phase | Status | Date | Tier |
|-------|--------|------|------|
| A: Seal the Data Boundary | Done | 2026-02-10 | Data |
| B: Data Quality Triage | Done | 2026-02-10 | Data |
| C: Crawler Coverage Blitz | Done (batch 1) | 2026-02-10 | Data |
| D: Genre Backfill (events) | Done | 2026-02-10 | Taxonomy |
| E: Drop Subcategory | Done | 2026-02-10 | Taxonomy |
| F: Schema Migrations (genres on venues, needs on users) | Done | 2026-02-10 | Taxonomy |
| G: Onboarding Revamp (categories → genres) | Done | 2026-02-10 | UX |
| H: User Profile & Preferences UX | Done | 2026-02-10 | UX |
| I: Discovery UX (genre filter pills, cross-entity search) | Done (pre-existing) | 2026-02-10 | UX |
| J: Hotel Concierge Demo | Done | 2026-02-10 | Demo |
| K: Portal Onboarding Flow | Done | 2026-02-10 | Demo |
| L: API Route Test Coverage | Done (events route) | 2026-02-10 | Eng Health |
| M: Community Needs Tags | Done | 2026-02-10 | Network |

---

## Tier 1: Data Foundation

### Phase A: Seal the Data Boundary [DONE]

Added validation whitelists (categories, venue types, vibes, festival types), genre-to-tag mapping, new high-value tags (live-music, class), tag health metrics, and expanded the web filter UI from 17 to 31 surfaced tags.

**Files changed:** `tags.py`, `tag_inference.py`, `db.py`, `series.py`, `data_health.py`, `web/lib/search-constants.ts`

---

### Phase B: Data Quality Triage

**Goal:** Identify broken/degraded crawlers, measure tag coverage, produce fix-or-disable list.

**Why:** Phase A added validation rules. Phase B measures what breaks and prioritizes repairs.

**Steps:**

1. **Run data health diagnostic**
   ```bash
   python3 data_health.py
   ```
   Capture full output. Note entity health scores and the new tag health section.

2. **Query source health from crawl_logs**
   ```sql
   SELECT s.slug, s.name,
     COUNT(*) as runs,
     SUM(CASE WHEN cl.status = 'success' THEN 1 ELSE 0 END) as successes,
     AVG(cl.events_found) as avg_found,
     AVG(cl.events_new) as avg_new
   FROM crawl_logs cl
   JOIN sources s ON s.id = cl.source_id
   WHERE cl.started_at > NOW() - INTERVAL '30 days'
   GROUP BY s.slug, s.name
   HAVING COUNT(*) >= 2
   ORDER BY (SUM(CASE WHEN cl.status = 'success' THEN 1 ELSE 0 END)::float / COUNT(*)) ASC
   LIMIT 30;
   ```

3. **Query category distribution and NULL categories by source**

4. **Produce triage report** — Save to `reports/data_quality_triage_YYYY-MM-DD.md`

5. **Disable broken sources** via `scripts/disable_broken_sources.py`

**Verification:** `data_health.py` runs clean. Triage report exists with actionable recommendations.

---

### Phase C: Crawler Coverage Blitz (can run in parallel with anything)

**Goal:** Add 50+ new venue crawlers for Atlanta neighborhoods with gaps.

**Why:** Coverage is the moat (Strategic Principle 2). The long tail of local venues is where no competitor can follow.

**Agent pattern:** For each venue, an agent should:
1. Visit the venue's website
2. Run `python scripts/source_audit.py --url <url>` to determine best method
3. Create crawler file in `sources/<slug>.py` following patterns in `crawlers/CLAUDE.md`
4. Include complete VENUE_DATA with lat/lng, neighborhood, venue_type, vibes
5. Test with `python main.py --source <slug> --verbose`
6. Register source in DB

**Priority neighborhoods:** Little Five Points, East Atlanta Village, Edgewood Ave, Virginia-Highland, Midtown, Old Fourth Ward, Decatur, West Midtown, Inman Park, Downtown. Full venue lists in `crawlers/CLAUDE.md`.

**Also expand:** Coffee shops, restaurants with events, breweries, bookstores, fitness/wellness venues.

**Verification:** Each new crawler runs successfully, produces valid events or at minimum creates the venue record with full data.

---

## Tier 2: Taxonomy (nail this down before building UX)

**Reference:** `prds/004-taxonomy-personalization-refactor.md` is the bible for this tier.

### Phase D: Genre Backfill (events) [DONE]

Enhanced `scripts/backfill_genres.py` to backfill both genres AND tags with genre context (GENRE_TO_TAGS mapping). Processed 10,000 events: 3,005 got genres from inference, 203 from subcategory migration, 802 normalized, 3,871 got new experiential tags via genre→tag mapping. 0 errors.

**Post-backfill tag health:**
- With any tags: 98.6%
- With 3+ tags: 51.5%
- With experiential tags: 46.2%
- With genres: 33.6%

**Deferred:** Venue genre backfill blocked by Phase F (needs `venues.genres` column). The `backfill_genres.py --venues-only` command is ready once the column exists.

**Script:** `scripts/backfill_genres.py` — supports `--retag-all`, `--dry-run`, `--category`, `--events-only`, `--venues-only`

---

### Phase E: Drop Subcategory [DONE]

Stopped writing subcategory across the entire stack. Subcategory→genre migration was already handled in Phase D (backfill_genres.py uses `genre_from_subcategory()`).

**Crawlers:**
- `db.py`: `event_data.pop("subcategory", None)` before insert — silently strips subcategory from any crawler that still sets it
- `pipeline_main.py`: Removed all 4 subcategory passthrough lines
- `tag_inference.py`: Marked `infer_subcategory()` as DEPRECATED (was already dead code, never called)

**Web frontend (12 files modified):**
- Removed `SubcategoryRow` filter component (stubbed to return null)
- Removed `SubcategoryChip`, `getSubcategoryLabel()`, `shouldShowSubcategory()` from `ActivityChip.tsx`
- Removed subcategory from `EventCard.tsx`, `ActiveFiltersRow.tsx`
- Removed subcategory step from onboarding flow (Categories → Neighborhoods now)
- Removed subcategory signals from `onboarding/complete` API
- Removed `subcategories` from `SearchFilters` interface and all API routes
- Removed subcategory from `useEventFilters.ts` filter state

**Still in place (intentionally):**
- `SUBCATEGORIES` constant in `search-constants.ts` (orphaned, no imports)
- `PREFERENCE_SUBCATEGORIES` in `preferences.ts` (cleanup in Phase G)
- `events.subcategory` DB column (drop after 4 weeks)
- `infer_subcategory()` function body (reference only)

**Verification:** `npx tsc --noEmit` clean. 189 pytest pass. No code writes to subcategory.

---

### Phase F: Schema Migrations [DONE]

Applied two migrations to add all taxonomy + personalization columns:

- **Migration 165** (`165_taxonomy_genre_refactor.sql`): Added `venues.genres TEXT[]` + GIN index, `festivals.genres TEXT[]` + GIN index, `genre_options.is_format`, `user_preferences.needs_accessibility/dietary/family TEXT[]`, 86 new genre_options across 12 categories, venue type normalization (sports_bar→bar, wine_bar→bar, cocktail_bar→bar), subcategory deprecation comment.
- **Migration 171** (`171_taxonomy_preferences_expansion.sql`): Added `user_preferences.favorite_genres JSONB`, `inferred_preferences.portal_id UUID` + FK, updated events search vector (replaced `subcategory` with `genres` at weight B), updated venues search vector (added `genres` at weight B), backfilled 4,050 event search vectors, created `venue_genre_inference` materialized view (427 venue-genre pairs from 365-day event history).
- **Venue genre backfill**: Ran `backfill_genres.py --venues-only` — 241 venues updated with genres inferred from event history, 0 errors.
- **TypeScript types regenerated**: All 7 new columns reflected in `database.types.ts`. `npx tsc --noEmit` clean.

---

## Tier 3: UX Foundations (patterns every portal will use)

### Phase G: Onboarding Revamp

**Goal:** Replace the current 3-step onboarding (categories → subcategories → neighborhoods) with the PRD 004 flow (categories → genres → location → needs).

**Why:** The current onboarding captures subcategories (deprecated) and misses genres (the core personalization dimension) and needs (accessibility/dietary — the stickiest feature).

**Reference:** PRD 004 Section 6.1 (Onboarding)

**Current state:**
- `web/app/onboarding/page.tsx` — 3-step flow
- `web/app/onboarding/steps/CategoryPicker.tsx` — category grid
- `web/app/onboarding/steps/SubcategoryPicker.tsx` — subcategory pills (TO BE REPLACED)
- `web/app/onboarding/steps/NeighborhoodPicker.tsx` — neighborhood picker
- `web/app/api/onboarding/complete/route.ts` — saves to `user_preferences` + `inferred_preferences`

**New flow (4 screens, < 45 seconds):**

1. **"What brings you out?"** — Category selection (keep existing `CategoryPicker`, minor updates)
2. **"Dial it in"** — Genre selection (NEW: replace `SubcategoryPicker`)
   - Show genre pills based on selected categories
   - Music → jazz, hip-hop, indie, electronic, rock, country, folk, soul, etc.
   - Comedy → stand-up, improv, sketch
   - etc. (full lists in PRD 004 Section 3)
   - Multi-select, minimum 5
3. **"Where & when?"** — Location + lifestyle (update existing `NeighborhoodPicker`)
   - Add quick toggles: Weeknight / Weekend warrior / Anytime
   - Add price preference: $ / $$ / $$$ / Any
4. **"Anything we should know?"** (optional) — Needs
   - Toggle chips: Wheelchair accessible, Gluten-free, Vegan, Kid-friendly, ASL, Sensory-friendly
   - Skip is prominent
   - Saved to `user_preferences.needs_*`

**Files to change:**
- `web/app/onboarding/page.tsx` — Add step 4, rename step 2
- `web/app/onboarding/steps/GenrePicker.tsx` — NEW (replaces SubcategoryPicker)
- `web/app/onboarding/steps/NeedsPicker.tsx` — NEW
- `web/app/onboarding/steps/NeighborhoodPicker.tsx` — Add time/price toggles
- `web/app/api/onboarding/complete/route.ts` — Save genres + needs to DB
- `web/lib/preferences.ts` — Add genre lists per category, needs definitions

**Verification:** Full onboarding flow works end-to-end. Genres saved to `user_preferences.favorite_genres`. Needs saved to `user_preferences.needs_*`. `npx tsc --noEmit` clean.

---

### Phase H: User Profile & Preferences UX

**Goal:** Add taste profile and needs management to user settings.

**Why:** Users need to edit preferences after onboarding. Needs must be editable (they change — someone gets a wheelchair, has a kid, develops an allergy).

**Reference:** PRD 004 Section 6.2-6.4

**Current state:**
- `web/app/settings/profile/page.tsx` — display name, bio, location, website, public/private
- `web/app/api/preferences/profile/route.ts` — reads explicit + inferred preferences
- No UI to edit favorite genres, vibes, or needs

**Steps:**

1. **Add "Taste Profile" section to settings**
   - Show favorite categories (editable)
   - Show favorite genres per category (editable, same pills as onboarding)
   - Show favorite neighborhoods (editable)
   - Show favorite vibes (editable)
   - Show inferred preferences with "learned from your activity" label

2. **Add "Needs" section to settings**
   - Accessibility needs (wheelchair, elevator, hearing loop, ASL, etc.)
   - Dietary needs (gluten-free, vegan, halal, kosher, etc.)
   - Family needs (stroller, kid-friendly, changing table, etc.)
   - Clear messaging: "These are applied everywhere — every portal, every city"

3. **Add API endpoints**
   - `PATCH /api/preferences/profile` — update explicit preferences (genres, needs)
   - Existing GET already returns preferences

**Files to change:**
- `web/app/settings/profile/page.tsx` — Add taste + needs sections
- `web/app/api/preferences/profile/route.ts` — Add PATCH handler
- `web/lib/preferences.ts` — Needs definitions (accessibility, dietary, family)

**Verification:** Can edit genres, neighborhoods, needs from settings. Changes persist. Needs show on preference profile API.

---

### Phase I: Discovery UX (Genre Filter Pills)

**Goal:** Add genre filter pills to the Find view and cross-entity genre search.

**Why:** Users currently filter by category only. With genres populated (Phase D) and the taxonomy clean (Phase E), we can offer much richer filtering. This is the core UX improvement that makes the data layer visible.

**Reference:** PRD 004 Section 5

**Steps:**

1. **Genre filter pills in Find view**
   - When user selects a category, show genre pills below
   - Pills ordered: user's preferred genres first, then popular, then alpha
   - Multiple genres selectable (OR logic)
   - Genre selection persists in URL params (`?category=music&genres=jazz,blues`)

2. **Update search API** — `/api/events` and `/api/spots` accept `genres` param
   - Filter events by `genres @> ARRAY[...]` (contains)
   - Filter venues by `genres @> ARRAY[...]`

3. **Genre on event/venue cards**
   - Show genre pills on event cards (small, below title)
   - Show venue genres separately from vibes on venue cards

4. **Cross-entity genre search** (stretch goal)
   - URL: `/[portal]/genres/[slug]`
   - Shows events + venues + series matching genre

**Files to change:**
- `web/lib/search-constants.ts` — Add genre lists per category (from PRD 004 Section 3)
- `web/components/SimpleFilterBar.tsx` — Add genre pill row
- `web/app/api/events/route.ts` — Accept `genres` filter param
- `web/app/api/spots/route.ts` — Accept `genres` filter param
- `web/components/EventCard.tsx` — Show genre pills
- `web/components/SpotCard.tsx` — Show genre pills

**Verification:** Category + genre filtering works in Find view. URL params are shareable. Cards show genres.

---

## Tier 4: Demo Sprint

### Phase J: Hotel Concierge Demo

**Goal:** Build the FORTH Hotel concierge portal as a distinct vertical.

**Why:** First sales vertical. All the taxonomy and UX patterns from Tiers 2-3 are now in place.

**Reference:** Read ALL PRDs in `prds/001*.md` before starting.

**Key files:**
- `web/app/[portal]/_templates/hotel.tsx` (stub exists)
- `web/app/[portal]/_components/hotel/` (directory exists)

**Steps:**
1. Add `vertical` field to portal settings if not present
2. Create hotel route group with independent layout
3. Build hotel-specific components: tonight's picks, neighborhood guide, concierge CTA
4. Distinct visual language (read 001a for direction)
5. Configure FORTH Hotel portal with curated sections
6. QR code integration for in-room tablets

**Verification:** `localhost:3000/forth-hotel` renders the hotel concierge UI. `npx tsc --noEmit` clean.

---

### Phase K: Portal Onboarding Flow

**Goal:** Step-by-step portal setup wizard.

**Why:** Backlog 1.2. Self-serve portal creation for long-tail customers.

**Reference:** `prds/002-portal-onboarding-wizard.md`

**Steps:** Name/type → Branding/colors → Filters/location → Sections → Preview → Launch. Template presets by vertical.

**Verification:** Can create a new portal through the wizard flow end-to-end.

---

## Tier 5: Engineering Health

### Phase L: API Route Test Coverage

**Goal:** Add tests for the most critical API routes. Currently 139 routes, 0 tests.

**Why:** TECH_DEBT A1. Highest-risk gap.

**Priority routes:** `/api/rsvp`, `/api/saved`, `/api/auth/profile`, `/api/follow`, `/api/events`, `/api/spots`, `/api/tonight`, `/api/admin/portals`

**Pattern:** Mock Supabase, test auth (401/200), test validation (400), test happy path, test rate limiting.

**Verification:** `npx vitest run` passes with new test files.

---

## Tier 6: Network Effects

### Phase M: Community Needs Tags

**Goal:** Extend venue tag voting to accessibility/dietary/family needs across all entities.

**Why:** PRD 004 identifies needs-verified data as the #1 most defensible data in the system. "Wheelchair accessible (47 confirm)" is data no competitor has.

**Reference:** PRD 004 Section 7

**Steps:**
1. Rename `venue_tag_definitions` → `tag_definitions` with `entity_types[]`
2. Create `needs` tag category with definitions (accessibility, dietary, family, sensory)
3. Extend voting to events, series, festivals
4. Post-RSVP tag prompt: "Is this good for date night?"
5. Post-check-in vibe prompt
6. Needs auto-filter in search (deprioritize non-matching, badge confirmed matches)

**Verification:** Tags can be added/voted on events. Needs filter works in search.

---

## Appendix: Agent Coordination

### How to hand off between agents

Each phase is designed so an agent can:
1. Read this file + the relevant CLAUDE.md + any referenced PRDs
2. Execute the steps
3. Run verification
4. Update the Status table at the top of this file

### Parallelization

- **C** (crawler blitz) can run alongside ANYTHING — it's fully independent
- **B** (data triage) can run alongside C and D
- **D** and **E** are sequential (D first, then E)
- **F** (migrations) must complete before G, H, I
- **G**, **H**, **I** can run in parallel after F
- **J** and **K** are independent of each other, but wait for G/H/I
- **L** (API tests) is independent of everything
- **M** can start after F

### When to spin up sub-agents

- Phase C: one agent per 5-10 crawlers (batch by neighborhood)
- Phase L: one agent per API route group
- Any phase that says "for each X, do Y" — parallelize across X
