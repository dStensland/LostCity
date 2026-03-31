# Places to Go Feed Redesign

**Date:** 2026-03-30
**Status:** Design approved, pending implementation plan

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

| # | Key | Label | Place types | Accent color |
|---|-----|-------|-------------|-------------|
| 1 | `parks_gardens` | Parks & Gardens | park, garden, zoo, aquarium | #86EFAC |
| 2 | `trails_nature` | Trails & Nature | trail, viewpoint, outdoor_venue | #4ADE80 |
| 3 | `museums` | Museums | museum, arts_center | #A78BFA |
| 4 | `galleries_studios` | Galleries & Studios | gallery, studio | #C084FC |
| 5 | `theaters_stage` | Theaters & Stage | theater, comedy_club, amphitheater, cinema | #F472B6 |
| 6 | `music_venues` | Music Venues | music_venue, arena, stadium | #FF6B7A |
| 7 | `restaurants` | Restaurants | restaurant, coffee_shop, food_hall, cooking_school | #FB923C |
| 8 | `bars_nightlife` | Bars & Nightlife | bar, brewery, cocktail_bar, wine_bar, rooftop, lounge, sports_bar, nightclub, club, distillery, winery | #E879F9 |
| 9 | `markets_local` | Markets & Local Finds | farmers_market, market, bookstore, record_store, retail | #FCA5A5 |
| 10 | `libraries_learning` | Libraries & Learning | library, institution, community_center | #60A5FA |
| 11 | `fun_games` | Fun & Games | arcade, escape_room, eatertainment, bowling, pool_hall, recreation, karaoke, theme_park, attraction | #22D3EE |
| 12 | `historic_sites` | Historic Sites | landmark, historic_site, skyscraper, artifact, public_art | #FBBF24 |

### Tile Design (Jeweltone Grid)

Preserve the current BrowseGridTile aesthetic: `color-mix(in srgb, accent 15%, transparent)` background, `color-mix(in srgb, accent 20%, transparent)` border, rounded-lg.

Layout: 2-col (mobile) / 3-col (tablet) / 4-col (desktop) grid.

#### Collapsed State (default)

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
- **Summary line:** `text-2xs text-[var(--muted)]` — dynamic, replaces static "this week"
- **Activity dot:** green pulse when events today (existing badge pattern)
- **Tap action:** expands to show place cards

#### Expanded State

Tile grows to **span full grid width**. Below the tile header, renders 2-3 compact place cards and a "See all" link.

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

Expanded tile uses `col-span-full` in the grid. Other tiles reflow around it naturally.

### Place Card (Inside Expanded Tile)

Compact horizontal layout, 2-3 per expanded tile.

- **Image:** 60x60px, rounded-lg, SmartImage with themed gradient fallback
- **Name:** `text-sm font-semibold text-[var(--cream)]`
- **Subtitle:** `text-xs text-[var(--soft)]` — neighborhood + open/closed status
- **Callout line:** `text-xs text-[var(--muted)]` — vertical-specific (see below)
- **Rating:** Google rating badge in accent color (when available)
- **Left border:** 2px in tile's accent color (jeweltone continuity)
- **Background:** `bg-[var(--night)]` with `border border-[var(--twilight)]/40`

Cards link to place detail page: `/{portal}/places/{slug}`.

### Vertical-Specific Callouts

Each category has a callout builder that selects the most interesting available data. Priority order: time-sensitive > activity-driven > static.

| Category | Time-sensitive | Activity-driven | Static fallback |
|----------|---------------|-----------------|-----------------|
| **Parks & Gardens** | "Great weather today" | "N events this week" | Dog-friendly, Family-friendly |
| **Trails & Nature** | "Perfect hiking weather" / season match | — | Difficulty + length + drive time |
| **Museums** | "New exhibit this month" | "N exhibitions now" | Library pass, Wheelchair accessible |
| **Galleries & Studios** | "Opening reception [day]" | "N shows current" | Neighborhood, Vibes |
| **Theaters & Stage** | "Tonight: [show title]" | "N shows this week" | Capacity feel, Genre |
| **Music Venues** | "Tonight: [act name]" | "N acts this week" | Vibes (divey, intimate, upscale) |
| **Restaurants** | "Happy hour til [time]" | "New this month" | Cuisine + price level + occasions |
| **Bars & Nightlife** | "Happy hour now" / "Tonight: [event]" | "N events tonight" | Vibes (rooftop, craft cocktails, divey) |
| **Markets & Local Finds** | "Next: [day]" (weekend markets) | — | Indoor/outdoor, Seasonal |
| **Libraries & Learning** | "N programs this week" | — | All ages, MARTA accessible |
| **Fun & Games** | — | "N events this week" | Family-friendly + age range, Group-friendly |
| **Historic Sites** | "Tour [day]" | "N tours this week" | Wheelchair accessible, Description snippet |

### Data sources for callouts

| Data point | Source table/field |
|---|---|
| Weather fit | `place_vertical_details.outdoor.weather_fit_tags` + current weather API |
| Dog-friendly | `place_vertical_details.outdoor.dog_friendly` OR `place_occasions.occasion = 'dog_friendly'` |
| Family-friendly | `place_profile.family_suitability` OR `place_occasions.occasion = 'family_friendly'` |
| Trail difficulty/length | `place_vertical_details.outdoor.difficulty_level`, `trail_length_miles`, `drive_time_minutes` |
| Tonight's event | `events` joined on `place_id` where `start_date = today` |
| Events this week | `events` count where `start_date` between today and +7 days |
| Happy hour active | `place_specials` where `type = 'happy_hour'` and current time in `time_start..time_end` and current day in `days_of_week` |
| New this month | `places.created_at > now() - 30 days` |
| Cuisine/price | `place_vertical_details.dining.cuisine`, `place_vertical_details.google.price_level` |
| Vibes | `places.vibes` array (from Spot type) |
| Occasions | `place_occasions.occasion` |
| Open/closed | Computed from `places.hours` + current time |
| Google rating | `place_vertical_details.google.rating` |
| Library pass | `place_profile.library_pass` |
| Wheelchair | `place_profile.wheelchair` |
| Next market date | `events` where `place_type IN (farmers_market, market)` ordered by `start_date` |
| MARTA accessible | `place_profile.transit_notes` (non-null = has transit info) |
| Season match | `place_vertical_details.outdoor.best_seasons` vs current month |

### Summary Line Cascade

Each collapsed tile shows a dynamic summary line. Computed server-side.

**Priority cascade per category:**

| Priority | Category | Time-sensitive | Activity-driven | Static |
|----------|----------|---------------|-----------------|--------|
| 1→2→3 | Parks & Gardens | "N match today's weather" | "N with events this week" | "N dog-friendly" |
| 1→2→3 | Trails & Nature | "Perfect [season] hiking" | — | "N within 45 min · N easy" |
| 1→2→3 | Museums | "N new exhibits this month" | "N exhibitions showing" | "N with library pass" |
| 1→2→3 | Galleries & Studios | "N opening receptions this week" | "N shows current" | "N in [top neighborhood]" |
| 1→2→3 | Theaters & Stage | "N shows tonight" | "N shows this week across N venues" | "N venues" |
| 1→2→3 | Music Venues | "N acts tonight" | "N acts this week" | "N venues" |
| 1→2→3 | Restaurants | "N with happy hour now" | "N new this month" | "N cuisines · $–$$$$" |
| 1→2→3 | Bars & Nightlife | "N happy hours active now" / "N events tonight" | "N with specials" | "N rooftops · N dive bars" |
| 1→2→3 | Markets & Local Finds | "N markets this weekend" | — | "N markets · N bookstores" |
| 1→2→3 | Libraries & Learning | "N free programs this week" | — | "N libraries · All ages" |
| 1→2→3 | Fun & Games | — | "N events this week" | "All ages: N · Date night: N" |
| 1→2→3 | Historic Sites | "N tours this week" | — | "N landmarks · N tours available" |

### Auto-Expand Logic

1-2 tiles auto-expand on page load. API returns `auto_expand: boolean` per category.

**Signals (additive scoring, top 1-2 win):**

| Signal | Score | Categories affected |
|--------|-------|-------------------|
| Sunny + warm (>65F) | +3 | Parks, Trails |
| Rainy / cold | +3 | Museums, Fun & Games, Libraries |
| Evening (after 5pm) | +3 | Bars & Nightlife, Music Venues |
| Weekend | +2 | Markets, Trails, Parks |
| Weekday daytime | +2 | Museums, Libraries |
| Category has 3+ events today | +2 | Any |
| Category has active specials now | +1 | Restaurants, Bars |

Top 1-2 scoring categories get `auto_expand: true`. Tie-break: higher place count.

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
  - Google rating >= 4.0:                            +10
  - Google rating >= 4.5:                            +5 (additional)
  - Has image:                                       +3
  - Has description:                                 +2
  - Featured flag:                                   +5

recency_bonus   (0-10 pts)
  - Created < 30 days ago:                           +10
  - Created < 90 days ago:                           +5
  - New events added < 7 days:                       +3
```

**Quality gate:** Exclude places with no image AND no description AND no rating. This prevents low-quality entries (paint-and-sip factories, generic event spaces) from dominating high-activity categories.

Return top 3 by score. If fewer than 2 pass the quality gate, the category still shows but without expanded place cards (collapsed tile only with summary + count).

### Data Architecture

**New API endpoint:** `GET /api/portals/[slug]/city-pulse/places-to-go`

Single request, server-side computation. No per-category client fetches.

**Request params:**
- `portal_slug` (from path)
- Weather data injected server-side (from weather cache or API)
- Current time computed server-side

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
  auto_expand: boolean;           // context-driven
  has_activity_today: boolean;    // for pulse dot
  places: PlacesToGoCard[];       // 0-3 cards
  see_all_href: string;           // "/?view=places&venue_type=park,garden,zoo,aquarium"
}

interface PlacesToGoCard {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  neighborhood: string | null;
  is_open: boolean | null;
  rating: number | null;
  callouts: string[];             // ["Great weather today", "Dog-friendly"]
  event_count: number;            // upcoming events
  href: string;                   // "/atlanta/places/piedmont-park"
}
```

**Cache:** 5 minute TTL (same as feed). Weather and time context make this naturally dynamic within the cache window.

### Components

| Component | Path | Purpose |
|-----------|------|---------|
| `PlacesToGoSection` | `web/components/feed/sections/PlacesToGoSection.tsx` | Section wrapper, grid layout, manages expand state |
| `PlacesToGoCategoryTile` | `web/components/feed/sections/PlacesToGoCategoryTile.tsx` | Single category tile (collapsed + expanded states) |
| `PlacesToGoCard` | `web/components/feed/sections/PlacesToGoCard.tsx` | Compact place card inside expanded tile |

### What Gets Removed

- **BrowseSection.tsx** — replaced entirely by PlacesToGoSection
- **"Things to Do" event category grid** — redundant with Lineup, See Shows, Regular Hangs
- **ExperiencesSection.tsx** — absorbed into Places to Go (same data, better presentation)
- **`browse` section type** in `portal_sections` — replaced by new `places_to_go` type
- **`experiences` section type** — removed

### What's Preserved

- Jeweltone color palette from `THINGS_TO_DO_TILES`
- `color-mix` tinting pattern from BrowseGridTile
- Grid layout (2/3/4 cols)
- "See all" links to Find/Places view
- Pulse dot for live activity

## Out of Scope

- Personalization (user preferences, saved places, history) — future enhancement
- Location-based distance sorting — requires geolocation consent flow
- Place following / social proof on cards — future social layer integration
- Weather API integration — use existing weather cache from CityBriefing; if unavailable, skip weather-dependent summaries and auto-expand signals gracefully
