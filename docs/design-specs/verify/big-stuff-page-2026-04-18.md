# Visual Verification: Big Stuff — See-All Page

**Reference:** `docs/design-specs/big-stuff-page.md` + Pencil node `YynKd`
**Live:** `http://localhost:3001/atlanta/festivals` (dev server, worktree `feat/big-stuff-page-redesign`)
**Date:** 2026-04-18
**Viewport:** 1440×900 desktop
**Verification method:** qa browser audit (DOM measurements + 3 screenshots) + live HTML inspection for structural conformance. Mobile verification deferred to manual Chrome DevTools pass (`resize_window` is a no-op per `feedback_mcp_browser_hidden_tab.md`).

---

## Discrepancies

### Critical
None.

### Major
**Hero card images don't load for some festivals** — partially mitigated.

Root cause: heterogeneous. Three distinct failure modes observed:
1. **Upstream UA / hotlink rejection (fixed this workstream):** WP/imgix hosts that blocked `LostCityImageProxy/1.0`. Fix: browser User-Agent + same-origin Referer.
2. **Upstream Content-Type missing (fixed this workstream):** Old Apache/WordPress hosts return 200 + image bytes but no `Content-Type` header. Fix: ext→MIME inference when upstream omits it.
3. **Dead URLs in the database (not fixed):** Some crawler-stored URLs now 404 upstream (e.g., `atlantastreetsalive.com` 2024 banner has been moved/deleted). This is a crawler data quality concern, already flagged by user for a follow-up pass.

Sample after fix (3/4 test URLs load):
- festival.inmanpark.org → 200 ✓
- www.atlantamotorspeedway.com → 200 ✓
- img1.wsimg.com → 200 ✓
- atlantastreetsalive.com → 502 (upstream 404, out of scope)

Production Vercel deployment may behave differently (different egress IP, different browser UA forwarding). Verify there before assuming local dev is representative.

### Minor
**None remaining.** The ~300px spacing gap between month sections was resolved in commit `9c023f17` (`mt-8 space-y-10` → `mt-6 space-y-6` on `BigStuffPage`, anchor `pt-4 mb-4` → `pt-6 mb-3` on `BigStuffMonthSection`).

### Needs Manual Check
**Mobile (<640px).** `resize_window` is a no-op on the web viewport. Required before merge:
1. Open Chrome DevTools → iPhone 12 (390×844).
2. Load `/atlanta/festivals`.
3. Verify:
   - Full ribbon: horizontal snap-scroll, 3 visible months at ~110px each.
   - Collapsed strip: `min-h-[44px]` (touch target), snap-scroll.
   - Hero card: `aspect-[16/9]` image, readable title.
   - Compact row: 56×56 thumb, type pill wraps below meta.
   - Filter chips: horizontal scroll strip.
   - No mid-word truncation on event titles.

If any of the above fails, file a follow-up; do not block merge unless mid-word truncation occurs (anti-pattern gallery hard block).

### Correct
- Page h1 "The Big Stuff" + subtitle mentioning "Atlanta" ✓
- Filter chip tablist: All · 50, Festivals · 20, Conventions · 9, Sports · 11, Community · 5 ✓
- Low-count chip suppression rule (none below threshold of 2 in live data) ✓
- Full month ribbon: 6 equal-width columns (APR–SEP), APR gold dot ✓
- Column "N EVENTS" counts update on filter change ✓
- Month anchor: "MMM YYYY" heading, border-t above ✓
- Hero card structure: 21:9 image placeholder, type-pill overlay, title, meta, teaser ✓
- Compact row: thumb 72×72 (desktop), title + meta + type pill right-aligned ✓
- Type color mapping: festival=gold, convention=vibe/purple, sports=neon-cyan, community=neon-green ✓
- Collapsed-sticky strip: pins on scroll, shows active month in gold with underline ✓
- Click a month pill (full or collapsed) → smooth scroll to section ✓
- Filter chip toggle: inactive click activates, active click resets to All ✓
- Ribbon pills for empty-after-filter months hide correctly ✓
- Zero console errors on the page ✓
- Data rendering: 50 events, real Atlanta festival + tentpole data ✓
- In-progress events with `LIVE NOW` pill (data: none in-progress today, not directly verified visually) ✓ (code path confirmed via unit tests)

---

## Verdict

**PASS-WITH-NOTES** — ship-ready for desktop.

Follow-ups tracked:
1. Manual mobile check at 390px in real Chrome DevTools before merge (this document + PR description).
2. Crawler data quality pass (re-verify image URLs, broaden description coverage, dedup FIFA matches, dedup Atlanta Caribbean Carnival) — separate workstream, user-confirmed deferred.

Relevant files:
- `web/components/festivals/*` (new page components)
- `web/lib/big-stuff/*` (types + derivation)
- `web/lib/teaser.ts`
- `web/lib/city-pulse/loaders/load-big-stuff-page.ts`
- `web/app/api/image-proxy/route.ts` (UA + Content-Type fixes)
- `web/app/[portal]/festivals/page.tsx` (rewritten)
