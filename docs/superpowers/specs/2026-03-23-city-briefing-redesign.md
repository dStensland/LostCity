# City Briefing Zone Redesign

**Date**: 2026-03-23
**Status**: Review
**Goal**: Redesign the top of the Atlanta feed as a unified "city briefing" zone that sets the table for the day — weather, signals, news headlines, flagship events — making this the first thing people check when they start their day.

## Context

The current CityBriefing hero shows a generic Atlanta skyline with "MONDAY MORNING" and a weather haiku. It gives zero reason to come back daily. The news module was extracted to a standalone section below The Lineup, but the user wants it moved back near the top as table-setting context — not the main event, but part of the briefing.

The flagship event binding we just built works. The signal strip and condensed news digest are new additions.

## Design Principle

**Table setting, not the meal.** The briefing zone sets context for the decisions you'll make when you reach The Lineup. Weather tells you outdoor vs indoor. Pollen tells you to stay inside. A flagship event tells you the city has something big happening. News tells you what Atlanta is talking about. Then The Lineup is where you choose what to do.

**One sentence that's only true today.** The briefing must contain information the user couldn't have known without opening the app. This is the daily variable reward that creates habit.

## Two States

### State 1: Flagship Event Day

When a tentpole/festival with an image is happening today (already computed via `header.flagship_event`):

- **Hero image**: The flagship event's image (SmartImage, ~340px height)
- **Gradient overlay**: Bottom 70%, from void to transparent
- **Signal strip** (overlaid on image, above headline): ambient context pills
- **Gold label**: "HAPPENING TODAY" (mono, 2xs, uppercase, tracking, gold)
- **Event title**: heading/xl (22px), font-semibold, cream
- **Event metadata**: venue + time + price + urgency ("Last Day" in neon-green if applicable)
- **Action pills**: "SEE LINEUP" (gold bg, void text) + "MAP IT" (ghost border)
- **News digest** (below hero image): 3 culture/arts/food headlines, compact
- **Boundary**: "THE LINEUP ↓" divider marking the transition to action content

Total height: ~460px (340px hero + 120px news digest)

### State 2: Normal Day

When no flagship event exists:

- **Hero image**: Vibrant Atlanta city photo (from the existing image set)
- **Gradient overlay**: Same bottom 70% treatment
- **Signal strip**: Same ambient pills
- **Headline**: "[Day] in Atlanta" (heading/lg, 20px, cream)
- **Summary line**: "47 events tonight · 12 live music · Perfect patio weather" (body/sm, soft) — assembled from real counts + weather context
- **Quick links**: Time-of-day contextual pills (Tonight, Free, Live Music, Date Night) — same as current but responsive to time slot
- **News digest**: Same 3 headlines below
- **Boundary**: "THE LINEUP ↓" divider

Total height: ~400px (280px hero + 120px news digest)

## Signal Strip

Thin horizontal row of ambient context pills overlaid on the hero image. Shows only what's notable — not every data point every day.

### Always present
- **Weather**: Temperature + condition + icon. `"☀ 71° Partly Cloudy"`. Taps to outdoor/indoor event filter.
- **Sunset time**: `"Sunset 7:41"`. Only shown in afternoon/evening time slots. Taps to golden hour outdoor events.

### Conditional (only when notable)
- **Pollen**: Only at code orange or higher. `"⚠ Pollen: Very High"` in coral/alert styling. Taps to indoor events filter.
- **Moon phase**: Only on notable phases (full moon, new moon). `"● Full Moon"`. Taps to outdoor evening events.
- **Sports game**: When a tentpole sports event is today. `"Braves vs Mets · 7:20"` in gold. Taps to the event detail.
- **Holiday/occasion**: When a known holiday is today. `"🎄 Juneteenth · 14 celebrations"` in vibe color. Taps to holiday-filtered events.
- **Rain**: When rain is forecasted. `"🌧 Rain until 4pm"` in cyan. Accompanied by `"Indoor picks below ↓"`.

### Visual treatment
- Each pill: `font-mono text-2xs`, `bg-white/15 backdrop-blur-sm`, `rounded-md`, `padding [3px, 8px]`
- Notable conditions (pollen, rain) use their accent color background at 15% opacity
- Strip wraps on mobile, scrolls if too many pills

### Data sources
- **Weather**: Already in `FeedContext` from the CityPulse API (`context.weather`)
- **Sunset**: Astronomical calculation from latitude (Atlanta: 33.749°N) + date. Pure function, no API needed. Libraries like `suncalc` or a simple formula.
- **Moon phase**: Same astronomical calculation. `suncalc` provides this. Pure function.
- **Pollen**: New data source needed. Options: (a) EPA AirNow API for air quality as proxy, (b) Atlanta Allergy & Asthma pollen count page scrape, (c) defer to v2. **Recommend deferring pollen to v2** — it requires a new external API integration. Show the pill slot but don't populate until the data source exists.
- **Sports**: Add `sports_tentpole` field to `ResolvedHeader` (parallel to `flagship_event`). Resolve in `header-resolver.ts` by querying today's events where `is_tentpole = true AND category_id = 'sports'`. Shape: `{ title: string; start_time: string; venue_name?: string; href: string } | null`.
- **Holiday**: Already in `FeedContext.active_holidays`.
- **Sunset/moon**: Install `suncalc` npm package. Pure calculations from date + Atlanta latitude (33.749°N, -84.388°W). No API needed.

## News Digest

3 culture/arts/food headlines condensed into the briefing zone, below the hero image.

### Content
- Fetched from the same `/api/portals/[slug]/network-feed` endpoint
- Default filter: culture, arts, food (same as the extracted TodayInAtlantaSection)
- Show exactly 3 headlines. If fewer than 3 match the culture filter, backfill from "community" category.
- No category tabs at this level — just headlines + "All news →" link

### Visual treatment
- Section label: "TODAY IN ATLANTA" (mono, 2xs, uppercase, muted)
- "All news →" link on right (mono, 2xs, muted)
- Each headline row: title (text-xs, font-medium, cream) + source + category (text-2xs, muted)
- Compact: ~40px per row, ~120px total for 3 rows
- Bottom border separates from The Lineup below

### "All news →" behavior
Links to the full TodayInAtlantaSection (which still exists as a standalone component with category tabs). Could be an in-page scroll anchor or a separate view.

## Summary Line (Normal Day)

Template-driven, assembled from real data:

```
"[N] events tonight · [N] live music · [weather_context]"
```

Weather context options:
- "Perfect patio weather" (clear, 65-85°F)
- "Bundle up tonight" (below 45°F)
- "Rain clears by evening" (rain forecasted to stop)
- "Indoor day" (active rain)
- "Beautiful evening ahead" (clear, 55-75°F, evening)

Uses existing `context.weather` data. Template matching similar to editorial templates.

## Implementation Changes

### Modified components
- **CityBriefing.tsx** — Major rework. The hero zone becomes the unified briefing zone. Signal strip + news digest integrated into the component. The atmospheric/flagship split logic already exists from the hero binding work. **New props needed**: `tabCounts` and `categoryCounts` (passed from CityPulseShell) for the SummaryLine event counts ("47 events tonight · 12 live music").

### New components
- **SignalStrip.tsx** — Horizontal row of ambient context pills. Accepts weather, moon, sunset, sports, holiday data. Renders only notable conditions.
- **NewsDigest.tsx** — Compact 3-headline news component. Self-fetching from network-feed API. Returns null if no headlines.
- **SummaryLine.tsx** — Template-driven summary for normal days ("47 events tonight · 12 live music · Perfect patio weather").

### New utilities
- **sun-moon.ts** — Pure functions for sunset time and moon phase calculation from date + latitude. No external API needed. Use `suncalc` npm package or inline the math (it's ~50 lines for both calculations).

### Removed/moved components
- **TodayInAtlantaSection.tsx** — Still exists as the full news section with category tabs, but is no longer rendered in CityPulseShell. The briefing zone's NewsDigest replaces it at the top level. The "All news →" link navigates to a dedicated news view or scrolls to a collapsed TodayInAtlanta section further down.

### Feed section order update

```
1. CityBriefing (unified briefing zone: hero + signals + news digest)
2. The Lineup (tiered)
3. Worth Checking Out (destinations)
4. Regular Hangs
5. See Shows (Film/Music/Stage)
6. Around the City (portal teasers)
7. On the Horizon (quality-gated)
8. Browse
```

TodayInAtlantaSection is absorbed into CityBriefing as the compact NewsDigest. The full TodayInAtlantaSection (with category tabs) is no longer rendered in CityPulseShell. The "All news →" link navigates to `/${portalSlug}/network` (the network feed page, route already exists).

### Boundary divider
The "THE LINEUP ↓" divider between briefing zone and Lineup: centered text, `font-mono text-2xs uppercase tracking-[1.2px] text-[var(--muted)]`, with a subtle `border-top: 1px solid var(--twilight)` above and `padding-top: 16px`. Simple, clear, consistent with the section header pattern.

## What's Deferred

- **Pollen data**: Requires external API integration (EPA AirNow or scraping). Show the pill architecture but don't populate until the data source is built.
- **"This day in Atlanta history"**: Requires manual curation. No data infrastructure exists.
- **Traffic/commute**: Waze territory. Not pursuing.
- **Air quality**: Secondary to pollen. Same external API dependency.

## Success Criteria

1. The briefing headline changes every day — it's never "MONDAY MORNING" twice in a row.
2. The signal strip shows at least 2 pills (weather + sunset are always present in the right time slots).
3. On a day with a flagship event, the event IS the hero — the user immediately knows what's happening.
4. The news digest shows 3 culture-positive headlines — no crime by default.
5. The transition from briefing → Lineup is clean. "THE LINEUP ↓" boundary is visually clear.
6. Total briefing zone is under 500px on mobile — doesn't push The Lineup too far down.

## Risks

- **Briefing too tall**: If signal strip + headline + news exceeds ~500px, users have to scroll before seeing any events. The briefing must feel like a glance, not a read. Cap the news at 3 headlines, no expanding.
- **Signal strip data staleness**: Weather and moon are real-time calculations, but pollen/sports depend on data freshness. Weather is already in the feed context (refreshes every request). Moon/sunset are pure calculations. Sports events are in the event pool.
- **News fetch failure**: If network-feed API fails, the news digest returns null and the briefing zone is just hero + signals. Graceful degradation.
- **"Same every day" trap**: If no flagship event exists and weather is the same as yesterday, the briefing feels static. The summary line counts ("47 events tonight") and the news headlines provide daily variation. But if the editorial headline is always "[Day] in Atlanta", that's stale. Consider rotating the city photo and varying the headline template.
