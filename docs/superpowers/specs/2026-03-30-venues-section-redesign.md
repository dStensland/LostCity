# Venues Section Redesign

## Context

The feed's "See Shows" section frames discovery as content-first ("here's what's playing"). The better frame is venue-first ("here are places that put on shows — here's what's on"). Users think "I want to go to the Plaza" not "I want to see a film and I don't care where." The venue IS the decision; the programming is what makes you go tonight vs another night.

Replaces "See Shows" with "Venues" — same position in the feed, same data, venue-shaped.

## Design

### Section Structure

- **Header:** "VENUES" with compass icon, vibe accent color, "Explore all →" link
- **6 tabs:** Film · Music · Comedy · Theater · Arts · Attractions
- **Layout:** 2-column card grid on sm+, 1-column on mobile (matching Lineup and Regulars patterns)

### Tab → Data Mapping

| Tab | Place Types | Data Source | Categories Filter |
|-----|------------|-------------|-------------------|
| Film | cinema, theater (film events) | `/api/showtimes?mode=by-theater` | category=film |
| Music | music_venue, arena | `/api/portals/[slug]/shows?categories=music` | music |
| Comedy | comedy_club | `/api/portals/[slug]/shows?categories=comedy` | comedy |
| Theater | theater, amphitheater | `/api/portals/[slug]/shows?categories=theater,dance` | theater, dance |
| Arts | gallery, museum, arts_center | `/api/portals/[slug]/shows?categories=arts,education` | arts, exhibitions |
| Attractions | zoo, aquarium, attraction, theme_park | `/api/portals/[slug]/shows?categories=outdoors,family,recreation` | broad |

### Venue Card (new component: `VenueShowCard`)

Each card in the grid represents one venue with its current programming:

```
┌─────────────────────────────────┐
│ [48px icon/img]  Venue Name     │
│                  Neighborhood   │
│─────────────────────────────────│
│ Show Title 1           3:30pm  │
│ Show Title 2           7:00pm  │
│ +2 more today                  │
└─────────────────────────────────┘
```

- **Left:** 48px venue image (SmartImage) or category icon fallback on colored bg
- **Top line:** Venue name (text-sm font-semibold cream) + neighborhood (text-xs muted)
- **Show rows:** Up to 3 shows, each with title + time. Divider between header and shows.
- **Overflow:** "+N more today" in tab accent color, links to venue detail
- **Card background:** `bg-[var(--night)] border border-[var(--twilight)]/30 rounded-xl` (matching Lineup cards)

### Empty Tab State

When a tab has 0 venues with programming: "No [category] shows tonight — check back tomorrow" centered text. Don't hide the tab.

### Film Tab Special Handling

Film data comes from a different API (`/api/showtimes`) than the other tabs (`/api/portals/[slug]/shows`). The existing `NowShowingSection` already groups by theater. Rather than rebuilding film grouping, transform the showtimes API response into the same `VenueShowCard` format.

## Components

### New: `VenueShowCard.tsx`

Stateless card component. Props:
- `venue: { name, slug, neighborhood, image_url }`
- `shows: { title, start_time, id }[]` (max 3)
- `totalCount: number`
- `portalSlug: string`
- `accentColor: string`

### Modified: `SeeShowsSection.tsx` → `VenuesSection.tsx`

- Rename component and file
- Expand tabs from 3 (film/music/theater) to 6
- Each tab renders a grid of `VenueShowCard` instead of the old `PlaceGroupedShowsList` carousel
- Film tab transforms showtimes data; other tabs use shows API
- Each tab accent color matches its category

### Modified: `CityPulseShell.tsx`

- Replace `SeeShowsSection` import with `VenuesSection`
- Update data attributes and comments

## Data Flow

1. Section mounts → first tab (Film) loads via `/api/showtimes`
2. User clicks tab → lazy-load that tab's data from `/api/portals/[slug]/shows`
3. Transform API response into `VenueShowCard[]` format
4. Render as 2-col grid
5. Each card links to `/[portal]/spots/[venue-slug]`

## Verification

1. `npx tsc --noEmit` — clean build
2. Browser test all 6 tabs — each shows venue cards with real data
3. Empty tabs show "no shows" message, not blank space
4. Mobile 375px — single column, no overflow
5. Click a venue card → navigates to venue detail with upcoming events
6. Film tab data matches old NowShowingSection content
