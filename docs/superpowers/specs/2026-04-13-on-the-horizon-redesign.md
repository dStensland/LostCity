# On the Horizon — Timeline Redesign

**Date:** 2026-04-13
**Status:** Design approved, pending implementation

## Problem

The "On the Horizon" feed section currently renders as a flat horizontal carousel with month-filter pills. Every event gets the same 310px card regardless of whether it's a FIFA World Cup match or a Chastain Park concert. The layout doesn't create visual hierarchy, doesn't tell a temporal story, and doesn't serve the planning use case well for either hotel guests (30-90 days out) or locals (next few weeks).

Data issues compound the problem: 5/10 flagship events lack venue links, 3 have LLM stub descriptions, dedup gaps produce 4x records for the same festival, and 157 arena shows are under-flagged.

## Design

### Layout: Stacked Time Buckets

Replace the carousel + month pills with vertically stacked **time buckets**. Each bucket represents a month and contains a **headliner card** (the biggest event) and **supporting event rows** (everything else).

The section scrolls vertically as part of the feed. No internal scroll containers. No horizontal scroll anywhere in the section.

### Time Boundaries

- **Start:** 4 weeks from today (avoids overlap with Lineup section's "Coming Up" tab, which owns 0-28 days)
- **End:** 180 days (existing `horizonEnd` boundary)
- **Tapering rule:** All `major`+ events within 3 months. Beyond 3 months, only `flagship` and `is_tentpole` events appear.
- **Empty buckets are suppressed.** If a month has zero qualifying events after tapering, it does not render.

### Bucket Structure

Each bucket contains:

| Element | Description |
|---------|-------------|
| **Bucket header** | Month name + relative time label + event count badge |
| **Headliner card** | Full-width, ~200px image zone (140px on mobile), gradient overlay, category badge, urgency pill, description, venue + neighborhood, price, ticket CTA |
| **Supporting rows** | Compact no-thumbnail rows: category dot, date, title, venue/neighborhood, price. Max 3 visible, with inline expansion for overflow |

**Small bucket rule:** Buckets with 1-2 events skip the headliner/supporting split. Events render as `StandardRow` components with bucket header still visible. Threshold: 1 event = single StandardRow, 2 events = two StandardRows, 3+ events = headliner + supporting rows (no disclosure needed until 4+).

### Height Management

- **Render first 3 buckets by default.** Additional buckets hidden behind a "See N more months" expansion button.
- **Expansion button:** Centered below the third bucket, full-width pill button (`bg-[var(--twilight)]/30 border border-[var(--twilight)] text-[var(--soft)] font-mono text-xs`), 44px min height. Reveals all remaining buckets at once. No collapse affordance.
- **Supporting rows capped at 3** per bucket. Overflow shows inline "N more in [Month]" expansion link that reveals remaining rows in-place (no navigation). Uses client-side `useState` per bucket.
- This keeps the section to roughly 800-1000px on initial render.

### Visual Grouping

Each bucket uses a **gold left rail** to bind the headliner and supporting rows into a visually cohesive unit:
- `border-l-2 border-[var(--gold)]/30` on the bucket container
- 16px padding-left on supporting rows to align with the rail's implied indent
- This is the lightest-touch option, consistent with cinematic minimalism and existing `StandardRow` left-border patterns

Without visual grouping, the section reads as alternating big cards and list rows — the hierarchy collapses.

### Headliner Selection Algorithm

Server-side, per bucket:

1. Filter out `sold_out` and `cancelled` events from headliner candidacy
2. Highest `importance` tier (`flagship` > `major` > `standard`)
3. Prefer: has `featured_blurb` > has `description` (length >= 20) > has `image_url`
4. Tiebreak: earliest `start_date` within the bucket

If no event qualifies as headliner (all sold out, or bucket has <= 2 events), skip the headliner/supporting split.

### Bucket Header

Format: **"MAY · 6 weeks away"** with count badge.

- Month name: `font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]`
- Separator: `·` (middle dot)
- Relative time: `text-[var(--muted)]` — computed via week-distance calculation from bucket's first event
- Event count: `CountBadge` component (existing design system component), muted treatment
- Bucket headers are visually subordinate to the section-level "On the Horizon" header

### Headliner Card

New `HorizonHeadlinerCard` component (does NOT reuse `PlanningHorizonCard`). Similar treatment to existing `HeroCard`:

- **Image zone:** ~200px height desktop, ~140px mobile. `bg-gradient-to-t from-[var(--night)]` overlay (neutral gradient only, per cinematic minimalism).
- **No-image fallback:** Category-tinted gradient (`dusk` -> `night`) + centered `CategoryIcon` at 20% opacity. Inherits pattern from `HeroCard`.
- **Category badge:** Top-left, colored per category
- **Urgency pill:** Bottom-left if applicable. Driven by existing `getPlanningUrgency()` from `web/lib/types/planning-horizon.ts`. Signals: `just_on_sale`, `selling_fast`, `early_bird_ending`, `registration_closing`, `sold_out`, `cancelled`.
- **Content zone:** Date (gold mono), title (2-line clamp, `text-lg font-semibold`), description from `featured_blurb` (2-line clamp), venue + neighborhood + price row
- **Ticket CTA:** Three states:
  - Paid event with `ticket_url`: coral "Get Tickets" button
  - Free event OR no price data: green "Get Details" button
  - No `ticket_url` and not free: no CTA rendered

### Supporting Rows

New `HorizonSupportingRow` component. **Do not reuse `StandardRow`** — its 64px thumbnail would visually compete with the headliner image above.

- 10px category color dot (left-aligned)
- Date: gold mono, short format ("Sat, May 17")
- Title: single-line truncate
- Venue name · neighborhood (muted)
- Price badge (right-aligned): green for free, mono for paid
- Min height: 44px (touch target)
- Left-edge alignment matches headliner card's content padding
- Tappable to event detail page
- **Sold-out events in supporting rows:** 50% opacity reduction + "Sold Out" badge replacing price

### Responsive Behavior

- **Headliner image zone:** 200px desktop, 140px mobile (breakpoint: `sm`)
- **Supporting row cap:** 3 on all breakpoints
- **Touch targets:** 44px minimum on all interactive elements (supporting rows, expansion buttons, ticket CTA)
- **Gold left rail:** Renders at all breakpoints (2px width is fine at 375px)
- **No horizontal scroll** anywhere in the section

### Animation

Inherit existing feed page-enter stagger. Cap stagger indices at the first bucket's contents — subsequent buckets render without stagger delay to avoid the section taking too long to populate.

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
  totalCount: number;       // total events in this month (before cap)
  overflowCount: number;    // events hidden behind "N more" disclosure
  isSmallBucket: boolean;   // true when totalCount <= 2 (skip headliner split)
}
```

Section meta changes from `{ month_counts }` to `{ buckets: HorizonBucket[] }`.

The `items` array is populated with the flattened list of all bucket events (headliners + supporting) for backward compatibility with generic section consumers. The client component ignores `items` and reads `meta.buckets` instead.

The section type remains `"planning_horizon"`. Layout can remain `"list"`.

**Safety rail:** The builder must apply its own `start_date >= 28 days from now` filter since it may receive events from multiple pools (not just the horizon pool).

**Event data completeness:** `CityPulseEventItem` events in buckets must carry `featured_blurb`, `description`, `urgency`, `ticket_freshness`, venue with `neighborhood`, and price fields. The existing builder already enriches urgency/freshness at build time. Verify `featured_blurb` and `description` travel through `FeedEventData` and aren't dropped by `makeEventItem`.

### Query Changes

The only query change is in `resolve-portal.ts` (~line 191): change `addDays(effectiveNow, 7)` to `addDays(effectiveNow, 28)` for `horizonStart`. Downstream consumers in `fetch-events.ts` and `fetch-feed-ready.ts` already read `ctx.horizonStart` — they don't need code changes.

Also remove the builder's own 7-day start boundary computation (~line 1076-1077 of section-builders.ts) so it uses the pool as-is (already filtered by the query boundary), plus the safety rail filter above.

### Cross-Section Dedup

The Lineup section owns 0-28 days. Horizon starts at 28+ days. This temporal separation eliminates overlap without requiring a shared `usedEventIds` set between builders.

### Deployment

Server and client changes must ship in the same deployment. The `meta` shape change (from `month_counts` to `buckets`) is breaking — the old client cannot render new meta. Vercel atomic deploys handle this, but do not attempt a phased rollout.

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

### 3. Importance Elevation for Arena Shows

**Where:** Crawler pipeline — venue-based heuristic
**What:** Apply `importance = 'major'` to events at State Farm Arena, Ameris Bank Amphitheatre, Chastain Park Amphitheatre, Mercedes-Benz Stadium, Gas South Arena at crawler level.
**Why:** 157 arena shows are tagged `standard`. The headliner selection algorithm ranks on importance tier — without this fix, weaker events at `major` beat legitimate arena headliners for the headliner slot. This is a correctness issue for the redesign.

### 4. Category Corrections

**Where:** Source crawlers or one-time migration
**What:** Fix misassigned categories: Inman Park Festival -> `festivals`, Juneteenth -> `community`, MomoCon -> `conventions`
**Why:** Category badges on headliner cards will display the wrong label.

## Data Improvements (P1)

These improve the section but don't block shipping:

- **Dedup tightening:** Add token-set similarity check in `dedupe.py` for same-venue, same-date events. Titles at 85%+ similarity are merge candidates. The UI mitigates this (headliner selection picks one per bucket), but supporting rows may still show dupes.
- **Pro sports policy:** Decide whether regular-season Braves/Hawks/United games should be `major`. If yes, apply in source crawlers.
- **Price coverage:** Chastain Park crawler needs price extraction. Currently 52% price coverage in the horizon pool.

## Out of Scope

- **Editorial curation / pin-boost mechanism** — algorithmic selection only for now. Portal-level overrides are a future enhancement.
- **Social proof layer** (friends attending, trending indicators) — first v2 enhancement after launch. Connects to existing Hangs infrastructure. High leverage on headliner cards for planning-horizon events.
- **Personalization** — per feed philosophy, this is an access layer. No interest-based filtering.
- **Cross-portal federation weighting** — distribution portals could weight headliners toward accommodation-driving events. Future state.

## Component Changes

| File | Change |
|------|--------|
| `web/lib/city-pulse/section-builders.ts` | Rewrite `buildPlanningHorizonSection` to produce `meta.buckets` array with headliner selection, tapering, and bucket caps |
| `web/lib/city-pulse/types.ts` | Add `HorizonBucket` interface |
| `web/lib/types/planning-horizon.ts` | Review: ensure `featured_blurb`, `description` fields are formalized on event type |
| `web/lib/city-pulse/pipeline/resolve-portal.ts` | Update `horizonStart` from 7 days to 28 days (~line 191) |
| `web/components/feed/sections/PlanningHorizonSection.tsx` | Rewrite: vertical bucket layout with progressive disclosure, replaces carousel + month pills |
| `web/components/feed/CityPulseShell.tsx` | Adjust wrapper spacing/divider for taller section |
| New: `web/components/feed/HorizonHeadlinerCard.tsx` | Full-width headliner card with image zone, description, ticket CTA |
| New: `web/components/feed/HorizonBucket.tsx` | Bucket container: header + headliner + supporting rows + disclosure |
| New: `web/components/feed/HorizonSupportingRow.tsx` | Compact no-thumbnail row for non-headliner events |
| Delete: `web/components/feed/PlanningHorizonCard.tsx` | Replaced by `HorizonHeadlinerCard` — extract reusable sub-components (UrgencyPill, formatEventDate, formatPrice) first if not already shared |

## Success Criteria

**Functional:**
- Section renders 3 buckets on initial load, expandable to more
- Each bucket has a visually distinct headliner (when 3+ events)
- No duplicate events visible (dedup working)
- Temporal separation from Lineup is clean (no overlapping events)
- Section height stays under 1000px on initial render (mobile)

**Data quality gate:**
- Zero headliner cards with stub descriptions at ship time
- Zero headliner cards with missing venue links at ship time
- All headliner events have correct category assignments

**Business:**
- A first-time viewer of the FORTH portal feed can identify three upcoming Atlanta events within 10 seconds of reaching the section, without filters or interaction
- The section requires no walkthrough to demonstrate to a hotel prospect
