# Festival Detail View Redesign

**Date:** 2026-03-29
**Status:** Approved design, pending implementation plan
**Expert reviews:** Architecture, Product Design, Data Quality — all incorporated below.

## Problem

The current `FestivalDetailView` was designed for multi-stage music festivals (stages, performers, headliners, day grids) but the actual data is:
- ~100 true festivals (after data cleanup removes ghosts/expos/series)
- 52 have **zero events** — the dominant case
- 39 have 1–33 events (mostly 1–5), with one outlier: **Atlanta Science Festival (107 programs, 100+ events, 15 days)**
- No festival except Atlanta Science Fest has more than 4 programs

Specific failures:
1. Music vocabulary ("1 Stage", "2 Performers", "sets", "HEADLINER") applied to food festivals, community festivals, film festivals
2. API filters out past events (`gte(start_date, today)`), leaving empty schedules for active/past festivals
3. Stat pills leak raw DB values ("major", "both", "mid" instead of proper labels)
4. `FestivalScheduleGrid` renders empty stage columns with "View full program" links to nothing
5. No temporal awareness — no indication whether a festival is upcoming, happening now, or ended
6. Two-column layout wastes space when content area has only a description + empty schedule
7. `FESTIVAL_TYPE_LABELS` missing 8 `primary_type` values — conferences show "Festival" badge

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Keep DetailShell sidebar | Consistency with Event/Series/Place detail views |
| Data density | Progressive disclosure | Sections appear only when data exists |
| Temporal state | Contextual shift | Banner + CTA + schedule adapt to upcoming/live/past |
| Past events | Show all, dim with "PAST" badge | Schedule is never empty; users can see what happened |
| Stat pills | Duration + price + indoor/outdoor only | Drop stage/performer counts and size_tier |
| Vocabulary | Neutral ("Schedule", "events") | No stages/performers/sets/headliners |
| Description | Render as-is | Bad descriptions are a crawler/data fix, not a frontend fix |
| Large festivals | Cap at 20 visible events + "See all" link | Atlanta Science Fest has 100+ — flat list breaks without a cap |

## Component: FestivalDetailView

Replaces `web/components/views/FestivalDetailView.tsx`. Same file, full rewrite.

### Sidebar Structure

Top to bottom, each section conditional:

1. **Hero image** — `SmartImage` if `image_url` exists, gradient fallback with `CalendarBlank` icon if not
2. **Type badge** — overlaid on hero bottom-left. Uses expanded `FESTIVAL_TYPE_LABELS` map (see Type Labels section).
3. **Temporal banner** — colored inline banner below hero, inside identity zone. See Temporal State section.
4. **Identity** — festival name (h1), date range, location + neighborhood
5. **Stat pills** — only: duration, price tier, indoor/outdoor. See Stat Pills section.
6. **Experience tags** — `ExperienceTagStrip` if `experience_tags` exists. Merged into pills area (remove separate "Experience" section header).
7. **CTAs** — "Get Passes" (primary) if `ticket_url` AND festival not ended. "Visit Website" (secondary) if `website`. If festival ended: website only, no ticket CTA. CTA color matches temporal state: `--coral` for upcoming/no-dates, `--gold` for happening. See Temporal State.
8. **Getting There** — only if single venue with transit data (MARTA, parking, BeltLine). Same as current.

### Content Structure

Top to bottom:

1. **About** — description with `LinkifyText`. Skipped if no description.
2. **Schedule** — event list with cap. See Schedule Section below.

That's it. No other content sections. The sidebar carries identity/metadata, the content carries description + schedule.

**Empty content area** (no description AND no events): Show centered hint with action — "Check the festival website for schedule updates" linked to `website` if available. If upcoming with `ticket_url`: "Schedule announced closer to the dates — passes available now" with link to ticket URL.

### Temporal State

Derived from `announced_start` and `announced_end` compared to today.

**Null `announced_end` handling:** If `announced_end` is null but `announced_start` exists, use "Happening now" for the active state — NOT "Last day." We can't assume it's single-day when the end date is simply missing. (Note: current data has 0 occurrences of this case, but the guard is important for future data.)

| State | Condition | Banner | CTA Color |
|-------|-----------|--------|-----------|
| **No dates** | `!announced_start` | None (date row shows "Dates TBD") | `--coral` |
| **Upcoming** | `announced_start > today` | Gold: "Starts in X days" | `--coral` |
| **Happening — first day** | `today == announced_start` | Green: "Starts today" | `--gold` |
| **Happening — mid** | `announced_start < today < announced_end` | Green: "Day X of Y — happening now" | `--gold` |
| **Happening — last day** | `today == announced_end` | Green: "Last day — ends tonight" | `--gold` |
| **Happening — no end date** | `today >= announced_start` AND `!announced_end` | Green: "Happening now" | `--gold` |
| **Ended** | `today > announced_end` | Muted: "Ended [date]" | Website only (no ticket CTA) |

Banner placement: inside the sidebar identity zone, between the hero image and the festival name. Small colored box with dot indicator + text.

Colors:
- Upcoming: `--gold` background tint, `--gold` text
- Happening: `--neon-green` background tint, `--neon-green` text
- Ended: `--twilight` background, `--muted` text
- No dates: no banner

**"Day X of Y" calculation:** Use `differenceInCalendarDays` from date-fns (not raw ms division) to avoid DST edge cases.

### Type Labels

Expand `FESTIVAL_TYPE_LABELS` to cover all `primary_type` values in the database:

```typescript
const FESTIVAL_TYPE_LABELS: Record<string, string> = {
  music_festival: "Music Festival",
  food_festival: "Food Festival",
  arts_festival: "Arts Festival",
  film_festival: "Film Festival",
  cultural_festival: "Cultural Festival",
  comedy_festival: "Comedy Festival",
  tech_festival: "Tech Festival",
  community_festival: "Community Festival",
  community: "Community Festival",
  beer_festival: "Beer Festival",
  wine_festival: "Wine Festival",
  // Added from data audit:
  conference: "Conference",
  tech_conference: "Conference",
  market: "Market",
  holiday_spectacle: "Holiday Event",
  performing_arts_festival: "Performing Arts",
  fair: "Fair",
  fashion_event: "Fashion Event",
  athletic_event: "Athletic Event",
  hobby_expo: "Expo",
  pop_culture_con: "Convention",
};
```

### Stat Pills

Only three possible pills, shown when data exists:

| Pill | Source | Display |
|------|--------|---------|
| Duration | Derived from `announced_start`/`announced_end` | "1 day", "3 days", "5 days" etc. |
| Price | `price_tier` | See mapping below |
| Indoor/Outdoor | `indoor_outdoor` | See mapping below |

**Dropped:** Stage count, performer/session count, `size_tier`.

**Price tier mapping** (all known DB values):
- `free` → "Free"
- `budget` → "$"
- `mid` → "$$"
- `moderate` → "$$"
- `premium` → "$$$"

**Indoor/outdoor mapping** (all known DB values):
- `indoor` → "Indoor"
- `outdoor` → "Outdoor"
- `both` → "Indoor + Outdoor"
- `mixed` → "Indoor + Outdoor"

### Schedule Section

Replaces `FestivalScheduleGrid`. Simple event list component.

**API change:** Remove `gte(start_date, today)` from the festival API route. Return ALL events for the festival regardless of date. Add `limit(200)` as a safety valve. The component handles past/future display.

**Layout rules:**
- **0 events**: Actionable empty state (see Content Structure above). No "Schedule" section header.
- **1–5 events (or single day)**: Flat chronological list. No day tabs.
- **6+ events spanning 2+ unique days**: Day tab selector above the list. Tabs show day name + date. Tabs scroll horizontally on mobile if many days.
- **20+ total events**: Show first 20, then a "See all N events →" link that navigates to Find view filtered by `festival_id`. This handles Atlanta Science Festival (100+ events) without rendering a wall of rows.

**Event row:** Simple clickable row with:
- Event title (cream, `text-sm font-medium`)
- Date + time + venue name (muted, `text-xs`)
- Caret right icon
- If `start_date < today`: dim to 70% opacity + "PAST" badge (mono, `text-2xs`, muted background)

**All-past schedule framing:** When ALL visible events are past, change the section header from "Schedule" to "Past Schedule". This contextualizes the dimmed content as a historical record, not a dead page.

**No stage columns.** No color-coded programs. No "HEADLINER" badge. No "View full program" link. Events are just events in a list.

**Day tab + cap interaction:** When day tabs are shown and total events exceed 20, show up to 20 events for the selected day. If a single day has 20+, show 20 with "See more from this day →".

### Mobile Behavior

- Sidebar stacks above content (DetailShell handles this)
- Temporal banner is visible immediately (no scroll needed)
- `DetailStickyBar` at bottom with "Get Passes" CTA if `ticket_url` AND festival not ended. CTA color matches temporal state.
- Day tabs scroll horizontally if many days

### Error / Loading States

- **Loading:** Same skeleton as current (works fine)
- **Error / not found:** Same error state as current (works fine)

## Files Changed

| File | Change |
|------|--------|
| `web/components/views/FestivalDetailView.tsx` | Full rewrite — new sidebar structure, temporal state, simplified pills, event list with cap |
| `web/components/detail/FestivalScheduleGrid.tsx` | Delete — replaced by inline event list in FestivalDetailView |
| `web/app/api/festivals/[slug]/route.ts` | Remove `gte(start_date, today)` filter. Add `limit(200)`. Return all events. |

## Files NOT Changed

- `DetailShell.tsx` — no layout changes
- `ExperienceTagStrip.tsx` — reused as-is (note: 9 common tags lack styled config — tracked separately)
- `DetailStickyBar.tsx` — reused as-is
- `SmartImage`, `LinkifyText`, `Skeleton` — reused as-is

## Out of Scope

- Festival description quality (crawler/data-layer fix — see `2026-03-29-festival-data-cleanup.md`)
- Festival data cleanup (separate migration — see `2026-03-29-festival-data-cleanup.md`)
- New sections (related festivals, nearby events, etc.) — not enough data to justify
- Mobile-specific redesign — DetailShell's responsive behavior is fine
- Full-page festival view (`/[portal]/festivals/[slug]/page.tsx`) — has its own date filter and vocabulary. Will diverge until aligned in a follow-up.
- API simplification (currently returns `programs[].sessions[]` structure the new client ignores — can flatten to `events[]` in follow-up)
- ExperienceTagStrip styled config for 9 common tags (`shopping`, `food_tasting`, `art_exhibits`, `workshops`, `kids_activities`, `cultural_heritage`, `speakers`, `cosplay`, `film_screenings`) — tracked separately as frontend polish

## Review Findings Tracker

Issues surfaced by expert review that affect other specs or workstreams:

| Issue | Owner | Spec |
|-------|-------|------|
| Shaky Knees slug wrong in cleanup spec (`shaky-knees` → `shaky-knees-festival`) | Migration | `2026-03-29-festival-data-cleanup.md` |
| `price_tier = 'mid'` should be normalized to `'moderate'` at crawler write time | Crawler | Crawler normalization |
| `indoor_outdoor = 'mixed'` should be rejected at ingestion (DB uses `'both'`) | Crawler | Crawler normalization |
| ExperienceTagStrip needs styled config for 9 additional tags | Frontend | Polish pass |
| Full-page festival view needs same temporal + vocabulary fixes | Frontend | Follow-up spec |
