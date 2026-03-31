# CityPulse Feed Redesign

**Date:** 2026-03-29
**Status:** Approved for implementation (post expert review, round 2)
**Portal scope:** Atlanta (base city portal). Other portals adapt from this template but are out of scope.

---

## Problem

The current feed has four structural issues:

1. **Fragmented timeline.** Events, regulars, and planning horizon live in 3 separate sections with 3 API calls and 3 mental models. Users piece together "what's happening" from disconnected views.
2. **Static header.** "Good evening, 847 events" is the same regardless of weather, holidays, major events, or time of day. The greeting doesn't reflect what's actually going on in the city.
3. **Thin cards.** The new data model (`place_profile`, `place_vertical_details`, Google ratings, exhibition data) delivers rich vertical-specific information that the feed doesn't surface.
4. **Browse is dead.** The jewel-tone category grid is static tiles with counts linking to filtered search. No live content, no contextual signals, no reason to engage beyond navigation.

Meanwhile, the upcoming unified Find tab handles comprehensive discovery. The feed's job needs to sharpen: it's the **daily briefing** that surfaces what matters right now and funnels into Find for depth.

## Design Philosophy

- **Access layer, not recommendation engine.** Surface the data, give people tools to navigate it, let them decide. Not a drip feed. Not "we picked 5 things for you." This applies to every section — each is a window into a full filterable set, not a curated cage.
- **Editorial voice, not algorithmic.** The feed reads like a smart city guide written by a local, not a ranked list assembled by a scoring function.
- **Full picture.** Every section surfaces its full dataset. "See all →" is the escape hatch into Find. Scoring influences order, never exclusion.
- **Feed funnels into Find.** Every section links to a Find lane or filtered view. The feed earns attention with editorial voice and contextual intelligence; Find handles the depth.

### Feed vs Find Contract

The feed is a **briefing**, not a browser. It surfaces moments — contextual, time-bound, editorial. Find handles systematic exploration. Every feed section funnels into Find for depth. These are complementary, not redundant:

- **Feed** answers: "What should I pay attention to right now?"
- **Find** answers: "Show me everything in this category."
- **Going Out** answers: "What are my friends doing?"

A user seeing the same event in the Briefing and the Lineup is not redundancy — the Briefing is editorial context ("Dragon Con starts tomorrow"), the Lineup is navigation ("here it is in your timeline"). The two surfaces have different voices even when they reference the same content.

Feed card tiers (HeroCard, StandardRow) are feed-specific visual treatments optimized for the timeline context. `DiscoveryCard` from the Find spec is the Find-specific card system optimized for list/grid contexts. They share underlying data types but render independently. No component sharing is required.

## Feed Structure

Six sections, each with a distinct job:

| # | Section | Job | Rendering |
|---|---------|-----|-----------|
| 1 | **The Briefing** | Context-aware editorial header | Server-rendered, above fold |
| 2 | **The Lineup** | Unified timeline (events + regulars + horizon) | Main API response, above fold |
| 3 | **See Shows** | Film / Music / Stage showtimes | Self-fetching, lazy-loaded |
| 4 | **Destinations** | Contextual places (weather, closing, new, open) | Self-fetching, lazy-loaded |
| 5 | **Neighborhood Pulse** | Geographic activity strip | Self-fetching, lazy-loaded (Phase 3, conditional) |
| 6 | **The Grid** | Alive browse with collections | Main API counts + lazy collections |

### What's removed

- **GreetingBar** → absorbed into The Briefing
- **DashboardCards** → removed (shortcuts to saved/trending/weekend were low-value)
- **CityBriefing** → absorbed into The Briefing (holiday/festival hero is now a Briefing signal)
- **The Scene (standalone section)** → absorbed into The Lineup via Regulars toggle
- **Planning Horizon (standalone section)** → absorbed into The Lineup via "On the Horizon" time marker
- **Trending Section** → trending signal folded into tier assignment (hero/featured cards), not a separate section

### Pre-implementation cleanup

- **Remove "Clowns" tab** from `SeeShowsSection.tsx` (line 21). Test artifact in production code — renders as a real tab. Fix before any spec work begins.

---

## Section 1: The Briefing

Replaces GreetingBar + DashboardCards + CityBriefing with a single context-aware header.

### Content

A **template-composed** editorial sentence synthesized from active signals, plus tappable context pills linking to relevant content. Context pills require `aria-label` attributes for screen readers (e.g., a pill reading "3 Openings Tonight" needs `aria-label="See 3 gallery openings tonight"`).

Example outputs:
- "Dragon Con starts tomorrow. 72° and clear tonight — 3 gallery openings in Castleberry Hill."
- "Rainy evening. Head to High Museum — Basquiat closes in 12 days. 14 comedy shows indoors tonight."
- "Sunny and 68°. Farmers market at Piedmont Park til noon. 4 trails in peak bloom."
- "No school tomorrow (APS spring break). 9 kid-friendly events this weekend."

### Signal Sources (priority order)

1. **Tentpole events** — `is_tentpole = true` or `festival_id` set. "Dragon Con starts tomorrow."
2. **Holidays** — hardcoded in context engine (13 covered). "Happy Juneteenth — 8 community events today."
3. **Exhibition closings** — `exhibitions.closing_date` within 14 days. "Basquiat closes in 12 days."
4. **School calendar** — `school_calendar_events` table (62 events, 4 systems). "No school tomorrow."
5. **Weather + time** — OpenWeatherMap API (already integrated). Drives indoor/outdoor nudges, patio mentions.
6. **General activity** — event counts, category highlights. Fallback when stronger signals are absent.

### Composition Rules

- The engine picks the top 2-3 active signals and composes 1-2 sentences.
- Signal priority is strict — tentpole always wins over weather.
- **Quiet-day collapse:** When no signal scores above a minimum threshold (no tentpoles, no holidays, no closings, neutral weather), the Briefing collapses to a minimal single-row header: `[Day, date] · [weather badge] · [event count]`, rendered at ~40px height with no hero image and no context pills. This prevents CLS — the section is either the full editorial block or the minimal one-liner, with a fixed container height. No filler prose.
- Context pills below the prose are tappable quick-links to the content mentioned (e.g., "Dragon Con Preview" → festival detail, "3 Openings Tonight" → Find arts lane filtered to today).

### Template Engine Specification

The template library is **formatting scaffolding**, not editorial content. The city feeds the content through data signals; templates are sentence patterns that format those signals into readable prose. Adding a new city or signal type requires adding a signal source to the priority stack, not writing new templates.

**Composition algorithm:** Greedy priority chain. Walk the signal priority stack top-to-bottom. First signal above threshold becomes the headline clause. Second signal becomes the supporting clause. If only one signal fires, compose a single sentence. If zero fire, quiet-day collapse.

**Minimum Phase 1 template set (8 patterns):**

| Pattern | Example |
|---------|---------|
| `[tentpole] + [weather]` | "Dragon Con starts tomorrow. 72° and clear tonight." |
| `[tentpole] + [activity]` | "Dragon Con starts tomorrow. 47 events across 5 hotels." |
| `[holiday] + [activity]` | "Happy Juneteenth — 8 community events today." |
| `[exhibition_closing] + [weather]` | "Basquiat closes in 12 days. Nice evening for Midtown." |
| `[school_calendar] + [activity]` | "No school tomorrow. 9 kid-friendly events this weekend." |
| `[weather] + [activity]` | "Rainy tonight — 14 comedy shows indoors." |
| `[weather] + [outdoor]` | "Sunny and 68°. 4 trails in peak bloom." |
| `[activity_only]` | "Farmers market at Piedmont Park til noon." |

**Fallback rule:** When no template cleanly matches the active signal combination, fall back to quiet-day collapse. Never generate awkward prose — silence is better than noise.

**Requirement:** Unit tests for each template pattern and for the quiet-day collapse threshold.

### Implementation

- Compose in existing `resolveHeader()` / `buildFeedContext()` — not a new API call.
- School calendar query added to Phase A enrichments (parallelize with weather fetch).
- Exhibition countdown query added once to Phase A enrichments: `SELECT * FROM exhibitions WHERE closing_date BETWEEN now() AND now() + interval '14 days'`. Store in `PhaseAEnrichments.closingSoonExhibitions` — this field is shared by Briefing (Phase 1), Destinations Closing Soon lens (Phase 2), and Grid CLOSING badges (Phase 2). Add the query in Phase 1; Phase 2 sections consume the same field.
- Refresh cadence: matches main feed cache (anon: 5 min, auth: 1 min).

### Build Requirements

- Wire `school_calendar_events` into `buildFeedContext()` in `web/lib/city-pulse/context.ts`.
- Build exhibition countdown query in Phase A enrichments. Store as `PhaseAEnrichments.closingSoonExhibitions`.
- Build template composition engine (greedy priority chain) with the 8 minimum patterns.
- Build quiet-day collapse logic with fixed container height (no CLS).
- Unit tests for all template patterns + quiet-day threshold.

---

## Section 2: The Lineup

Consolidates Lineup + Regulars + Planning Horizon into a single unified timeline.

### Why a Toggle, Not a Tab

Regulars remain discoverable but secondary. The toggle keeps the default timeline as the primary surface — most users are looking for one-off events on a given evening. Recurring events appear inline with badges so users see they exist. The toggle gives regulars-first users the focused mode they want without adding a 4th tab that splits attention. This also justifies the pre-fetch at T=1s — it's required to make the toggle feel instant since it switches between two pre-loaded data pools.

### Structure

**Three time tabs:**
- **Today** — Happening Now + Tonight (+ today's regulars woven in)
- **This Week** — 7-day view (+ this week's regulars woven in + horizon tentpoles)
- **Coming Up** — 8-30 day window (+ upcoming tentpoles/festivals)

**Regulars toggle** — a filter chip in the chip row below the tabs:
- **Toggle OFF (default):** Full timeline. One-off events and recurring events mixed chronologically. All regulars for that time window appear at their scored position in the timeline — this is the "full picture" default. Recurring events marked with color-coded accent bars and day-specific recurrence badges (default to `EVERY MON` / `EVERY TUE` etc. when day-of-week data is available; fall back to `WEEKLY` only when day data is missing). Activity type determines accent color (trivia = blue, karaoke = pink, comedy = gold, etc.).
- **Toggle ON:** Scene mode. Content filters to only recurring events.
  - **Today tab + Regulars ON:** Today's regulars listed flat. Activity chips for filtering. No day pills (you're already scoped to today).
  - **This Week tab + Regulars ON:** Full 7-day calendar. Day pills appear for day-level navigation. Activity chips for filtering. This is where the rich day-of-week browsing experience lives.
  - **Coming Up tab + Regulars ON:** Recurring events in the 8-30 day window. Same pattern as This Week.

The toggle respects the tab's time scope. Day pills only appear in This Week (and Coming Up) because those are the only tabs where day-level navigation makes sense.

**State management:** Day pill selection is tab-scoped state. Switching tabs resets day pill selection. This prevents the bug where a user on "This Week + Wednesday selected" taps "Today" and sees an empty list because a hidden Wednesday filter is still active.

### Time Flow Markers

Within each tab, colored markers create natural time sections:

| Marker | Color | Appears when |
|--------|-------|-------------|
| **Happening Now** | Green (#00D9A0), pulse dot | Events in progress or starting within 1 hour |
| **Tonight** / **This Afternoon** | Gold (#FFD93D) | Rest of today. Label shifts at 2pm. |
| **On the Horizon** | Gold (#FFD93D) | Tentpoles/festivals within 30 days. Quality gate: `is_tentpole = true` OR `festival_id` set. |

**"Happening Now" pulse dot** uses the existing `@keyframes pulse` CSS animation. Must include `@media (prefers-reduced-motion: reduce) { .pulse-dot { animation: none; } }` for vestibular accessibility. The pulse dot is a shape signal (animated dot), not a color block, to avoid collision with the green used for "Open Now" badges, "Free" chips, and success states elsewhere in the app.

**"On the Horizon"** uses gold (not copper) because it's a temporal concept ("coming up"), not an arts/exhibition concept. Copper (#C9874F) is reserved for arts/exhibition accents per the entity type color system in the Find spec.

### Card Tiers

Existing tier assignment system (`tier-assignment.ts`) determines card visual weight:
- **Hero** — full-width image card. Tentpoles, festivals, flagship events.
- **Featured** — medium card with image strip. Friends going, editorial mentions, high-score events.
- **Standard** — compact row. Accent dot + title + venue + time.

Recurring events use the same tier system but default to **Standard** unless they have exceptional signals (e.g., a trivia night with 50+ RSVPs would promote to Featured).

### Enriched Cards (Phase 2)

Card enrichment depends on the Phase 0 data layer work from the Unified Find spec (`place_profile` and `place_vertical_details` wired into APIs). **Phase 1 ships the structural redesign** (unified timeline, tabs, regulars toggle, time flow markers) **without enriched card data.** Enriched fields arrive in Phase 2 alongside the data layer work.

When available (Phase 2+), event cards gain optional data:
- **Google rating** + review count (from `place_vertical_details.google`) — shown when available, hidden when not. Not a required field.
- **Cuisine/price** (from `place_vertical_details.dining`) — shown for dining-venue events.
- **Open/closed status** — derived from `places.hours` + current time.

Design cards so all enrichment fields are optional. The card must look complete with just: title, venue name, time, and accent color.

### Regulars Toggle Discoverability

Users who don't discover the toggle miss the focused browsing mode (the default timeline already shows all regulars inline). Mitigations:
- Contextual nudge at the bottom of the Lineup section (not mid-list — preserves scroll rhythm): "Looking for weekly trivia, karaoke, comedy? → Toggle Regulars".
- Keyed on `localStorage` with a `regulars_nudge_dismissed` flag (works for anonymous users). Maximum 3 impressions, then auto-dismissed.
- The nudge doesn't reappear after the user has toggled once.

### API Strategy

- **One-off events:** Main feed API response (existing pipeline, no change).
- **Regulars:** Separate fetch from `/api/regulars`. The existing `weekday` parameter already supports "today's regulars" (pass today's day of week). For "This Week," the existing 7-day window covers it. For "Coming Up," extend the date range cap from 7 to 30 days. No new `tab` parameter needed — the client passes appropriate `weekday` and date range params per tab.
- **Pre-fetch:** Background fetch regulars at T=1s after lineup loads using React Query `prefetchQuery`. Makes the toggle feel instant.
- **Toggle:** Client-side pool switch between one-off and regulars data. Not a server re-fetch.
- **Tab switching:** Existing `?tab=` pattern for This Week / Coming Up lazy fetch.

### "See all" Link

Footer of each tab: "See all [count] events →" links to `?view=find` with appropriate time filter. **Interim link strategy:** If the Unified Find spec has not yet shipped when Phase 1 launches, use `?view=happening` (events) and `?view=places` (destinations) as interim link targets. The `normalizeFinURLParams()` utility from the Find spec will handle the migration when Find ships.

---

## Section 3: See Shows

Film / Music / Stage tabs. Existing pattern, enriched with new data. Every section is a window into a full filterable set — See Shows links to Find for comprehensive listings.

### What Changes

- **Venue ratings** — Google rating + review count on theater/venue cards (from `place_vertical_details.google`, optional). Phase 2 — requires data layer wiring.
- **Inline showtime chips** — tappable time badges for each screening (7:00, 9:30, IMAX 8:00).
- **Urgency badges** — `LAST SHOWING` when series has ≤2 remaining showtimes. `OPENING NIGHT` when event date equals series first showtime date. `SELLING FAST` deferred (requires ticket API integration).
- **Festival parent links** — "Part of Atlanta Film Festival 2026" when `festival_id` is set.
- **Metadata row** — runtime, MPAA rating, director (from `series` table, shown when populated, hidden when not).

### What Stays

- Film / Music / Stage tabs.
- Self-fetching via `/api/whats-on/*`.
- Lazy-loaded via `LazySection`.
- The interaction model works — this is enrichment, not replacement.

### Header Link

"See all in Find →" links to `?view=find&lane=music` (or appropriate lane). Interim: `?view=happening&content=showtimes` until Find ships.

### Implementation

- Add LEFT JOIN to `place_vertical_details` (keyed by venue's `place_id`) in whats-on queries. One join on indexed PK (Phase 2).
- Showtime chips: group events by `series_id`, render each event's `start_time` as a chip.
- Metadata: read `series.runtime_minutes`, `series.rating`, `series.director`. Render when non-null.

---

## Section 4: Destinations

Contextual places section with rotating lenses. **This is a rewire of the current destinations pipeline, not a small extension.** The current `fetchDestinations()` is occasion-driven only, not currently wired into `assembleResponse()`, and has no joins to `place_profile` or `place_vertical_details`. The `DestinationsSection` component is commented out of the shell.

### Context Lenses

Tappable filter chips that re-sort the section. Default shows a smart mix. Each lens pulls from different data:

| Lens | Data Source | Data Gate | Example |
|------|-----------|-----------|---------|
| **Weather-driven** | Weather API + `places.indoor_outdoor` + `place_vertical_details.outdoor.best_seasons` | Always available (weather API is live) | "72° and clear — perfect evening for a walk" |
| **Closing Soon** | `exhibitions.closing_date` within 14 days (shared from `PhaseAEnrichments.closingSoonExhibitions`) | Hide if 0 exhibitions closing | "Basquiat closes in 12 days" |
| **New** | `places.created_at` within 30 days | Hide if <3 new places | "Opened 2 weeks ago" |
| **Open Now** | `places.hours` + current time | **Hide if <5 destinations have `hours` data** | Green "Open" / "Open til 9pm" badge |
| **Top Rated** | `place_vertical_details.google.rating` | Hide if <30% of active places have ratings | "4.7 ★ 2.4K reviews" |

Lens switching is **client-side** — fetch destinations once, filter/sort locally per lens. No re-fetch on lens tap.

**Fallback when all lenses gate out:** Show "New" lens as default (uses `created_at` which always exists). If even "New" has <3 results, collapse the section. An empty Destinations section is better than one with phantom filter chips.

### Card Content

Each destination card shows (when available):
- Name, neighborhood, place type
- Google rating + review count
- Open/closed status
- Contextual line (weather fitness, closing countdown, "new" date, cuisine + price level)
- Accessibility badges (wheelchair, family-friendly) from `place_profile`
- Image from `places.image_url` or `place_profile.hero_image_url`

All fields optional. Card must look complete with just: name, neighborhood, place type.

### Data Gates

- **place_occasions sparsity:** If audit shows <100 Atlanta places with occasion records, lean on non-occasion lenses (Closing Soon, New, Weather, Open Now) which work with existing data. Don't surface "Perfect for Date Night" labels unless backed by data.
- **Per-lens gates:** See table above. Each lens hides itself when data is insufficient.
- **Images:** Fall back to themed gradient + icon when `image_url` is null.

### API Strategy

**This is new pipeline work, not an extension.** Build requirements:
1. Rewrite `fetchDestinations()` to support multi-source queries (not just occasion-driven). The function needs to query places with joins to `place_profile` and `place_vertical_details`, scored by multiple signals (weather fit, recency, closing urgency, rating, open status).
2. Wire destinations into `assembleResponse()` — currently not populated in the `CityPulseResponse`.
3. Return essential fields only (id, name, slug, neighborhood, place_type, image_url, rating, rating_count, open_status, created_at, closing_exhibition_title, closing_exhibition_days_remaining, indoor_outdoor). Gallery URLs, planning notes, and verbose text load on detail tap. This keeps the payload lean (~1-2KB per item vs 3-5KB with full profiles).
4. Fetch ~20 destinations. Lens switching is pure client-side filter/sort on this set.

Self-fetching lazy-loaded section (not embedded in main feed response — avoids 20-40KB payload inflation on every feed load for a below-fold section).

### Header Link

"Explore all →" links to the Find lane matching the active lens: Weather → `?view=find&lane=outdoors`, Closing Soon → `?view=find&lane=arts`, default → `?view=find`. Each link should carry the lens context where possible. Interim: `?view=places` until Find ships.

---

## Section 5: Neighborhood Pulse (Phase 3, Conditional)

Geographic activity strip. Horizontal scroll of neighborhood cards.

### Gate Condition

**Only build if real-world data density test confirms:** 4+ neighborhoods consistently have 5+ events on a typical day. Run the test on a weekday AND a weekend before committing.

If the test fails, invest instead in making Find's neighborhood filter more prominent and deep-linking from other sections ("See all events in Inman Park →").

### Design (if built)

Horizontal scroll of neighborhood cards (top 6-8 by event count):
- Neighborhood name
- Event count ("23 tonight" / "23 today" — time-aware label)
- Mini category sparkline bars (relative activity by category)
- Top category labels ("Music · Arts · Dining")
- Each card uses a distinct accent color

**Data-driven, not hardcoded.** Show top 6-8 neighborhoods by event count. Neighborhoods with <3 events don't appear. Use `neighborhood-index.ts` canonical names — don't surface ad-hoc strings from venue data. Only count events with a venue that has a non-null, non-generic neighborhood value (filter out "Atlanta" as a neighborhood).

### Interaction

Tap a card → opens Find filtered by that neighborhood (`?view=find&neighborhoods=midtown`). "Map view →" header link opens Find in map mode. Interim: `?view=places&neighborhoods=midtown` until Find ships.

### API Strategy

New self-fetching endpoint: `/api/portals/[slug]/neighborhoods/pulse`. Uses existing `get_neighborhood_activity` RPC. Pre-compute counts in post-crawl maintenance script (extend `feed_category_counts` or create `feed_neighborhood_counts` table). Runtime query is a simple SELECT on pre-computed rows.

Lazy-loaded via `LazySection`. Cache TTL: 10 min (neighborhood distribution is stable within a day).

---

## Section 6: The Grid

Alive jewel-tone browse with real content, contextual badges, and data-driven collections.

### Tile Content

Each tile shows (compared to current static tiles):
- **Category name** (same)
- **Live count** ("47 this week" / "31 open now" — time-aware, from `category_counts.today`)
- **Content snippet** — **Desktop/tablet only** (tile width ≥ 200px, `sm:` breakpoint). 1-2 lines of real content: top event or place for that category. At 375px (2-column grid, ~165px tiles), snippets truncate to meaninglessness — show only category name + count + corner badge on mobile.
- **Contextual badge** (corner, all viewports):
  - Green pulse dot = something happening right now in this category (with `prefers-reduced-motion` handling)
  - `NEW` = new venue/event in this category this month
  - `CLOSING` = exhibition closing soon in this category (from shared `PhaseAEnrichments.closingSoonExhibitions`)

Jewel-tone color scheme preserved. Each tile links to its Find lane (`?view=find&lane=music`). Interim: `?view=happening&categories=music` until Find ships.

### Collections Row

Horizontal scroll of themed bundles below the grid. **100% data-driven and auto-regenerating**, not manually curated. No editorial rotation required.

| Collection | Query Logic |
|-----------|------------|
| Free This Weekend | `is_free = true AND date IN (sat, sun)` |
| Date Night [Neighborhood] | Restaurants + shows in the neighborhood with the highest tonight event count. Deterministic: selected by query at generation time based on `MAX(event_count)` grouped by neighborhood. Rotates nightly as data changes. No curation. |
| New in Atlanta | Places with `created_at` within 30 days |
| Family Sunday | Events with `family` category/tag on Sunday |
| Closing Soon | Exhibitions with `closing_date` within 14 days |

Collections with 0 results are excluded. Each collection shows: title, count, category labels. Tap → opens Find with appropriate filters.

### Removed: "Surprise Me"

Cut per strategic review. Novelty feature that doesn't compound. Misaligns with access-layer philosophy — removes user agency in exchange for serendipity that degrades after 2 taps. The Grid's value is navigation and context, not randomness.

### API Strategy

- **Tile counts:** Already computed in `category_counts.today` from the main pipeline. Zero new DB queries.
- **Content snippets:** Pass `todayEventsPool` to `buildBrowseSection` (function signature change — currently receives only counts). Pick one representative event per category (highest-tier event with an image). Minimal data: `{title, venue_name}`. No additional DB queries — selection from existing event pool.
- **Contextual badges:** Derive from event pool (any event starting within 1 hour = pulse dot), `places.created_at` (NEW), `PhaseAEnrichments.closingSoonExhibitions` (CLOSING).
- **Collections:** Single self-fetching endpoint: `/api/portals/[slug]/collections`. Returns all active collections with title, count, and category labels. Each collection is a parameterized query run at request time (bounded: max 5 queries, each limit 10). Collections with 0 results excluded. Cache TTL: 15 min. Do NOT compute at main feed-load time.

---

## Shipping Sequence

### Phase 1: Briefing + Lineup + See Shows (structural)

**Prerequisite:** Pre-implementation cleanup (remove "Clowns" tab from SeeShowsSection.tsx).

The core feed redesign. Ships the structural changes without enriched card data:
- Static greeting → editorial briefing (context engine + template composition)
- 3 disconnected sections → 1 unified timeline (3 tabs + regulars toggle + time flow markers)
- See Shows enrichment: showtime chips, urgency badges, metadata row, festival parent links

**Card enrichment (ratings, cuisine, open/closed) is NOT in Phase 1.** Cards ship with the existing data (title, venue name, time, accent color) plus recurrence badges for regulars. Enriched fields arrive in Phase 2.

This phase ships a complete, coherent feed. Phases 2 and 3 are additive.

### Phase 2: Enriched Cards + Destinations + Grid

**Prerequisite:** Completion of the Phase 0 data layer wiring task from the Unified Find spec — `place_profile` and `place_vertical_details` wired into discovery and detail APIs. This is a shared dependency between the CityPulse and Find specs. Additionally: audit `place_occasions` count for Destinations.

Enriches the full feed:
- Card enrichment across Lineup and See Shows (Google ratings, cuisine/price, open status)
- Destinations section (rewired pipeline, context lenses, data-gated)
- Alive Grid (content snippets, contextual badges, collections row)

### Phase 3: Neighborhood Pulse (conditional)

**Prerequisite:** Data density validation (4+ neighborhoods with 5+ events consistently, tested weekday AND weekend).

If validated, adds geographic browsing. If not, invest in Find's neighborhood filter instead.

---

## Progressive Rendering Strategy

| Priority | Section | Strategy | Target |
|----------|---------|----------|--------|
| T=0 | The Briefing | Server-rendered via `serverFeedData`. Signals from Phase A enrichments. Fixed-height container (no CLS). | Instant |
| T=0 | The Lineup (Today tab) | Main city-pulse API response. | ~1s |
| T=1s | Regulars pre-fetch | Background fetch from `/api/regulars?weekday=today`. | Pre-loaded for toggle |
| Scroll | Lineup (This Week / Coming Up) | Tab-mode fetch on tab switch. | On interaction |
| Scroll | See Shows | Self-fetching, lazy-loaded. | On scroll |
| Scroll | Destinations | Self-fetching, lazy-loaded. Own cache. | On scroll |
| Deep scroll | Neighborhood Pulse | Self-fetching, lazy-loaded. | On scroll |
| Deep scroll | The Grid (tiles) | Counts embedded in main response. Snippets from event pool (Phase 2). | On scroll |
| Deep scroll | The Grid (collections) | Lazy self-fetching via `/api/portals/[slug]/collections`. | On scroll |

---

## Caching Strategy

| Data | Cache | TTL | Notes |
|------|-------|-----|-------|
| Main feed (Briefing + Lineup + Grid counts) | Shared server cache | Anon: 5 min, Auth: 1 min | Embedded sections share one cache entry |
| Regulars | Shared server cache | 3 min | Independent — different data lifecycle |
| Destinations | Self-fetching, server cache | 5 min | Independent — below fold, own lifecycle |
| Neighborhood Pulse | Pre-computed table + server cache | Pre-computed per crawl, API: 10 min | Stale data acceptable |
| See Shows | Client React Query | 5 min staleTime | Independent, self-fetching |
| Collections | Server cache | 15 min | Independent, lazy-loaded |

---

## Scope Boundaries

**In scope:**
- Briefing context engine with template composition (8 minimum patterns)
- Unified Lineup (3 tabs + Regulars toggle + time flow markers)
- See Shows enrichment (showtimes, urgency, metadata, festival links)
- Destinations rewire with context lenses (weather, closing, new, open now, top rated)
- Grid alive tiles with counts, snippets (desktop), badges, collections
- Neighborhood Pulse (conditional, Phase 3)
- "See all →" links from every section to appropriate Find lane (with interim targets)
- Exhibition countdown query in Phase A (shared across Briefing, Destinations, Grid)

**Out of scope:**
- Social proof in feed (friends going signals) — flagged for near-term roadmap, strongest conversion signal currently absent
- User interest picker / personalized section ordering
- Other portal feed variants (each portal adapts separately)
- "Surprise Me" — cut per strategic review
- Organization detail in feed
- Map mode within feed sections
- `SELLING FAST` urgency badge (requires ticket API integration)

---

## Review Log

**Design review round 1 (2026-03-29). Three reviewers:**

**Data Specialist:** Section-by-section data audit. Lineup (A), Grid (A-), Briefing (B), See Shows (B), Neighborhood Pulse (B-), Destinations (C). Critical gap: `place_occasions` likely sparse — kills Destinations' contextual labels. `place_vertical_details.google` not confirmed at scale — design ratings as optional. `place_profile` thin beyond backfill.

**Business Strategist:** Core direction correct. Briefing must collapse on quiet days — no filler. Cut "Surprise Me" (novelty, doesn't compound). Challenge Neighborhood Pulse (data density risk, belongs in Find). Social proof absent from feed — strongest conversion signal missing. Collections row is strong if data-driven.

**Architect:** Pipeline accommodates all changes without structural modification. Keep regulars dual-fetch (don't merge into main pool). Briefing composes in existing header resolution. Destinations: one API call, client-side lens switching. Grid counts already pre-computed. Neighborhood Pulse needs pre-computed table.

**Spec review round 2 (2026-03-29). Three reviewers:**

**Architect (round 2):** Critical: Destinations pipeline is disconnected (not "extend existing" — rewired). Regulars API `tab` param unnecessary — existing `weekday` filter works. Phase 1 enriched cards need Phase 0 data work — split into Phase 2. Exhibition data absent from pipeline — add once to Phase A, share. Template engine understated — needs minimum pattern set. Grid snippets need event pool passed to `buildBrowseSection`. "See all" links depend on Find's `lane=` param — add interim targets.

**Business Strategist (round 2):** Must-fix: Add Feed/Find division-of-labor statement. Phase 2 prerequisite incomplete (Phase 0 is shared dependency). Define Horizon quality gate. Clarify template library is scaffolding only. Confirm Date Night is query-derived. Add Regulars toggle rationale.

**Product Designer (round 2):** Critical: Regulars day pill state must reset on tab switch. Destinations needs Open Now data gate + fallback path when all lenses fail. Briefing collapsed state needs visual spec (prevent CLS). Regulars nudge: localStorage, 3 impressions max, section footer not mid-list. "Clowns" tab live bug. Major: Happening Now green collides with Open/Free/Success — differentiate via shape. Grid snippets overflow at 375px — desktop only. On the Horizon should use gold (temporal) not copper (arts). Accessibility: pulse dot needs `prefers-reduced-motion`, context pills need `aria-label`.

All issues from round 2 incorporated into this version of the spec.
