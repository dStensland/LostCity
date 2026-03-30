# Venues Section Redesign

## Context

The feed's "See Shows" section frames discovery as content-first ("here's what's playing"). The better frame is venue-first ("here are places that put on things — here's what's on"). Users think "I want to go to the Plaza" not "I want to see a film and I don't care where." The venue IS the decision; the programming is what makes you go tonight vs another night.

Replaces "See Shows" with "Venues" — same position in the feed, same data, venue-shaped.

## Design

### 7 Tabs, Two Card Flavors

**Programming venues** (shows with start times):
- **Film** — cinemas, indie theaters, drive-ins
- **Music** — music venues, arenas
- **Comedy** — comedy clubs + comedy at bars (9 dedicated clubs, 38 events/week)
- **Theater** — theaters, amphitheaters (theater + dance categories)
- **Nightlife** — DJ nights, parties, themed nights at clubs/bars

**Exhibition venues** (what's currently showing, dates not times):
- **Arts** — galleries, museums, arts centers (exhibitions + openings)
- **Attractions** — zoos, aquariums, theme parks, attractions (what's on / what's showing)

### Tab → Data Mapping

| Tab | Data Source | Category Filter | Card Flavor |
|-----|------------|-----------------|-------------|
| Film | `/api/showtimes?mode=by-theater` | film | programming (keep NowShowingSection rendering) |
| Music | `/api/portals/[slug]/shows?categories=music` | music | programming |
| Comedy | `/api/portals/[slug]/shows?categories=comedy` | comedy | programming |
| Theater | `/api/portals/[slug]/shows?categories=theater,dance` | theater, dance | programming |
| Nightlife | `/api/portals/[slug]/shows?categories=nightlife` | nightlife | programming |
| Arts | exhibitions table + events at gallery/museum/arts_center | art, education | exhibition |
| Attractions | events at zoo/aquarium/attraction/theme_park | outdoors, workshops | exhibition |

### Tab Accent Colors

| Tab | Color |
|-----|-------|
| Film | `var(--vibe)` (existing) |
| Music | `#E855A0` (existing) |
| Comedy | `var(--gold)` |
| Theater | `var(--neon-cyan)` (existing) |
| Nightlife | `var(--neon-magenta)` |
| Arts | `var(--coral)` |
| Attractions | `var(--neon-green)` |

### Programming Card (`VenueShowCard`)

2-column grid on sm+, 1-column on mobile. Each card:

```
┌─────────────────────────────────┐
│ [48px icon/img]  Venue Name     │
│                  Neighborhood   │
│─────────────────────────────────│
│ Show Title 1           7:00pm  │
│ Show Title 2           9:30pm  │
│ +2 more today                  │
└─────────────────────────────────┘
```

- 48px venue image (SmartImage) or category icon fallback
- Venue name + neighborhood
- Up to 3 shows with times
- "+N more" overflow link to venue detail
- Card bg: `bg-[var(--night)] border border-[var(--twilight)]/30 rounded-xl`

### Exhibition Card (`VenueExhibitionCard`)

Same grid layout. Different content shape:

```
┌─────────────────────────────────┐
│ [48px icon/img]  Venue Name     │
│                  Neighborhood   │
│─────────────────────────────────│
│ Exhibition Title                │
│ Through Apr 15                  │
│ Another Exhibition              │
│ Opens Apr 1                     │
└─────────────────────────────────┘
```

- Same 48px image + venue header
- Shows exhibition titles with date context ("Through Apr 15", "Opens Apr 1", "Now showing")
- No times — exhibitions are date-range based

### Film Tab — Preserve Existing Richness

The Film tab keeps `NowShowingSection`'s rendering inside the new tab shell. It already groups by theater with poster strips, showtimes per film, ratings, and the theater customizer. Don't regress this to flat `VenueShowCard` — the film data is richer and deserves its own rendering.

### Empty Tab Handling

Show "No [category] tonight" message. Don't hide the tab — users should know the category exists. If a tab is consistently empty (tracked over time), it can be hidden in a future iteration.

### Section Header

"VENUES" with MapPin icon, `var(--vibe)` accent. "Explore all →" links to `/${portalSlug}?view=find&type=destinations`.

### Tab Caching

Use `visited` set pattern (already in SeeShowsSection) — once a tab's data is fetched, cache it client-side for the session. Tab switches don't re-fetch.

## Components

### New: `VenueShowCard.tsx`
Programming venue card. Props: venue, shows[], totalCount, portalSlug, accentColor.

### New: `VenueExhibitionCard.tsx`
Exhibition venue card. Props: venue, exhibitions[], portalSlug, accentColor.

### Modified: `SeeShowsSection.tsx` → `VenuesSection.tsx`
- Rename file and component
- Expand from 3 tabs to 7
- Programming tabs render `VenueShowCard` grid
- Exhibition tabs render `VenueExhibitionCard` grid
- Film tab keeps `NowShowingSection` internally
- Tab caching via `visited` set

### Modified: `CityPulseShell.tsx`
- Replace SeeShowsSection import with VenuesSection

### Possibly new: Arts/Attractions data fetching
- Arts tab may need to query `exhibitions` table + events at arts venues
- Attractions tab needs events filtered by place_type (zoo, aquarium, etc.)
- May need a new API endpoint or extend shows API with `venue_types` param

## Verification

1. `npx tsc --noEmit` — clean build
2. All 7 tabs render with real data
3. Film tab preserves poster strips + showtime grouping
4. Programming tabs show venue cards with show times
5. Exhibition tabs show venue cards with exhibition dates
6. Empty tabs show message, not blank
7. Mobile 375px — single column, tabs scroll horizontally
8. Tab switching doesn't re-fetch (cached)
