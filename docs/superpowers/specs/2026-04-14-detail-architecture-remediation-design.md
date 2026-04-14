# Detail Architecture Remediation — Design Spec

**Goal:** Address the structural issues behind the 24-file broken link fix — centralized URL generation, exhibition system completion, portal data integrity, and entity evolution.

**Scope:** Four phases, each independently shippable. Phases are ordered by priority and dependency.

---

## Phase 1: Routing Hygiene

### Problem

160+ entity links are string-concatenated inline across the codebase. No shared function decides overlay vs. canonical based on context. This caused the 24-file breakage and will continue producing broken links as the codebase grows.

### Design

**New module: `web/lib/entity-urls.ts`**

Centralized URL builders for all entity types. Two context modes:

- `'feed'` — overlay pattern (`?event={id}`) for use inside feed/explore/calendar surfaces where scroll preservation matters
- `'page'` — canonical pattern (`/events/{id}`) for standalone detail pages, sharing, SEO, cross-entity links

```typescript
buildEventUrl(id: number, portalSlug: string, context: 'feed' | 'page'): string
buildSpotUrl(slug: string, portalSlug: string, context: 'feed' | 'page'): string
buildSeriesUrl(slug: string, portalSlug: string, seriesType?: string): string  // always canonical, routes to /showtimes/ for film type
buildFestivalUrl(slug: string, portalSlug: string): string  // always canonical
buildExhibitionUrl(slug: string, portalSlug: string): string  // always canonical
buildArtistUrl(slug: string, portalSlug: string): string  // always canonical
buildOrgUrl(slug: string, portalSlug: string): string  // always canonical (overlay ?org= also exists)
```

Events and spots get the context parameter because they're the only two entities with overlay support in `detail-entry-contract.ts`. Everything else is always canonical.

**Civic routing coexistence:** `getCivicEventHref()` in `web/lib/civic-routing.ts` remains a separate pre-check. It routes government/community/volunteer events to dedicated civic pages (`/meetings/`, `/volunteer/`) based on portal vertical and event category. The URL builder handles the non-civic path. Call pattern at usage sites remains: `getCivicEventHref(event, portalSlug, vertical) ?? buildEventUrl(id, portalSlug, context)`. The CLAUDE.md update documents this two-step pattern.

**Fix overlay leak on standalone pages:**

These pages use overlay links (`?spot=` or the now-fixed `?venue=`) for venues, but they're standalone pages with no feed overlay router beneath them. The links currently navigate to the feed root with a query param that no router catches:

- `web/app/[portal]/volunteer/[id]/page.tsx` — venue links: change to canonical `/spots/{slug}`
- `web/app/[portal]/meetings/[id]/page.tsx` — venue link: change to canonical `/spots/{slug}`
- `web/app/[portal]/exhibitions/[slug]/page.tsx` — "Plan My Visit" CTA: change to canonical `/spots/{slug}`

**CLAUDE.md update:**

Replace the rule "No new shared query-overlay routing" with: "All entity URLs must use `entity-urls.ts` builders. Overlay context (`'feed'`) is only valid inside feed/explore/calendar surface components. Standalone detail pages must use `'page'` context. Civic events use `getCivicEventHref()` as a pre-check before the URL builder."

**Not in scope:** Migrating all 160+ existing inline links to the builder. Progressive adoption — new code uses it, old code migrates opportunistically.

---

## Phase 2: Exhibition System Completion

### Problem

Exhibitions graduated from "a kind of event" (`content_kind='exhibit'`) to their own entity (`exhibitions` table), but the extraction was never finished. Three gaps:

1. Event feeds don't filter `content_kind='exhibit'` — stale exhibit-events leak into feeds
2. Exhibition search retrieval layer is missing — types/presentation exist but the DB query doesn't
3. No FK between `exhibitions` and `events` — no way to link related events to an exhibition

### Design

**2a. Feed filter (immediate insurance)**

Add `.neq("content_kind", "exhibit")` to ALL event query paths in the feed pipeline. The architect review identified 6-8 paths, not just 3:

Primary (via `buildEventQuery()`):
- `buildEventQuery()` in `web/lib/city-pulse/pipeline/fetch-events.ts` (~line 370)

Standalone queries in `fetch-events.ts` that bypass `buildEventQuery()`:
- Evening supplemental query (~line 539)
- Trending query (~line 559)
- Horizon pool query (~line 584)
- `buildInterestQueries()` (~line 427)
- `fetchNewFromSpots()` (~line 728)

Search queries:
- `getFilteredEventsWithSearch()` in `web/lib/event-search.ts` (NOT `search.ts`)
- `getFilteredEventsWithCursor()` in `web/lib/event-search.ts`

Spot detail:
- Upcoming events query in `web/lib/spot-detail.ts` (~line 544) — exhibits at a museum would otherwise show in the venue's events alongside their proper exhibition page

**2b. Exhibitions in search**

The search type system already partially supports exhibitions:
- `EntityType` union in `web/lib/search/types.ts` includes `"exhibition"`
- `input-schema.ts` allows it, `presenting/grouped.ts` has labels and ordering
- `search-service.ts` has group caps defined

What's missing: the `search_unified` RPC function in `web/lib/search/unified-retrieval.ts` only searches `["event", "venue"]` by default and has no exhibitions CTE.

Work needed:
- Add an `exhibitions` CTE to the `search_unified` database function (or the Supabase RPC)
- Extend the default type list to include `"exhibition"`
- Verify portal scoping via `source_id` / `portal_id` filtering

**2c. `exhibition_id` FK on events**

Database migration:
```sql
ALTER TABLE events ADD COLUMN exhibition_id UUID REFERENCES exhibitions(id);
CREATE INDEX idx_events_exhibition_id ON events(exhibition_id) WHERE exhibition_id IS NOT NULL;
```

This lets "opening night" or "artist talk" events link to their parent exhibition. The exhibition detail page can query related events via this FK instead of the current loose venue-based "Also at this venue" section.

Note: `exhibition_id` is UUID type to match `exhibitions.id`. One event links to at most one exhibition; multiple events can link to the same exhibition. Standard many-to-one — no junction table needed.

The FK is only useful if crawlers populate it. Phase 2d covers the crawler-side documentation. Actual crawler updates to populate `exhibition_id` on related events are future work — the FK exists as infrastructure for when exhibition crawlers are enhanced.

**2d. Deprecate `content_kind='exhibit'`**

- Update `crawlers/ARCHITECTURE.md` to document: crawlers must create exhibitions in the `exhibitions` table, never as events with `content_kind='exhibit'`
- Events that relate to exhibitions use the `exhibition_id` FK instead
- Don't DROP the column or modify the CHECK constraint — that's future cleanup
- The value `'special'` is similarly vestigial (place_specials is now its own table) but also out of scope for this pass

**Phase 2 is a prerequisite for starting P4 Arts portal build.** The exhibition FK and search integration are the data layer the Arts portal will depend on. If P4 kicks off before Phase 2 ships, the build agent will either skip the FK or re-implement it inconsistently.

---

## Phase 3: Portal Data Integrity

### Problem

Entity detail pages fetch by ID/slug with no portal access check. Any event is viewable under any portal URL (`/forth/events/12345` shows the same event as `/atlanta/events/12345`), even if that event's source isn't federated to FORTH. Federation is enforced at the feed level but not at the detail page level.

### Design

**Approach: Soft redirect with cross-portal banner for B2B portals**

If an entity's source isn't federated to the current portal, redirect to the entity under its canonical portal (the source's `owner_portal_id`).

**B2B portal exception:** For distribution portals (FORTH, future hotel clients), a silent redirect is wrong — the guest leaves the white-labeled experience without understanding why. Instead of redirecting, render a cross-portal banner: "This event isn't part of our [Portal Name] collection. [View on Lost City Atlanta →]". This keeps the guest in the branded portal and makes the curation feel intentional. Detect distribution portals via `portals.portal_type` or a similar field.

**Portal lookup — avoid extra DB round-trip:**

Instead of a separate `getCanonicalPortalForSource()` helper, include the source's portal slug in the initial entity fetch via a join:
```sql
source:sources(owner_portal_id, portal:portals(slug))
```
This piggybacks on the existing query — zero additional round trips.

**Add `source_id` to Event TypeScript type:** The `Event` type in `web/lib/supabase.ts` doesn't expose `source_id` even though `getEventById` uses `select(*)`. Add it to the type definition so the portal check doesn't require a cast.

**Pages to update:**
- `web/app/[portal]/events/[id]/page.tsx`
- `web/app/[portal]/series/[slug]/page.tsx`
- `web/app/[portal]/festivals/[slug]/page.tsx`
- `web/app/[portal]/exhibitions/[slug]/page.tsx`

**Spots excluded from scope:** Places have no `source_id` or `portal_id`. Venues are shared infrastructure — The Earl legitimately appears on both Atlanta and Arts portals. Portal access checks don't apply to venues.

**Not in scope:** Locking down API routes. The `/api/events/[id]` route serves the overlay system and doesn't have portal context in the URL — it stays open. Portal scoping is a presentation-layer concern.

---

## Phase 4: Entity Evolution

### 4a. Series Film/Show Route Split

**Problem:** `/series/[slug]` serves two fundamentally different pages. A film page (poster hero, runtime, director, rating, theater showtimes) shares no UI with a recurring show page (frequency, day of week, upcoming events). The URL `/series/nosferatu` is semantically wrong for a movie.

**Design:**

New route: `web/app/[portal]/showtimes/[slug]/page.tsx`

The `/showtimes` route already owns film discovery (`/showtimes` is the showtime board). Placing film detail under `/showtimes/[slug]` creates a natural hierarchy:
- `/showtimes` — all films playing now (the "what's on" board)
- `/showtimes/nosferatu` — this specific film's detail page

Implementation:
- Handles series where `series_type='film'`
- Film-specific layout: poster hero mode, runtime/director/rating metadata, showtimes grouped by theater
- Same data layer: `getSeriesBySlug()`, `getSeriesEvents()` — only rendering differs

The existing `/series/[slug]` page:
- Continues handling `recurring_show`, `class_series`, `festival_program`, `tour`, `other`
- Adds early check: if fetched series has `series_type='film'`, `permanentRedirect()` to `/showtimes/[slug]` (301, not the default 307 from `redirect()`)
- Old `/series/` URLs for films keep working via this permanent redirect — Google transfers ranking

The `buildSeriesUrl()` function in `entity-urls.ts`:
- Accepts optional `seriesType` parameter
- Returns `/showtimes/{slug}` when type is `'film'`, `/series/{slug}` otherwise

No schema changes needed.

---

## ~~Phase 4b: Event Slugs~~ — DEFERRED

**Moved to backlog.** All three expert reviewers agreed: weak ROI at current product stage, large cross-system blast radius (DB + crawlers + web routing), and format needs more design work. Revisit after Arts portal is live and FORTH is closed, when SEO surface and sharing patterns are better understood.

Key design decisions to resolve when revisited:
- Slug format: `{title}-{date}` (drop venue — date provides sufficient uniqueness)
- Truncation rules for long titles (cap at ~60 chars before date)
- Virtual/venue-less event fallback
- Collision resolution algorithm
- Blast radius: every event query path needs to fetch/expose the slug field

---

## Cleanup

**Volunteer "More from this group" placeholder:**

`web/app/[portal]/volunteer/[id]/page.tsx` (~lines 530-536) renders a visible section with hardcoded text "More opportunities from X will appear here." This is smoke and mirrors on a live portal. Remove the entire section. It can be rebuilt when the data query exists.

**Route audit for empty states:**

Audit these portal routes that exist in the directory structure but whose data layer may not be confirmed working:
- `/[portal]/studios/` — listed in Arts portal design but may render empty
- `/[portal]/open-calls/` — listed as P4 remaining work

If these routes render empty/placeholder states, either add proper empty state messaging or remove the routes until the data layer ships.

---

## Dependency Graph

```
Phase 1 (URL builder) ← no dependencies, ship first
Phase 2a (feed filter) ← no dependencies, can ship with Phase 1
Phase 2b (search) ← no dependencies
Phase 2c (exhibition FK) ← database migration, independent
Phase 2d (deprecate content_kind) ← after 2c
Phase 3 (portal access) ← independent, needs source join in entity queries
Phase 4a (showtimes route) ← depends on Phase 1 (uses buildSeriesUrl)
Cleanup ← no dependencies
```

**Suggested shipping order:**
1. Phase 1 + 2a + Cleanup (routing hygiene, feed filter, placeholder/route audit)
2. Phase 2b + 2c + 2d (exhibition search + FK + deprecation) — **prerequisite for P4 Arts build**
3. Phase 3 (portal access checks)
4. Phase 4a (showtimes route split)
