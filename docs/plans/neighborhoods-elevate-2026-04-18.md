# Neighborhoods Elevate — Implementation Plan

**Date:** 2026-04-18
**Scope:** Round 1 of the `/elevate` pass on the Explore section (user: Path A — ship neighborhoods first, Explore home comp follows in Round 2).
**Status:** Drafted. Pending user sign-off before execution.

---

## Why

The shipped `/atlanta/neighborhoods` and `/atlanta/neighborhoods/[slug]` routes are functional but structurally diverge from the Pencil design system. The index page ignores the `NeighborhoodCard` atom (`eoLUe`) in favor of a hand-rolled `NeighborhoodIndexCard` that overloads a single surface with color-tinted backgrounds, activity scores, stats, category icons, and secondary counts — 5 jobs per card where the comp says 1. The detail page's Pencil comp (`Z0gY3`) has EVENTS/PLACES tabs + weekly section dividers + a prominent time column + POPULAR SPOTS + NEARBY NEIGHBORHOODS chip row. The shipped detail page matches **none** of that: an UPPERCASE title + color-accent-bar hero, a flat event list with 14px time column, color-tinted "Explore Nearby" cards, no imagery anywhere.

The map hero on the index page (live production, added after the Pencil comp was drawn) is staying per user call — "the neon mashup gives it the city at night feel." But the editorial copy, the mode filter, and the infrastructure legend ("151 total / 7 active") need work.

Zero motion anywhere is a separate concern — motion specs baked into the comps, applied in a follow-up pass.

## References

- **Audit (Phase 1–2):** covered in the conversation thread leading into this plan. Key findings at-a-glance:
  - Index page: map hero + color-tinted cards + tiered grid densities + infrastructure legend
  - Detail page: missing tabs, missing weekly dividers, missing imagery, 14px time column reads as timid
  - Motion: zero entrance animations, zero scroll reveals, hover-scale reads toyish
- **Pencil comps (design-system.pen):**
  - `QwPkU` / `8inW1` — original Neighborhoods Index comp (no map — superseded by v2)
  - `Z0gY3` / `YvbKx` — original Neighborhood Detail comp (target — shipped code ignores this)
  - `0xWTr` / `dlvfh` — **Neighborhoods Index v2** (desktop + mobile — new, integrates neon map)
  - `WxF6c` / `Zqxgk` — **Neighborhood Detail v2** (desktop + mobile — new, comp-faithful + imagery + color thread)
  - `eoLUe` — `NeighborhoodCard` atom (existing, minimalist — will be renamed `NeighborhoodSelectChip` per architect review)
  - `XNu6y` — new index card atom (to be implemented as `NeighborhoodIndexCard`, NOT `V2`)
  - `nWTcD` / `sIncC` — new time-anchored row atom (to be implemented via existing Pencil `t5jrF` ScheduleRow, NOT a new `TimeAnchoredRow`)
  - Motion annotations: `iv4Zd`, `xgNEk`, `oXH05`, `A2rvj`
  - Implementation mapping note: `4PorI`
- **Reviews (binding):**
  - `product-designer` returned **PASS-WITH-NOTES** — 6 spec revisions
  - `code-review-ai:architect-review` returned **BLOCK on V2 naming + REVISE on 7 architectural items**
- **Prerequisite (shipping separately):** PR #53 — portal attribution leak fix. Must merge before this plan executes.

---

## Revisions to the Comps (from reviews)

Apply these to the Pencil comps before `/design-handoff extract`:

### From product-designer

1. **Mode filter pill** — Confirm the `Tonight / This Week / All` pill drives distinct visual state on the map (fill-opacity expression change, not just overlay copy). If it cannot, drop it. Decision point.
2. **Neon-gradient hero fallback** — Spec must cite photo coverage: "X of N neighborhoods have curated photos as of [date]. Gradient fallback used for the remainder. Revisit at M-photo threshold." Gradient cannot be the permanent default.
3. **Category chip color source** — The `data-category` attribute system (already in `globals.css`) drives the category chip color inside event rows, **NOT** the neighborhood color. Prevents a third competing accent on each row.
4. **Map 22px time** → map to `text-xl font-bold font-mono tabular-nums` (20px via Tailwind scale, not arbitrary `text-[22px]`).
5. **No `mask-fade-x`** on the NEARBY NEIGHBORHOODS chip row — confirm in implementation.
6. **"ALIVE TONIGHT" editorial copy** — render only when `eventsTonightCount > 0`. Otherwise fall back to a week-variant copy ("This week across Atlanta") or render nothing. No "0 neighborhoods" state.

### From architect-review

7. **Kill V2 naming.** Rename `web/components/NeighborhoodCard.tsx` → `NeighborhoodSelectChip` (its actual role in `ForYouOnboarding` + `NeighborhoodMap` legend). The new index card atom lives at `web/components/neighborhoods/NeighborhoodIndexCard.tsx`. **No "V2" suffixes anywhere.**
8. **Reuse the Pencil `t5jrF` ScheduleRow** pattern rather than inventing a `TimeAnchoredRow`. Implement as `web/components/schedule/ScheduleRow.tsx` (or `web/components/feed/`, whichever matches existing structure — check via `ls` before creating). Neighborhood-specific only if the pattern truly doesn't generalize.
9. **Extract loaders** out of page files into `web/lib/neighborhoods/loaders.ts` (matches `lib/marketplace-data.ts` pattern). Page files import + call; any future API route wraps the same function. Hard Rule 7 conformant.
10. **Narrow card props.** `NeighborhoodIndexCard` takes a 3-field view model `{ eventsTodayCount, eventsWeekCount, venueCount }` + color + name + slug + portalSlug. NOT the full `NeighborhoodActivity` type.
11. **Hero image contract.** Add `heroImage?: string` field to `web/config/neighborhoods.ts`. Ship gradient-only initially for all 45 neighborhoods. Photo curation is a follow-on workstream — NOT part of this elevate. Use `SmartImage` with `fallback` prop; NEVER `next/image` directly.
12. **Editorial overlay copy** routes through `web/lib/editorial-templates.ts` (template key: `neighborhoods_alive_tonight`, `neighborhoods_week_scope`). NOT inline concatenated strings.

---

## Incidental Cleanup (picked up during rebuild)

These are things architect-review flagged in shipped code that make sense to fix as part of this PR rather than separately:

13. **Stale `venues` joins** — `getActivityData` uses `venue:venues!events_venue_id_fkey(...)`. The March 2026 rename made `venues` → `places`. Migrate joins to `place:places!events_place_id_fkey(neighborhood)` where correct, update downstream type guards. Check carefully — some joins may silently work today via FK aliases.
14. **Explicit cache directive on `/api/neighborhoods/events`** — the drill-down fetches this and it has no runtime policy. Add `export const revalidate = 120` or equivalent per Hard Rule 9.
15. **Structured logging in `getActivityData`** — the silent `catch {}` wrapping the RSVP RPC call currently eats errors. Log via the `logger` util with `{ error: err.message }` instead of the bare comment.
16. **Boundaries fetch** — `/api/neighborhoods/boundaries` returns static GeoJSON with no cache directive. Add `force-cache` or convert to a static import. Not critical for this PR but document if deferred.

---

## Architecture

### New files

```
web/components/neighborhoods/
  NeighborhoodIndexCard.tsx          — minimalist atom (dot + name + status line)
  NeighborhoodsMapMode.tsx           — mode filter pill component (Tonight/Week/All)
  NeighborhoodsEditorialOverlay.tsx  — "ALIVE TONIGHT" kicker, conditional render

web/components/schedule/               (or feed/, pending ls)
  ScheduleRow.tsx                    — prominent time-column row; used by neighborhood detail + any future schedule surface

web/lib/neighborhoods/
  loaders.ts                         — extracted getNeighborhoodSpots, getNeighborhoodEvents, getNeighborhoodEventCounts, getNeighborhoodsIndex
  bucket-events.ts                   — pure util: bucketEvents(events, now) → { tonight, weekend, nextWeek, later }
  loaders.test.ts                    — portal isolation fixtures
  bucket-events.test.ts              — time window edges (midnight, Fri-Sun weekend, DST transition)
```

### Modified files

```
web/components/NeighborhoodCard.tsx                   → RENAMED to NeighborhoodSelectChip.tsx
  (callers: ForYouOnboarding.tsx, NeighborhoodMap.tsx legend)

web/components/neighborhoods/NeighborhoodMap.tsx      → remove "151 total / 7 active" legend
                                                        accept modeFilter prop, apply to paint expression
web/components/neighborhoods/NeighborhoodsPageClient.tsx → lift modeFilter state alongside selectedSlug;
                                                           render NeighborhoodsEditorialOverlay above map

web/app/[portal]/neighborhoods/page.tsx               → use NeighborhoodIndexCard;
                                                        uniform 4-col grid across tiers;
                                                        use loaders.ts;
                                                        migrate venues → places joins

web/app/[portal]/neighborhoods/[slug]/page.tsx        → full rebuild to Z0gY3/WxF6c comp;
                                                        EVENTS/PLACES tabs (+ URL state via ?tab=);
                                                        TONIGHT/THIS WEEKEND/NEXT WEEK dividers;
                                                        ScheduleRow events;
                                                        heroImage + SmartImage with gradient fallback;
                                                        NEARBY chip row (no color-tinted Links)

web/config/neighborhoods.ts                           → add heroImage?: string field to Neighborhood type

web/lib/editorial-templates.ts                        → add keys:
                                                          - neighborhoods_alive_tonight
                                                          - neighborhoods_week_scope

web/app/api/neighborhoods/events/route.ts             → add cache directive (force-cache or revalidate)
```

### Data contracts

**`NeighborhoodIndexCard` props**
```ts
interface NeighborhoodIndexCardProps {
  name: string;
  slug: string;
  portalSlug: string;
  color: string;                    // from getNeighborhoodColor(name)
  eventsTodayCount: number;
  eventsWeekCount: number;
  venueCount: number;
}
```

**`ScheduleRow` props** (confirm against `t5jrF` Pencil node before finalizing)
```ts
interface ScheduleRowProps {
  event: {
    id: number | string;
    title: string;
    startDate: string;
    startTime: string | null;
    isAllDay: boolean;
    venue?: { name: string; slug?: string } | null;
    categoryId?: string | null;
    imageUrl?: string | null;
  };
  accentColor: string;              // neighborhood color, rendered on left bar at ≤70% opacity
  portalSlug: string;
  context: 'page' | 'feed';         // per entity-urls.ts LinkContext
}
```

**`bucketEvents(events, now)` contract**
```ts
type EventBuckets<T> = {
  tonight: T[];     // start_date === today AND (is_all_day OR start_time >= 17:00)
  weekend: T[];     // start_date in Sat/Sun OR (Fri AND start_time >= 17:00), excluding tonight
  nextWeek: T[];    // start_date within 8-14 days from today
  later: T[];       // everything else
};
```

Boundaries require care: DST transitions, timezone (Atlanta = `America/New_York`), events in the past silently filtered upstream. Tests must cover Friday night → Saturday AM overlap and week rollover.

---

## Implementation Phases

Each phase is sized so that a subagent (or sequential work) can land it as a reviewable unit.

### Phase 0 — Prerequisites (do first, independently)
- [ ] PR #53 (portal attribution fix) merged to main
- [ ] Apply 6 product-designer revisions to Pencil comps (update node props, add photo-coverage note, map 22px → text-xl, confirm no mask-fade-x, conditional "ALIVE TONIGHT")
- [ ] Confirm with user: mode filter pill (Note 1 from product-designer) — does the existing `NeighborhoodMap.tsx` paint expression have a hook for opacity modulation based on active events, or is this a larger refactor than a pill state change?

### Phase 1 — Data layer foundation
1. Create `web/lib/neighborhoods/loaders.ts`:
   - Move `getNeighborhoodSpots`, `getNeighborhoodEvents`, `getNeighborhoodEventCounts` out of the detail page
   - Add `getNeighborhoodsIndex` (moved from index page's `getActivityData`) — fold in the `venues` → `places` join migration here
   - All event loaders take `portalId` and apply the standard `portal_id.eq.{id},portal_id.is.null` filter (PR #53 merged → pattern is established)
2. Create `web/lib/neighborhoods/bucket-events.ts` + tests. Test DST, midnight, Friday 5pm weekend boundary, empty, all-past, all-future.
3. Create `web/lib/neighborhoods/loaders.test.ts` — portal isolation fixture: mixed-portal events, assert only requested portal + null leak through.
4. Add `heroImage?: string` field to `Neighborhood` type in `web/config/neighborhoods.ts` (don't populate yet).
5. Add editorial template keys to `web/lib/editorial-templates.ts`.

### Phase 2 — Atoms + rename
1. Rename `web/components/NeighborhoodCard.tsx` → `web/components/NeighborhoodSelectChip.tsx`. Update the two callers (`ForYouOnboarding.tsx`, `NeighborhoodMap.tsx`) in the same commit.
2. Create `web/components/neighborhoods/NeighborhoodIndexCard.tsx` per props contract above. Storybook or simple test for coral-vs-muted status line branch.
3. Confirm existing `ScheduleRow` implementation: `ls web/components/{schedule,feed,detail}/ScheduleRow*` — if absent, create at `web/components/schedule/ScheduleRow.tsx` per Pencil `t5jrF` spec.
4. Create `web/components/neighborhoods/NeighborhoodsEditorialOverlay.tsx` — conditional render using editorial-templates + `eventsTonightCount` threshold.
5. Create `web/components/neighborhoods/NeighborhoodsMapMode.tsx` — mode filter pill with URL state or lifted state (decide in code review).

### Phase 3 — Page rebuilds
1. **Index page** (`web/app/[portal]/neighborhoods/page.tsx`):
   - Replace inline `NeighborhoodIndexCard` with the real component
   - Drop tier-specific grid density variation (2/3/4 → 2/3/4 → 2/4/5). Uniform grid: 4-col desktop (`lg:grid-cols-4`), 3-col `sm:grid-cols-3`, 2-col mobile base
   - Apply editorial overlay above the map
   - Use `loaders.ts`
2. **NeighborhoodMap** updates:
   - Remove legend
   - Accept `modeFilter` prop, translate to paint-expression opacity
3. **NeighborhoodsPageClient**:
   - Lift `modeFilter` state alongside `selectedSlug`
   - Render overlay + map + drill-down
4. **Detail page** (`web/app/[portal]/neighborhoods/[slug]/page.tsx`):
   - Rebuild to WxF6c comp
   - Full-bleed `SmartImage` hero with gradient fallback (driven by `heroImage` from config or color-keyed gradient if absent)
   - Color-dot kicker + title-case title + stats (inside hero overlay)
   - EVENTS/PLACES tab bar using `?tab=` URL state, default `events`
   - `bucketEvents()` on server, pass bucketed arrays to client
   - TONIGHT (coral) / THIS WEEKEND / NEXT WEEK section dividers
   - `ScheduleRow` event rows (kill the inline 14px time column list)
   - POPULAR SPOTS via existing `PlaceCard` with `variant="compact"` (keep)
   - NEARBY chip row (kill color-tinted Link cards; chip = color dot + name + `rounded-full` border)
5. **API route cache directive** — `/api/neighborhoods/events`

### Phase 4 — Verification
1. `npm run lint` clean
2. `npx tsc --noEmit` clean
3. `npx vitest run lib/neighborhoods` passes (bucket + loaders)
4. `/design-handoff verify` against `0xWTr` + `WxF6c` on desktop; `dlvfh` + `Zqxgk` on mobile
5. Manual browser QA: `/atlanta/neighborhoods`, `/atlanta/neighborhoods/midtown`, `/atlanta/neighborhoods/old-fourth-ward`, at 1440×900 and 375×812. Check empty state: navigate to a neighborhood with 0 tonight events, verify overlay falls back gracefully.
6. Portal smoke: if FORTH has neighborhoods routing enabled, load `/forth/neighborhoods/midtown` and confirm event scoping via DevTools Network tab.

### Phase 5 — Follow-ups (NOT in this PR)
- `/motion design` pass applies the motion annotations baked into the comps (entrance stagger, map polygon breathing, tab slide, hover glow). Tracked separately.
- Curate per-neighborhood `heroImage` assets — 45 neighborhoods, editorial call.
- Round 2 — Explore home comp + rebuild (new Pencil comp design first, user said current explore "looks like a freshman design project").
- `/api/neighborhoods/boundaries` static-ification.

---

## Test Plan

| Test | File | Covers |
|---|---|---|
| Bucket edges | `lib/neighborhoods/bucket-events.test.ts` | midnight, Fri 5pm weekend start, Sun midnight weekend end, DST spring-forward, DST fall-back, empty list, all-past, all-future, week rollover |
| Portal isolation | `lib/neighborhoods/loaders.test.ts` | mixed-portal fixture: assert only `portal_id = X` + `portal_id IS NULL` events returned, no other-portal leakage |
| Index card variants | `components/neighborhoods/NeighborhoodIndexCard.test.tsx` | coral status line when `eventsTodayCount > 0`, muted fallback, color-dot renders with provided hex, slug routing correct |
| ScheduleRow edge times | `components/schedule/ScheduleRow.test.tsx` | all-day event renders "ALL / DAY"; null time renders "TBD"; 00:00 renders "12:00 AM"; 12:00 renders "12:00 PM"; accent color applied at 70% opacity |
| Detail page overlay context | manual QA | event links use `'page'` context (canonical), not `'feed'` — no overlay nesting bug |

---

## Non-goals

- **Explore section** — Round 2, separate comp design first
- **Motion implementation** — Phase 5, separate `/motion` pass
- **Per-neighborhood photo curation** — editorial call, separate workstream
- **Hangs query portal scoping** — `hangs` table has no `portal_id`, scoping via user/venue; not in this scope
- **Unified search integration** — the PLACES tab links out to `/find?neighborhood=X` (existing); no changes to unified search RPC
- **GeoJSON boundaries caching** — low priority, noted in incidental cleanup but deferred if PR grows
- **`server-feed.ts` parse error / `HangFeedSection` SSR error** — tracked separately, not blocking this plan

---

## Open Questions

1. **Mode filter pill — does it ship?** Requires confirming `NeighborhoodMap.tsx` paint expression can drive opacity off an active-events flag. If the answer is "not without bigger refactor," drop the pill in this PR and just fix the editorial overlay copy.
2. **ScheduleRow location** — `components/schedule/` vs. `components/feed/` vs. `components/detail/`. Defer to `ls` findings in Phase 2 step 3.
3. **Hero image coverage threshold** — what percentage curated before we hide the gradient fallback entirely? Guess: 80%. Open for discussion.
4. **Tab URL state** — `?tab=events|places` via `window.history.replaceState` (per web/CLAUDE.md client-side filter pattern, no router.push). Confirm this is the right pattern for tab state.

---

## Acceptance Gate

Before merge:
- [ ] `product-designer` returns **PASS** (not just PASS-WITH-NOTES) after reviewing the shipped pages at both viewports
- [ ] `/design-handoff verify` passes for all four comps (`0xWTr`, `dlvfh`, `WxF6c`, `Zqxgk`)
- [ ] Portal isolation test green
- [ ] `npm run lint` + `npx tsc --noEmit` clean
- [ ] Manual QA in browser at 1440 + 375, zero console errors introduced
- [ ] No new anti-patterns from the design-truth gallery shipped (glassmorphism, mask-fade-x, count-badges-as-headers, etc.)
