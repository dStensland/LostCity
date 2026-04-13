# On the Horizon — Timeline Redesign

**Date:** 2026-04-13
**Status:** Design approved, pending implementation

## Problem

The "On the Horizon" feed section currently renders as a flat horizontal carousel with month-filter pills. Every event gets the same 310px card regardless of whether it's a FIFA World Cup match or a Chastain Park concert. The layout doesn't create visual hierarchy, doesn't tell a temporal story, and doesn't serve the planning use case well for either hotel guests (30-90 days out) or locals (next few weeks).

Data issues compound the problem: 5/10 flagship events lack venue links, 3 have LLM stub descriptions, dedup gaps produce 4x records for the same festival, and 157 arena shows are under-flagged.

## Design

### Layout: Stacked Time Buckets

Replace the carousel + month pills with vertically stacked **time buckets**. Each bucket represents a month and contains a **headliner card** (the biggest event) and **supporting event rows** (everything else).

The section scrolls vertically as part of the feed. No internal scroll containers.

### Time Boundaries

- **Start:** 4 weeks from today (avoids overlap with Lineup section's "Coming Up" tab, which owns 0-28 days)
- **End:** 180 days (existing `horizonEnd` boundary)
- **Tapering rule:** All `major`+ events within 3 months. Beyond 3 months, only `flagship` and `is_tentpole` events appear.
- **Empty buckets are suppressed.** If a month has zero qualifying events after tapering, it does not render.

### Bucket Structure

Each bucket contains:

| Element | Description |
|---------|-------------|
| **Bucket header** | Month name + relative time label + event count. E.g., "May - 6 weeks away (4)" |
| **Headliner card** | Full-width, ~200px image zone, gradient overlay, category badge, urgency pill, description, venue + neighborhood, price, ticket CTA |
| **Supporting rows** | Compact horizontal rows: date, title, venue/neighborhood, category dot, price. Max 3 visible, with "N more in [Month]" disclosure link |

**Small bucket rule:** Buckets with 1-2 events skip the headliner/supporting split. Events render as standard cards (not headliner-sized).

### Height Management

- **Render first 3 buckets by default.** Additional buckets hidden behind a "See N more months" expansion.
- **Supporting rows capped at 3** per bucket with disclosure link for overflow.
- This keeps the section to roughly 800-1000px on initial render — manageable within the feed.

### Visual Grouping

Each bucket is visually contained to make the headliner-to-supporting-rows relationship clear. Options (choose during implementation):
- Subtle `--twilight`-tinted background on bucket container with `rounded-card`
- Gold left rail (`border-l-2 border-[var(--gold)]/30`) on the bucket
- 8px indent on supporting rows beneath headliner

Without visual grouping, the section reads as alternating big cards and list rows — the hierarchy collapses.

### Headliner Selection Algorithm

Server-side, per bucket:

1. Filter out `sold_out` and `cancelled` events from headliner candidacy
2. Highest `importance` tier (`flagship` > `major` > `standard`)
3. Prefer: has `featured_blurb` > has `description` (length >= 20) > has `image_url`
4. Tiebreak: earliest `start_date` within the bucket

If no event qualifies as headliner (all sold out, or bucket has <= 2 events), skip the headliner/supporting split.

### Bucket Header

Format: **"May - 6 weeks away"** with event count badge.

- Month name: `font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]` (matches existing `FeedSectionHeader` pattern)
- Relative time: computed via existing `getContextualTimeLabel` utility or simple week-distance calculation
- Count badge: muted, secondary

### Headliner Card

Full-width card, similar treatment to existing `HeroCard`:

- **Image zone:** ~200px height, `bg-gradient-to-t from-[var(--night)]` overlay (neutral, per cinematic minimalism)
- **Category badge:** Top-left, colored per category
- **Urgency pill:** Bottom-left if applicable (selling fast, early bird ending, etc.)
- **Content zone:** Date (gold mono), title (2-line clamp, `text-lg font-semibold`), description from `featured_blurb` (2-line clamp), venue + neighborhood + price row
- **Ticket CTA:** Context-aware button (coral "Get Tickets" for paid, green "Get Details" for free, muted if stale)

### Supporting Rows

Compact single-line rows using existing `StandardRow` pattern or similar:

- Category color dot (left)
- Date: short format ("Sat, May 17")
- Title: single-line truncate
- Venue name + neighborhood
- Price (green for free, mono for paid)
- Tappable to event detail page

## Architecture

### Server-Side Bucketing

All bucketing, headliner selection, and tapering happens in `buildPlanningHorizonSection`. The client is a pure renderer.

**Return shape:**

```typescript
interface HorizonBucket {
  key: string;              // "2026-05" or "2026-06"
  label: string;            // "May"
  relativeLabel: string;    // "6 weeks away"
  headliner: CityPulseEventItem | null;
  supporting: CityPulseEventItem[];
  totalCount: number;       // total events in this month (for "N more" disclosure)
}
```

Section meta changes from `{ month_counts }` to `{ buckets: HorizonBucket[] }`.

The section type remains `"planning_horizon"`. Layout can remain `"list"` — the bucket sub-structure is encoded in meta, not in the layout type.

### Query Changes

The existing fetch query (`fetch-events.ts:581-601`) is mostly fine. Adjustments:

- Start boundary moves from 7 days to 28 days (`ctx.horizonStart`)
- The tapering rule is applied in the section builder, not the query (the query still fetches the full 180-day pool; the builder filters by importance at the 3-month boundary)

### Cross-Section Dedup

The Lineup section owns 0-28 days. Horizon starts at 28+ days. This temporal separation eliminates overlap without requiring a shared `usedEventIds` set between builders.

### Caching

No changes to caching strategy. The 5-minute anon / 1-minute auth TTL works for this section since bucket composition changes slowly (daily, not hourly).

## Data Prerequisites (P0)

These must land before or alongside the UI work. Without them, headliner cards will showcase bad data at large visual scale.

### 1. Stub Description Rejection

**Where:** Crawler pipeline (`extract.py` / `db.py`)
**What:** Reject descriptions matching the pattern `"[Name] is a local event"` or `"is a [type] event. Location:"` at ingestion. Set `description = NULL` rather than storing the stub.
**Why:** Three flagship events (MomoCon, Peachtree Road Race, FIFA knockout rounds) currently have these stubs. A headliner card amplifies bad descriptions.

### 2. Venue Linking for Flagships

**Where:** Individual source crawlers for MomoCon, Breakaway, Atlanta Jazz Fest, FIFA Fan Festival, Inman Park Festival, NASCAR
**What:** Call `get_or_create_place()` with the actual venue (Georgia World Congress Center, Piedmont Park, Atlanta Motor Speedway, etc.)
**Why:** 5/10 flagships have no `place_id`. Headliner cards show venue + neighborhood — missing venue data is conspicuous at this visual scale.

### 3. Dedup Tightening

**Where:** `dedupe.py`
**What:** Add token-set similarity check for events at the same venue on the same date. Titles matching at 85%+ similarity (after stripping year suffixes) are merge candidates.
**Why:** SweetWater 420 Fest has 4 active records. Virginia-Highland Summerfest has 5. These would appear as duplicate headliner candidates or duplicate supporting rows.

### 4. Category Corrections

**Where:** Source crawlers or one-time migration
**What:** Fix misassigned categories: Inman Park Festival -> `festivals`, Juneteenth -> `community`, MomoCon -> `conventions`
**Why:** Category badges on headliner cards will display the wrong label.

## Data Improvements (P1)

These improve the section but don't block shipping:

- **Importance elevation for arena shows:** Apply `major` to events at State Farm Arena, Ameris Bank, Chastain, Mercedes-Benz Stadium, Gas South at crawler level. 157 shows are currently under-flagged.
- **Pro sports policy:** Decide whether regular-season Braves/Hawks/United games should be `major`. If yes, apply in source crawlers.
- **Price coverage:** Chastain Park crawler needs price extraction. Currently 52% price coverage in the horizon pool.

## Out of Scope

- **Editorial curation / pin-boost mechanism** — algorithmic selection only for now. Portal-level overrides are a future enhancement.
- **Social proof layer** (friends attending, trending indicators) — good v2 enhancement, connects to existing Hangs infrastructure.
- **Personalization** — per feed philosophy, this is an access layer. No interest-based filtering.
- **Cross-portal federation weighting** — distribution portals could weight headliners toward accommodation-driving events. Future state.

## Component Changes

| File | Change |
|------|--------|
| `web/lib/city-pulse/section-builders.ts` | Rewrite `buildPlanningHorizonSection` to produce `meta.buckets` array with headliner selection, tapering, and bucket caps |
| `web/lib/city-pulse/types.ts` | Add `HorizonBucket` interface |
| `web/lib/city-pulse/pipeline/fetch-events.ts` | Adjust `horizonStart` from 7 days to 28 days |
| `web/lib/city-pulse/pipeline/resolve-portal.ts` | Update `horizonStart` constant |
| `web/components/feed/sections/PlanningHorizonSection.tsx` | Rewrite: vertical bucket layout with progressive disclosure, replaces carousel + month pills |
| `web/components/feed/PlanningHorizonCard.tsx` | Evolve into headliner card variant (wider, taller image, description visible) |
| New: `web/components/feed/HorizonBucket.tsx` | Bucket container: header + headliner + supporting rows + disclosure |
| New: `web/components/feed/HorizonSupportingRow.tsx` | Compact row component for non-headliner events (or reuse `StandardRow` if it fits) |

## Success Criteria

- Section renders 3 buckets on initial load, expandable to more
- Each bucket has a visually distinct headliner (when 3+ events)
- No duplicate events visible (dedup working)
- All headliner events have real descriptions and venue links
- Section height stays under 1000px on initial render (mobile)
- Temporal separation from Lineup is clean (no overlapping events)
- A hotel prospect looking at the feed can immediately identify what's coming to Atlanta this season without touching any filters
