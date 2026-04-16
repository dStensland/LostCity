# Atlanta Feed Audit — 2026-04-16

Browser-based assessment of `lostcity.ai/atlanta` (production). Desktop viewport (1440×900). Mobile viewport could not be verified — see "Testing infrastructure" below.

Sections covered: Hero, Today in Atlanta, The Lineup, The Big Stuff, Now Showing, Live Music, Places to Go, Game Day.

---

## P0 — Ship blockers (data credibility)

### 1. Mismatched images in Live Music cards
**Where:** `LiveMusicSection` / `SeeShowsSection` — the Live Music carousel.
**Symptom:** "Heavy Steppin Tour" card shows an image containing "WEEKLY SCHEDULE / OPENING AT 5PM / MONDAY / FEBRUARY 2" — clearly a different event's poster bleeding into this card.
**Why it matters:** A single wrong image on the homepage destroys the "this is curated, trustworthy" feel that the cinematic design is buying. This is a data-layer issue, not a design one.
**Action:** Data diagnostic — find whether the image mismatch is at the crawler layer (wrong `image_url` on the event row), the cache layer, or the render layer (wrong event bound to the card). Crawler-dev + data-specialist.

### 2. Garbage event titles in list rows
**Where:** Live Music → "This Week at Atlanta Venues" → Aisle 5 row: `"Best Six Nachos Kids That Fly"`.
**Why it matters:** This reads as a parser failure (multiple event names concatenated with spaces, no delimiter). Makes the whole list feel broken.
**Action:** Data-specialist triage — identify source and pattern. Likely an Aisle 5 crawler that's flattening a multi-event listing into one title.

---

## P1 — Design/UX defects

### 3. Grid-shape mismatch with content count
**Now Showing:** 3 theater cards rendered in a 4-column grid → 25% dead space on the right.
**Places to Go:** 11 destination cards in a 4×3 grid → slot 12 is empty.
**Why it matters:** Visual imbalance signals "incomplete" even when the content is the intended set.
**Options:**
- Shrink the grid (3-col for Now Showing, auto-fit for Places to Go).
- Fill the missing slot with a CTA/teaser ("Explore all theaters →", "Browse all destinations →").
- Make the grid responsive to count, not fixed.
**Recommendation:** Option 2 — the empty cell becomes a meaningful destination prompt.

### 4. "# 38 LIVE" chip reads as raw markup
**Where:** Top-left of hero on feed homepage.
**Symptom:** The `#` prefix looks like unformatted markdown syntax, not decorative typography.
**Why it matters:** Reads broken. Unclear semantic — is it a count? A hashtag?
**Action:** Replace `#` with a dot indicator, or drop the symbol entirely ("38 LIVE" is self-explanatory), or use a glyph (`●`, `•`, `◉`) if a marker is desired.

### 5. Carousel edges clip with no scroll affordance
**Where:** Game Day, Live Music "Tonight" strip, Now Showing.
**Symptom:** Right-most card is sliced visually with no indicator that more cards exist or that the strip scrolls.
**Constraint:** `mask-fade-x` is ruled out per existing memory (obscures edge content).
**Options:**
- Subtle paginator dots below the strip.
- Right-aligned chevron hint that fades after first scroll.
- Snap-point outline on the first off-screen card's leading edge.
**Recommendation:** Chevron hint — lowest visual weight, tests well on touch + mouse.

### 6. Background grain/diagonal texture
**Where:** Every section (via global layer).
**Symptom:** Subtle diagonal noise/scratches visible on dark surfaces. Reads like film grain.
**Why it matters:** It's doing compositor work on every section for modest visual payoff. On detail pages with backdrop-blur stacking, it compounds GPU load.
**Action:** Quantify payoff. If it's intended cinematic texture, keep it but reduce opacity. If it's residual from an older style, remove. Check with the cinematic-minimalism decision doc.

### 7. Destination card subtitle inconsistency
**Where:** Places to Go — 11 cards, each with a unique subtitle.
**Examples:**
- "4 with events this week" ✓
- "48 new this month" ✓
- "Family-friendly: 1" ✗ (reads as debug output)
- "6 landmarks" ✓
- "2 acts tonight" ✓
- "1 show tonight" ✓

**Action:** Copy-pass on subtitle templates. Every subtitle should read like editorial metadata, not a label-value dump. "Family-friendly: 1" → "1 family-friendly spot" or drop the count entirely if it's always 1.

---

## P2 — Motion gaps

### 8. Section entrances are unchoreographed
**Symptom:** Sections below the fold appear instantly when scrolled into view — no stagger, no fade-up.
**Existing infra:** `fade-up`, `scale-in`, `content-reveal` keyframes exist in `globals.css` with stagger delay utilities (`.stagger-1` through `.stagger-10`). They're defined but not applied to feed sections.
**Action:** `/motion apply` pass on `CityPulseShell` section wrappers — attach `feed-section-enter` class + IntersectionObserver trigger (pattern already used in `TodayInAtlantaSection`). Keep it one-shot, don't re-trigger on scroll-back.

### 9. No scroll-indicator motion on carousels
Covered under #5 above.

---

## Testing infrastructure

### 10. `mcp__claude-in-chrome__resize_window` does not change the web viewport

**What I found:** Called `resize_window({width: 390, height: 844})`. Tool returned success. `window.innerWidth` remained `1440`. The macOS window frame resized but the web viewport did not.

**Impact:** Every "mobile pass" screenshot the skills have been producing for `/design-handoff verify` and `/motion audit` has been capturing desktop-rendered pages at reduced window size — not actual mobile layouts. This:
- Doubled screenshot count per run (desktop pass + fake "mobile" pass) — contributes to the memory accumulation we fixed this morning.
- Gave false-positive verify signals (nothing actually tested at mobile breakpoints).

**Fix direction:** The MCP browser needs to use Chrome DevTools Protocol `Emulation.setDeviceMetricsOverride` to change the viewport, not `window.resizeTo`. Until that's wired up:
- Remove mobile viewport steps from `design-handoff` and `motion` skills.
- Mobile testing should be done manually in a real Chrome window at the target width, or on a real device.
- Flag any prior "mobile verified ✓" claims in recent PRs as unverified.

### 11. `window.close()` no-op from MCP
Tabs cannot be programmatically closed by the MCP agent — `window.close()` returns but the tab persists. If tab-cycling between viewports is the memory discipline, we need an MCP tool that actually closes tabs (or the agent must accept accumulating tab count per session).

---

## Already fixed this session

- **Today in Atlanta tab counts** — removed. The artificial `3` on every tab was misleading: it was the count of previewed stories, not the total available. Users access the full list via "All news →". (`TodayInAtlantaSection.tsx`)
- **"Family-friendly: 1" subtitle** (P1 #7) — fixed to natural phrasing. Now reads "N family-friendly spot(s)" when applicable, falls back to "N spots" otherwise. (`lib/places-to-go/callouts.ts` + tests, 23/23 pass)
- **"# 38 LIVE" chip** (P1 #4) — dropped from the list. Re-read of `CityBriefing.tsx:288-305` confirmed the code renders `{liveCount} Live` with a pinging red dot. The `#` in my screenshot was a JPEG artifact of the `animate-ping` ring mid-animation, not raw markup.
- **Grid gaps** (P1 #3) — reclassified. Now Showing is a horizontal carousel, not a 4-col grid (my misread). Places to Go genuinely has 11 categories with no clean grid fit. Both need design decisions (add 12th CTA tile? drop a category? center last row?) rather than quick patches. **Moved to P2 / follow-up.**
- **Section entrance choreography** (P2 #8, partial) — added `feed-section-enter` class to the 4 feed sections missing it: `LineupSection`, `FestivalsSection` (The Big Stuff), `PlacesToGoSection`, `MusicTabContent` (Live Music). All 8 main feed sections now use the same entrance keyframe (0.3s fade + 4px translateY on mount).
- **Carousel scroll affordance on desktop** (P1 #5) — unhid the existing mobile dot indicators on desktop for the three carousels that had no desktop affordance: `NowShowingSection`, `GameDaySection`, `PlaceGroupedShowsList`. Skipped `FeaturedCarousel` and `FeedSection` (both already have desktop arrow buttons).
- **Background grain** (P1 #6) — user decision: keep as-is (cinematic brand principle). No code change.
- **Testing skills** (#10) — removed mobile-viewport instructions from `design-handoff` and `motion` skills, with an explicit note that `resize_window` is a no-op on the web viewport. Memory index updated.
- **Masquerade image bug** (P0 #1) — fixed at the crawler level. Added `"weeklyservice"` to `crawlers/utils.py` `_IMAGE_SKIP_PATTERNS` (load-bearing change — affects `extract_images_from_page`, `smart_update_existing_event`, and the DB-events insert filter). Added a venue-specific pre-record and post-enrich guard in `crawlers/sources/the_masquerade.py`. Six new tests in `crawlers/tests/test_the_masquerade_participants.py`, all 15 pytests pass. **The 54 affected rows will self-heal on the next Masquerade crawl** — no SQL backfill needed. Trigger: `python3 main.py --source the-masquerade --allow-production-writes`.
- **Aisle 5 "garbage title"** (P0 #2) — not a bug. The band is literally "Post Sex Nachos"; the DB row title `"Post Sex Nachos, Kids That Fly"` is correct. What I read as "Best Six" during the visual audit was a misread of "Post Sex" at JPEG screenshot resolution. Verified no content-substitution filter exists in the web code. **Dropped from the list.**

## Follow-ups from crawler-dev work (not fixed here)

- **`enrich_event_record()` early-exit** (`crawlers/utils.py`): the function short-circuits if `image_url` is already set, meaning any bad image written before enrichment silently blocks detail-page re-fetch. The Masquerade fix clears the bad URL *before* calling enrich, but the same failure pattern could bite other crawlers. Worth a future refactor: either accept a `force_image_refresh` flag, or run `is_likely_non_event_image()` inside `enrich_event_record` to re-evaluate whether the existing image should be kept.
- **Deduplication miss** (Aisle 5 / Ticketmaster): event 7776 (Aisle 5, "Post Sex Nachos, Kids That Fly") and event 70652 (Ticketmaster, "Post Sex Nachos" — missing supporting act) are the same show at the same date/venue but aren't being collapsed by the dedup logic. Aisle 5's own crawler is the authoritative source. Worth flagging to crawler-dev / data-specialist.

## Known gap after the partial fix (#8)

`.feed-section-enter` fires **on mount**, not on scroll-into-view. Below-the-fold sections complete their 0.3s animation before the user scrolls to them — so users who scroll in (most users) see no motion. The class currently only buys a visible effect for sections above the fold.

**To make scroll-triggered entrances work**: wrap each section in a component that uses `IntersectionObserver` to toggle a visibility flag, with `opacity: 0` as the initial state until the section is 10-20% in view. This is a ~30-line hook + applying it across ~8 sections. Worth doing but out of scope for this quick-win pass.

---

## Not reviewed (needs follow-up)

- Hover states on cards / chips / section links (static screenshots don't test hover).
- Focus ring visibility on keyboard navigation.
- Loading states in the wild (only saw the rendered state).
- Cross-portal view — this audit is Atlanta-only.
- Authenticated view — audit was in guest state.
