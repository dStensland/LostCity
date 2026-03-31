# Places to Go Feed Redesign

**Date:** 2026-03-30
**Status:** Design approved, pending implementation plan
**Reviewed by:** Architecture, Performance, Data Quality, Product Design (2026-03-30)

## Problem

The current BrowseSection at the bottom of the CityPulse feed has two grids:
1. **"Things to Do"** — event category tiles (music, film, comedy, etc.) with counts. Redundant. The Lineup, See Shows, Regular Hangs, and Game Day sections already surface events by every useful angle.
2. **"Places to Go"** — destination-type tiles (museums, parks, trails, etc.) with counts. Thin. Just a count and a link — none of the rich `place_profile`, `place_vertical_details`, `place_occasions`, or `place_specials` data is surfaced.

Additionally, the ExperiencesSection (venue grid with category chips) overlaps with Places to Go.

## Solution

Replace BrowseSection with an enhanced **"Places to Go"** section. Remove "Things to Do" tiles entirely. Absorb ExperiencesSection. Show 12 jeweltone category tiles that expand to reveal contextually-selected place cards with vertical-specific callouts.

## Design

### Section Position

Same slot as current BrowseSection (bottom of feed). Feed order unchanged.

### 12 Categories

Each category maps `place_type` values to a tile:

| # | Key | Label | Place types | Accent color | Place count |
|---|-----|-------|-------------|-------------|-------------|
| 1 | `parks_gardens` | Parks & Gardens | park, garden, zoo, aquarium | #86EFAC | ~465 |
| 2 | `trails_nature` | Trails & Nature | trail, viewpoint, outdoor_venue | #4ADE80 | ~57 |
| 3 | `museums` | Museums | museum, arts_center | #A78BFA | ~72 |
| 4 | `galleries_studios` | Galleries & Studios | gallery, studio | #C084FC | ~116 |
| 5 | `theaters_stage` | Theaters & Stage | theater, comedy_club, amphitheater, cinema | #F472B6 | ~120 |
| 6 | `music_venues` | Music Venues | music_venue, arena, stadium | #FF6B7A | ~70 |
| 7 | `restaurants` | Restaurants | restaurant, coffee_shop, food_hall, cooking_school | #FB923C | ~1,008 |
| 8 | `bars_nightlife` | Bars & Nightlife | bar, brewery, cocktail_bar, wine_bar, rooftop, lounge, sports_bar, nightclub, club, distillery, winery | #E879F9 | ~410 |
| 9 | `markets_local` | Markets & Local Finds | farmers_market, market, bookstore, record_store, retail | #FCA5A5 | ~161 |
| 10 | `libraries_learning` | Libraries & Learning | library, institution, community_center | #60A5FA | ~352 |
| 11 | `fun_games` | Fun & Games | arcade, escape_room, eatertainment, bowling, pool_hall, recreation, karaoke, theme_park, attraction | #22D3EE | ~61 |
| 12 | `historic_sites` | Historic Sites | landmark, historic_site, skyscraper, artifact, public_art | #FBBF24 | ~101 |

### Tile Design (Jeweltone Grid)

Preserve the current BrowseGridTile aesthetic: `color-mix(in srgb, accent 15%, transparent)` background, `color-mix(in srgb, accent 20%, transparent)` border, rounded-lg.

Layout: 2-col (mobile) / 3-col (tablet) / 4-col (desktop) grid.

#### Collapsed State (default)

All tiles start collapsed, including on initial load.

```
┌─────────────────────────┐
│  Parks & Gardens    ● 4 │  ← pulse dot if events today
│  52                     │  ← total place count in accent color
│  Great day for it —     │  ← dynamic summary line
│  8 match the weather    │
└─────────────────────────┘
```

- **Category name:** `text-sm font-semibold text-[var(--cream)]`
- **Count:** `text-xl font-bold` in accent color
- **Summary line:** `text-xs text-[var(--soft)]` — dynamic, replaces static "this week"
- **Activity dot:** green pulse when events today (existing badge pattern)
- **Tap action:** expands to show place cards (collapses any other expanded tile)

#### Expanded State

Tile grows to **span both columns** (`col-span-2` on mobile, `col-span-3` on tablet, `col-span-4` on desktop — always full row width). Below the tile header, renders 2-3 compact place cards and a "See all" link. Only one tile can be expanded at a time — tapping a new tile collapses the previous.

```
┌──────────────────────────────────────────────────────────────┐
│  Parks & Gardens                          52 places  See all │
│  Great day for it — 8 match today's weather                  │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │ [img] Piedmont Park  │  │ [img] Botanical Gdn  │         │
│  │ Midtown · Open now   │  │ Midtown · Open now   │         │
│  │ ☀ Weather · 🐕 Dogs │  │ 3 events this week   │         │
│  └──────────────────────┘  └──────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

**Expand interaction:** Immediately apply full-row `col-span`. Cards appear with a short fade-in. No height animation on the grid (layout-triggering, janky). Collapsed tiles below shift down once — this is acceptable for a single reflow.

**Expand state:** `useState<string | null>` — one expanded category key or null.

### Place Card (Inside Expanded Tile)

Compact horizontal layout, 2-3 per expanded tile.

- **Image:** 80x80px, rounded-lg, SmartImage with themed gradient fallback
- **Name:** `text-sm font-semibold text-[var(--cream)]`
- **Subtitle:** `text-xs text-[var(--soft)]` — neighborhood + open/closed status (when hours available)
- **Callout line:** `text-xs text-[var(--muted)]` — vertical-specific (see below)
- **Left border:** 2px in tile's accent color (jeweltone continuity)
- **Background:** `bg-[var(--night)]` with `border border-[var(--twilight)]/40`
- **Image loading:** `loading="lazy"` — cards are below the fold inside an interaction

Cards link to place detail page: `/{portal}/places/{slug}`.

### Vertical-Specific Callouts

Each category has a callout builder that selects the most interesting available data. Priority order: time-sensitive > activity-driven > static.

`place_occasions` is the strongest callout data source (1,500 family_friendly, 1,366 date_night, 659 outdoor_dining, 309 dog_friendly). Lean on it as a primary source, not just a fallback.

| Category | Time-sensitive | Activity-driven | Static fallback |
|----------|---------------|-----------------|-----------------|
| **Parks & Gardens** | "Great weather today" | "N events this week" | Dog-friendly, Family-friendly |
| **Trails & Nature** | "Perfect hiking weather" / season match | — | Difficulty + drive time |
| **Museums** | "New exhibit this month" | "N exhibitions now" | Library pass, Family-friendly |
| **Galleries & Studios** | "Opening reception [day]" | "N shows current" | Neighborhood, Vibes |
| **Theaters & Stage** | "Tonight: [show title]" | "N shows this week" | Genre |
| **Music Venues** | "Tonight: [act name]" | "N acts this week" | Vibes (divey, intimate, upscale) |
| **Restaurants** | "Happy hour til [time]" | "New this month" | Cuisine + occasions (date night, groups, outdoor dining) |
| **Bars & Nightlife** | "Happy hour now" / "Tonight: [event]" | "N events tonight" | Vibes (rooftop, craft cocktails, divey) |
| **Markets & Local Finds** | "Next: [day]" (weekend markets) | — | Indoor/outdoor, Seasonal |
| **Libraries & Learning** | "N programs this week" | — | Family-friendly, Near [MARTA station] |
| **Fun & Games** | — | "N events this week" | Family-friendly + age range, Group-friendly |
| **Historic Sites** | "Tour [day]" | "N tours this week" | Description snippet |

### Data sources for callouts (verified against actual DB coverage)

| Data point | Source table/field | Coverage |
|---|---|---|
| Weather fit | `place_vertical_details.outdoor.weather_fit_tags` + `/api/weather/current` | 610 places |
| Dog-friendly | `place_occasions.occasion = 'dog_friendly'` | 309 places |
| Family-friendly | `place_occasions.occasion = 'family_friendly'` | 1,500 places |
| Trail difficulty | `place_vertical_details.outdoor.difficulty_level` | 273 places |
| Drive time | `place_vertical_details.outdoor.drive_time_minutes` | 188 places |
| Tonight's event | `events` joined on `place_id` where `start_date = today` | varies daily |
| Events this week | `events` count where `start_date` between today and +7 days | varies |
| Happy hour active | `place_specials` where `type = 'happy_hour'` + time/day match | 22 places |
| New this month | `places.created_at > now() - 30 days` | varies |
| Cuisine | `places.cuisine` (array field on places table) | 93% of restaurants |
| Vibes | `places.vibes` (array field) | 72% of places |
| Occasions | `place_occasions.occasion` | well-populated across 15 occasion types |
| Open/closed | Computed from `places.hours` + current time via `isOpenAt()` | 85% restaurants/bars, <30% galleries/libraries |
| Library pass | `place_profile.library_pass` | needs coverage check |
| MARTA accessible | `places.nearest_marta_station` + `places.marta_walk_minutes` | 1,062 places |
| Season match | `place_vertical_details.outdoor.best_seasons` vs current month | 610 places |
| Next market date | `events` where `place_type IN (farmers_market, market)` | varies |

**Data that does NOT exist (removed from callouts):**
- ~~`place_vertical_details.google.rating`~~ — 0% populated, all null
- ~~`place_vertical_details.google.price_level`~~ — 0% populated
- ~~`place_vertical_details.dining.cuisine`~~ — field doesn't exist here; use `places.cuisine`
- ~~`trail_length_miles`~~ — 0 records populated
- ~~`place_profile.family_suitability`~~ — 0% populated; use `place_occasions`
- ~~`place_profile.wheelchair`~~ — 0% populated
- ~~`place_profile.transit_notes`~~ — 0% populated; use `places.nearest_marta_station`

### Summary Line Cascade

Each collapsed tile shows a dynamic summary line. Computed server-side. Summaries are derived from the same data pool as scoring — no additional queries.

**Priority cascade per category:**

| Priority | Category | Time-sensitive | Activity-driven | Static |
|----------|----------|---------------|-----------------|--------|
| 1->2->3 | Parks & Gardens | "N match today's weather" | "N with events this week" | "N dog-friendly" |
| 1->2->3 | Trails & Nature | "Perfect [season] hiking" | — | "N within 45 min · N easy" |
| 1->2->3 | Museums | "N new exhibits this month" | "N exhibitions showing" | "N with library pass" |
| 1->2->3 | Galleries & Studios | "N opening receptions this week" | "N shows current" | "N in [top neighborhood]" |
| 1->2->3 | Theaters & Stage | "N shows tonight" | "N shows this week across N venues" | "N venues" |
| 1->2->3 | Music Venues | "N acts tonight" | "N acts this week" | "N venues" |
| 1->2->3 | Restaurants | "N with happy hour now" | "N new this month" | "N cuisines" |
| 1->2->3 | Bars & Nightlife | "N happy hours active now" / "N events tonight" | "N with specials" | "N rooftops · N dive bars" |
| 1->2->3 | Markets & Local Finds | "N markets this weekend" | — | "N markets · N bookstores" |
| 1->2->3 | Libraries & Learning | "N free programs this week" | — | "N libraries" |
| 1->2->3 | Fun & Games | — | "N events this week" | "Family-friendly: N · Date night: N" |
| 1->2->3 | Historic Sites | "N tours this week" | — | "N landmarks" |

### Place Selection Algorithm

For each category, select 2-3 places. Server-side scoring:

```
contextual_fit  (0-40 pts)
  - Weather match (weather_fit_tags vs current):     +20
  - Time-of-day match (best_time_of_day vs now):     +10
  - Season match (best_seasons vs current):          +10

activity_boost  (0-30 pts)
  - Events today:                                    +15 per event (max 30)
  - Events this week:                                +5 per event (max 20)
  - Active specials right now:                       +10

quality_floor   (0-20 pts)
  - Has image:                                       +8
  - Has description:                                 +5
  - Featured flag:                                   +5
  - Has 3+ occasions tagged:                         +2

recency_bonus   (0-10 pts)
  - Created < 30 days ago:                           +10
  - Created < 90 days ago:                           +5
  - New events added < 7 days:                       +3
```

Note: Google rating scoring removed — 0% data coverage. Will be added when Google enrichment runs.

**Quality gate:** Exclude places with no image AND no description. This prevents low-quality entries from dominating high-activity categories. At current data coverage (~85% images, ~76% descriptions), this filters very few places — the gate becomes more useful as new/uncurated places are added.

Return top 3 by score. If fewer than 2 pass the quality gate, the category still shows but without expanded place cards (collapsed tile only with summary + count).

### Data Architecture

**New API endpoint:** `GET /api/portals/[slug]/city-pulse/places-to-go`

Single request, server-side computation. No per-category client fetches.

**Data fetching pattern:** Self-fetching via `useQuery` on the client (matching ExperiencesSection pattern). This section is below the fold — do NOT include in the main feed API response to avoid bloating it.

**Query strategy (1+3 pattern):**
1. **Main query:** All active places matching any of the 12 categories' place_types, with FK joins to `place_profile` and `place_vertical_details`. Limit 500. Bucket into categories in JS.
2. **Parallel secondary queries (Promise.all):**
   - Event counts per place_id via RPC with `GROUP BY place_id` (not raw row fetching)
   - Active specials (`place_specials` with time/day filters)
   - Place occasions (`place_occasions` — fetch all, build `Map<number, string[]>`)

Scoring, summary computation, and card selection all run in-memory against the fetched data pool. No per-category queries.

**Weather injection:** Fetch from `/api/weather/current` at route handler level. Pass `{ temperature, isRainy, condition }` into the scoring function. If weather fetch fails, skip weather-dependent scoring and summaries gracefully (fall through to activity/static).

**Portal scoping:** Apply `applyManifestFederatedScopeToQuery` on the events query (copy from experiences endpoint). Filter chain venues (AMC, Regal, Planet Fitness) from results.

**Cache strategy:**
- Key: `${portalSlug}|${timeSlot}|${today}` where timeSlot = morning/afternoon/evening/late_night
- TTL: 30 minutes with `s-maxage=300, stale-while-revalidate=3600`
- Weather staleness within the cache window is acceptable — this section is not real-time
- Use existing `getSharedCacheJson`/`setSharedCacheJson` pattern

**Response shape:**
```typescript
interface PlacesToGoResponse {
  categories: PlacesToGoCategory[];
}

interface PlacesToGoCategory {
  key: string;                    // "parks_gardens"
  label: string;                  // "Parks & Gardens"
  accent_color: string;           // "#86EFAC"
  icon_type: string;              // "park" (for Phosphor icon mapping)
  count: number;                  // total places in category
  summary: string;                // "8 match today's weather"
  has_activity_today: boolean;    // for pulse dot
  places: PlacesToGoCard[];       // 0-3 cards
  see_all_href: string;           // routing varies by category (see below)
}

interface PlacesToGoCard {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  neighborhood: string | null;
  is_open: boolean | null;
  callouts: string[];             // ["Great weather today", "Dog-friendly"]
  event_count: number;            // upcoming events
  href: string;                   // "/atlanta/places/piedmont-park"
}
```

Note: `auto_expand` removed from response — all tiles start collapsed. `rating` removed from card — no data.

**"See all" routing:** Categories that have native tab views link there; others link to Places view with venue_type filter.
- Restaurants, coffee_shop, food_hall → `?view=places&tab=eat-drink`
- Bars, nightlife types → `?view=places&tab=eat-drink` (nightlife sub-tab if available)
- All other categories → `?view=places&venue_type={types}`

### Components

| Component | Path | Purpose |
|-----------|------|---------|
| `PlacesToGoSection` | `web/components/feed/sections/PlacesToGoSection.tsx` | Section wrapper, grid layout, manages expand state (`useState<string \| null>`) |
| `PlacesToGoCategoryTile` | `web/components/feed/sections/PlacesToGoCategoryTile.tsx` | Single category tile (collapsed + expanded states) |
| `PlacesToGoCard` | `web/components/feed/sections/PlacesToGoCard.tsx` | Compact place card inside expanded tile |

### What Gets Removed

- **BrowseSection.tsx** — replaced entirely by PlacesToGoSection
- **BrowseGridTile.tsx** — replaced by PlacesToGoCategoryTile
- **"Things to Do" event category grid** — redundant with Lineup, See Shows, Regular Hangs
- **ExperiencesSection.tsx** — absorbed into Places to Go (same data, better presentation)
- **`browse` section type** in `portal_sections` — replaced by new `places_to_go` type
- **`experiences` section type** — removed
- **CityPulseShell references** to BrowseSection and ExperiencesSection rendering — update to render PlacesToGoSection

### What's Preserved

- Jeweltone color palette from `THINGS_TO_DO_TILES`
- `color-mix` tinting pattern from BrowseGridTile
- Grid layout (2/3/4 cols)
- "See all" links to Find/Places view
- Pulse dot for live activity

### New Constants

Create `PLACES_TO_GO_CATEGORIES` in a new constants file (or extend `spots-constants.ts`) to replace `THINGS_TO_DO_TILES`. The two constants must not coexist — remove the old one and update any remaining references.

## Data Coverage Reality (as of 2026-03-30)

At launch, expect:
- **Strong callouts** (time-sensitive + activity): Bars (happy hour + events), Theaters (tonight's shows), Music Venues (tonight's act), Libraries (programs this week), Restaurants (happy hour + new)
- **Medium callouts** (activity + occasions): Parks (events + dog/family), Galleries (openings), Markets (next date), Fun & Games (events + occasions)
- **Static-only callouts**: Trails (difficulty + drive time), Historic Sites (description snippet)

This is acceptable. The static fallbacks are meaningful — "Moderate · 45 min drive" for a trail is genuinely useful. Coverage improves as Google enrichment and vertical_details population continue.

## Out of Scope

- Personalization (user preferences, saved places, history) — future enhancement
- Location-based distance sorting — requires geolocation consent flow
- Place following / social proof on cards — future social layer integration
- Google Places enrichment — when populated, add rating badge to cards and rating scoring to algorithm
- Auto-expand on load — removed per design review; summary lines provide sufficient scanning affordance without it
