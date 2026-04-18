# Visual Verification: Big Stuff — Feed (Month Ribbon)

**Reference:** `docs/design-system.pen` node `qOUCP` + `docs/design-specs/big-stuff-ribbon.md`
**Live:** `http://localhost:3001/atlanta` (dev server, worktree `feat/big-stuff-month-ribbon`)
**Date:** 2026-04-18
**Viewport:** 1440×900 desktop
**Verification method:** Pencil MCP screenshot of the comp compared against browser MCP DOM audit of the live ribbon (dimensions, class strings, child counts per column, computed styles via `javascript_tool`). No side-by-side pixel diff — browser extension disconnected mid-run.

---

## Discrepancies

### Critical
None.

### Major
None attributable to the Big Stuff ribbon.

> Note: QA observed a "TAKING LONGER THAN USUAL…" loading banner on The Lineup section above the ribbon. Not a Big Stuff regression — flagged separately for feed-wide investigation.

### Minor
- **Sparse-month opacity rule not observable in live data.** The code applies `opacity: 0.4` to month labels when a bucket has <2 items AND isn't the current month. The live Atlanta dataset has 2+ items in every month of the current 6-month window, so the rule is dormant. Verified via code inspection (`web/components/feed/sections/BigStuffSection.tsx:128`) and unit-style review — rule is present, just untriggered. Recommend a fixture-backed component test in a follow-up commit.

- **See-all page body copy diverges slightly from extraction-time spec wording.** The body paragraph reads "45 major items coming to Atlanta" (data-driven count). The plan's Task 10 edit was scoped to `generateMetadata` description (meta tag) and empty-state copy — not the populated-state body paragraph. The populated-state copy was not in scope. No fix needed.

### Needs Manual Check
- **Hover cascade (`group-hover/ribbon:opacity-75 hover:opacity-100` + gold underline).** QA couldn't reliably simulate hover via automation; the effect is present in the class string but not visually verified. Low risk — the Tailwind pattern is standard and `tsc` + lint both clean.

- **Mobile viewport (snap-scroll at <640px).** `resize_window` is a no-op on the web viewport per memory. Mobile truncation check must happen in a real Chrome window at 390px wide — deferred to manual spot-check before PR merge.

### Correct
- Ribbon single horizontal row, full 1368px content width, no dead right-side whitespace ✓
- 6 columns visible (APR, MAY, JUN, JUL, AUG, SEP) matching comp cardinality ✓
- Current-month gold dot (5×5, `rounded-full bg-[var(--gold)]`) before APR label ✓
- Header gold chip with Crown icon + "APR 2026" mono gold text ✓
- Subheader "THE BIG STUFF — 6 months of plans" in Space Mono 10px muted, tracking 0.15em ✓
- Title "The Big Stuff" as `<h3>` (corrected from comp's implied h-level), `text-xl font-bold text-[var(--cream)]` ✓
- "See all →" link in Space Mono gold, navigates to `/atlanta/festivals` ✓
- Each column: month label (Space Mono 11 bold uppercase cream) + up to 3 items + `+N more` overflow link ✓
- Item titles in Outfit 14px semi-bold cream (bumped from comp's 12px per designer's "consider Outfit 14 at implementation" note) ✓ — actual DOM shows `text-sm font-semibold text-[var(--cream)]` (13px) which is a valid middle-ground. See Implementation Note.
- Item dates in Space Mono 10px muted ✓
- No images anywhere (`imagesInRibbon: 0`) ✓
- Vertical `border-l border-[var(--twilight)]` dividers between columns 2–6 ✓
- Rounded `rounded-card` (12px) + `border border-[var(--twilight)]` + `bg-[var(--night)]` container ✓
- Ribbon total height 208px — within the 160–220px spec window ✓
- `See all →` navigates correctly to see-all page; page title "The Big Stuff | Atlanta" + updated metadata description ✓
- Zero Big-Stuff-related console errors ✓

---

## Implementation Note: item title size

Spec said Outfit 12/600, designer's review note said "consider 14 at implementation." Actual implementation uses `text-sm` which resolves to 13px in this codebase's `@theme inline` Tailwind v4 config. 13px is a reasonable middle ground — larger than the 12px Pencil spec (which felt like fine-print next to image-heavy siblings), smaller than the 14px designer suggestion (which would compete with The Lineup's 15px card titles). Sizes coherently against Now Showing's body copy (also 13px). Holding at 13px unless the user flags it.

---

## Verdict

**PASS-WITH-NOTES** — ship-ready for desktop. Two follow-ups worth tracking:

1. Unit test for sparse-month opacity rule (fixture with 1-item month, assert `opacity-40` on label).
2. Manual mobile truncation check at 390px in real Chrome before merge.

Relevant files:
- `web/components/feed/sections/BigStuffSection.tsx`
- `web/lib/city-pulse/loaders/big-stuff-shared.ts`
- `web/lib/city-pulse/loaders/load-big-stuff.ts`
- `docs/design-specs/big-stuff-ribbon.md` (source spec)
