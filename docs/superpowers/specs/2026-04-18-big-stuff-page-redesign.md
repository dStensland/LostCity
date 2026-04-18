# Big Stuff See-All Page Redesign

**Spec date:** 2026-04-18
**Route:** `/[portal]/festivals` (user-facing path unchanged)
**File:** `web/app/[portal]/festivals/page.tsx`
**Follow-on to:** PR #58 (feed month-ribbon)

## Problem

The see-all page (the destination of the feed ribbon's "See all →" link) is a 3-column grid of 4:5 poster cards with countdown badges. It competes with the feed ribbon for the same job (marking upcoming events) while doing it less well:

- No calendar/time axis — a grid of cards reads as "random recommendations," not "what's coming."
- Every card is the same size regardless of editorial weight; flagship festivals and fringe cons have identical visual footprint.
- No type differentiation — a convention, a marathon, and a music festival are visually indistinguishable.
- Countdown badges ("In 3 weeks") double up on the feed ribbon's job and add clutter at this depth.
- Happening-now events render in a separate block that duplicates organization logic.

Users arriving from the feed ribbon expect the same temporal spine (months as anchors) but with richer per-event treatment than the ribbon's typography-only summary.

## Goal

A calendar-spined browse page that:
1. Reuses the feed ribbon's month-axis metaphor at a larger scale (nav + full-month sections instead of one-line summaries).
2. Gives every event a proper hero or compact row treatment, with tiering so flagships feel flagship-sized.
3. Adds light type tagging so a user can triage festivals vs conventions vs sports events at a glance.
4. Folds happening-now events into the timeline rather than a separate block.

## Non-goals

- Personalization / recommendation logic. This is a browse surface, not a rec engine (per feed philosophy).
- Multi-select filtering or URL-state filter persistence. Shareable filter links aren't a common-enough flow to justify the state complexity.
- A new entity type. All events rendered already exist in `festivals` and `events` (is_tentpole).
- Replacing `/api/festivals/upcoming`. That route remains to serve `useFestivalsList` on other surfaces.

## Architecture

### Data flow

```
page.tsx (RSC)
  ├─ loadBigStuffForPage(ctx) → BigStuffPageData | null
  │     ├─ fetchBigStuffForPage(portalId, portalSlug) ─ Supabase query
  │     │     ├─ festivals table (announced_2026=true, 6mo horizon, ALL festival_types)
  │     │     └─ events table (is_tentpole, 6mo horizon, also includes in-progress within current month)
  │     └─ return BigStuffPageItem[]
  ├─ groupItemsByMonth(items, today, 6) → BigStuffMonthBucket[]  ← reused from big-stuff-shared.ts
  └─ <BigStuffPage> (client island)
        ├─ <BigStuffPageHeader> (title, description, filter chips)
        ├─ <BigStuffRibbon> (full + collapsed-sticky strip)
        └─ <BigStuffMonthSection> × N
              ├─ <BigStuffHeroCard>  (top card)
              └─ <BigStuffRow> × N   (compact rows)
```

### New files

- `web/lib/city-pulse/loaders/load-big-stuff-page.ts` — server loader. Mirrors `load-big-stuff.ts` but with a looser query (all festival_types; include in-progress events for current month) and adds per-item type derivation + description extraction.
- `web/components/festivals/BigStuffPage.tsx` — root client component for the page.
- `web/components/festivals/BigStuffRibbon.tsx` — full ribbon (above-the-fold, includes counts).
- `web/components/festivals/BigStuffCollapsedStrip.tsx` — ~32px pinned strip that appears after the full ribbon scrolls out of view. Owns the active-month IntersectionObserver.
- `web/components/festivals/BigStuffMonthSection.tsx` — month anchor + hero + rows.
- `web/components/festivals/BigStuffHeroCard.tsx` — landscape hero.
- `web/components/festivals/BigStuffRow.tsx` — compact row.
- `web/components/festivals/BigStuffFilterChips.tsx` — type filter chips.
- `web/lib/big-stuff/type-derivation.ts` — pure function `getBigStuffType(item)` → bucket + tests.
- `web/lib/big-stuff/types.ts` — shared types for the page (`BigStuffType`, `BigStuffPageItem`, `BigStuffPageData`).

### Modified files

- `web/app/[portal]/festivals/page.tsx` — rewrite: uses `loadBigStuffForPage` + `<BigStuffPage>`. Kept server component wrapper for SEO metadata.

### Deleted files

None in this phase. `BigStuffCard` (inline in current `page.tsx`), the "Happening Now" / "Coming Up" blocks, and the countdown badge logic go away as part of the rewrite.

### Reused

- `groupItemsByMonth` + `BigStuffMonthBucket` from `web/lib/city-pulse/loaders/big-stuff-shared.ts` — same month bucketing logic.
- `DescriptionTeaser` extraction approach from `web/components/detail/DescriptionTeaser.tsx` (first meaningful sentence, 30–180 chars).
- `SmartImage` for all images.
- `FilterChip` from `web/components/filters/FilterChip.tsx` for the type chip strip.
- Phosphor icons for type-icon fallbacks on missing images.

## Page structure

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER (static, scrolls away)                                     │
│   h1: "The Big Stuff"                                             │
│   subtitle: "Festivals, tentpoles, and season-defining moments"   │
│                                                                   │
│   Filter chips (tablist):                                         │
│   [All 45] [Festivals 28] [Conventions 11] [Sports 4] [Community 2]│
│                                                                   │
│   Month ribbon (full, ~90px tall):                                │
│   • APR · 4   MAY · 12   JUN · 6   JUL · 3   AUG · 5   SEP · 7  │
│   (APR has a gold dot marker for current month)                   │
├──────────────────────────────────────────────────────────────────┤
│ COLLAPSED-STICKY STRIP (appears on scroll, ~32px tall, pinned)   │
│ • APR   MAY   JUN   JUL   AUG   SEP                               │
│   (active month — e.g., JUN — highlighted as user scrolls)       │
├──────────────────────────────────────────────────────────────────┤
│ BODY (scrollable)                                                 │
│                                                                   │
│   ═══ APR 2026 ═══                                               │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │ HERO: top event in month (type-colored 2px left border) │   │
│   └──────────────────────────────────────────────────────────┘   │
│   ▌ compact row                                                   │
│   ▌ compact row                                                   │
│   ▌ compact row                                                   │
│                                                                   │
│   ═══ MAY 2026 ═══                                               │
│   ... (same pattern)                                              │
│                                                                   │
│   ... through SEP                                                 │
└──────────────────────────────────────────────────────────────────┘
```

## Cards

### Hero card (top card per month)

- Full-bleed landscape image, `aspect-[21/9]` desktop, `aspect-[16/9]` mobile. `SmartImage` with `object-cover`. Missing image → gradient keyed to type color + large Phosphor icon (Crown for festival, Users for convention, MedalMilitary for sports, HeartStraight for community).
- Type pill overlay: top-left, `10px` Space Mono uppercase, `bg-[color]/10 border border-[color]/40 text-[color]`, `rounded` (3px), `px-1.5 py-0.5`. `LIVE NOW` pill (when `isLiveNow`) sits to the left of the type pill in `--neon-red`.
- Below image, in a padded body:
  - Title: `text-3xl font-bold text-[var(--cream)] tracking-[-0.01em]`
  - Meta line: date range `·` location, `text-sm text-[var(--muted)]`
  - Description teaser: `text-sm leading-relaxed text-[var(--soft)] mt-2`, 1–2 lines, null if no meaningful sentence (see Description extraction).
- Card container: `bg-[var(--night)] border border-[var(--twilight)] rounded-card overflow-hidden border-l-[2px] border-l-[var(--<type-color>)]` (the type-color left border overrides the normal border on that edge).
- Whole card is a `<Link>` to the detail page. Hover: subtle ken-burns on image (700ms ease-out, scale 1.0 → 1.04) on desktop only.
- `aria-label` composes title + type + date + location.

### Compact row (non-top cards per month)

- Grid row: `grid-cols-[72px_1fr]` desktop, `grid-cols-[56px_1fr]` mobile, `gap-3`.
- Thumbnail: square, same image fallback pattern (gradient + icon).
- Content cell:
  - Title: `text-base font-semibold text-[var(--cream)] truncate`
  - Meta: `text-sm text-[var(--muted)] truncate` — date range `·` location.
  - Type pill: right-aligned on desktop (`ml-auto`), wraps below meta on mobile.
- Card container: same left-border treatment as hero.
- `<Link>` wraps the row. Hover: `bg-[var(--dusk)]` (100ms ease).

### Tier assignment (which event is the hero vs row)

Inline computation in the loader — does NOT depend on the feed's `card_tier` pipeline. Each `BigStuffPageItem` gets a `tier: "hero" | "featured" | "standard"` field:

- `hero` if `importance = 'flagship'` OR (it's a festival AND has an image).
- `featured` if it has an image but doesn't meet `hero` criteria.
- `standard` otherwise.

Within each month, items sort by:
1. `isLiveNow` DESC (live now on top — only in current month).
2. `tier` rank (`hero` > `featured` > `standard`).
3. `startDate` ASC.

Top item becomes the hero card. All others become compact rows. If the top item happens to have no image (it's a `standard`-tier month with only image-less events), the hero treatment still applies with the gradient+icon fallback.

## Type taxonomy

Single enum `BigStuffType`:

| Value         | Color         | Derivation                                                                             |
|---------------|---------------|----------------------------------------------------------------------------------------|
| `festival`    | `--gold`      | `festivals.festival_type = 'festival'` OR tentpole with "festival" in title OR `category = 'music'` with "festival" context |
| `convention`  | `--vibe`      | `festivals.festival_type IN ('convention','conference')` OR tentpole with title suffix matching `/[A-Z]on$/` (DragonCon, MomoCon, Frolicon pattern) |
| `sports`      | `--neon-cyan` | tentpole `category IN ('sports','race','running')` OR title matches `/marathon|5k|10k|race|cup|match|nascar|peachtree/i` |
| `community`   | `--neon-green`| `festivals.festival_type = 'community'` OR title matches `/parade|streets alive|juneteenth|pride/i` |
| `other`       | `--muted`     | fallback — rare                                                                        |

Derivation is a pure function `getBigStuffType(item): BigStuffType` in `web/lib/big-stuff/type-derivation.ts`, fully unit-tested with fixtures covering:
- Each festival_type value
- Tentpole titles that should match each bucket (FIFA World Cup → sports, DragonCon → convention, AJC Peachtree Road Race → sports, Juneteenth Atlanta Parade & Music Festival → community, etc.)
- "Other" fallback

Derivation runs once in the loader, baked into `BigStuffPageItem.type`. No client-side derivation.

## Filter chips

- Horizontal row above the ribbon, using `FilterChip` from `web/components/filters/FilterChip.tsx`.
- Labels: `All <N>`, `Festivals <N>`, `Conventions <N>`, `Sports <N>`, `Community <N>`. Counts are derived from unfiltered data (constant across selection).
- "Other" bucket is NOT a chip. Items in "other" are included in `All` but not filterable.
- Default active: `All`.
- Click behavior:
  - Click an inactive chip → exclusive select (replaces current selection).
  - Click the active chip → snaps back to `All`.
  - No multi-select.
- Applied state updates:
  - Cards not matching the active type are hidden (CSS `display: none` based on a data attribute) OR removed from render via React. Render-removal is preferable — the DOM stays clean and counts inside the ribbon can re-derive.
  - Month sections with zero matching items are hidden.
  - Ribbon month pills with zero matching items are hidden. Counts re-derive (e.g., `MAY · 12` → `MAY · 4`).
- State lives in `<BigStuffPage>` as `useState<BigStuffType | "all">("all")`. Children receive `activeType` + callback. No URL state (per non-goals).

## Ribbon behavior

### Full ribbon (above-the-fold)

- Reuses `BigStuffSection`'s month-ribbon visual spine but scaled up: ~90px tall, horizontal flex row, each month a column equal-width.
- Each month column shows:
  - Month label: `font-mono text-sm font-bold tracking-[0.12em] uppercase`, with gold 6px dot for current month.
  - Count: `text-xs text-[var(--muted)]` below label (e.g., "12 events"). In the filtered state, count reflects the filter.
- Column is a `<button>` — click smooth-scrolls the body to `#month-<key>` anchor.
- No item previews inside the ribbon columns (unlike the feed ribbon — the body does that job here).

### Collapsed-sticky strip (on scroll)

- Activated when the full ribbon scrolls past the top of the viewport.
- ~32px tall, pinned `position: sticky; top: 0`, z-index above body content.
- Contains just a row of month pills (no counts, no label label row), `text-xs font-mono tracking-[0.08em] uppercase`, `px-2 py-1`.
- Active month pill (the one the user is currently scrolled to) has `bg-[var(--gold)]/15 text-[var(--gold)]` + underline.
- Active-month tracking: IntersectionObserver on each `<BigStuffMonthSection>` with `rootMargin: "-40px 0px -70% 0px"` (i.e., a section counts as active when its top crosses below the collapsed strip and before it's scrolled past the viewport midpoint). Multiple sections may be intersecting; the one with the highest `top` value (closest-to-top) wins. Update is throttled via `requestAnimationFrame` to avoid layout thrash.
- Implementation: a second component `<BigStuffCollapsedStrip>` rendered alongside the full ribbon; CSS controls which is visible via intersection observer on the full ribbon's sentinel.
- On mobile the collapsed strip is also snap-scrollable horizontally.

### Scroll behavior

- Clicking any ribbon pill (full or collapsed) calls `document.getElementById('month-' + monthKey)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`.
- Each `<BigStuffMonthSection>` renders with `id="month-<monthKey>"` + `scroll-mt-[40px]` so the collapsed strip doesn't cover the heading.
- `prefers-reduced-motion`: smooth-scroll becomes instant.

## Data loader

### `loadBigStuffForPage(ctx: FeedSectionContext): Promise<BigStuffPageData | null>`

Location: `web/lib/city-pulse/loaders/load-big-stuff-page.ts`.

```ts
export interface BigStuffPageData {
  items: BigStuffPageItem[];
}

export interface BigStuffPageItem extends BigStuffItem {
  type: BigStuffType;            // computed via getBigStuffType
  isLiveNow: boolean;            // end_date >= today AND start_date <= today
  description: string | null;    // first meaningful sentence (30-180 chars) or null
  imageUrl: string | null;       // for hero + thumb; null → gradient+icon fallback
}
```

### Query differences from `load-big-stuff.ts`

1. **Festival type filter relaxed.** Drop the `not("festival_type", "in", ...)` clause — include conventions, conferences, community.
2. **Current-month in-progress inclusion.** In addition to `start_date > today`, also fetch events where `start_date <= today AND end_date >= today` (ongoing now). Supabase filter: `or(start_date.gt.<today>,and(start_date.lte.<today>,end_date.gte.<today>))`.
3. **Description column selected.** Add `description` to both festivals and tentpole queries (existing columns, not a migration).
4. **Image URL selected.** Already present in existing queries; ensure it's in the SELECT for both.

### Cache

- Namespace: `api:big-stuff-page`.
- Key: `${portalId ?? "none"}|${getLocalDateString()}|big-stuff-page-v1`.
- TTL: 5 minutes.
- Same `getOrSetSharedCacheJson` pattern as the feed loader.

### Metadata unchanged

`page.tsx` still emits the same `<title>` + `<description>` metadata generated in `generateMetadata`. Page body is a client island (`<BigStuffPage>`) that receives `initialData` from the loader.

## Description extraction

`extractTeaser(desc: string | null): string | null` — lifted from `DescriptionTeaser` logic:
- Return `null` if input is null or under 30 chars.
- Find first sentence boundary (`.` or `!` or `?` followed by whitespace).
- If sentence length is 30–180 chars, return it.
- Else return the first 160 chars, trimmed at last word boundary + ellipsis.
- Reject if it contains markdown fencing, URLs, or looks like metadata dump.

Check `web/components/detail/DescriptionTeaser.tsx` — if a `extractTeaser` helper is already exported there or from `web/lib/`, import and reuse. If the logic is inline inside the component, extract to `web/lib/teaser.ts` as part of this workstream (a small refactor; the existing component also switches to the imported helper).

## Empty states

- No events in any month (e.g., portal with zero `announced_2026` data): render the page header + a centered empty state ("Nothing on the 6-month horizon yet. Check back soon."). Ribbon hidden.
- Filter selection with zero matches: render the header + chips (so user can reset), then an inline empty state in the body ("No <type> events in the next 6 months. Try All or another type."). Ribbon hidden.
- Single month has zero matches after filter: that month's section is hidden (not rendered at all). Ribbon pill for that month is hidden.

## Loading + error

- Server-rendered, no client fetch. If loader returns `null` (query error), page renders the empty state with a log captured via `logger.error`.
- Suspense is not needed — the whole data comes in one RSC load. Body renders when the server has the data.

## Testing

### Unit tests

- `web/lib/big-stuff/type-derivation.test.ts` — 20+ fixtures covering:
  - Each `festival_type` value → correct bucket.
  - Real Atlanta data: FIFA World Cup match → `sports`, DragonCon → `convention`, AJC Peachtree Road Race → `sports`, Inman Park Festival → `festival`, Juneteenth Parade → `community`, unknown tentpole → `other`.
  - Edge cases: festival_type null, category null, title with mixed case, hyphens.
- `web/lib/city-pulse/loaders/load-big-stuff-page.test.ts` — grouping + filtering + in-progress inclusion (7+ tests).
- `web/components/festivals/BigStuffFilterChips.test.tsx` — selection state, count derivation.

### Component tests

- `web/components/festivals/BigStuffPage.test.tsx`:
  - Renders with empty data → shows empty state.
  - Renders with filtered data → hides non-matching cards.
  - Applying a filter removes matching cards AND their month pills.
  - Click a month pill → invokes scrollIntoView (spy).

### Browser verification

- Desktop + mobile, local dev:
  - Full ribbon renders; filter chips work.
  - Scrolling past ribbon: collapsed strip appears, tracks active month.
  - Click a month pill in both states: smooth-scrolls.
  - Filter a type: cards and ribbon pills update consistently.
  - Hero + rows render correctly with + without images.
  - LIVE NOW pill renders on current in-progress events.

### A11y audit

- axe or manual screen reader pass — tablist semantics for filter chips, `aria-current` on active month, `aria-label` on cards. No keyboard traps.

## Motion

- Ribbon full→collapsed transition: opacity + translateY over 200ms ease-out. `prefers-reduced-motion` → instant.
- Filter chip click: 200ms opacity fade on entering/leaving cards (CSS transition on `opacity`, initial `0` for mounted cards, `1` for visible). No height/layout animation.
- Hero image hover: ken-burns, 700ms ease-out, scale 1.0 → 1.04. Desktop only. `prefers-reduced-motion` → no-op.
- LIVE NOW pill: slow pulse (0.7 → 1 opacity, 3s infinite) — same treatment as the feed's countdown pulse. `prefers-reduced-motion` → static at 0.85.
- Active-month indicator in collapsed strip: 150ms ease-out x-position shift when the active month changes. `prefers-reduced-motion` → instant.

## Mobile

- Below 640px (`sm:` breakpoint):
  - Full ribbon: horizontal snap-scroll, 3 visible months at ~110px each.
  - Collapsed strip: same horizontal snap-scroll, 28px tall.
  - Filter chips: horizontal scroll chip strip (`FilterChip` default mobile).
  - Hero card: `aspect-[16/9]` image instead of 21:9.
  - Compact rows: thumbnail `56×56`, type pill wraps below meta.

## Open items

- Portal scope: this page should work on Atlanta only today, but the code structure shouldn't block future portals. Loader takes a portalId just like the feed; other portals either have no Big Stuff data yet (empty state) or their own data.
- FIFA match dedup: the 8+ FIFA World Cup match events currently render as individual rows. Pre-existing crawler concern (flagged in PR #58). Not fixed by this page; the page surfaces whatever the data has. If dedup lands later, the page benefits automatically.
- `announced_2026` naming: the column will need a rename/generalization when 2027 arrives. Noted; not blocking this spec.

## Migration / rollout

1. Land new loader + components + page behind the existing route. Existing `/[portal]/festivals/page.tsx` is replaced; no URL change; no redirect.
2. No database migration required.
3. After merge, the feed ribbon's "See all →" link destination is the new page. No feed-side changes needed.
4. Existing `useFestivalsList` hook (used by legacy surfaces) is unaffected — `/api/festivals/upcoming` route still live.

## Success criteria

- The page is calendar-spined: month anchors visible, 6 month sections, ribbon navigation works.
- Type tagging is visible and distinguishable at a glance without reading labels.
- Filter chips work client-side; ribbon counts update on filter change.
- Hero-vs-row tier is visible and consistent.
- Happening-now events appear in the current month with clear `LIVE NOW` indicator.
- Desktop + mobile both clear the shipping standards checklist.
- Zero regressions on feed ribbon / `useFestivalsList` / detail page links.
