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
buildSeriesUrl(slug: string, portalSlug: string, seriesType?: string): string  // always canonical, routes to /films/ for film type
buildFestivalUrl(slug: string, portalSlug: string): string  // always canonical
buildExhibitionUrl(slug: string, portalSlug: string): string  // always canonical
buildArtistUrl(slug: string, portalSlug: string): string  // always canonical
```

Events and spots get the context parameter because they're the only two entities with overlay support in `detail-entry-contract.ts`. Everything else is always canonical.

**Fix overlay leak on standalone pages:**

These pages currently use `?spot=` overlay links for venues, but they're standalone pages with no feed overlay router beneath them:

- `web/app/[portal]/volunteer/[id]/page.tsx` — lines 300, 466: change to `buildSpotUrl(slug, portal, 'page')`
- `web/app/[portal]/meetings/[id]/page.tsx` — line 214: same
- `web/app/[portal]/exhibitions/[slug]/page.tsx` — line 508 ("Plan My Visit" CTA): same

**CLAUDE.md update:**

Replace the rule "No new shared query-overlay routing" with: "All entity URLs must use `entity-urls.ts` builders. Overlay context (`'feed'`) is only valid inside feed/explore/calendar surface components. Standalone detail pages must use `'page'` context."

**Not in scope:** Migrating all 160+ existing inline links to the builder. Progressive adoption — new code uses it, old code migrates opportunistically.

---

## Phase 2: Exhibition System Completion

### Problem

Exhibitions graduated from "a kind of event" (`content_kind='exhibit'`) to their own entity (`exhibitions` table), but the extraction was never finished. Three gaps:

1. Event feeds don't filter `content_kind='exhibit'` — stale exhibit-events leak into feeds
2. Exhibitions aren't searchable — missing from `InstantSearchEntityType`
3. No FK between `exhibitions` and `events` — no way to link related events to an exhibition

### Design

**2a. Feed filter (immediate insurance)**

Add `.neq("content_kind", "exhibit")` to these query builders:

- `buildEventQuery()` in `web/lib/city-pulse/pipeline/fetch-events.ts` (~line 370)
- `getFilteredEventsWithSearch()` in `web/lib/search.ts`
- `getFilteredEventsWithCursor()` in `web/lib/search.ts`

One-line each. Doesn't delete data — exhibit-events remain in the DB and are accessible by direct URL. Just removes them from event feeds where they duplicate their proper exhibition pages.

**2b. Exhibitions in search**

- Add `"exhibition"` to `InstantSearchEntityType` union in `web/lib/instant-search-service.ts`
- Wire up search query to hit `exhibitions` table with text matching on `title`, `description`, `tags`
- Add to `getDefaultInstantTypes()` so exhibitions surface in search results
- Portal-scope via `source_id` / `portal_id` filtering consistent with other entity types

**2c. `exhibition_id` FK on events**

Database migration:
```sql
ALTER TABLE events ADD COLUMN exhibition_id UUID REFERENCES exhibitions(id);
CREATE INDEX idx_events_exhibition_id ON events(exhibition_id) WHERE exhibition_id IS NOT NULL;
```

This lets "opening night" or "artist talk" events link to their parent exhibition. The exhibition detail page can query related events via this FK instead of the current loose venue-based "Also at this venue" section.

**2d. Deprecate `content_kind='exhibit'`**

- Update `crawlers/ARCHITECTURE.md` to document: crawlers must create exhibitions in the `exhibitions` table, never as events with `content_kind='exhibit'`
- Events that relate to exhibitions use the `exhibition_id` FK instead
- Don't DROP the column or modify the CHECK constraint — that's future cleanup
- The value `'special'` is similarly vestigial (place_specials is now its own table) but also out of scope for this pass

---

## Phase 3: Portal Data Integrity

### Problem

Entity detail pages fetch by ID/slug with no portal access check. Any event is viewable under any portal URL (`/forth/events/12345` shows the same event as `/atlanta/events/12345`), even if that event's source isn't federated to FORTH. Federation is enforced at the feed level but not at the detail page level.

### Design

**Approach: Soft redirect**

If an entity's source isn't federated to the current portal, redirect to the entity under its canonical portal (the source's `owner_portal_id`). Links always work — users land in the correct portal context.

**Helper: `getCanonicalPortalForSource(sourceId: number): Promise<string | null>`**

Looks up `sources.owner_portal_id` → `portals.slug`. Returns the portal slug that owns this source, or null if the source has no owner.

**Implementation per detail page:**

After fetching the entity, check whether the current portal has access via `portal_source_access`. If not, resolve the canonical portal slug and `redirect()`:

```typescript
// Pseudocode — same pattern for events, series, festivals, exhibitions, spots
const entity = await getEntityById(id);
if (!entity) notFound();

const canonicalPortal = await getCanonicalPortalForSource(entity.source_id);
if (canonicalPortal && canonicalPortal !== activePortalSlug) {
  redirect(`/${canonicalPortal}/events/${entity.id}`);
}
```

**Pages to update:**
- `web/app/[portal]/events/[id]/page.tsx`
- `web/app/[portal]/series/[slug]/page.tsx`
- `web/app/[portal]/festivals/[slug]/page.tsx`
- `web/app/[portal]/exhibitions/[slug]/page.tsx`
- `web/app/[portal]/spots/[slug]/page.tsx`

**Not in scope:** Locking down API routes. The `/api/events/[id]` route serves the overlay system and doesn't have portal context in the URL — it stays open. Portal scoping is a presentation-layer concern.

---

## Phase 4: Entity Evolution

### 4a. Series Film/Show Route Split

**Problem:** `/series/[slug]` serves two fundamentally different pages. A film page (poster hero, runtime, director, rating, theater showtimes) shares no UI with a recurring show page (frequency, day of week, upcoming events). The URL `/series/nosferatu` is semantically wrong for a movie.

**Design:**

New route: `web/app/[portal]/films/[slug]/page.tsx`

- Handles series where `series_type='film'`
- Film-specific layout: poster hero mode, runtime/director/rating metadata, showtimes grouped by theater
- Same data layer: `getSeriesBySlug()`, `getSeriesEvents()` — only rendering differs

The existing `/series/[slug]` page:
- Continues handling `recurring_show`, `class_series`, `festival_program`, `tour`, `other`
- Adds early redirect: if fetched series has `series_type='film'`, `redirect()` to `/films/[slug]`
- Old `/series/` URLs for films keep working via this redirect

The `buildSeriesUrl()` function in `entity-urls.ts`:
- Accepts optional `seriesType` parameter
- Returns `/films/{slug}` when type is `'film'`, `/series/{slug}` otherwise

No schema changes needed.

### 4b. Event Slugs

**Problem:** Events are the only entity using numeric IDs in URLs. `/events/12345` is worse for SEO and shareability than `/events/tuesday-jazz-the-earl-2026-04-15`.

**Design:**

**Schema:**
```sql
ALTER TABLE events ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX idx_events_slug ON events(slug) WHERE slug IS NOT NULL;
```

**Slug format:** `{slugify(title)}-{venue-slug}-{YYYY-MM-DD}` — e.g., `tuesday-jazz-the-earl-2026-04-15`. Uniqueness suffix appended if collision (e.g., `-2`).

**Slug generation:**
- At crawl time: crawler pipeline generates slug on event insert/update
- Backfill migration: one-time script generates slugs for all existing events

**Route change:** `/events/[id]` param becomes `/events/[idOrSlug]`:
- If param is numeric → ID lookup (existing behavior)
- If param is string → slug lookup
- If accessed by ID and event has a slug → 301 redirect to slug URL
- Old numeric URLs keep working and progressively redirect

**`buildEventUrl()` in entity-urls.ts:**
- Accepts `{ id: number, slug?: string }` — prefers slug when available
- Components pass both; URL builder picks the best one

**Not in scope:** Changing the events table PK. IDs remain the internal identifier. Slugs are for URL display only.

---

## Cleanup

**Volunteer "More from this group" placeholder:**

`web/app/[portal]/volunteer/[id]/page.tsx` (~lines 530-536) renders a visible section with hardcoded text "More opportunities from X will appear here." This is smoke and mirrors on a live portal. Remove the entire section. It can be rebuilt when the data query exists.

---

## Dependency Graph

```
Phase 1 (URL builder) ← no dependencies, ship first
Phase 2a (feed filter) ← no dependencies, can ship with Phase 1
Phase 2b (search) ← no dependencies
Phase 2c (exhibition FK) ← database migration, independent
Phase 2d (deprecate content_kind) ← after 2c
Phase 3 (portal access) ← independent, needs helper function
Phase 4a (films route) ← depends on Phase 1 (uses buildSeriesUrl)
Phase 4b (event slugs) ← depends on Phase 1 (uses buildEventUrl), DB migration + crawler changes
Cleanup ← no dependencies
```

**Suggested shipping order:**
1. Phase 1 + 2a + Cleanup (routing hygiene, feed filter, placeholder removal)
2. Phase 2b + 2c + 2d (exhibition search + FK + deprecation)
3. Phase 3 (portal access checks)
4. Phase 4a (films route split)
5. Phase 4b (event slugs — largest, most cross-cutting)
