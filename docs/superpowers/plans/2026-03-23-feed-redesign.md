# Feed Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Atlanta feed from a flat event index into an editorial city guide with tiered hierarchy, contextual hero, noise filtering, and two new sections (destinations + portal teasers).

**Architecture:** Three phases — (1) fix the broken hierarchy by connecting existing tier components to the main feed surface and filtering noise, (2) add contextual intelligence (hero binding, news filter, See Shows), (3) build new sections (destinations, portal teasers). Phase 1 is the highest-impact, lowest-risk work.

**Tech Stack:** Next.js 16, Tailwind v4, Supabase, CityPulse pipeline (`web/lib/city-pulse/`), existing TieredEventList/HeroCard/StandardRow components

**Spec:** `docs/superpowers/specs/2026-03-23-feed-redesign.md`

---

## Phase 1: Fix the Broken Hierarchy

### Task 1: Noise Filter in Feed Pipeline

**Purpose:** Remove rec center programming, YMCA classes, and uncategorized junk from the curated feed. These events remain accessible via "See all" in the Find view.

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts:258-259`

- [ ] **Step 1: Read the current `buildEventQuery` function**

Read `web/lib/city-pulse/pipeline/fetch-events.ts` lines 243-266. Understand the existing filter chain. The noise filter goes after the `neq("category_id", "film")` line.

- [ ] **Step 2: Add category exclusion filter**

After the film exclusion (line ~259), add two filters:

**Category exclusion:**
```typescript
.not("category_id", "in", "(recreation,unknown)")
```

**YMCA source exclusion (short-term bridge until YMCA crawler sets `is_class = true`):**
```typescript
// Look up YMCA source IDs first (do this once at module level or in a cached helper)
// Query: SELECT id FROM sources WHERE slug LIKE 'ymca%' AND owner_portal_id = <atlanta_portal_id>
// Then exclude those source_ids:
.not("source_id", "in", `(${ymcaSourceIds.join(",")})`)
```

If looking up source IDs at query time is too complex, an alternative is to hardcode the YMCA source IDs from the database (query them once, add as a constant). The long-term fix is the YMCA crawler setting `is_class = true`, at which point the existing `is_class` filter handles it and this source exclusion can be removed.

The combined filter removes ~60-80 noise events per day (rec center + YMCA + uncategorized).

- [ ] **Step 3: Verify the filter works**

```bash
curl -s "http://localhost:3000/api/portals/atlanta/city-pulse" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data.get('sections', []):
    if s['type'] in ('right_now', 'tonight'):
        items = [i for i in s['items'] if i.get('item_type') == 'event']
        cats = {}
        for i in items:
            cat = i['event'].get('category', '?')
            cats[cat] = cats.get(cat, 0) + 1
        print(f'{s[\"type\"]}: {len(items)} events')
        print(f'  Categories: {sorted(cats.items(), key=lambda x: -x[1])}')
        # Verify no recreation or unknown
        assert 'recreation' not in cats, 'recreation events still present!'
        assert 'unknown' not in cats, 'unknown events still present!'
        print('  ✓ No recreation or unknown events')
"
```

- [ ] **Step 4: Run tests**

```bash
cd web && npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add web/lib/city-pulse/pipeline/fetch-events.ts
git commit -m "fix: filter recreation and unknown categories from curated feed"
```

---

### Task 2: Connect TieredEventList to LineupSection

**Purpose:** Replace the horizontal carousel of uniform cards with vertical tiered rendering (hero → featured → standard). This is the single highest-impact change.

**Files:**
- Modify: `web/components/feed/LineupSection.tsx:658-680` (rendering logic)
- Reference: `web/components/feed/TieredEventList.tsx` (already built)
- Reference: `web/lib/city-pulse/types.ts` (CityPulseEventItem, CardTier)

- [ ] **Step 1: Read LineupSection rendering logic**

Read `web/components/feed/LineupSection.tsx` lines 640-700. Find the `visibleItems` mapping that renders `CompactEventRow` in a horizontal scroll container. This is what we're replacing.

Also read `web/components/feed/TieredEventList.tsx` to understand its props:
```typescript
interface TieredEventListProps {
  events: TieredFeedEvent[];
  sectionType?: string;
  maxHero?: number;
  maxFeatured?: number;
  seeAllHref?: string;
  seeAllLabel?: string;
}
```

- [ ] **Step 2: Import TieredEventList**

Add to LineupSection.tsx imports:
```typescript
import TieredEventList from "@/components/feed/TieredEventList";
```

- [ ] **Step 3: Replace horizontal carousel with TieredEventList**

Find the rendering block (around lines 658-680) that maps `visibleItems` to `CompactEventRow` in a horizontal scroll container. Replace it with:

```tsx
<TieredEventList
  events={visibleItems.map(item => ({
    ...item.event,
    card_tier: (item.event as any).card_tier,
    editorial_mentions: (item.event as any).editorial_mentions,
  }))}
  sectionType={activeTab === "today" ? "tonight" : activeTab === "this_week" ? "this_week" : "coming_up"}
  maxHero={1}
  maxFeatured={4}
  seeAllHref={`/${portalSlug}?view=happening`}
  seeAllLabel={`See all ${tabCounts?.[activeTab === "today" ? "today" : activeTab] ?? ""} →`}
/>
```

**Important:** The `visibleItems` array contains `CityPulseEventItem` objects. TieredEventList expects `TieredFeedEvent` (which extends `FeedEventData` with `card_tier`). The `card_tier` is already on each event item from the API pipeline (added in Task 3 of the elevation plan). The cast through `as any` is a short-term bridge — a proper type unification should follow.

- [ ] **Step 4: Remove the horizontal scroll container**

Delete or comment out the old rendering code:
- The `flex gap-3 overflow-x-auto snap-x snap-mandatory` container
- The `CompactEventRow` mapping inside it
- The mobile dot navigation for the carousel
- The scroll arrow buttons (if any exist for this section)

Keep the tab bar, category chips, and "See all" link logic — those stay. Only the event rendering changes.

- [ ] **Step 5: Verify the tab/filter interaction still works**

The category chips and tab switching filter `visibleItems` before it reaches the renderer. This should still work since we're passing the same filtered array to TieredEventList. Verify:
- Switch tabs (Today / This Week / Coming Up) — events change
- Toggle category chips — events filter
- "Free" chip — free events only
- The "See all" link navigates to the Find view

- [ ] **Step 6: Browser test**

Open `http://localhost:3000/atlanta`. Verify:
- The Lineup section now shows events vertically with tiered rendering
- Hero card (full-width, image) appears for the highest-tier event
- Featured cards show in a small carousel row
- Standard events show as compact rows
- No horizontal scroll through 100+ uniform cards
- Mobile (375px) — the vertical layout works, hero card is appropriately sized

- [ ] **Step 7: TypeScript check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add web/components/feed/LineupSection.tsx
git commit -m "feat: replace Lineup horizontal carousel with vertical tiered rendering"
```

---

### Task 3: Quality-Gate Planning Horizon

**Purpose:** Only show tentpoles, festivals, and multi-day events in "On the Horizon." No more weekly open mics.

**Files:**
- Modify: `web/lib/city-pulse/section-builders.ts:1128-1227` (buildPlanningHorizonSection)
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts:365-384` (horizon query)

- [ ] **Step 1: Read current horizon filter**

Read `web/lib/city-pulse/section-builders.ts` lines 1128-1227 (`buildPlanningHorizonSection`). The current filter at lines 1136-1142 uses `importance IN ('flagship', 'major')`.

Also read `web/lib/city-pulse/pipeline/fetch-events.ts` lines 365-384 — the horizon pool query that fetches events 7-180 days out.

- [ ] **Step 2: Tighten the horizon query**

In `fetch-events.ts`, the horizon pool query (lines 365-384) already has filters for importance AND category exclusions (recreation, unknown, sports, tours). **Keep ALL existing category exclusions.** Only change the importance/quality filter:

Replace the `.in("importance", ["flagship", "major"])` filter with:
```typescript
.or("is_tentpole.eq.true,festival_id.not.is.null,importance.eq.flagship")
```

**Keep these existing filters intact** (they're already in the query):
- `.not("category_id", "in", "(sports,recreation)")` — keep
- `.neq("category_id", "unknown")` — keep
- `.neq("category_id", "tours")` — keep

The only change is: `importance IN ('flagship', 'major')` → `is_tentpole OR festival_id OR importance='flagship'`. This narrows the pool (removes `importance='major'` events that aren't tentpoles or festivals).

- [ ] **Step 3: Add multi-day filter in section builder**

In `buildPlanningHorizonSection`, after deduplication, add a filter for single-day recurring events:

```typescript
// Exclude single-day recurring events (weekly trivia, open mics)
const qualityFiltered = dedupedEvents.filter(e => {
  // Always include tentpoles and festivals
  if (e.is_tentpole || e.festival_id) return true;
  // Include multi-day events (end_date > start_date)
  if (e.end_date && e.end_date !== e.start_date) return true;
  // Include flagship importance
  if (e.importance === 'flagship') return true;
  // Exclude everything else (single-day non-tentpole events)
  return false;
});
```

- [ ] **Step 4: Verify horizon content**

```bash
curl -s "http://localhost:3000/api/portals/atlanta/city-pulse" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data.get('sections', []):
    if s['type'] == 'planning_horizon':
        items = [i for i in s['items'] if i.get('item_type') == 'event']
        print(f'Horizon: {len(items)} events')
        for i in items[:10]:
            e = i['event']
            print(f'  {e.get(\"title\",\"?\")[:50]} | tentpole:{e.get(\"is_tentpole\")} | festival:{e.get(\"festival_id\",\"none\")[:20] if e.get(\"festival_id\") else \"none\"}')
"
```

Expected: 5-15 genuinely significant events. No weekly open mics, no recurring bar nights.

- [ ] **Step 5: Commit**

```bash
git add web/lib/city-pulse/section-builders.ts web/lib/city-pulse/pipeline/fetch-events.ts
git commit -m "fix: quality-gate Planning Horizon to tentpoles, festivals, and multi-day events only"
```

---

## Phase 2: Contextual Intelligence

### Task 4: Contextual Hero Binding

**Purpose:** When a flagship event is happening today, it owns the hero. The hero image is the event's image, the headline is the event name.

**Files:**
- Modify: `web/components/feed/CityBriefing.tsx` (hero rendering)
- Modify: `web/lib/city-pulse/types.ts` (add flagship_event to ResolvedHeader or pass separately)
- Modify: `web/components/feed/CityPulseShell.tsx` (pass flagship event data to CityBriefing)
- Modify: Feed pipeline to identify and pass the flagship event

- [ ] **Step 1: Add flagship event to feed response**

In the feed pipeline (likely `web/lib/city-pulse/pipeline/build-sections.ts` or the route handler), identify today's flagship event:

```typescript
const flagshipEvent = todayEvents.find(e =>
  (e.is_tentpole || e.festival_id) && e.image_url
) ?? null;
```

Add it to the CityPulse response (or pass through `ResolvedHeader`). The CityPulseShell already receives the full response — it can extract and pass to CityBriefing.

- [ ] **Step 2: Pass flagship event to CityBriefing**

In `CityPulseShell.tsx`, extract the flagship event from the response and pass to CityBriefing:

```tsx
<CityBriefing
  header={header}
  context={context}
  portalSlug={portalSlug}
  portalId={portal.id}
  quickLinks={quickLinks}
  flagshipEvent={flagshipEvent}  // new prop
/>
```

- [ ] **Step 3: Render flagship hero in CityBriefing**

In `CityBriefing.tsx`, when `flagshipEvent` is provided:
- Use the event's `image_url` as the hero image (via SmartImage)
- Replace the time-of-day headline with the event title
- Add a gold "HAPPENING NOW" label
- Show venue + time metadata below title
- Add contextual CTAs ("Get Tickets", "Map It")
- When no flagship event: fall back to current atmospheric hero behavior

- [ ] **Step 4: Browser test**

If a flagship event exists today (check via API), verify the hero shows the event. If not, verify the atmospheric fallback works.

- [ ] **Step 5: Commit**

```bash
git add web/components/feed/CityBriefing.tsx web/components/feed/CityPulseShell.tsx
git add web/lib/city-pulse/pipeline/build-sections.ts  # or wherever flagship extraction was added
git commit -m "feat: bind hero to flagship events when present"
```

---

### Task 5: Extract News from CityBriefing + Default Filter

**Purpose:** Move the news module ("Today in Atlanta") out of CityBriefing and into its own standalone section positioned after The Lineup and Destinations. Default to Culture/Arts/Food categories.

**Files:**
- Modify: `web/components/feed/CityBriefing.tsx` (remove news rendering ~line 1060)
- Create: `web/components/feed/sections/TodayInAtlantaSection.tsx` (extracted standalone news section)
- Modify: `web/components/feed/CityPulseShell.tsx` (add as standalone section in new position)

- [ ] **Step 1: Identify the news module in CityBriefing**

Read `web/components/feed/CityBriefing.tsx`. Find the "Today in Atlanta" news module — it's rendered inside CityBriefing (around line 1060). It fetches from `/api/portals/[slug]/network-feed` and renders news posts with category tabs.

- [ ] **Step 2: Extract into standalone component**

Create `web/components/feed/sections/TodayInAtlantaSection.tsx`:
- Move the news rendering logic (fetch, tabs, post list) out of CityBriefing into this new self-contained component
- Props: `portalSlug: string`
- Self-fetching: calls the same network-feed API
- Section header: "TODAY IN ATLANTA" with muted accent

- [ ] **Step 3: Change default category filter**

In the extracted component, set the default category to "culture" instead of "all":
```typescript
const [activeCategory, setActiveCategory] = useState("culture");
```

Reorder tabs to: Culture, Arts, Food, Community, All

- [ ] **Step 4: Remove news from CityBriefing**

In `CityBriefing.tsx`, remove the news module rendering. CityBriefing should only contain: hero image, time-of-day headline, quick links, and optionally the marquee strip. No news posts.

- [ ] **Step 5: Add TodayInAtlantaSection to CityPulseShell**

In `CityPulseShell.tsx`, render `<TodayInAtlantaSection>` AFTER the Lineup and Destinations sections, BEFORE Regular Hangs. This matches the spec's section order: Hero → Lineup → Destinations → News → Regular Hangs.

- [ ] **Step 6: Browser test**

- News now appears below The Lineup, not inside the hero area
- Default shows Culture-tagged stories
- No crime visible by default
- "All" tab still accessible

- [ ] **Step 7: Commit**

```bash
git add web/components/feed/CityBriefing.tsx
git add web/components/feed/sections/TodayInAtlantaSection.tsx
git add web/components/feed/CityPulseShell.tsx
git commit -m "feat: extract news into standalone section, position below Lineup, default to Culture"
```

---

### Task 6: See Shows Expansion

**Purpose:** Expand "Now Showing" into "See Shows" with Film / Music / Stage tabs.

**Files:**
- Create: `web/app/api/portals/[slug]/shows/route.ts` (new API for music/stage shows)
- Create: `web/components/feed/sections/SeeShowsSection.tsx` (tabbed wrapper)
- Create: `web/components/feed/VenueGroupedShowsList.tsx` (venue-grouped rendering for Music/Stage)
- Modify: `web/components/feed/CityPulseShell.tsx` (replace NowShowingSection with SeeShowsSection)

- [ ] **Step 1: Create shows API route**

Create `web/app/api/portals/[slug]/shows/route.ts`:
- Accept query param `category` (music, theater, comedy, dance)
- Query today's events filtered by category, grouped by venue
- Return: `{ venues: [{ venue: { id, name, slug, neighborhood, image_url }, shows: [{ id, title, start_time, price_min, image_url }] }] }`
- Sort venues by show count DESC, then alphabetically
- Use `createClient` (anon key for public read)

- [ ] **Step 2: Create VenueGroupedShowsList component**

Create `web/components/feed/VenueGroupedShowsList.tsx`:
- Same visual pattern as NowShowingSection's theater cards
- Venue header card with venue image, name, neighborhood
- Show thumbnails/rows beneath each venue
- Horizontal scroll carousel of venue cards

- [ ] **Step 3: Create SeeShowsSection wrapper**

Create `web/components/feed/sections/SeeShowsSection.tsx`:
- Tab bar: Film / Music / Stage
- Film tab renders existing NowShowingSection (as-is)
- Music tab renders VenueGroupedShowsList with `category=music`
- Stage tab renders VenueGroupedShowsList with `category=theater,comedy,dance`
- Each tab lazy-fetches on first view
- Section header: "SEE SHOWS" with accent color

- [ ] **Step 4: Replace NowShowingSection in CityPulseShell**

In `CityPulseShell.tsx`, find where NowShowingSection is rendered in `renderMiddleSection`. Replace with SeeShowsSection.

- [ ] **Step 5: Browser test**

- Film tab: same as current Now Showing
- Music tab: venue-grouped live music events today
- Stage tab: theatre/comedy/dance grouped by venue
- Tab switching is smooth, data loads on first view

- [ ] **Step 6: Commit**

```bash
git add web/app/api/portals/[slug]/shows/route.ts
git add web/components/feed/VenueGroupedShowsList.tsx
git add web/components/feed/sections/SeeShowsSection.tsx
git add web/components/feed/CityPulseShell.tsx
git commit -m "feat: expand Now Showing into See Shows with Film/Music/Stage tabs"
```

---

## Phase 3: New Sections

### Task 7: Destinations Section (Worth Checking Out)

**Purpose:** Contextual venue suggestions that respond to time, weather, and occasion. "Where should I go?" not just "what's happening?"

**Files:**
- Create: `web/app/api/portals/[slug]/destinations/route.ts`
- Create: `web/components/feed/sections/DestinationsSection.tsx`
- Modify: `web/components/feed/CityPulseShell.tsx` (add section)

- [ ] **Step 1: Create destinations API route**

Create `web/app/api/portals/[slug]/destinations/route.ts`:

Query logic:
1. Determine current time slot from request time
2. Map time slot to occasion list (using the mapping table from the spec)
3. Query through `venues` as the base table (since both `venue_occasions` and `editorial_mentions` have FK to `venues`):
   ```typescript
   // Step 1: Get venues with matching occasions
   const { data: venuesWithOccasions } = await supabase
     .from('venue_occasions')
     .select('venue_id, occasion, confidence')
     .in('occasion', occasionList)
     .gte('confidence', 0.5);

   // Step 2: Get venue details for those IDs
   const venueIds = [...new Set(venuesWithOccasions?.map(v => v.venue_id) ?? [])];
   const { data: venues } = await supabase
     .from('venues')
     .select('id, name, slug, neighborhood, venue_type, image_url, hours')
     .in('id', venueIds)
     .eq('active', true);

   // Step 3: Get editorial mentions for those venues
   const { data: mentions } = await supabase
     .from('editorial_mentions')
     .select('venue_id, source_key, snippet')
     .in('venue_id', venueIds);
   ```
   Note: `venue_occasions` and `editorial_mentions` are NOT directly related — both FK to `venues`. Query them separately and merge in application code.

4. Filter for "open now" using `isOpenAt()` from `web/lib/hours.ts` — parse each venue's `hours` field against current time
5. Deduplicate by venue (pick highest-confidence occasion per venue)
6. Merge editorial mentions into venue objects
7. Sort by: has editorial mention DESC, occasion confidence DESC
8. Limit to 6 venues
9. Fallback: if < 3 results, query `editorial_mentions` directly for top-mentioned venues regardless of occasion

Response shape:
```typescript
{
  destinations: [{
    venue: { id, name, slug, neighborhood, venue_type, image_url },
    occasion: string,
    contextual_label: string, // "OPEN NOW · 0.3 MI", "PERFECT FOR DATE NIGHT"
    editorial_quote?: { snippet: string, source: string }
  }]
}
```

- [ ] **Step 2: Create DestinationsSection component**

Create `web/components/feed/sections/DestinationsSection.tsx`:
- Self-fetching (calls `/api/portals/[slug]/destinations`)
- Section header: "WORTH CHECKING OUT" with neon-green accent
- "Explore →" link to spots finder
- Horizontal carousel of destination cards
- Each card: venue image (SmartImage), contextual label (mono, neon-green), venue name, neighborhood + type, editorial quote (PressQuote component if available)
- Returns null if < 2 destinations (graceful degradation)

- [ ] **Step 3: Add to CityPulseShell**

Insert DestinationsSection after The Lineup and before the news/middle sections in `CityPulseShell.tsx`.

- [ ] **Step 4: Browser test**

Verify the section shows contextual venues based on current time of day. Check that "open now" filtering works. Check mobile (375px) — carousel scrolls.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/portals/[slug]/destinations/route.ts
git add web/components/feed/sections/DestinationsSection.tsx
git add web/components/feed/CityPulseShell.tsx
git commit -m "feat: add contextual destinations section to feed"
```

---

### Task 8: Portal Teasers (Around the City)

**Purpose:** Cross-portal headline cards showing the most relevant content from other Lost City portals. The network effect becomes visible.

**Files:**
- Create: `web/app/api/portals/[slug]/headlines/route.ts` (cross-portal headline aggregator)
- Create: `web/components/feed/sections/PortalTeasersSection.tsx`
- Modify: `web/components/feed/CityPulseShell.tsx` (add section)

- [ ] **Step 1: Create headlines API route**

Create `web/app/api/portals/[slug]/headlines/route.ts`:

For each active portal (civic, arts, family, adventure), fetch the single most notable item:
- **Civic**: Next upcoming meeting or volunteer opportunity
- **Arts**: Next exhibition opening or open call deadline
- **Family**: Next school calendar event or featured program
- **Adventure**: Featured trail or seasonal destination

Query pattern per portal:
```typescript
// Civic headline
const { data: civicHeadline } = await supabase
  .from('events')
  .select('id, title, start_date, venue:venues(name)')
  .eq('portal_id', civicPortalId)
  .gte('start_date', today)
  .order('start_date')
  .limit(1)
  .maybeSingle();
```

Response:
```typescript
{
  headlines: [{
    portal: { slug, name, accent_color },
    headline: string,
    context: string,
    href: string
  }]
}
```

- [ ] **Step 2: Create PortalTeasersSection component**

Create `web/components/feed/sections/PortalTeasersSection.tsx`:
- Self-fetching (calls headlines API)
- Section header: "AROUND THE CITY" with neon-cyan accent
- Horizontal carousel of portal teaser cards
- Each card: left accent border (portal color), portal name badge, headline, context line, "See details →" link
- Returns null if no headlines (graceful degradation)

- [ ] **Step 3: Add to CityPulseShell**

Insert after Regular Hangs + See Shows, before On the Horizon.

- [ ] **Step 4: Browser test**

Verify portal cards appear with correct branding (teal for Citizen, copper for Arts, sage for Family). Each card links to the corresponding portal.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/portals/[slug]/headlines/route.ts
git add web/components/feed/sections/PortalTeasersSection.tsx
git add web/components/feed/CityPulseShell.tsx
git commit -m "feat: add cross-portal teaser headlines to feed"
```

---

## Task 9: Section Ordering + Final Integration

**Purpose:** Ensure the feed sections render in the correct order per the spec.

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx` (reorder sections)

- [ ] **Step 1: Verify current section order**

Read `CityPulseShell.tsx` lines 380-525. Map the current JSX render order.

- [ ] **Step 2: Register new FeedBlockIds**

In `web/lib/city-pulse/types.ts`, add new block IDs to the `FeedBlockId` type union:
```typescript
type FeedBlockId = "events" | "hangs" | "recurring" | "festivals" | "experiences"
  | "community" | "cinema" | "horizon" | "browse"
  | "destinations" | "portal_teasers" | "news"; // new
```

Add `"destinations"` and `"news"` to `DEFAULT_FEED_ORDER` array in the appropriate positions.

Add entries to the `BLOCK_TO_SECTION` map if the new sections come from the CityPulse pipeline (destinations and news are self-fetching, so they may not need this — but the block ID is still needed for the ordering/visibility system).

- [ ] **Step 3: Reorder sections in CityPulseShell**

The final order should be:
1. CityBriefing (with flagship binding) — already position 1
2. Quick Links — already part of CityBriefing
3. LineupSection (tiered) — already position 4
4. DestinationsSection — new, render in explicit JSX after Lineup
5. TodayInAtlantaSection (news) — new standalone section, explicit JSX
6. Regular Hangs (HangFeedSection) — currently in middle sections
7. See Shows (SeeShowsSection) — replaces NowShowingSection in renderMiddleSection
8. Around the City (PortalTeasersSection) — new, explicit JSX
9. PlanningHorizonSection — already exists
10. Browse sections — already last

New self-fetching sections (Destinations, News, Portal Teasers) should be rendered as explicit JSX in CityPulseShell, NOT through `renderMiddleSection`. They don't come from the CityPulse pipeline — they fetch their own data. Add them as direct `<DestinationsSection />` / `<TodayInAtlantaSection />` / `<PortalTeasersSection />` between existing blocks.

Update `renderMiddleSection` switch case to swap "cinema" block from `NowShowingSection` to `SeeShowsSection`.

- [ ] **Step 3: Browser test full scroll**

Scroll through the entire feed and verify section order matches the spec. Verify on mobile (375px) as well.

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/CityPulseShell.tsx
git commit -m "feat: reorder feed sections to match redesign spec"
```

---

## Task 10: Cleanup + Documentation

- [ ] **Step 1: Remove dead code**

If `CompactEventRow` is no longer used anywhere after LineupSection switch, consider marking it for deprecation (don't delete yet — other sections may use it).

- [ ] **Step 2: Update design system rules**

Add feed redesign notes to `web/.claude/rules/figma-design-system.md`:
- Feed section order
- Noise filter categories
- Horizon quality gate rules
- Contextual hero binding logic

- [ ] **Step 3: Run full test suite**

```bash
cd web && npx vitest run && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/.claude/rules/figma-design-system.md
git commit -m "docs: update design system rules with feed redesign patterns"
```
