# Atlanta Feed Redesign — Editorial Guide with Index Fallback

**Date**: 2026-03-23
**Status**: Review
**Goal**: Redesign the Atlanta portal feed from a comprehensive event index into an editorial city guide that curates ~25-40 events worth seeing, with "See all" access to the full index.

## Context

Three expert audits (product design, data quality, architecture) identified five structural failures in the current feed:

1. **The tier system is disconnected from the main feed surface.** LineupSection renders everything as uniform 224px horizontal scroll cards, ignoring `card_tier`. The tiered rendering only works in ComingUpSection.
2. **~30-40% of the feed is noise.** YMCA swim classes, rec center open gyms, library tax help, HOA meetings. The `is_class` filter doesn't catch programmatic events not explicitly tagged.
3. **The hero doesn't respond to what's happening.** Cherry Blossom Festival is today but the hero shows a generic skyline with a weather haiku.
4. **News leads with crime.** Second thing visible: "Police investigate shooting at Brookhaven Kroger." Undermines "get people out."
5. **Planning Horizon shows weekly open mics alongside festivals.** No quality gate beyond having an image.

### What works (keep)
- Regular Hangs section — excellent UX
- Visual design system — tokens, components, recipes
- Scoring infrastructure — signals exist, just not displayed
- Tiered rendering components — HeroCard, StandardRow, TieredEventList all work

### Root cause
The feed is trying to be a comprehensive city index (273 events, all categories, no quality filter) when it should be an editorial guide that curates what matters. The comprehensive index should be one tap away via "See all."

## Design Principles

1. **Editorial guide by default, comprehensive index via "See all."** The feed does the work of deciding what matters. Users who want all 273 can always get there.
2. **Vertical scroll, not horizontal carousel.** Scroll position = importance. Big things are big. Small things are small.
3. **The hero responds to reality.** When Cherry Blossom Festival is today, that IS the hero.
4. **Noise is filtered from the editorial feed but never hidden.** Rec center programming, YMCA classes, library events are excluded from curated picks but accessible via "See all."
5. **Every section earns its position** by answering a question the user has at that point in their scroll.

## Feed Architecture — 9 Sections

### Section 1: Contextual Hero

**Question it answers:** "What's the biggest thing happening right now?"

**Current state:** Generic Atlanta skyline, time-of-day headline ("MONDAY MORNING"), weather subhead, quick link pills. Flagship events get a tiny marquee strip.

**Redesign:** When a flagship event is happening today, it owns the hero. The hero image is the event's image, the headline is the event name, and the CTAs are contextual ("Get Tickets", "Map It"). When no flagship event exists, falls back to the atmospheric time-of-day hero with quick links.

**Hero binding logic:**
```
1. If any event today has is_tentpole=true OR festival_id set → candidate
2. Candidate must have a non-null image_url (no image = no hero binding)
3. If multiple candidates qualify, pick the one with highest intrinsic score
4. If no candidate has an image → atmospheric hero (current behavior)
5. If no event qualifies at all → atmospheric hero (current behavior)
```

**Visual treatment (flagship mode):**
- Full-width image from the flagship event (SmartImage with gradient overlay)
- Gold "HAPPENING NOW" or "FESTIVAL" label (mono, 2xs, uppercase, tracking)
- Event title (heading/2xl, cream)
- Venue + time + price metadata (body/sm, soft)
- CTA pills: "Get Tickets" (gold bg), "Map It" (twilight border)

**Visual treatment (atmospheric mode):**
- Current CityBriefing behavior — skyline, time-of-day, quick links

### Section 2: Quick Links

**Question it answers:** "I know what I want — take me there fast."

**Current state:** Coffee, Classes, Today, Free Today, This Weekend — generic utility shortcuts.

**Redesign:** Category + occasion shortcuts that respond to time of day. Morning → Coffee, Classes. Evening → Tonight, Nightlife, Date Night. "Date Night" links to the destination finder (occasion filter), not the event list.

**Implementation:** Same quick link pills as current, but the set of links changes based on `context.time_slot`. Already partially implemented — CityBriefing has time-aware quick links. Adjust the link set to include occasion-based destinations (Date Night, Brunch, Late Night Eats).

### Section 3: The Lineup

**Question it answers:** "What's worth going to today/this week?"

**Current state:** Tabbed (Today/This Week/Coming Up) with category filter chips and horizontal carousel of uniform 224px cards. Shows all 273 events with no quality differentiation.

**Redesign:** Keep the tabs and category filter chips. Replace the horizontal carousel with vertical tiered rendering:

1. **Editorial callout** (if applicable) — gold-bordered contextual aside from `generateEditorialCallout()`
2. **Hero card** (max 1) — full-width image card for the highest-tier event in this tab
3. **Featured row** (max 3-4) — horizontal carousel of corrected 288px FeaturedCards
4. **Standard rows** — compact single-line StandardRows for remaining curated events
5. **"See all N →"** link at bottom to the full unfiltered index

**Curation logic:** The Lineup shows events that pass a quality bar:
- Exclude: `is_class = true`, `category IN ('recreation', 'unknown')`
- Include: everything else, sorted by score (intrinsic + personalized)
- Show: top ~15-25 events per tab, tiered by `card_tier`
- "See all" links to the full unfiltered Find view with the same date/category filters applied

**Tab behavior:** Same as current — Today, This Week, Coming Up. Category chips filter within the active tab. Counts on chips reflect the curated set, not the full index.

**Noise filter location: SERVER-SIDE** in `web/lib/city-pulse/pipeline/fetch-events.ts`, inside `buildEventQuery()`. This is where `source_id` and `category_id` are available and where `is_class` is already filtered. Add:
- `.not("category_id", "in", "(recreation,unknown)")` to the base query
- YMCA source exclusion: query source IDs for YMCA sources at startup, then `.not("source_id", "in", "(...)")` — OR fix the YMCA crawler to set `is_class = true` (preferred long-term fix, the filter is the short-term bridge)

The client-side `LineupSection.tsx` does NOT need noise filtering — events are already filtered before they reach the client. The `event.category` alias (mapped from `category_id`) is what the client sees.

**Rendering change:** Replace `CompactEventRow` horizontal carousel in LineupSection with `TieredEventList` (already built). The `card_tier` field is already on every event from the API. No new data plumbing — just swap the renderer.

### Section 4: Worth Checking Out (Destinations)

**Question it answers:** "Where should I go, not just what's happening?"

**Current state:** No destination section in the feed. Destinations only exist in the Places/Spots finder view.

**Redesign:** A contextual destination carousel that responds to time, weather, day of week, and occasion. Shows 4-6 venue cards with editorial voice.

**Contextual logic:**
- Monday morning → coffee shops, co-working cafes
- Friday evening → date night restaurants, cocktail bars
- Rainy Saturday → museums, galleries, indoor attractions
- Sunday brunch → brunch spots
- Generic fallback → editorially-mentioned venues that are open now

**Data sources (all exist):**
- `venue_occasions` (4,431 rows) — maps venues to occasions (date_night, brunch, late_night, etc.)
- `editorial_mentions` (193 rows) — press quotes from Eater, Infatuation, etc.
- Venue hours — "open now" filtering
- Weather API — already in feed context
- Time of day — already in feed context (`context.time_slot`)

**Card design:**
- Horizontal carousel of venue cards (similar to existing VenueCard but smaller/tighter)
- Contextual label: "OPEN NOW · 0.3 MI", "PERFECT FOR DATE NIGHT", "RAINY DAY PICK"
- Venue name, neighborhood, type
- Press quote if available (PressQuote component, already built)
- "Explore →" link to the full spots finder

**Occasion-to-time mapping (using existing occasion taxonomy):**

The `venue_occasions` table has these occasions: date_night, groups, solo, outdoor_dining, late_night, quick_bite, special_occasion, beltline, pre_game, brunch, family_friendly, dog_friendly, live_music, dancing. NOT all time-of-day slots have a matching occasion.

| Time Slot | Occasions Available | Fallback |
|-----------|-------------------|----------|
| morning | (none in taxonomy) | Editorial-mentioned venues only |
| midday | quick_bite, outdoor_dining | Editorial-mentioned venues |
| happy_hour | outdoor_dining, pre_game | Editorial-mentioned venues |
| evening | date_night, live_music, late_night | All occasions, sorted by editorial |
| late_night | late_night, dancing | All late_night occasions |
| weekend morning | brunch, outdoor_dining, family_friendly | Brunch spots |

For time slots without matching occasions (morning), the section falls back to editorially-mentioned venues sorted by mention count. This ensures the section always has content even when the occasion taxonomy doesn't cover the current moment.

**"Open now" filtering:** The `venues` table has structured hours data, parsed by `isOpenAt()` in `web/lib/hours.ts`. The destinations query joins `venues.hours` and filters server-side. This is a new join not in any existing API route — the endpoint must parse hours and check against current time.

**API:** New endpoint `/api/portals/[slug]/destinations` (or extend the feed API with a `destinations` section). Query logic:
1. Get current time slot from `context.time_slot`
2. Query `venue_occasions` filtered by matching occasions (see table above)
3. Join `venues` for hours, name, neighborhood, image
4. Join `editorial_mentions` for press quotes (LEFT JOIN — not all venues have them)
5. Filter: venue is in the portal's city, hours indicate open now (via `isOpenAt`), has an image or editorial mention
6. Sort: editorial mention count DESC, occasion confidence DESC
7. Limit: 6
8. Fallback: if fewer than 3 results, drop the occasion filter and show top editorial-mentioned venues that are open now

Response shape: `{ destinations: [{ venue: {...}, occasion: string, editorial_quote?: string, distance?: number }] }`

### Section 5: Today in Atlanta (News)

**Question it answers:** "What's the city talking about?"

**Current state:** Full news module with 7 category tabs (News, Culture, Arts, Food, Community, Civic, Politics), positioned as the second thing in the feed. Today's visible content leads with a shooting investigation.

**Redesign:** News moves below The Lineup and Destinations. Default tabs are Culture, Arts, Food only. "All" tab available for users who want the full feed (including crime/civic/politics). Reduced to 2-3 visible stories in the default view.

**Default category filter:**
- Show: Culture, Arts, Food, Community (positive/aspirational categories)
- Available via tab: All (includes News, Civic, Politics — the crime/admin content)
- Never auto-default to: News, Civic, Politics

**Position:** After The Lineup and Destinations, before Regular Hangs. The news module reinforces "city front page" positioning but doesn't dominate the discovery experience.

**Technical change:** Modify the news feed component's default category filter. Currently defaults to "All" — change to Culture/Arts/Food. The "All" tab remains accessible. No backend changes needed.

### Section 6: Regular Hangs

**Question it answers:** "What are the reliable weekly spots?"

**Current state:** Excellent. Day-of-week filter, activity type chips (Trivia 85, Karaoke 28, Comedy 17), recurring event cards.

**Redesign:** No changes. This section works.

### Section 7: See Shows (Film / Music / Stage)

**Question it answers:** "What can I go see today?"

**Current state:** "Now Showing" — cinema only, grouped by theater. Well-executed but limited to film.

**Redesign:** Expand to three tabs covering all performance-based events:

**Film tab:** Current Now Showing behavior — movies grouped by theater. Unchanged.

**Music tab:** Live music events today, grouped by venue. Shows: venue name, artist/band playing, time, price. Sources from the same event pool as The Lineup, filtered to `category_id IN ('music')` where events have a clear performance component (not background music at a restaurant). Grouped by venue like the Film tab groups by theater.

**Stage tab:** Theatre, comedy, dance performances today. Same venue-grouped pattern. Sources from `category_id IN ('theater', 'comedy', 'dance')`.

**Visual treatment:** Same card pattern as current Now Showing — venue header card with poster/event thumbnails beneath. The tab bar is Film / Music / Stage.

**Data architecture:** The three tabs use different data sources:

- **Film tab**: Current `/api/portals/[slug]/now-showing` endpoint. NowShowingSection is self-fetching and works well. No changes.
- **Music tab**: New API route `/api/portals/[slug]/shows?category=music` — queries today's events where `category_id = 'music'` and the event represents a live performance (not background music). Groups results by `venue_id`. Returns `{ venues: [{ venue: {...}, shows: [{event}, ...] }] }`. Reuses existing event query patterns from the CityPulse pipeline.
- **Stage tab**: Same API route with `?category=theater,comedy,dance`. Same venue-grouped response shape.

The Music/Stage API is a lightweight endpoint — a filtered, venue-grouped event query. No new data tables needed, just a new route that queries the existing `events` table with category + date filters and groups by venue.

**Implementation note:** The containing component becomes a tabbed wrapper that renders NowShowingSection for Film and a new VenueGroupedShowsList component for Music/Stage. The tab state is client-side; each tab lazy-fetches its data on first view.

### Section 8: Around the City (Portal Teasers)

**Question it answers:** "What else is going on in Atlanta beyond events?"

**Current state:** No cross-portal content in the Atlanta feed.

**Redesign:** A horizontal carousel of portal teaser cards. Each card shows the most relevant headline from another Lost City portal.

**Cards:**
- **Lost Citizen** — Next council meeting, volunteer opportunity, or civic issue. Teal accent.
- **Lost Arts** — New exhibitions opening, artist spotlight, or open call deadline. Copper accent.
- **Lost Youth** — School calendar event (upcoming break), featured program, or kid-friendly weekend picks. Sage accent.
- **Lost Track** — Trail conditions, seasonal destination, or new trail added. Terracotta accent.

**Card design:**
- Left accent border matching portal color
- Portal logo/name badge (mono, uppercase, portal color)
- Headline: 1-2 lines (body/base, cream)
- Context line: 1 line (body/sm, muted)
- "See details →" link (mono, portal color)

**Data source:** Each portal exposes a "headline" via its feed API — the single most notable item for the current moment. The Atlanta feed fetches these in parallel during feed assembly.

**Graceful degradation:** If a portal has nothing notable (no upcoming meetings, no new exhibitions), its card doesn't render. The section renders with 1-4 cards, or doesn't render at all if no portal has a headline.

**Position:** Below the fold, after Regular Hangs + See Shows. For users who scroll deep — a window into the broader Lost City ecosystem.

**Implementation (future):** Requires a lightweight cross-portal API. Each portal's feed API adds a `headline` field to its response — the single most notable item. The Atlanta feed aggregates these. This is the first visible expression of federation.

### Section 9: On the Horizon

**Question it answers:** "What should I plan ahead for?"

**Current state:** Shows 40 events including weekly open mics alongside multi-day festivals. No quality gate beyond having `importance = major/flagship`.

**Redesign:** Strict quality gate. Only shows events that are genuinely "plan ahead" material:
- `is_tentpole = true`, OR
- `festival_id IS NOT NULL`, OR
- Multi-day event (`end_date != start_date` AND duration > 1 day), OR
- `importance = 'flagship'`

Single-day, recurring venue events (weekly trivia, open mics) are excluded regardless of importance/score. The section should contain 5-15 genuinely significant upcoming events, not 40 events of mixed quality.

**Technical change:** This REPLACES the existing filter in `buildPlanningHorizonSection` (line ~1136-1142 of `section-builders.ts`) which currently filters by `importance = 'flagship' OR importance = 'major'`. The new filter is stricter: `is_tentpole = true OR festival_id IS NOT NULL OR (end_date != start_date AND duration > 1 day) OR importance = 'flagship'`. Note: `importance = 'major'` alone no longer qualifies — it was too broad and admitted weekly events that happened to get backfilled.

**Visual treatment:** Horizontal carousel of horizon cards (current PlanningHorizonCard design, corrected). Each card shows: date range, category, event title, venue, price, "Get Tickets" CTA. No internal tier labels (no "Flagship" badge — removed per earlier fix).

**Filter pills:** Month filters (Mar, Apr, May, etc.) to browse by time window. Category filters optional.

## Noise Filtering

### What gets filtered from the curated feed (Lineup)

Events matching these criteria are excluded from the curated Lineup but remain accessible via "See all" links:

1. `is_class = true` (already filtered)
2. `category_id IN ('recreation', 'unknown')` — rec center programming, uncategorized junk
3. Events from YMCA sources (22 branches) — until the YMCA crawler properly sets `is_class = true`
4. Events with `data_quality` below a minimum threshold (if such a field is reliable)

### What stays in
Everything else stays in the curated feed. The goal is to remove ~60-80 noise events per day, leaving ~150-200 in the curated pool, of which the top ~15-25 are shown per tab with the rest accessible via "See all."

### "See all" behavior
Every "See all" link navigates to the Find/Happening view with the appropriate filters pre-applied (date range, category). The Find view shows the FULL unfiltered index — all 273 events, including rec center programming. Nothing is hidden from the platform, it's just not featured.

## Implementation Priority

### Phase 1: Fix the broken hierarchy (highest impact, least new code)
1. **Connect TieredEventList to LineupSection** — replace horizontal carousel with vertical tiered rendering. The components exist. This is the single highest-impact change.
2. **Add noise filter to Lineup** — exclude recreation, unknown categories, YMCA sources from the curated set.
3. **Quality-gate Planning Horizon** — add tentpole/festival/multi-day filter to `buildPlanningHorizonSection`.

### Phase 2: Contextual intelligence
4. **Contextual Hero** — bind hero to flagship events when present.
5. **News default filter** — change default from "All" to Culture/Arts/Food.
6. **See Shows expansion** — add Music and Stage tabs to Now Showing.

### Phase 3: New sections
7. **Worth Checking Out (Destinations)** — contextual venue section from occasion + editorial data.
8. **Around the City (Portal Teasers)** — cross-portal headline cards.

## Data Changes Required

### Crawler fixes (P0)
- **YMCA crawler**: Set `is_class = true` on all structured programming. Removes ~40-60 noise events/day via existing filter.

### Feed pipeline changes
- **Lineup noise filter**: Add category exclusion (`recreation`, `unknown`) and YMCA source exclusion to the Lineup's event pool before rendering.
- **Horizon quality gate**: Add `is_tentpole OR festival_id OR multi-day` filter to `buildPlanningHorizonSection`.
- **Intrinsic scoring for anonymous users**: Merge `computeIntrinsicScore` from `tier-assignment.ts` into the main `scoreEvent` function so tentpole events sort above generic programming for all users.

### New API work
- **Destinations section**: Lightweight query joining `venue_occasions` + `editorial_mentions` + hours, filtered by time-appropriate occasions. Return 6 venues.
- **Portal teasers**: Each portal exposes a `headline` endpoint. Atlanta feed aggregates in parallel. (Phase 3, can be deferred)

## Success Criteria

1. A stranger opening the Atlanta feed on a day when Cherry Blossom Festival is happening sees the festival as the hero, not a generic skyline.
2. The Lineup shows ~15-25 curated events per tab with visual hierarchy (hero → featured → standard). YMCA swim classes are not visible unless the user taps "See all."
3. "On the Horizon" contains only events worth planning for — no weekly open mics.
4. The news module defaults to Culture/Arts/Food — a user never sees a shooting investigation as the second thing in the feed unless they explicitly tap "All."
5. The feed makes someone want to go out, not just know what's out there.

## Risks

- **Noise filter too aggressive**: If the recreation/unknown category filter removes events that users actually want (e.g., a popular rec center event), they can still find them via "See all." Monitor feedback.
- **Hero binding misfire**: If the hero binds to a low-quality flagship event (bad image, obscure festival), it's worse than the generic skyline. Need fallback: only bind if the event has a quality image.
- **Destinations cold start**: The occasion data (4,431 rows) may not cover all time slots evenly. Graceful degradation: if fewer than 3 venues match the current context, don't show the section.
- **Portal teasers require cross-portal API**: This is new infrastructure. Phase 3 appropriately — build the Atlanta feed redesign first, add portal teasers when the headline API exists.
- **"See all" link discoverability**: If "See all 47 tonight" is too subtle, users may think the curated 15-25 events IS the entire feed. The link needs to be prominent enough to find but not so prominent it undermines the curation.
