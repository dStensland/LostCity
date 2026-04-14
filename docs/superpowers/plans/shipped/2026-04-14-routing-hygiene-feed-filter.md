# Routing Hygiene + Feed Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a centralized entity URL builder, fix overlay links on standalone pages, add content_kind='exhibit' feed filter, and remove smoke-and-mirrors placeholders.

**Architecture:** New `web/lib/entity-urls.ts` module provides context-aware URL builders for all entity types. `web/lib/feed-gate.ts` gets a content_kind filter that propagates to all feed queries. Standalone pages switch from overlay to canonical links. Volunteer placeholder removed.

**Tech Stack:** Next.js 16, TypeScript, Supabase PostgREST

**Spec:** `docs/superpowers/specs/2026-04-14-detail-architecture-remediation-design.md` (Phase 1 + 2a + Cleanup)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `web/lib/entity-urls.ts` | Create | Centralized URL builders |
| `web/lib/__tests__/entity-urls.test.ts` | Create | Tests for URL builders |
| `web/lib/feed-gate.ts` | Modify | Add content_kind='exhibit' filter |
| `web/lib/city-pulse/pipeline/fetch-events.ts` | Modify | Add content_kind filter to 5 standalone queries |
| `web/lib/event-search.ts` | Modify | Add content_kind filter to 2 search functions |
| `web/lib/spot-detail.ts` | Modify | Add content_kind filter to upcoming events query |
| `web/app/[portal]/exhibitions/[slug]/page.tsx` | Modify | Fix "Plan My Visit" CTA from overlay to canonical |
| `web/app/[portal]/volunteer/[id]/page.tsx` | Modify | Fix venue links + remove placeholder section |
| `web/app/[portal]/meetings/[id]/page.tsx` | Modify | Fix venue link from overlay to canonical |
| `web/CLAUDE.md` | Modify | Update overlay routing rule |

---

### Task 1: Create entity URL builder module with tests

**Files:**
- Create: `web/lib/entity-urls.ts`
- Create: `web/lib/__tests__/entity-urls.test.ts`

- [ ] **Step 1: Write tests for the URL builder**

```typescript
// web/lib/__tests__/entity-urls.test.ts
import { describe, it, expect } from "vitest";
import {
  buildEventUrl,
  buildSpotUrl,
  buildSeriesUrl,
  buildFestivalUrl,
  buildExhibitionUrl,
  buildArtistUrl,
  buildOrgUrl,
} from "@/lib/entity-urls";

describe("entity-urls", () => {
  describe("buildEventUrl", () => {
    it("returns overlay URL in feed context", () => {
      expect(buildEventUrl(123, "atlanta", "feed")).toBe("/atlanta?event=123");
    });
    it("returns canonical URL in page context", () => {
      expect(buildEventUrl(123, "atlanta", "page")).toBe("/atlanta/events/123");
    });
  });

  describe("buildSpotUrl", () => {
    it("returns overlay URL in feed context", () => {
      expect(buildSpotUrl("the-earl", "atlanta", "feed")).toBe("/atlanta?spot=the-earl");
    });
    it("returns canonical URL in page context", () => {
      expect(buildSpotUrl("the-earl", "atlanta", "page")).toBe("/atlanta/spots/the-earl");
    });
  });

  describe("buildSeriesUrl", () => {
    it("returns /series/ for recurring shows", () => {
      expect(buildSeriesUrl("tuesday-jazz", "atlanta")).toBe("/atlanta/series/tuesday-jazz");
    });
    it("returns /series/ when no seriesType provided", () => {
      expect(buildSeriesUrl("tuesday-jazz", "atlanta")).toBe("/atlanta/series/tuesday-jazz");
    });
    it("returns /showtimes/ for film type", () => {
      expect(buildSeriesUrl("nosferatu", "atlanta", "film")).toBe("/atlanta/showtimes/nosferatu");
    });
    it("returns /series/ for non-film types", () => {
      expect(buildSeriesUrl("tuesday-jazz", "atlanta", "recurring_show")).toBe("/atlanta/series/tuesday-jazz");
    });
  });

  describe("buildFestivalUrl", () => {
    it("returns canonical festival URL", () => {
      expect(buildFestivalUrl("shaky-knees", "atlanta")).toBe("/atlanta/festivals/shaky-knees");
    });
  });

  describe("buildExhibitionUrl", () => {
    it("returns canonical exhibition URL", () => {
      expect(buildExhibitionUrl("picasso-blue", "arts")).toBe("/arts/exhibitions/picasso-blue");
    });
  });

  describe("buildArtistUrl", () => {
    it("returns canonical artist URL", () => {
      expect(buildArtistUrl("big-boi", "atlanta")).toBe("/atlanta/artists/big-boi");
    });
  });

  describe("buildOrgUrl", () => {
    it("returns canonical org URL", () => {
      expect(buildOrgUrl("dad-garage", "atlanta")).toBe("/atlanta?org=dad-garage");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run lib/__tests__/entity-urls.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the URL builder**

```typescript
// web/lib/entity-urls.ts

/**
 * Centralized URL builders for all entity types.
 *
 * Two context modes:
 * - 'feed': overlay pattern (?event=id) — scroll preservation in feed/explore/calendar
 * - 'page': canonical pattern (/events/id) — standalone pages, sharing, SEO
 *
 * Civic events use getCivicEventHref() as a pre-check before this builder.
 * See web/lib/civic-routing.ts.
 */

type LinkContext = "feed" | "page";

export function buildEventUrl(id: number, portalSlug: string, context: LinkContext): string {
  if (context === "feed") return `/${portalSlug}?event=${id}`;
  return `/${portalSlug}/events/${id}`;
}

export function buildSpotUrl(slug: string, portalSlug: string, context: LinkContext): string {
  if (context === "feed") return `/${portalSlug}?spot=${slug}`;
  return `/${portalSlug}/spots/${slug}`;
}

export function buildSeriesUrl(slug: string, portalSlug: string, seriesType?: string): string {
  if (seriesType === "film") return `/${portalSlug}/showtimes/${slug}`;
  return `/${portalSlug}/series/${slug}`;
}

export function buildFestivalUrl(slug: string, portalSlug: string): string {
  return `/${portalSlug}/festivals/${slug}`;
}

export function buildExhibitionUrl(slug: string, portalSlug: string): string {
  return `/${portalSlug}/exhibitions/${slug}`;
}

export function buildArtistUrl(slug: string, portalSlug: string): string {
  return `/${portalSlug}/artists/${slug}`;
}

export function buildOrgUrl(slug: string, portalSlug: string): string {
  return `/${portalSlug}?org=${slug}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run lib/__tests__/entity-urls.test.ts 2>&1 | tail -10`
Expected: All tests PASS

- [ ] **Step 5: Run tsc**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -10`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add web/lib/entity-urls.ts web/lib/__tests__/entity-urls.test.ts
git commit -m "feat: add centralized entity URL builder module

Context-aware URL generation for all entity types. 'feed' context
produces overlay URLs (?event=id) for scroll preservation. 'page'
context produces canonical URLs (/events/id) for standalone pages,
sharing, and SEO. Film series route to /showtimes/{slug}."
```

---

### Task 2: Add content_kind='exhibit' filter to feed gate

**Files:**
- Modify: `web/lib/feed-gate.ts:18-21`

The `applyFeedGate` function is the shared filter applied to all feed event queries. Adding the content_kind filter here catches all callers that use it. However, 5 standalone queries in `fetch-events.ts` and 2 in `event-search.ts` skip `applyFeedGate` — those are handled in Task 3.

- [ ] **Step 1: Add content_kind filter to applyFeedGate**

In `web/lib/feed-gate.ts`, modify the `applyFeedGate` function:

```typescript
// old (lines 18-21):
export function applyFeedGate<T extends { or: (...args: any[]) => any }>(query: T): T {
  return query
    .or("is_feed_ready.eq.true,is_feed_ready.is.null");
}

// new:
export function applyFeedGate<T extends { or: (...args: any[]) => any; neq: (...args: any[]) => any }>(query: T): T {
  return query
    .or("is_feed_ready.eq.true,is_feed_ready.is.null")
    .neq("content_kind", "exhibit");
}
```

- [ ] **Step 2: Run tsc**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -10`
Expected: Clean (the type constraint addition may need adjustment — if tsc errors on the generic, check callers)

- [ ] **Step 3: Commit**

```bash
git add web/lib/feed-gate.ts
git commit -m "fix: filter content_kind='exhibit' from feed gate

Exhibit-events in the events table are duplicates of their proper
exhibition pages. This prevents them from appearing in event feeds
across all callers of applyFeedGate."
```

---

### Task 3: Add content_kind filter to standalone queries

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts` — 5 query locations
- Modify: `web/lib/event-search.ts` — 2 query locations
- Modify: `web/lib/spot-detail.ts` — 1 query location

These queries build their own Supabase chains without calling `applyFeedGate`. Each needs `.neq("content_kind", "exhibit")` added.

- [ ] **Step 1: Add filter to fetch-events.ts standalone queries**

In `web/lib/city-pulse/pipeline/fetch-events.ts`, add `.neq("content_kind", "exhibit")` to each of these 5 query chains:

**Evening supplemental (~line 539):**
```typescript
// After line 547 (.not("category_id", "in", ...)):
          .neq("content_kind", "exhibit")
```

**Trending (~line 559):**
```typescript
// After line 568 (.not("category_id", "in", ...)):
          .neq("content_kind", "exhibit")
```

**Horizon pool (~line 584):**
```typescript
// After line 596 (.neq("is_class", true)):
          .neq("content_kind", "exhibit")
```

**buildInterestQueries (~line 427):**
```typescript
// After line 435 (.not("category_id", "in", ...)):
      .neq("content_kind", "exhibit")
```

**fetchNewFromSpots (~line 736):**
```typescript
// After line 745 (.not("category_id", "in", ...)):
    .neq("content_kind", "exhibit")
```

- [ ] **Step 2: Add filter to event-search.ts**

In `web/lib/event-search.ts`:

**getFilteredEventsWithSearch (~line 797):**
```typescript
// After line 797 (.is("canonical_event_id", null)):
    .neq("content_kind", "exhibit")
```

**getFilteredEventsWithCursor (~line 924):**
```typescript
// After line 924 (.is("canonical_event_id", null)):
    .neq("content_kind", "exhibit")
```

- [ ] **Step 3: Add filter to spot-detail.ts**

In `web/lib/spot-detail.ts`, the upcoming events query at ~line 542:

```typescript
// After line 551 (.is("canonical_event_id", null)):
      .neq("content_kind", "exhibit")
```

- [ ] **Step 4: Run tsc**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -10`
Expected: Clean

- [ ] **Step 5: Commit**

```bash
git add web/lib/city-pulse/pipeline/fetch-events.ts web/lib/event-search.ts web/lib/spot-detail.ts
git commit -m "fix: filter content_kind='exhibit' from standalone event queries

Eight query paths that bypass applyFeedGate needed the exhibit filter
added directly: evening, trending, horizon, interest, followed-spots
in fetch-events.ts; search and cursor in event-search.ts; upcoming
events in spot-detail.ts."
```

---

### Task 4: Fix overlay links on standalone detail pages

**Files:**
- Modify: `web/app/[portal]/exhibitions/[slug]/page.tsx:507`
- Modify: `web/app/[portal]/volunteer/[id]/page.tsx:300,466`
- Modify: `web/app/[portal]/meetings/[id]/page.tsx:214`

These pages use `?spot=` overlay links for venues, but they're standalone pages — no overlay router exists beneath them. Change to canonical `/spots/{slug}` links.

Note: volunteer lines 300 and 466 were already changed from `?venue=` to `?spot=` in the earlier fix branch. Now change them from `?spot=` (overlay) to canonical `/spots/` (page).

- [ ] **Step 1: Fix exhibition "Plan My Visit" CTA**

In `web/app/[portal]/exhibitions/[slug]/page.tsx`, change line 507:

```typescript
// old:
                href={`/${activePortalSlug}?spot=${venue.slug}`}

// new:
                href={`/${activePortalSlug}/spots/${venue.slug}`}
```

- [ ] **Step 2: Fix volunteer venue links**

In `web/app/[portal]/volunteer/[id]/page.tsx`, change line 300:

```typescript
// old:
                  href={`/${activePortalSlug}?spot=${venue.slug}`}

// new:
                  href={`/${activePortalSlug}/spots/${venue.slug}`}
```

And line 466:

```typescript
// old:
              href={`/${activePortalSlug}?spot=${venue.slug}`}

// new:
              href={`/${activePortalSlug}/spots/${venue.slug}`}
```

- [ ] **Step 3: Fix meetings venue link**

In `web/app/[portal]/meetings/[id]/page.tsx`, change line 214:

```typescript
// old:
              href={`/${portalSlug}?spot=${event.venue.slug}`}

// new:
              href={`/${portalSlug}/spots/${event.venue.slug}`}
```

- [ ] **Step 4: Run tsc**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -10`
Expected: Clean

- [ ] **Step 5: Commit**

```bash
git add "web/app/[portal]/exhibitions/[slug]/page.tsx" "web/app/[portal]/volunteer/[id]/page.tsx" "web/app/[portal]/meetings/[id]/page.tsx"
git commit -m "fix: change overlay venue links to canonical on standalone pages

Exhibition Plan My Visit, volunteer venue links, and meetings venue
link used ?spot= overlay params. These pages have no overlay router —
the links silently navigated to the feed. Now use canonical /spots/."
```

---

### Task 5: Remove volunteer placeholder and audit empty routes

**Files:**
- Modify: `web/app/[portal]/volunteer/[id]/page.tsx:502-537`
- Check: `web/app/[portal]/studios/page.tsx`
- Check: `web/app/[portal]/open-calls/page.tsx`

- [ ] **Step 1: Remove "More from this group" placeholder**

In `web/app/[portal]/volunteer/[id]/page.tsx`, remove the entire "More from this group" section (lines 502-537):

```typescript
// DELETE this entire block:
          {/* ── More from this group ──────────────────────────────── */}
          {event.organization && (
            <div
              className="rounded-2xl p-5"
              style={{
                backgroundColor: CARD_BG,
                border: `1px solid ${BORDER}`,
              }}
            >
              {/* Section header */}
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-xs font-mono font-bold uppercase tracking-wider"
                  style={{ color: TEXT_MUTED }}
                >
                  More From This Group
                </h2>
                <Link
                  href={`/${activePortalSlug}?org=${event.organization.slug}&category=volunteer`}
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: GREEN }}
                >
                  See all
                  <ArrowRight size={12} weight="bold" />
                </Link>
              </div>

              {/* Placeholder cards — populated when org has events */}
              <p
                className="text-sm text-center py-4"
                style={{ color: TEXT_MUTED }}
              >
                More opportunities from {event.organization.name} will appear here.
              </p>
            </div>
          )}
```

Check if `ArrowRight` import is still needed elsewhere in the file — if this was its only usage, remove the import too.

- [ ] **Step 2: Audit studios and open-calls routes**

Read `web/app/[portal]/studios/page.tsx` and `web/app/[portal]/open-calls/page.tsx`. For each:
- If the page renders real data from a query, leave it alone
- If it renders a placeholder/coming-soon message with no data query, note it as a finding to report

Do NOT modify these files — just report what you find. The spec says to audit them, not necessarily fix them.

- [ ] **Step 3: Run tsc**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -10`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add "web/app/[portal]/volunteer/[id]/page.tsx"
git commit -m "fix: remove volunteer 'More from this group' placeholder

Visible placeholder text on a live portal. The section can be rebuilt
when the org events query is implemented."
```

---

### Task 6: Update CLAUDE.md overlay routing rule

**Files:**
- Modify: `web/CLAUDE.md:36`

- [ ] **Step 1: Update the rule**

In `web/CLAUDE.md`, find line 36:

```markdown
6. **No new shared query-overlay routing.** If an overlay experience exists, it must be detail-surface code, not feed/explore/community code.
```

Replace with:

```markdown
6. **Entity URLs use `lib/entity-urls.ts` builders.** Overlay context (`'feed'`) is only valid inside feed/explore/calendar surface components. Standalone detail pages must use `'page'` context. Civic events use `getCivicEventHref()` from `lib/civic-routing.ts` as a pre-check before the URL builder (pattern: `getCivicEventHref(event, portal, vertical) ?? buildEventUrl(id, portal, context)`).
```

- [ ] **Step 2: Commit**

```bash
git add web/CLAUDE.md
git commit -m "docs: update CLAUDE.md overlay routing rule to reference entity-urls.ts"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full tsc**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: Clean build

- [ ] **Step 2: Run tests**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run 2>&1 | tail -20`
Expected: All tests pass (including new entity-urls tests)

- [ ] **Step 3: Grep for remaining overlay links on standalone pages**

Run: `grep -rn '?spot=' web/app/\[portal\]/volunteer/ web/app/\[portal\]/meetings/ web/app/\[portal\]/exhibitions/ --include="*.tsx" | grep -v ".test."`

Expected: No results — all standalone pages now use canonical links

- [ ] **Step 4: Verify content_kind filter coverage**

Run: `grep -rn 'content_kind.*exhibit\|neq.*content_kind' web/lib/feed-gate.ts web/lib/city-pulse/pipeline/fetch-events.ts web/lib/event-search.ts web/lib/spot-detail.ts`

Expected: 9 hits total (1 in feed-gate, 5 in fetch-events, 2 in event-search, 1 in spot-detail)
