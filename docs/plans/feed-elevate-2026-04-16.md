# Atlanta Feed Elevate Plan — 2026-04-16

Four-wave rebuild of the Atlanta Discover feed. Supersedes `docs/feed-audit-2026-04-16.md` (which is now rolled into Wave A/B) and integrates the multi-lens audit (architecture / data / performance / design).

## Approved decisions

- **Scope**: all four waves.
- **Feed block prefs system**: delete. The `FeedBlockId` enum, `DEFAULT_FEED_ORDER`, `feedLayout.hidden_blocks` / `visible_blocks`, and related prefs UI are vestigial — every meaningful section hard-codes through JSX. Remove the lie.
- **News ("Today in Atlanta")**: keep as Section 2 (after hero, before Lineup).
- **Hero chips**: convert to pre-filtered `/atlanta/explore` shortcuts (not section anchors, not category filters).
- **Motion**: per-section personality, integrated into each wave as a gate, not a final polish pass. GPU-only transforms, `prefers-reduced-motion` respected, <8 KB gzip budget.

## Non-goals (explicitly out of scope)

- Now Showing cinema data model rebuild (tracked in screening-primary project).
- Aisle 5 crawler title parsing (separate crawler issue from prior audit).
- Personalization or recommendations (feed is an access layer, not a rec engine).
- Cross-portal feed (this is Atlanta only).

---

## Wave A — Data layer fixes (unblocks everything)

Low risk, high credibility impact. Do first so the Lineup sort in Wave B operates on clean data.

| # | Task | Owner | Files |
|---|------|-------|-------|
| A1 | Refresh `feed_category_counts` materialized table; repair scheduled refresh job so the hero chip counts stop serving March 27 data | crawler-dev / data-specialist | `crawlers/` pg_cron or Edge Function job; `web/lib/city-pulse/pipeline/fetch-counts.ts` consumer |
| A2 | Add `fitness` to category exclusion list (currently excludes `wellness`, `exercise` but not `fitness`) | full-stack-dev | `web/lib/city-pulse/pipeline/fetch-events.ts:400` |
| A3 | Exclude library programming sources (302 Gwinnett, 303 Cobb) from Lineup, or tag `is_class=true` on those rows | crawler-dev | pipeline config + source records |
| A4 | Merge duplicate place: `Atlanta Film Festival 2026` (id 6589) → `Atlanta Film Festival` (id 200); fix upstream crawler dedup for annual festivals | crawler-dev | `crawlers/dedupe.py` |
| A5 | Merge duplicate news sources: Rough Draft Atlanta (1 + 39), Atlanta Voice (25 + 40); add unique constraint on `network_posts(source_id, url)` | crawler-dev | DB migration + source records |
| A6 | Fix "Heavy Steppin Tour" image mismatch from prior audit (P0 #1) | data-specialist | event row in DB |
| A7 | Delete stale past festivals or mark inactive (10 rows with `announced_end < today`) | data-specialist | `festivals` table |

**Verification gate (Wave A done when):**
- Hero chip counts reflect today's DB state (music count within ±10% of actual).
- Tonight's Lineup "All" view contains zero fitness classes and zero library programming.
- `Atlanta Film Festival` renders as a single theater card in Now Showing.
- News duplication rate <5% (down from 43%).

---

## Wave B — Lineup sort + card fallback + Lineup motion

The single biggest user-facing win. A first-time user's test of the page happens in The Lineup within two scrolls.

### B1. Lineup "All" default view sort rebuild

**Problem**: chronological or unrelevant sort puts 11am library class above 7pm $36 show.

**Spec**:
- Score each event by: `importance_weight` (flagship=100, major=50, standard=10) + `time_of_day_relevance` (within next 4h = +30, next 8h = +15, later today = 0) + `ticket_signal` (has_price = +10) + `image_signal` (has_image = +10) + `venue_weight` (editorial_mentions count × 5, cap +25) + `friends_going` (if auth) × 5.
- Cap individual events per category (max 3 "theater" before other categories get a turn) to avoid category domination.
- Time-of-day rule: between 3pm and midnight local, events starting before 3pm sort after events starting after 5pm regardless of raw score.

**Files**: new `web/lib/city-pulse/lineup-ranking.ts`; wire into `fetch-events.ts` or consumer.

### B2. Missing-image fallback treatment

**Problem**: empty `image_url` renders a black box.

**Spec**: Replace with a category-colored background + category icon at 40% opacity + event title as the visual. Use existing CategoryIcon + category color tokens. Same treatment across all card components in the feed.

**Files**: `web/components/EventCard.tsx`, `web/components/feed/StandardRow.tsx`, `web/components/feed/CompactEventRow.tsx`.

### B3. Scroll-reveal mobile blank-gap fix

**Problem**: aggressive IntersectionObserver thresholds cause viewport-height blank gaps between Lineup cards on mobile.

**Spec**: `rootMargin` changes from `-200px` → `-50px`; `once: true`; switch entrance from translate-Y 40px → opacity-only fade with 6px translate max.

**Files**: `web/components/feed/FeedSectionReveal.tsx`, `LazySection.tsx` if it owns entrance reveals.

### B4. Lineup motion design

**Personality**: Focused, rhythmic.

**Spec (must be produced as motion doc before implementation)**:
- Tab switch (`Today` / `This Week` / `Coming Up`): 180ms cross-fade + 6px y-offset. Uses View Transitions API if available; CSS fallback.
- Category chip filter: remaining cards stagger in at 40ms apart, max 8 cards animated (rest just swap). Opacity + 4px y-offset.
- Hero-tier card: one-shot ken-burns on image (scale 1.0 → 1.04 over 8s on mount, not loop).
- Card hover: image brightness +8%, y-translate -2px, 200ms ease. CSS only.
- Kill the per-card scroll reveal stagger (B3 fix).

**Implementation**: full-stack-dev after motion spec review.

### B5. Festivals + Live Music motion polish

**Festivals personality**: Cinematic, poster-weight.
- Hover tilt on poster card: 3deg max, 200ms ease. CSS only.
- "Happening Now" badge: slow opacity pulse (0.7 → 1 → 0.7 over 3s, infinite).
- Snap-scroll with overshoot-resist feel (CSS scroll-snap + momentum already in place; just verify).
- Fix raw `<img>` → `SmartImage` in `FestivalsSection.tsx:187-201`.

**Live Music personality**: Amplified.
- Tonight carousel card hover: neon glow sweep (CSS animation on ::after pseudo-element), only on hovered card.
- Genre chip active state: color bleed transition 250ms.

**Verification gate (Wave B done when):**
- First 6 Lineup cards in "All/Today" at 6pm are all evening ticketed events or strongly-imaged daytime.
- No black missing-image boxes anywhere in the feed.
- Mobile Lineup scrolls without viewport-height gaps.
- Motion audit pass on Lineup + Festivals + Live Music sections (no layout thrash, GPU-only, `prefers-reduced-motion` respected).

---

## Wave C — Architecture rebuild

The shell has been abandoned by its authors (the "hard-coded so users cannot hide or reorder" comments are the tell). Porting to a real section contract + moving client boundaries down enables Wave D polish to be faster and future sections to be cheaper.

### C1. Section contract + registry

Define:

```ts
interface FeedSection {
  id: string;
  component: ComponentType<FeedSectionProps>;
  renderMode: 'server' | 'client-island';
  required: boolean; // cannot be hidden
  loader?: (portalSlug: string) => Promise<unknown>;
  placeholder?: ComponentType;
}

const ATLANTA_FEED_MANIFEST: FeedSection[] = [ /* ordered */ ];
```

New file `web/lib/city-pulse/feed-manifest.ts`. Port each section to conform.

### C2. Split CityPulseShell into server orchestrator + client islands

- New `CityPulseServerShell.tsx` (RSC) iterates manifest, renders server sections inline, client sections as islands with server-prefetched props.
- Interactive sections become client islands:
  - `LineupSection` (tab switching, filter chips)
  - `LiveMusicSection` genre chip strip
  - `NowShowingSection` carousel
  - `TodayInAtlantaSection` category tabs (could be Server Actions + navigation; preferred simpler)
- Static sections render as RSC:
  - `FestivalsSection` (read-only)
  - `RegularHangsSection` 
  - `PlacesToGoSection`
  - Hero's non-interactive shell (time/date/weather)

### C3. Delete feed block prefs system

Remove: `DEFAULT_FEED_ORDER`, `ALWAYS_VISIBLE_BLOCKS`, `FIXED_LAST_BLOCKS`, `feedLayout.hidden_blocks`, `feedLayout.visible_blocks`, `useFeedPreferences` block ordering logic, the prefs UI that sets them, migration helpers for legacy block ids. Keep `savedInterests` (that's category personalization, separate concern).

DB: the `user_feed_preferences` table's `hidden_blocks` / `visible_blocks` columns can be dropped in a follow-up migration; leave in place for now, stop writing to them.

### C4. Remove redundant/speculative fetches

- Delete `fetchTab("this_week")` + `fetchTab("coming_up")` speculative prefetch (`useCityPulseFeed.ts:148-163`). Let on-click tab switch own it with `keepPreviousData`.
- Delete `useEffect` prefetches in `CityPulseShell.tsx:268-288` (regulars) and `:292-319` (network-feed). Sections already own these fetches and React Query dedupes.
- Estimated savings: ~200 KB / session + 2 redundant round-trips.

### C5. Extract Yonder + community branches

- Yonder sections (CityPulseShell.tsx:584) → their own template/shell. Yonder should not be a branch inside Atlanta's shell.
- `InterestChannelsSection` (civic-only, line 577) → move into CivicFeedShell.

### C6. Hero chips → pre-filtered Find shortcuts

Change chip hrefs from whatever they currently do to `buildExploreUrl({ portalSlug, lane: "events", ...preset })`. Preset per chip:

- Live Music → `categories: "music"` + `date: "today"`
- Going Out → `categories: "nightlife,food_drink,music,comedy"` + `date: "tonight"`
- Comedy → `categories: "comedy"` + `date: "today"`
- Late Night Eats → `categories: "food_drink"` + `date: "today"` + `open_after: "22:00"` (if supported) OR drop this chip if time-of-day filtering isn't in explore
- This Weekend → `date: "this_weekend"`

Remove Live Music from this strip if it duplicates Lineup category coverage — verify with design.

### C7. News + Festivals ports to RSC + SmartImage

Alongside C2:
- `TodayInAtlantaSection` → RSC shell + small client island for tab state (or URL-state via `searchParams`).
- `FestivalsSection` → RSC fetch + replace raw `<img>` with `SmartImage` (carries into Wave B visual polish).

**Verification gate (Wave C done when):**
- `npx tsc --noEmit` clean.
- Feed TTFB at or below current; hydration JS budget down by ~30% (measure with lighthouse before/after).
- No `if (portalSlug === "yonder")` or `vertical === "community"` branches in CityPulseShell.
- Section count in manifest matches rendered sections on `/atlanta`.
- Atlanta feed visually unchanged post-rebuild except improvements from B.

---

## Wave D — Polish + motion across remaining sections

Final coherence pass. Everything here depends on C being done; motion specs for remaining sections can be produced during C.

### D1. Per-section motion (remaining 5)

| Section | Personality | Motion |
|---|---|---|
| CityBriefing hero | Atmospheric, alive | Subtle skyline parallax (already?), live pulse on LIVE badge, time-of-day color wash over 30s, chip hover = glow bloom (no scale) |
| News | Wire-service, ticker | Category tab panel slide, headlines 1-line slide-up on switch, no scroll-entrance (immediate) |
| Now Showing | Marquee, filmic | Theater poster-stack riffle on hover (z-rotate 2deg each), showtime chips tick in when section enters viewport (once) |
| Regular Hangs | Steady | Soft fade in only |
| Places to Go | Curated, slow | Image crossfade on card hover (primary → secondary), neighborhood tag slide |

### D2. News + grid fixes from prior audit

- Now Showing grid: shrink to 3-col OR use an auto-fit grid so theater cards don't leave 25% dead space.
- Places to Go grid: same — auto-fit or CTA slot to fill the empty 12th cell.
- News mobile: add horizontal scroll-indicator fade on the 8-tab category strip.

### D3. "Show N more events" CTA treatment

Current coral text is underpowered. Promote to a bordered button or a more prominent inline trigger. Match system.

### D4. Hero "54 LIVE" badge

Prior audit flagged `# 38 LIVE` looking like raw markdown. Replace prefix with a dot glyph (●) or drop prefix entirely.

### D5. Global motion audit

Run `/motion audit /atlanta` across the full page. Check:
- No simultaneous continuous animations in the same viewport.
- All entrances honor `prefers-reduced-motion`.
- No layout thrash (all transforms on `transform` / `opacity`).
- JS motion budget <8 KB gzip.

**Verification gate (Wave D done when):**
- `/motion audit` returns clean across all sections.
- Desktop and mobile walkthroughs feel coherent — each section has personality but the whole feels like one product.
- QA pass: the friend test (see Phase 2) returns "yes, I'd recommend this."

---

## Execution notes

- **Wave A is parallel-safe** across agents (each task hits different files/crawlers). Dispatch A1–A7 in a batch.
- **Wave B B1 (sort) and B2 (fallback) are independent** — dispatch in parallel. B3, B4, B5 need motion specs first.
- **Wave C must be sequential** — section contract first (C1), then shell split (C2), then deletions (C3/C4/C5), then hero chips (C6), then RSC ports (C7).
- **Wave D motion work can run in parallel** per section, but only ONE browser-using subagent at a time for verification (qa, product-designer, `/design-handoff verify`, `/motion audit`). Never stack.
- **Design handoff**: where Pencil comps exist for a section, use `/design-handoff extract` → spec → implement → `/design-handoff verify`. Don't "extract from existing code."
- **Type verification before each wave**: read the actual shipped `*/types.ts` files before writing code blocks for agent tasks.

## Gates summary (do not skip)

| Wave | Gate |
|---|---|
| A | Data counts true; no fitness/library noise in Lineup; news dedup fixed |
| B | Lineup sort + fallbacks + motion specs implemented & audited |
| C | `tsc --noEmit` clean; bundle smaller; visual parity + improvements; no vertical branches |
| D | `/motion audit` clean; friend-test pass |

## References

- Prior feed audit: `docs/feed-audit-2026-04-16.md`
- Multi-lens audit (this session): conversation with audit tool outputs from architect-review, data-specialist, performance-engineer, product-designer
- Quality bar: `docs/quality-bar.md`
- Portal surfaces contract: `docs/portal-surfaces-contract.md`
- Design + motion in plans standard: `.claude/projects/-Users-coach-Projects-LostCity/memory/feedback_design_motion_in_plans.md`
