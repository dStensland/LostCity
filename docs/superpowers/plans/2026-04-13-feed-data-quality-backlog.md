# Feed Data Quality Backlog

Issues surfaced during the 2026-04-13 music + feed consolidation session. Organized by priority.

## P0 — Visible to users, undermines credibility

### 1. Genre misclassification at 3 venues
**Impact:** Genre filter returns wrong results. User filters to "Comedy" and sees Tabernacle rock concerts.
**Venues:**
- Tabernacle: 5/6 shows tagged `comedy` (Calum Scott, Natalia Lafourcade, etc.) — systematic crawl bug
- City Winery: 3 shows tagged `comedy` (Jonathan Butler R&B, wine events) — LLM extraction confusion
- Smith's Olde Bar: all 5 shows have identical `['dj', 'karaoke', 'rock']` — venue-template contamination
**Fix:** Crawler-side. Audit each source's LLM extraction prompt. Add validation: if >3 events at same venue share identical genre arrays, flag as contamination.
**Effort:** ~1 hour per source

### 2. Film metadata empty (rating, runtime, director)
**Impact:** NowShowingSection cards show only title + showtimes. The component renders rating/runtime/director rows — they're always empty.
**Scope:** 0/327 screening_titles have this data.
**Fix:** Add TMDB enrichment step to screening title creation pipeline. After `screening_titles` INSERT, fetch TMDB by `canonical_title` + `year` to backfill `rating`, `runtime_minutes`, `director`.
**Effort:** ~2 hours (TMDB integration exists for event posters, extend to screening_titles)

### 3. Cinema crawler daily scheduling
**Impact:** On days crawlers haven't run, Now Showing has 2 theaters instead of 5. Section looks broken.
**Fix:** Ensure `landmark-midtown`, `tara-theatre`, `plaza-theatre`, `starlight-drive-in` run in the daily cadence before the morning feed cache refresh.
**Effort:** ~30 min (cron/scheduling config)

## P1 — Polish and consistency

### 4. NowShowing section header drops icon
**Impact:** "Now Showing" has no FilmSlate icon while "Live Music" has MusicNote icon. Visual inconsistency between adjacent sections.
**Fix:** FeedSectionHeader `variant="cinema"` doesn't render the icon prop. Add icon rendering to the cinema variant, matching the destinations variant pattern.
**File:** `web/components/feed/FeedSectionHeader.tsx`
**Effort:** ~15 min

### 5. Tonight carousel has no scroll indicator
**Impact:** User doesn't know how many cards are off-screen. 10 cards = ~2,600px of scroll content with no count or dot indicator.
**Fix:** Add a total count indicator (e.g., "10 shows tonight") or mobile dot indicators matching NowShowingSection's carousel pattern.
**File:** `web/components/feed/sections/MusicTabContent.tsx`
**Effort:** ~30 min

### 6. NowShowingSection card height (619px on desktop)
**Impact:** Cards are very tall due to unbounded film list. 4 films × 3 showtimes + metadata = tall cards.
**Fix:** Cap at `MAX_FILMS_PER_CARD=3` (currently 4) or add `max-h` with gradient mask on card body.
**File:** `web/components/feed/sections/NowShowingSection.tsx`
**Effort:** ~15 min

### 7. Studio Movie Grill classification gap
**Impact:** Shows as non-indie non-chain in theater customizer. Should be classified as chain.
**Fix:** Add `studio movie grill` to `CHAIN_CINEMA_PATTERNS` in `web/lib/cinema-filter.ts`.
**Effort:** ~5 min

## P2 — Data coverage improvements (improve over time)

### 8. doors_time coverage (2/282 shows)
**Status:** Extraction schema updated, will improve as crawlers re-run. Verify high-volume sources (Masquerade, Terminal West, Variety Playhouse) actually produce doors_time after next crawl cycle.
**Action:** Monitor after 1 week of crawl runs.

### 9. Genre filter "Filter by genre" label
**Impact:** Genre chips have no label — user doesn't immediately know they're filtering both tonight carousel AND venue directory.
**Fix:** Add subtle sub-label or integrate filter into section header.
**Effort:** ~15 min

### 10. Midtown Alliance organization holding venue-attributed events
**Impact:** 12 shows attributed to "Midtown Alliance" (an organization) instead of actual venues (Symphony Hall, Woodruff Arts Center).
**Fix:** Re-attribute events to correct venues in crawler pipeline. Midtown Alliance should be source, not venue.
**Effort:** ~1 hour (crawler investigation)

## Resolution Status (2026-04-14)

| # | Item | Status |
|---|------|--------|
| 1 | Genre misclassification | DONE — crawler fixes + 77 events cleaned |
| 2 | Film metadata (TMDB) | DONE — 197/335 enriched, pipeline wired end-to-end |
| 3 | Cinema daily scheduling | RESOLVED — already configured as daily cadence |
| 4 | NowShowing icon | DONE |
| 5 | Tonight scroll indicator | DONE |
| 6 | Card height cap | DONE |
| 7 | Studio Movie Grill | DONE |
| 8 | doors_time coverage | MONITORING — will improve with crawl cycles |
| 9 | Genre filter label | SKIPPED — "All" chip makes purpose clear |
| 10 | Midtown Alliance | RESOLVED — aggregator by design, junk filter handles leak |
