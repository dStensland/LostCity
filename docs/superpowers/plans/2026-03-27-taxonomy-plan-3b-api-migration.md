# Taxonomy API Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update all API routes and portal queries to use new taxonomy — dissolving the nightlife compound filter, switching Family portal to audience-tag filtering, suppressing Support by default, and updating the noise filter to exclude dissolved categories.

**Architecture:** Nine API routes contain `category_id` queries that reference dissolved categories (`nightlife`, `community`, `family`, `recreation`, `wellness`). Each is updated in-place. The `nightlife_mode` compound filter in `portals/[slug]/feed/route.ts` is replaced with a time+venue-type+vibe filter. The feed pipeline's noise filter exclusion list is updated. The `feed_events_ready` refresh function was already updated in Plan 3a.

**Tech Stack:** Next.js API Routes (TypeScript), Supabase query builder, PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-27-event-taxonomy-redesign.md`

**Depends on:** Plan 3a (backfill) must be complete. Dissolved categories must have near-zero event counts before these API changes go live, otherwise queries will return empty results.

---

### Task 1: Audit — full list of category_id references in API routes

This task is read-only. Confirm the complete list of files to change before touching anything.

**Files to audit:**
- `web/app/api/tonight/route.ts`
- `web/app/api/feed/route.ts`
- `web/app/api/regulars/route.ts`
- `web/app/api/portals/[slug]/feed/route.ts`
- `web/app/api/portals/[slug]/preferences/route.ts`
- `web/app/api/portals/[slug]/outing-suggestions/route.ts`
- `web/app/api/whats-on/stage/route.ts`
- `web/lib/city-pulse/pipeline/fetch-events.ts`
- `web/components/find/FindFilterBar.tsx`
- `web/components/BrowseByActivity.tsx`

- [ ] **Step 1: Confirm all instances**

```bash
cd /Users/coach/Projects/LostCity/web
grep -rn "nightlife\|\"family\"\|\"community\"\|\"recreation\"\|\"wellness\"\|\"exercise\"\|\"learning\"\|\"support_group\"" \
  app/api/ lib/city-pulse/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules\|\.test\." \
  | grep -v "// " \
  | head -80
```

This produces the canonical list of lines that need changing. Review it before proceeding. Note: `best-of/`, `contests/`, `places/`, `showtimes/` routes use `category_id` but they reference the `best_of_nominations`, `best_of_votes`, and `places`/`events` tables with user-supplied category values — those are not taxonomy-constrained and need no change.

---

### Task 2: Update `web/lib/city-pulse/pipeline/fetch-events.ts` — noise filter

The noise filter currently excludes `recreation, unknown, support_group, religious`. After taxonomy v2:
- `recreation` is dissolved (events now in `fitness` or `games`)
- `support_group` is renamed to `support`
- `religious` should stay excluded from the main curated feed
- Add `community`, `family`, `wellness`, `exercise`, `learning` (all dissolved categories) to prevent stale dissolved-category events from appearing if any slip through backfill

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts`

The noise filter pattern appears at these lines (approximately — confirm with grep):
- Line ~287: `.not("category_id", "in", "(recreation,unknown,support_group,religious)")`
- Line ~327: same pattern
- Line ~410: same pattern
- Line ~431: same pattern

- [ ] **Step 1: Find all noise filter lines**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "recreation,unknown" lib/city-pulse/pipeline/fetch-events.ts
```

Note every line number.

- [ ] **Step 2: Update the noise filter string at every occurrence**

Replace every instance of:
```typescript
.not("category_id", "in", "(recreation,unknown,support_group,religious)")
```

With:
```typescript
.not("category_id", "in", "(recreation,unknown,support_group,religious,support,community,family,wellness,exercise,learning)")
```

Use find-and-replace to catch all occurrences. Verify count matches what grep found in Step 1.

Note: `support` (the new category) is intentionally excluded from the main curated feed — it's for HelpATL only. This is separate from `support_group` (old name). Both are excluded here.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep "fetch-events" | head -10
```

Expected: No errors in fetch-events.ts.

---

### Task 3: Update `web/app/api/tonight/route.ts` — scoring logic

This file references dissolved categories in scoring heuristics (not in Supabase queries). Lines ~114–115 define category scoring buckets, and lines ~504–508 and ~568–570 use `cat === "nightlife"` in score penalties/bonuses.

**Files:**
- Modify: `web/app/api/tonight/route.ts`

- [ ] **Step 1: Update `HIP_CATEGORIES` and `GENERIC_CATEGORIES`**

Find lines ~114–115:
```typescript
const HIP_CATEGORIES = ["music", "comedy", "nightlife", "art", "film", "theater", "sports"];
const GENERIC_CATEGORIES = ["family", "exercise", "recreation", "classes"];
```

Replace with:
```typescript
// New taxonomy v2 — dissolved categories removed
const HIP_CATEGORIES = ["music", "comedy", "dance", "games", "art", "film", "theater", "sports"];
const GENERIC_CATEGORIES = ["fitness", "workshops", "education"];
```

- [ ] **Step 2: Update nightlife penalty at ~line 504**

Find:
```typescript
// Penalize nightlife events in the morning (likely miscategorized)
if (cat === "nightlife" && event.start_time) {
```

Replace with:
```typescript
// Penalize late-night-category events in the morning (likely miscategorized)
if ((cat === "music" || cat === "dance" || cat === "games") && event.start_time) {
```

The logic checks for events before 17:00 — this is now applied to the categories that replaced nightlife's content.

- [ ] **Step 3: Update weekend evening boost at ~line 568**

Find:
```typescript
if (cat === "music" || cat === "comedy" || cat === "nightlife") {
```

Replace with:
```typescript
if (cat === "music" || cat === "comedy" || cat === "dance" || cat === "games") {
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep "tonight" | head -10
```

---

### Task 4: Update `web/app/api/regulars/route.ts` — exclusion list

The regulars route explicitly excludes `film, theater, family, learning, support_group, community` from the regular hangs feed to keep it focused on recurring social activities.

**Files:**
- Modify: `web/app/api/regulars/route.ts`

- [ ] **Step 1: Find the exclusion line**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "film,theater,family" app/api/regulars/route.ts
```

- [ ] **Step 2: Update the exclusion list**

Find (approximately line 109):
```typescript
.not("category_id", "in", "(film,theater,family,learning,support_group,community)") // Showtimes, theater runs, kids events, classes, recovery meetings, volunteer shifts — never regular hangs
```

Replace with:
```typescript
.not("category_id", "in", "(film,theater,education,support,support_group,civic,volunteer,religious,community,family,learning)") // Showtimes, theater runs, civic meetings, recovery, volunteer shifts, worship — never regular hangs
```

Note: `workshops`, `words`, `fitness`, `games`, `dance`, `music`, `comedy`, `art`, `food_drink`, `outdoors`, `sports`, `conventions` are all valid regulars.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep "regulars" | head -5
```

---

### Task 5: Update `web/app/api/portals/[slug]/feed/route.ts` — nightlife_mode compound filter

This is the most complex change. The `nightlife_mode` filter currently:
1. Queries for `category_id = 'nightlife'` events (core query)
2. Queries for `music, comedy, dance` events after 17:00 (entertainment query)
3. Queries for events at `bar, nightclub, rooftop` venues after 17:00 (venue query)

After taxonomy v2, `nightlife` is dissolved. The compound filter must be updated to cover the same behavioral territory using new categories.

**Files:**
- Modify: `web/app/api/portals/[slug]/feed/route.ts`

- [ ] **Step 1: Find the nightlife_mode implementation block**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "nightlife_mode\|hasNightlifeSection\|nightlifeCoreQuery\|entertainmentQuery\|venueBasedQuery" \
  app/api/portals/[slug]/feed/route.ts | head -30
```

Note the exact line numbers of the nightlifeCoreQuery block (~line 1099–1160).

- [ ] **Step 2: Replace `nightlifeCoreQuery` (was `.eq("category_id", "nightlife")`)**

Find (approximately lines 1099–1109):
```typescript
let nightlifeCoreQuery = portalClient
  .from("events")
  .select(eventSelect)
  .or(`start_date.gte.${today},end_date.gte.${today}`)
  .lte("start_date", supplementEndDate)
  .is("canonical_event_id", null)
  .or("is_class.eq.false,is_class.is.null")
  .or("is_sensitive.eq.false,is_sensitive.is.null")
  .eq("category_id", "nightlife");
nightlifeCoreQuery = applyFeedGate(nightlifeCoreQuery);
nightlifeCoreQuery = applyPortalEventScope(nightlifeCoreQuery);
```

Replace the `nightlifeCoreQuery` with a query that captures what `nightlife` used to — social-vibe events in the evening at social-vibe venues. Use `games` as the primary replacement (trivia/bingo/poker was the bulk of nightlife content):

```typescript
// v2: nightlife dissolved — games (trivia/bingo/poker) + dance (latin/line-dancing) replace "nightlife" category
let nightlifeCoreQuery = portalClient
  .from("events")
  .select(eventSelect)
  .or(`start_date.gte.${today},end_date.gte.${today}`)
  .lte("start_date", supplementEndDate)
  .is("canonical_event_id", null)
  .or("is_class.eq.false,is_class.is.null")
  .or("is_sensitive.eq.false,is_sensitive.is.null")
  .in("category_id", ["games", "dance"])
  .gte("start_time", "17:00:00");
nightlifeCoreQuery = applyFeedGate(nightlifeCoreQuery);
nightlifeCoreQuery = applyPortalEventScope(nightlifeCoreQuery);
```

- [ ] **Step 3: Update `entertainmentQuery` — already mostly correct**

The existing entertainment query at ~line 1111 already uses `.in("category_id", ["music", "comedy", "dance"])`. This is correct for taxonomy v2. Only update the comment:

Find:
```typescript
.in("category_id", ["music", "comedy", "dance"])
.gte("start_time", "17:00:00");
```

This is already correct. Add `"games"` to prevent overlap with nightlifeCoreQuery:

Actually, leave entertainmentQuery as-is for music/comedy/dance. The nightlifeCoreQuery now handles games/dance in the evening. This creates minor duplication for `dance` — which is acceptable. Deduplication happens downstream when building the section.

- [ ] **Step 4: Update the VALID_INTERESTS list in `preferences/route.ts`**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "nightlife\|wellness\|family" app/api/portals/[slug]/preferences/route.ts
```

Find (approximately lines 32–37):
```typescript
const VALID_INTERESTS = [
  "food",
  "nightlife",
  "arts",
  "outdoors",
  "wellness",
```

Replace `"nightlife"` and `"wellness"` with new taxonomy interests:

```typescript
const VALID_INTERESTS = [
  "food",
  "music",
  "arts",
  "outdoors",
  "fitness",
  "games",
  "dance",
  "comedy",
  "theater",
  "film",
  "sports",
  "workshops",
  "education",
  "words",
  "volunteer",
  "civic",
  "conventions",
] as const;
```

This is a breaking change for any saved user preferences using the old values. Add a migration step in the comment: "Existing 'nightlife' → 'music', 'wellness' → 'fitness', 'family' → (remove, handled by audience tag)"

- [ ] **Step 5: Update `outing-suggestions/route.ts` — CATEGORY_LABELS**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "CATEGORY_LABELS\|nightlife.*Nightlife\|community.*Community" app/api/portals/[slug]/outing-suggestions/route.ts
```

Find the CATEGORY_LABELS object (~lines 178–184):
```typescript
const CATEGORY_LABELS: Record<string, string> = {
  music: "Music", comedy: "Comedy", theater: "Theater", dance: "Dance",
  film: "Film", art: "Art", food_drink: "Food & Drink", sports: "Sports",
  nightlife: "Nightlife", community: "Community", festival: "Festival",
  family: "Family", wellness: "Wellness", education: "Education",
  networking: "Networking", other: "Event",
};
```

Replace with:
```typescript
const CATEGORY_LABELS: Record<string, string> = {
  music: "Music", comedy: "Comedy", theater: "Theater", dance: "Dance",
  film: "Film", art: "Art", food_drink: "Food & Drink", sports: "Sports",
  fitness: "Fitness", outdoors: "Outdoors", games: "Games",
  workshops: "Workshops", education: "Education", words: "Words",
  conventions: "Conventions", volunteer: "Volunteer", civic: "Civic",
  support: "Support", religious: "Religious",
  // Legacy aliases kept for graceful degradation on existing saved preferences
  nightlife: "Nightlife", community: "Community", family: "Family",
  wellness: "Wellness", other: "Event",
};
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep "portals.*feed\|outing\|preferences" | head -20
```

---

### Task 6: Update Family portal queries — category to audience-tag

The Family portal currently filters events by `category_id = 'family'`. After taxonomy v2, family is dissolved. Family-appropriate events are identified by `audience_tags` containing any of `['toddler', 'preschool', 'kids', 'teen']`.

**Files to check:**
- `web/app/api/portals/[slug]/feed/route.ts` — portal category filter function
- `web/lib/portal-taxonomy.ts` — vertical definitions

- [ ] **Step 1: Find where the Family portal applies category filters**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "family\|audience_tag\|FAMILY" app/api/portals/[slug]/feed/route.ts | head -20
grep -n "applyPortalCategoryFilters\|portalFilters\.categories" app/api/portals/[slug]/feed/route.ts | head -10
```

- [ ] **Step 2: Find `applyPortalCategoryFilters` or equivalent**

```bash
cd /Users/coach/Projects/LostCity/web
grep -rn "applyPortalCategoryFilters\|portalFilters.*categories" app/api/ lib/ --include="*.ts" | head -20
```

- [ ] **Step 3: Update portal category filter to use audience_tags for family vertical**

Wherever the portal applies category filters from `portalFilters.categories`, add a special case for the family vertical:

```typescript
// If portal is family vertical, override category filter with audience_tags filter
if (portalVertical === "family") {
  query = query.overlaps("audience_tags", ["toddler", "preschool", "kids", "teen"]);
} else if (portalFilters.categories?.length) {
  query = query.in("category_id", portalFilters.categories);
}
```

The `.overlaps()` Supabase method checks if the array column overlaps with the provided array (equivalent to `audience_tags && ARRAY['toddler','preschool','kids','teen']` in SQL).

- [ ] **Step 4: Add Support suppression to all non-HelpATL portal queries**

Find the shared event query builder or each portal's feed query. Add a `.neq("category_id", "support")` filter that applies to all portals EXCEPT those with `vertical === "community"` (HelpATL).

In `web/app/api/portals/[slug]/feed/route.ts`, find the section where portal-level gates are applied (search for `applyFeedGate` or `applyPortalEventScope`):

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "applyFeedGate\|applyPortalEventScope\|is_sensitive" app/api/portals/[slug]/feed/route.ts | head -20
```

Add support suppression near the other sensitivity filters:
```typescript
// Suppress Support category from all non-civic portals
// (AA meetings, grief groups belong in HelpATL, not alongside music shows)
if (portalVertical !== "community") {
  query = query.neq("category_id", "support");
}
```

Apply this in the same place as `is_sensitive` filtering.

- [ ] **Step 5: Apply same Support suppression to `tonight/route.ts` and `feed/route.ts`**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "is_sensitive\|support_group" app/api/tonight/route.ts app/api/feed/route.ts | head -20
```

Add `.neq("category_id", "support")` alongside `.not("category_id", "in", "(recreation,unknown...)")` in both files. The base feed and tonight views are not HelpATL, so support should always be suppressed there.

In `app/api/tonight/route.ts`, add to the noise exclusion (or wherever is_sensitive is filtered):
```typescript
.neq("category_id", "support")
// also exclude old support_group name
.neq("category_id", "support_group")
```

In `app/api/feed/route.ts`, find the category exclusion block and add:
```typescript
.not("category_id", "in", "(support,support_group)")
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | grep -v "^$" | tail -15
```

Expected: No new errors. Pre-existing errors are fine.

---

### Task 7: Update `web/app/api/whats-on/stage/route.ts`

The stage route uses `STAGE_CATEGORIES = ["comedy", "theater"]`. This is already correct for taxonomy v2 — both `comedy` and `theater` are clean new categories. No category change needed. However, verify the route handles the new category IDs cleanly.

**Files:**
- Read-only check: `web/app/api/whats-on/stage/route.ts`

- [ ] **Step 1: Verify STAGE_CATEGORIES are already v2-compatible**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "STAGE_CATEGORIES\|category_id.*comedy\|category_id.*theater" app/api/whats-on/stage/route.ts
```

Expected: `STAGE_CATEGORIES = ["comedy", "theater"]` — both are valid new taxonomy values. No changes needed to this file.

---

### Task 8: Update `web/app/api/feed/route.ts` — portal category filter and favorites

- [ ] **Step 1: Find category filter usages**

```bash
cd /Users/coach/Projects/LostCity/web
grep -n "category_id\|nightlife\|family\|community" app/api/feed/route.ts | head -20
```

- [ ] **Step 2: Check the favorites query at ~line 652**

Find:
```typescript
.in("category_id", favoriteCategories)
```

This uses user-supplied favorite categories (from user preferences). No change needed here — the preferences API was updated in Task 5 to only accept new taxonomy values. Old `nightlife` favorites in the DB will simply return no results now (correct behavior — those events no longer exist under that category).

- [ ] **Step 3: Add Support suppression**

Find the main events query in the feed route. Add support suppression alongside other sensitivity filters:
```typescript
.not("category_id", "in", "(support,support_group)")
```

---

### Task 9: Test each updated route

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/coach/Projects/LostCity/web
npm run dev &
sleep 8
```

- [ ] **Step 2: Test the feed API — check that dissolved categories don't appear**

```bash
# Atlanta feed should not include support/support_group events
curl -s "http://localhost:3000/api/portals/atlanta/city-pulse" | python3 -m json.tool | \
  python3 -c "import sys,json; d=json.load(sys.stdin); cats=set(e.get('category','') for e in d.get('today',[])); print('Categories in today pool:',cats)"
```

Expected: No `nightlife`, `community`, `family`, `support`, `support_group` in results.

- [ ] **Step 3: Test the tonight API**

```bash
curl -s "http://localhost:3000/api/tonight?portalSlug=atlanta" | python3 -m json.tool | \
  python3 -c "import sys,json; d=json.load(sys.stdin); cats=set(e.get('category_id','') for e in d.get('events',[])); print('Categories tonight:',cats)"
```

Expected: Valid new taxonomy categories only.

- [ ] **Step 4: Test the regulars API**

```bash
curl -s "http://localhost:3000/api/regulars?portalSlug=atlanta" | python3 -m json.tool | \
  python3 -c "import sys,json; d=json.load(sys.stdin); cats=set(e.get('category_id','') for e in d.get('events',[])); print('Categories in regulars:',cats)"
```

Expected: No `film`, `theater`, `education`, `support`, `civic`, `volunteer`, `religious` in results.

- [ ] **Step 5: Kill dev server**

```bash
kill %1 2>/dev/null || true
```

---

### Task 10: Commit

- [ ] **Step 1: Run final TypeScript check**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | tail -5
```

- [ ] **Step 2: Run linter**

```bash
cd /Users/coach/Projects/LostCity/web && npm run lint 2>&1 | tail -10
```

- [ ] **Step 3: Commit all API migration changes**

```bash
cd /Users/coach/Projects/LostCity
git add \
  web/app/api/tonight/route.ts \
  web/app/api/feed/route.ts \
  web/app/api/regulars/route.ts \
  web/app/api/portals/[slug]/feed/route.ts \
  web/app/api/portals/[slug]/preferences/route.ts \
  web/app/api/portals/[slug]/outing-suggestions/route.ts \
  web/lib/city-pulse/pipeline/fetch-events.ts
git commit -m "feat(taxonomy): update API routes for v2 — dissolve nightlife/community/family, suppress Support"
```
