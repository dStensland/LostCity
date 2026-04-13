# Music Tab Redesign — Hybrid Layout

**Date:** 2026-04-13
**Status:** Draft
**Scope:** Venues → Music tab on the CityPulse feed

## Problem

The current Music tab renders a flat 2-column grid of VenueShowCard components. Every venue with music events gets equal treatment regardless of whether it's Terminal West or a random bar with an open mic. Key data we've invested in collecting (artist names, genres, doors time) isn't surfaced. No genre filtering exists. The result is cluttered and generic.

## Design

### Layout: Two Zones

**Zone 1 — Tonight Carousel** (conditional: omitted when no shows tonight)

Horizontal-scroll carousel of tonight's shows across all qualifying venues. Each card shows:
- Artist/show name (primary text)
- Venue name + neighborhood (secondary)
- Genre tags as chips (e.g., "indie rock", "psychedelic") — from event tags or artist enrichment
- Doors time badge (top-right, accent-tinted)
- Show time (accent color)
- FREE badge when `is_free = true` (neon-green)

Cards are ~260px wide, consistent with FeaturedCarousel card sizing. Image area uses venue or artist image with gradient overlay. Falls back to accent-tinted gradient when no image available.

**Sourcing:** All venues with `is_show = true` music events today — includes borderline venues (bars, restaurants) since tonight is about urgency, not venue curation. Uses existing shows API with `categories=music&is_show=true` filtered to today only.

**Sorting:** By show time ascending (earliest first).

**Zone 2 — Venue Directory**

Compact venue rows for established music venues only. Each row shows:
- Venue image or icon fallback (left rail, same sizing as VenueShowCard)
- Venue name + neighborhood
- Show count badge ("4 shows")
- Next 2 upcoming shows with artist name + day/time
- "+N more this week" overflow link

**Filtering:** Only `place_type = 'music_venue'` venues appear in the directory (~13 currently). This is the curated "established" flag set via migration. Bars/restaurants/breweries never appear here regardless of show count.

**Sorting:** Venues with today's shows first, then by total show count descending.

**Visual language:** Same card DNA as other Venues tabs — `bg-[var(--night)]`, accent-tinted `border-left`, same typography scale. The directory should feel like a natural extension of the tab, not a foreign component.

### Genre Filter Strip

Horizontal-scroll pill strip above both zones. Broad buckets:
- All (default, active)
- Rock
- Hip-Hop / R&B
- Electronic / DJ
- Jazz / Blues
- Country
- Latin
- Pop / Singer-Songwriter

**Data source:** Event `tags` array and artist genre data from MusicBrainz enrichment. Map specific tags to broad buckets (e.g., "indie rock", "alt rock", "post-punk" → Rock). Events without genre data are included under "All" but excluded from specific genre filters.

**Behavior:** Single-select. Filters both tonight carousel and venue directory. Uses client-side filtering on already-fetched data (no additional API calls). Active chip uses magenta accent (`#E855A0`).

**Subgenre tags on cards:** Individual genre tags appear as small chips on tonight's carousel cards (e.g., "indie rock", "shoegaze"). These are the specific tags, not the broad bucket. Visible for discovery but not used for navigation.

### Empty States

- **No shows tonight:** Tonight section is omitted entirely. Venue directory renders with "This Week" shows. No empty state message.
- **No shows this week at a venue:** Venue is omitted from the directory (don't show venues with nothing coming up).
- **No shows at all (rare):** Minimal message: "No music shows this week" — same pattern as other tabs.
- **Genre filter yields 0 results:** "No [genre] shows this week" with option to clear filter.

## Data Requirements

### API Changes

Extend the existing `/api/portals/[slug]/shows` response (no new query parameters needed — client does today/venue-tier splitting locally):

1. **Add `tags` to show response:** Include event tags array for genre filtering/display.
2. **Add `doors_time` to show response:** Include doors_time from events table.
3. **Ensure `place_type` on venue response:** Already present — used by client to split music_venue directory from tonight carousel.

Response shape additions per show:
```typescript
{
  // existing fields...
  tags: string[];
  doors_time: string | null;
}
```

Genre bucket labels are derived client-side from tags using the genre map below. No server-side genre computation needed.

### Genre Mapping

A static map from specific tags to broad buckets. Lives in a shared utility (used by both API response building and client-side filtering):

```typescript
const GENRE_MAP: Record<string, string> = {
  "rock": "Rock",
  "indie-rock": "Rock",
  "alt-rock": "Rock",
  "post-punk": "Rock",
  "punk": "Rock",
  "metal": "Rock",
  "hip-hop": "Hip-Hop / R&B",
  "rap": "Hip-Hop / R&B",
  "r-and-b": "Hip-Hop / R&B",
  "soul": "Hip-Hop / R&B",
  "electronic": "Electronic / DJ",
  "edm": "Electronic / DJ",
  "house": "Electronic / DJ",
  "techno": "Electronic / DJ",
  "dj": "Electronic / DJ",
  "jazz": "Jazz / Blues",
  "blues": "Jazz / Blues",
  "country": "Country",
  "bluegrass": "Country",
  "americana": "Country",
  "latin": "Latin",
  "reggaeton": "Latin",
  "salsa": "Latin",
  "pop": "Pop / Singer-Songwriter",
  "singer-songwriter": "Pop / Singer-Songwriter",
  "folk": "Pop / Singer-Songwriter",
  "indie-pop": "Pop / Singer-Songwriter",
  // unmapped tags → excluded from genre filters, still visible as chips
};
```

### No New Tables or Migrations

All data already exists:
- `events.tags` — genre tags from LLM extraction
- `events.doors_time` — doors time column
- `events.is_show` — show flag
- `places.place_type` — venue tier flag
- `event_artists` — artist data (future: could surface headliner name)

## Component Architecture

### New Components

1. **`MusicTabContent`** — replaces `ProgrammingTabContent` for the music tab only. Orchestrates tonight carousel + genre filter + venue directory. Lives in `web/components/feed/sections/`.

2. **`TonightShowCard`** — carousel card for tonight's shows. ~260px wide, image area with gradient, artist name, venue, genre chips, doors time badge. Lives in `web/components/feed/venues/`.

3. **`GenreFilterStrip`** — horizontal-scroll pill strip with genre buckets. Shared component (could be reused by other tabs later). Lives in `web/components/feed/`.

### Modified Components

4. **`VenueShowCard`** — minor: add optional `genres` display as small chips below show title. No structural changes.

5. **`VenuesSection`** — swap `ProgrammingTabContent` for `MusicTabContent` in the music tab panel. No other changes.

### Data Flow

```
VenuesSection (music tab active)
  └─ MusicTabContent
       ├─ fetch /api/portals/[slug]/shows?categories=music&is_show=true
       ├─ GenreFilterStrip (client-side filter state)
       ├─ Tonight Carousel (filtered to today, genre-filtered)
       │    └─ TonightShowCard[] (horizontal scroll)
       └─ Venue Directory (music_venue only, genre-filtered)
            └─ VenueShowCard[] (vertical list)
```

Single API call, client-side splitting into today vs. this-week and client-side genre filtering. No additional network requests for genre changes.

## Scope Boundaries

**In scope:**
- Music tab layout restructure (tonight + directory)
- Genre filter strip with client-side filtering
- Surface doors_time, tags/genres on cards
- API response additions (tags, doors_time)

**Out of scope:**
- Artist images on cards (requires reliable artist image pipeline)
- Headliner name extraction from event_artists table (future enhancement)
- Genre filter on other tabs (Comedy, Theater, etc.)
- Ticket link/buy button on cards
- Changes to any other Venues tab
