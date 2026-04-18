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
2. **Neon-gradient hero is the designed base, not a fallback.** Per product-designer follow-up: cinematic minimalism calls for "solid surfaces with atmospheric glow." A well-executed gradient keyed to neighborhood color IS atmospheric glow. The correct architecture: gradient is always present as a compositional base; `SmartImage` renders the photo on top when `heroImage` is populated. **No retirement threshold** — at 100% coverage, gradient stays as a compositional element behind the image. Phase 0 must still lock the current photo-coverage count in the comp annotation before `/design-handoff extract` runs (so the implementer knows how many neighborhoods ship with photos on day one), but "retire the fallback at N%" framing is dropped.
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
12. **Editorial overlay copy** routes through `web/lib/editorial-templates.ts`. NOT inline concatenated strings. Template string literals locked below (do not re-invent during implementation):
    - `neighborhoods_alive_tonight` → `"ALIVE TONIGHT — {n} neighborhoods have events starting soon"` (render only when `n > 0`)
    - `neighborhoods_week_scope` → `"This week across Atlanta"` (render when `eventsTonightCount === 0` but `eventsWeekCount > 0`)
    - When both counts are 0, render no overlay (not a 0-state copy variant).

---

## Incidental Cleanup

### Split into its own PR (lands before Phase 1 of the elevate)

13. **Stale `venues` joins** — `getActivityData` uses `venue:venues!events_venue_id_fkey(...)`. The March 2026 rename made `venues` → `places`. Migrate joins to `place:places!events_place_id_fkey(neighborhood)`, update downstream type guards. Some joins silently work today via FK aliases — confirm by turning off the aliases in a branch and observing what breaks. **Per architect-review: ship as standalone PR** (cross-cutting rename, diff hardness, silent regression risk). Blocks Phase 1.

### Bundled with the elevate rebuild

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
  NeighborhoodHeroStyle.ts           — getNeighborhoodHeroStyle(color, heroImage?) helper
                                       returns { gradient: CSSProperties, imageSrc?: string }
                                       used by both server render + SmartImage fallback to
                                       prevent fallback-logic duplication

web/components/shared/                 — ScheduleRow lives in shared, NOT schedule/ (circular-import risk)
  ScheduleRow.tsx                    — prominent time-column row; used by neighborhood detail
                                       + any future schedule surface (venue detail, series detail)

web/lib/neighborhoods/
  loaders.ts                         — extracted getNeighborhoodSpots, getNeighborhoodEvents,
                                       getNeighborhoodEventCounts, getNeighborhoodsIndex
  bucket-events.ts                   — pure util: bucketEvents(events, now, timezone)
                                       → { tonight, weekend, nextWeek, later }
                                       timezone param is REQUIRED (no hardcoded America/New_York)
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
// Typography constants — DO NOT override during implementation.
// Shipped 14px time column was too timid; product-designer locked the new scale.
// time column: `text-xl font-bold font-mono tabular-nums text-[var(--cream)] leading-none`
// period (AM/PM): `text-2xs font-mono text-[var(--muted)] tracking-[0.14em]`
// accent bar: neighborhood color at ≤70% opacity, 3×48px, 2px radius

interface ScheduleRowProps {
  event: {
    id: number | string;
    title: string;
    startDate: string;
    startTime: string | null;
    isAllDay: boolean;
    place?: { name: string; slug?: string } | null;   // RENAMED from `venue` — matches places refactor
    categoryId?: string | null;                        // colored via data-category attribute, NOT accentColor
    imageUrl?: string | null;
  };
  accentColor: string;              // neighborhood color, rendered on left bar at ≤70% opacity
  portalSlug: string;
  context: 'page' | 'feed';         // per entity-urls.ts LinkContext
}
```

**`bucketEvents(events, now, timezone)` contract**
```ts
function bucketEvents<T extends EventLike>(
  events: T[],
  now: Date,
  timezone: string,   // REQUIRED — e.g., 'America/New_York'. Never hardcode inside the util.
): {
  tonight: T[];     // start_date === today AND (is_all_day OR start_time >= 17:00)
  weekend: T[];     // start_date in Sat/Sun OR (Fri AND start_time >= 17:00), excluding tonight
  nextWeek: T[];    // start_date within 8-14 days from today
  later: T[];       // everything else
};
```

Boundaries require care: DST transitions, timezone passed explicitly (NOT hardcoded), events in the past silently filtered upstream. Tests must cover Friday night → Saturday AM overlap, week rollover, DST spring-forward and fall-back.

---

## Implementation Phases

Each phase is sized so that a subagent (or sequential work) can land it as a reviewable unit.

### Phase 0 — Prerequisites (do first, independently)
- [ ] PR #53 (portal attribution fix) merged to main
- [ ] **Places rename PR** — item 13 above. Migrate `venues` → `places` joins in `getActivityData` + downstream type guards. Lands before Phase 1, reviewed in isolation.
- [ ] Apply 6 product-designer revisions to Pencil comps (update node props, document gradient-as-designed-base, map 22px → text-xl, confirm no mask-fade-x, conditional "ALIVE TONIGHT", lock literal editorial strings)
- [ ] **Lock the photo coverage count** in the comp annotation: count how many of the 45 neighborhoods have `heroImage` populated in `config/neighborhoods.ts` as of the extract date. Written into the annotation before `/design-handoff extract` runs — not deferred.
- [ ] **BLOCK-level resolution**: mode filter pill feasibility. Read `NeighborhoodMap.tsx` paint expression. Confirm it can drive `fill-opacity` from a per-polygon active-events flag. If it can't, **drop the pill in this elevate** and adjust the Index comp accordingly. Resolve here, not during coding.

### Phase 1 — Data layer foundation
1. Create `web/lib/neighborhoods/loaders.ts`:
   - Move `getNeighborhoodSpots`, `getNeighborhoodEvents`, `getNeighborhoodEventCounts` out of the detail page
   - Add `getNeighborhoodsIndex` (moved from index page's `getActivityData`) — fold in the `venues` → `places` join migration here
   - All event loaders take `portalId` and apply the standard `portal_id.eq.{id},portal_id.is.null` filter (PR #53 merged → pattern is established)
2. Create `web/lib/neighborhoods/bucket-events.ts` + tests. Test DST, midnight, Friday 5pm weekend boundary, empty, all-past, all-future.
3. Create `web/lib/neighborhoods/loaders.test.ts` — portal isolation fixture:
   - Fixture shape: **3 events on portal A, 2 events on portal B, 1 event with `portal_id IS NULL`**
   - Include BOTH same `place_id` across portals (catches join-leakage) AND distinct `place_id`s per portal (catches filter-clause-missing)
   - Assert A-scoped query returns 4 (A + null), B-scoped returns 3 (B + null), no-portal query returns all 6
4. Add `heroImage?: string` field to `Neighborhood` type in `web/config/neighborhoods.ts` (don't populate yet).
5. Add editorial template keys to `web/lib/editorial-templates.ts`.

### Phase 2 — Atoms + rename
1. Rename `web/components/NeighborhoodCard.tsx` → `web/components/NeighborhoodSelectChip.tsx`. Update the two callers (`ForYouOnboarding.tsx`, `NeighborhoodMap.tsx`) in the same commit.
2. Create `web/components/neighborhoods/NeighborhoodIndexCard.tsx` per props contract above. Storybook or simple test for coral-vs-muted status line branch.
3. Confirm existing `ScheduleRow` implementation: `ls web/components/{shared,schedule,feed,detail}/ScheduleRow*` — if absent, create at `web/components/shared/ScheduleRow.tsx` per Pencil `t5jrF` spec. Typography constants are in the props contract comment — treat them as locked.
4. Create `web/components/neighborhoods/NeighborhoodsEditorialOverlay.tsx` — conditional render using editorial-templates + `eventsTonightCount` threshold. Literal strings locked in Revisions § 12.
5. Create `web/components/neighborhoods/NeighborhoodsMapMode.tsx` — mode filter pill with URL state or lifted state (decide in code review). **Only if Phase 0 confirmed paint-expression feasibility.**
6. Create `web/components/neighborhoods/NeighborhoodHeroStyle.ts` — `getNeighborhoodHeroStyle(color, heroImage?)` helper. Single source of truth for gradient + photo layer composition; used by both server render and `SmartImage` fallback to prevent duplication.

**Phase 2 → Phase 3 gate (composite-atoms checkpoint per `feedback_composite_with_siblings.md`):** Before starting the page rebuild, render the new atoms at page-representative density — 12 `NeighborhoodIndexCard` in the grid, 8 `ScheduleRow` in a section — and screenshot against the comp. Fidelity-to-atom ≠ fitness-for-context. Catch sizing/spacing drift here, not after Phase 3 lands.

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
   - NEARBY chip row spec (lock these to prevent drift):
     - chip = 7px color dot + name + `rounded-full` border
     - border color: `border border-[var(--twilight)]` (NOT color-tinted)
     - row overflow: horizontal scroll (`overflow-x-auto scrollbar-hide`), NO `mask-fade-x` (violates anti-pattern)
     - max visible: 5 chips on desktop, 3 on mobile; remainder reachable via scroll
     - kill the existing color-tinted `Link` card pattern entirely
5. **API route cache directive** — `/api/neighborhoods/events` — add `export const revalidate = 120`
6. **Server bucketing × tab state**: `bucketEvents` runs server-side. PLACES tab still pays for the event fetch even when user never activates it. **Choose one:**
   - (a) Accept the cost as-is (events are already fetched for EVENTS tab, so the waste is only the bucketing CPU — negligible). Default recommendation.
   - (b) Lazy-load events only when `?tab=events` is active via `useSWR` or similar. More complex; only worth it if events fetch is measurably slow.
   Decide in code review based on observed timing.

### Phase 4 — Verification
1. `npm run lint` clean
2. `npx tsc --noEmit` clean
3. `npx vitest run lib/neighborhoods` passes (bucket + loaders)
4. `/design-handoff verify` against `0xWTr` + `WxF6c` on desktop; `dlvfh` + `Zqxgk` on mobile
5. Manual browser QA: `/atlanta/neighborhoods`, `/atlanta/neighborhoods/midtown`, `/atlanta/neighborhoods/old-fourth-ward`, at 1440×900 and 375×812. Check empty state: navigate to a neighborhood with **zero tonight events AND zero week events** (end-to-end empty bucket), verify overlay renders nothing and the TONIGHT/THIS WEEKEND/NEXT WEEK sections degrade gracefully.
6. Portal smoke: if FORTH has neighborhoods routing enabled, load `/forth/neighborhoods/midtown` and confirm event scoping via DevTools Network tab.
7. **Lighthouse LCP spot-check** on `/atlanta/neighborhoods` — hero `SmartImage` + map is LCP-sensitive. Baseline before rebuild, compare after.
8. **Console check**: zero new errors or warnings introduced during portal-scoped fetches. Distinguish from pre-existing `HangFeedSection`/`server-feed.ts` noise (tracked separately).

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

Resolved during review — remaining unknowns:

1. **Tab URL state** — `?tab=events|places` via `window.history.replaceState` (per web/CLAUDE.md client-side filter pattern, no router.push). Confirm this is the right pattern for tab state.

Previously open, now closed:
- ~~Mode filter pill feasibility~~ → **Phase 0 BLOCK**; resolve before coding, not during
- ~~ScheduleRow location~~ → `components/shared/` per architect-review (avoid circular-import risk)
- ~~Hero image coverage threshold~~ → No threshold. Gradient is designed base; photos layer on top. Per product-designer.

---

## Acceptance Gate

Before merge:
- [ ] `product-designer` returns **PASS** (not just PASS-WITH-NOTES) after reviewing the shipped pages at both viewports
- [ ] `/design-handoff verify` passes for all four comps (`0xWTr`, `dlvfh`, `WxF6c`, `Zqxgk`)
- [ ] Portal isolation test green (fixture: 3 A + 2 B + 1 null, A-scope returns 4, B-scope returns 3)
- [ ] Bucket-events tests green (DST spring-forward, fall-back, Fri 5pm weekend boundary, week rollover)
- [ ] Composite-atoms checkpoint passed before Phase 3 started (12-card grid + 8-row schedule section vs comp)
- [ ] `npm run lint` + `npx tsc --noEmit` clean
- [ ] Lighthouse LCP on `/atlanta/neighborhoods` is within 10% of pre-rebuild baseline (or improved)
- [ ] Manual QA in browser at 1440 + 375, zero console errors or warnings introduced (distinguish from pre-existing noise)
- [ ] Empty-bucket neighborhood E2E verified (zero tonight AND zero week events — page degrades gracefully, no phantom overlay)
- [ ] No new anti-patterns from the design-truth gallery shipped (glassmorphism, mask-fade-x, count-badges-as-headers, etc.)
