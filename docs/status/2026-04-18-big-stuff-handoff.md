# Big Stuff Workstream — Handoff

**Last updated:** 2026-04-18 (late evening)
**Purpose:** Fresh-context pickup for this workstream.

## Elevator pitch

Two connected pieces rebuilt today: the **Big Stuff feed block** on `/atlanta` (the low-profile "6 months of plans" marker) and the **Big Stuff see-all page** at `/atlanta/festivals` (the richer calendar/timeline people land on from the "See all →" link). Both emerged from an `/elevate` pass that diagnosed the old carousel as "janky," ran multi-lens audit (design + strategy + architecture), Pencil-designed both surfaces, and shipped them through plan → subagent-driven implementation → verify → merge.

Consumer-facing URL: https://lostcity.ai/atlanta (ribbon) and https://lostcity.ai/atlanta/festivals (page).

---

## Shipped

### PR #58 — `feat(feed): rebuild Big Stuff as compact month ribbon`
Merged 2026-04-18.

- Replaces the 4-card `FestivalsSection` carousel with `BigStuffSection` — a typographic month ribbon showing ~3–6 dynamic columns of upcoming festivals + tentpole events.
- Forward-looking only (`start_date > today`), `announced_2026 = true` gate on festivals, 6-month ceiling.
- Pencil comp: `docs/design-system.pen` node **`qOUCP`**.
- Key files:
  - `web/components/feed/sections/BigStuffSection.tsx` (new)
  - `web/lib/city-pulse/loaders/big-stuff-shared.ts` (new — pure grouping + types, client-safe)
  - `web/lib/city-pulse/loaders/load-big-stuff.ts` (new — server loader)
  - `web/lib/city-pulse/manifests/atlanta.tsx` (swap)
- Deleted: old `FestivalsSection.tsx`, dead `WhatsHappeningSection.tsx`.
- Tests: 7 unit (`load-big-stuff.test.ts`) + 3 component (`BigStuffSection.test.tsx`).

### PR #69 — `feat(festivals): rebuild Big Stuff see-all as calendar + hero page`
Merged 2026-04-18.

- Rewrites `/[portal]/festivals` into a calendar-spined browse page.
- Architecture: server component loads data via `loadBigStuffForPage`, client island `<BigStuffPage>` owns filter state + scroll. Collapsed-sticky month ribbon (`min-h-[44px]` mobile touch target / `h-8` desktop) with IntersectionObserver-tracked active month.
- 5-bucket type taxonomy: `festival` (gold), `convention` (vibe), `sports` (neon-cyan), `community` (neon-green), `other` (muted). 2px left-border accents + type pills on cards.
- Tier-driven: within each month, items sort `isLiveNow → tier(hero|featured|standard) → startDate`; top item = hero card (21:9 image + title + date + teaser), rest = compact rows (72×72 thumb + title + meta + type pill).
- Filter chips: tablist, client-side, no URL state. Chips with count < 2 hidden. Empty-after-filter months hide their ribbon pills and body sections.
- Happening-now events: folded into current month with `LIVE NOW` red pill (no separate section).
- Pencil comp: `YynKd` (main) + `6JK5d` (collapsed strip preview).
- Key files:
  - `web/components/festivals/*` — BigStuffPage, BigStuffRibbon, BigStuffCollapsedStrip, BigStuffMonthSection, BigStuffHeroCard, BigStuffRow, BigStuffFilterChips, useActiveMonth
  - `web/lib/big-stuff/{types,type-derivation}.ts` — type taxonomy + derivation
  - `web/lib/teaser.ts` — first-sentence teaser helper
  - `web/lib/city-pulse/loaders/load-big-stuff-page.ts` — server loader with in-progress inclusion
  - `web/app/[portal]/festivals/page.tsx` — rewritten
- Drive-by: `web/app/api/image-proxy/route.ts` now sends browser UA + same-origin Referer (fixes WP/imgix hotlink 403s) and infers Content-Type from URL extension when upstream omits it (fixes old-Apache 415s). Measured: 3/4 sample hero images load cleanly after fix (was 0/4).
- Tests: 55 new (7 teaser + 14 type-derivation + 12 loader + 6 filter chips + 9 cards + 7 misc). Clean tsc + lint.

### Documentation landed
- `docs/design-truth.md` — product spirit + anti-pattern gallery (pre-existing, both PRs cite it).
- `docs/superpowers/specs/2026-04-18-big-stuff-page-redesign.md` — spec.
- `docs/superpowers/plans/2026-04-18-big-stuff-month-ribbon.md` — feed ribbon plan.
- `docs/superpowers/plans/2026-04-18-big-stuff-page-redesign.md` — see-all page plan.
- `docs/design-specs/big-stuff-ribbon.md` + `docs/design-specs/big-stuff-page.md` — extracted Pencil specs.
- `docs/design-specs/verify/big-stuff-ribbon-2026-04-18.md` + `docs/design-specs/verify/big-stuff-page-2026-04-18.md` — verify reports.

---

## Open items (deferred, not blocked)

### 1. Manual mobile check at 390px for PR #69
Why it's not automated: `mcp__claude-in-chrome__resize_window` is a no-op on the web viewport — only resizes the macOS window frame. `window.innerWidth` stays at desktop. Any "mobile" screenshot via MCP is captured desktop-rendered at a smaller window — worthless.

Required manual pass: open Chrome DevTools → iPhone 12 (390×844) → `/atlanta/festivals`. Verify:
- Full ribbon snap-scrolls, 3 months visible at ~110px.
- Collapsed strip is `min-h-[44px]` touch target.
- Hero card image switches to 16:9.
- Compact row thumb 56×56, type pill wraps below meta.
- Filter chips horizontal-scroll.
- **No mid-word title truncation** — this is the only hard-block item (anti-pattern gallery rule). If any title like "Juneteenth Atlanta Parade & Music Festival" breaks mid-word, file a fix-PR.

### 2. Crawler data-quality pass
User explicitly deferred. Scope:
- **Broken hero image URLs.** Some crawler-stored URLs now 404 upstream (e.g., `atlantastreetsalive.com/wp-content/uploads/2024/08/...`). Re-verify + re-capture.
- **Richer descriptions.** Hero teaser coverage: festivals 100%, tentpoles 71%. Improving the 29% of tentpoles without descriptions makes more hero cards fire their teaser block.
- **More events.** Broader event capture for the 6-month forward window.
- **FIFA World Cup match dedup.** 8+ individual match events compete for June/July ribbon slots. Needs crawler-level collapse under one "FIFA World Cup 26" tentpole + a program view.
- **Atlanta Caribbean Carnival™ dedup.** Two near-identical rows from different crawl passes.
- `announced_2026` field rename when 2027 horizon lands.

### 3. Worktree cleanup
Worktree at `.claude/worktrees/big-stuff-ribbon` is still on the merged branch `feat/big-stuff-page-redesign` locally. Remote branch deleted. Harmless but can be cleaned up via `git worktree remove .claude/worktrees/big-stuff-ribbon` from the main repo, or via `ExitWorktree` tool in a session that's currently inside it.

---

## Gotchas a fresh session should know

- **Pencil MCP state is session-local.** If you open `design-system.pen` in a fresh session, the Pencil MCP may not surface the comps created in this session (they persist to disk but the MCP server's in-memory state resets). Use `mcp__pencil__batch_get` to confirm what's actually in the file. Nodes of interest: `qOUCP` (feed ribbon), `YynKd` (see-all page main), `6JK5d` (see-all page collapsed strip).
- **`resize_window` is a no-op** on the web viewport — only resizes the macOS window. Mobile verification must be manual. Memory: `feedback_mcp_browser_hidden_tab.md`.
- **Screenshot resolution is ~512px wide** regardless of input. Small-typography comps (<14px) render sub-pixel and appear blank. Either design large or trust the tree.
- **Browser memory budget: 16GB + 0 swap.** `qa`, `product-designer`, `/design-handoff verify`, `/design`, `/motion audit` are all browser-using processes — run ONE at a time. Pre-flight `vm_stat` check, abort if <200MB free. Memory: `feedback_browser_memory_budget.md` + `feedback_no_parallel_browser_subagents.md`.
- **`groupItemsByMonth` cap param.** `web/lib/city-pulse/loaders/big-stuff-shared.ts` has an optional `maxPerMonth` (default 3). The feed ribbon uses the default; the see-all page passes `Number.POSITIVE_INFINITY` to show all items in a month.
- **Image proxy hosts that still 502:** some sites gate by IP (CDN hotlink rules, not just UA). Proxy fixes landed today help most but not all. Dead upstream URLs return upstream 404 → proxy 502 — not a proxy bug, a crawler data bug.
- **Tailwind v4 arbitrary value trap:** never `text-[var(--text-xs)]`. Use `text-xs`, `text-sm`, `text-2xs` (10px custom utility). `text-[10px]` and `text-[var(--*)]` forms produce `color:` rules instead of `font-size:`. Memory lives in `web/CLAUDE.md`.
- **`announced_2026` gate** on festivals — this is the "confirmed" flag. Festivals without it are historical-pattern data; Big Stuff queries exclude them.

---

## Decision log

Key decisions made during brainstorm/review that are non-obvious from the code:

- **Option A (month ribbon) over Option B (editorial lede + list) over Option C (horizontal poster rail)** — chose the tightest marker-like form for the feed. For the see-all page, the month-ribbon-up-top + scroll-body pattern scales the feed's visual vocabulary.
- **Data window is permissive** on the feed ribbon ("happening now OK, Lineup will have other events" — user's call). The see-all page extends this with explicit `LIVE NOW` pill treatment for in-progress events.
- **Tier rule is data-driven, no separate "marquee" concept** — within a month, items sort by `isLiveNow → card_tier → startDate`; top item gets the hero treatment. No manual `is_marquee` boolean.
- **Filter chips are single-select, no URL state** — URL-shareable filter state is not a common-enough flow to justify.
- **Type pill + color accent** over type pill alone — 2px left-border keyed to type accent for glanceable sorting. Design-truth `find-row-card` pattern precedent.
- **Custom header in `BigStuffSection`** (not shared `FeedSectionHeader`) — the secondary-priority header renders badge text inline; we needed the gold chip + Crown + "APR 2026" as a standalone element. Designer-review mandate.
- **`hover:!opacity-100` with `!important`** on the ribbon item hover cascade — specificity math dictates it. An earlier review mistakenly advised removing it; the final review restored it. Don't remove it again.
- **Chip minCount rule (hide <2)** — designer review #1 on PR #69. Sparse-count chips aren't useful filters.
- **Collapsed strip is 44px on mobile, 32px desktop** — touch target rule. Designer review catch.
- **Spec extracted Pencil comps → `docs/design-specs/*.md`** + verify reports → `docs/design-specs/verify/*.md`. This is the design-handoff contract; implementers read from these, not from Pencil directly.

---

## What to run on pickup

If the fresh session wants to continue this workstream:

1. **Start the dev server from the worktree:**
   ```bash
   cd /Users/coach/Projects/LostCity/.claude/worktrees/big-stuff-ribbon/web
   PORT=3001 npm run dev
   ```
   (Port 3000 may be occupied by the main-repo dev server. Start on 3001 to avoid collision.)

2. **Navigate:** `http://localhost:3001/atlanta` for the feed, `http://localhost:3001/atlanta/festivals` for the see-all page.

3. **To pick up the mobile check:** Chrome DevTools → iPhone 12 → observe both URLs.

4. **To pick up the crawler data-quality pass:** fresh brainstorm per the deferred-items scope above. Not a continuation of this workstream — a new spec/plan.

5. **To clean up the worktree:** from a session NOT in this worktree, `git worktree remove /Users/coach/Projects/LostCity/.claude/worktrees/big-stuff-ribbon`. Or `ExitWorktree --action remove --discard_changes true` if there's any lingering state.
