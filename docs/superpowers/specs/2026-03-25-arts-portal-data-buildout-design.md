# Arts Portal Data Buildout — Exhibition Coverage Scaling & Data Quality

## Goal

Scale Atlanta exhibition coverage from ~107 unique gallery/museum exhibitions (many stale or duplicate) across 38 venues to 150+ verified current exhibitions across 40+ venues. Fix data quality issues in the existing pipeline and round out the arts data layer (studios, event categorization) for portal launch. Combined with the open calls corpus (13,692 across 59 sources), this completes the data needed to launch the Arts portal.

## Primary User

**The working artist.** Checks open calls weekly, tracks the local exhibition scene to understand gallery programs and peer activity, uses the studio directory when looking for space. Open calls (the moat) serve this user. The exhibition feed serves both artists and gallery-goers, but the artist is the retention loop — they come back because deadlines close.

The gallery-goer who wants to know "what's showing this weekend" is a secondary user served by the same data.

## Current State — What Already Exists

### Infrastructure (fully built)

| Component | File | Status |
|-----------|------|--------|
| `db/exhibitions.py` | `crawlers/db/exhibitions.py` | Complete — insert, dedup, hash, artist linking, slug collision recovery |
| `artists.py` | `crawlers/artists.py` | Complete — get_or_create_artist, get_or_create_and_enrich, slug-based dedup |
| `exhibition_utils.py` | `crawlers/exhibition_utils.py` | Complete — record builder for TypedEntityEnvelope |
| `entity_persistence.py` | `crawlers/entity_persistence.py` | Complete — multi-entity persistence with exhibitions lane |
| `generic_venue_crawler.py` | `crawlers/generic_venue_crawler.py` | Complete — LLM extraction with exhibition support |
| Exhibitions API | `web/app/api/exhibitions/route.ts` | Complete — list with filters |
| Exhibition detail API | `web/app/api/exhibitions/[slug]/route.ts` | Complete |
| Studios API | `web/app/api/studios/route.ts` | Complete |
| Open Calls API | `web/app/api/open-calls/route.ts` | Complete — 13,692 calls, 59 sources |
| Web components | `components/arts/*` | Complete — OpenCallsBoard, ExhibitionFeed, ExhibitionCard, StudiosDirectory, ArtistExhibitionTimeline |
| DB schema | migration 498 | Complete — exhibitions, exhibition_artists tables with indexes, RLS |

### Exhibition Crawlers (7 gallery-specific + 1 generic)

| Crawler | File | Approach |
|---------|------|----------|
| High Museum | `sources/high_museum_exhibitions.py` | WP REST API + detail page scraping |
| MOCA GA | `sources/moca_ga_exhibitions.py` | WP archive page scraping (REST returns 0) |
| Atlanta Contemporary | `sources/atlanta_contemporary_exhibitions.py` | Server-rendered HTML masonry grid |
| Marcia Wood Gallery | `sources/marcia_wood_gallery.py` | Gallery crawler |
| Sandler Hudson Gallery | `sources/sandler_hudson_gallery.py` | Gallery crawler |
| Whitespace Gallery | `sources/whitespace_gallery.py` | ArtCloud React SPA |
| Atlanta Printmakers | `sources/atlanta_printmakers_studio.py` | Gallery/studio crawler |
| Generic venue crawler | `generic_venue_crawler.py` | LLM extraction (handles exhibitions when detected) |

### Data Quality Problems (must fix before scaling)

The existing 200 exhibition rows have serious issues identified by the data quality audit:

1. **~107 unique gallery/museum exhibitions** out of 200 rows, but many are stale or duplicated (28 distinct duplicate pairs = ~50 duplicate rows, 21 junk rows)
2. **21 junk rows from Kai Lin Art** — "View Fullsize", "Download Press Release" extracted as titles
3. **Lifecycle management never run** — exhibitions from 2022-2023 still `is_active: true` because `closing_date` is NULL
4. **28 duplicate pairs (~50 rows)** — same exhibition with different `opening_date` each crawl run (MODA has 10 copies of "Exhibit Tour of Public Notice" alone)
5. **Non-exhibition content** — Klezmer concert, "Live Animal Encounter", College Football Hall of Fame items in the exhibitions table
6. **0 exhibitions marked `is_active: false`** — the deactivation logic exists in concept but has never been executed

### Venue Coverage Gap

- **165 gallery/museum venues** in the database
- **28 have any exhibitions** (17%)
- **137 have zero exhibitions** (83%) — includes ZuCot, Mint Gallery, Poem 88, Get This Gallery, ABV Gallery, Besharat Contemporary, Atlanta Center for Photography, Hammonds House, Spelman Museum

### Studio State

- **61 venues** with `venue_type: "studio"`
- **5 enriched** with `studio_type`, `availability_status`, `monthly_rate_range` (not 10 as previously estimated)
- **Cook's Warehouse** is misclassified as `studio` — should be `event_space` or `food_hall`

## Design Decisions

### Exhibition definition
Curated gallery/museum shows only (solo, group, installation, retrospective, popup, permanent). Broader "art-friendly venues" (coffee shops with rotating art) get venue-level metadata via `venue_occasions`, not exhibition records.

### Geographic scope
Atlanta metro only. Exhibition crawlers will extend to other cities at portal launch.

### Images
Extract og:image from exhibition pages — the image galleries explicitly set for social sharing. Standard practice across all arts aggregators.

### Artist extraction
Extract-and-enrich on first pass. When a crawler encounters artist names on an exhibition page, extract names + any linked URLs (website, Instagram, portfolio). Create or match artist records. Link via `exhibition_artists` junction.

### ArtsATL as discovery, not data source
ArtsATL is an editorial aggregator — using it as a canonical exhibition data source violates the "always crawl original sources" rule. Instead, use ArtsATL's exhibition coverage as a **discovery tool**: identify which galleries have current shows that we have no crawler for, then build first-party crawlers for those galleries. The existing editorial mentions pipeline already crawls ArtsATL for article data.

### Template base classes: recalibrated expectations
The architect review found that gallery websites are structurally diverse even within the same CMS. High Museum uses WP REST API with custom post types. MOCA GA uses WordPress but REST returns 0 results. Whitespace uses ArtCloud (React SPA). Sandler Hudson is Squarespace with `?format=json`.

Template base classes will cover **30-40%** of galleries, not 70%. The existing `generic_venue_crawler.py` with LLM extraction is the better breadth strategy for the remaining 60-70%. Build templates where they add value (clear CMS clusters), fall back to LLM extraction or custom crawlers otherwise.

## Architecture

### Phase 0: Data Cleanup (before adding new crawlers)

Fix the existing 200 rows before scaling:

**Lifecycle sweep:**
- `closing_date < today` → mark `is_active: false`
- `closing_date IS NULL AND opening_date < (today - 2 years)` → mark inactive with `metadata.lifecycle_note = "auto_expired_no_close_date"`
- `closing_date IS NULL AND exhibition_type = 'permanent'` → leave active, set `metadata.is_permanent = true`
- All others with `closing_date IS NULL`: set default expiry of 6 months from `opening_date`

**Junk removal:**
- Delete rows with titles matching `^(view fullsize|download|click here|read more|learn more)` (Kai Lin Art artifacts)
- Remove non-exhibition content (Klezmer concert, Live Animal Encounter, College Football Hall of Fame)
- Fix Cook's Warehouse venue_type from `studio` to `event_space`

**Title validation guard in `db/exhibitions.py`:**
- Add title validation to `insert_exhibition()` — reject navigation/UI text patterns
- Normalize internal whitespace before hashing: `re.sub(r'\s+', ' ', title.strip().lower())`

**Cross-source dedup fallback:**
- Add title+venue_id secondary lookup in `insert_exhibition()` when hash misses
- If an exhibition with the same title at the same venue exists (regardless of date), treat as same exhibition and update rather than insert
- This prevents ArtsATL-style aggregators from creating duplicates of first-party crawled exhibitions

**Event re-categorization diagnostic (read-only):**
- Run diagnostic: sample events in `community`, `learning`, `family` categories at gallery/museum/studio venues
- Flag probable miscategorizations (museum receptions, gallery openings currently tagged `community`)
- Estimated ~50-80 events to re-tag, plus `tag_inference.py` rule updates

### Phase 1: Artist Pipeline Fixes

**Separate visual artist path from music enrichment:**
- Exhibition pipeline should call `get_or_create_artist()` directly, NOT `get_or_create_and_enrich()`
- `get_or_create_and_enrich()` routes through MusicBrainz/Spotify — will silently match wrong people for visual artists
- The discipline guard (`if discipline in ("musician", "band", "dj")`) works now but is fragile

**Artist name normalization before matching:**
- "Last, First" → "First Last" inversion: if name matches `^(\w[\w\-.]+),\s+(\w.+)$`, rewrite as "$2 $1"
- Normalize internal whitespace: `re.sub(r'\s+', ' ', name.strip())`
- This is a common enough format to handle on first pass without fuzzy matching

**Artist re-linking on exhibition update:**
- Current `update_exhibition()` does NOT re-run `_upsert_exhibition_artists()`
- Fix: when updating an existing exhibition, also re-link artists if new artist data is provided

**Fix TypedEntityEnvelope artist data flow:**
- `build_exhibition_record()` returns `(record, artists)` as a tuple, but `entity_persistence.py` pops `artists` from the record dict — which is always `None` because artists were separated by the builder
- Crawlers using `insert_exhibition()` directly are unaffected (artists passed correctly)
- Crawlers using `TypedEntityEnvelope` + `persist_typed_entity_envelope()` silently lose artist associations
- Fix: embed artists in the record dict before adding to envelope, or pass artists separately through the envelope

**Note on Living CV:** The Living CV feature is non-functional until a fuzzy artist dedup pass runs on `artists` and `exhibition_artists`. Exact-match-or-create will accumulate duplicates ("J. Smith" vs "Jane Smith"). This is acceptable for the data buildout — fuzzy dedup is a separate enrichment pass once volume exists. Do not ship Living CV UI pointing at this data without that caveat.

### Phase 2: Gallery Crawler Scaling

**ArtsATL discovery pass:**
- Use ArtsATL exhibition coverage to identify which Atlanta galleries currently have shows
- Cross-reference against our 165 gallery/museum venues
- Produce a prioritized target list of galleries that need crawlers (sorted by editorial mention frequency)

**Build crawlers using three approaches (chosen per gallery):**

1. **Template base classes** (`crawlers/sources/exhibitions_base.py`) for CMS clusters:
   - `WordPressExhibitionCrawler` — WP REST API with exhibition post type detection
   - `SquarespaceExhibitionCrawler` — `?format=json` API extraction
   - Each gallery configured via data dict (URL patterns, selectors, venue slug)

2. **LLM extraction via `generic_venue_crawler.py`** for structurally unique sites:
   - Already handles exhibitions when detected on venue pages
   - Extend to explicitly target "Current Exhibitions" / "On View" pages
   - Best for galleries with custom sites, irregular HTML, or pages that change layout

3. **Custom crawlers** for high-value venues with complex structures:
   - Only when templates and LLM extraction both fail
   - Follow existing pattern (High Museum, MOCA GA, Atlanta Contemporary)

**Initial scaling targets (15-20 galleries):**
Priority galleries needing crawlers or fixes: ZuCot Gallery, Mint Gallery, Poem 88, Get This Gallery, ABV Gallery, Besharat Contemporary, Hathaway Contemporary, Kai Lin (fix existing junk + re-crawl), Arnika Dawkins Photography (venue record needs creation), Atlanta Center for Photography, Michael C. Carlos Museum, Spalding Nix, Gallery 72. Note: Hammonds House and Spelman Museum have rows but they are misclassified events, not real exhibitions — these need cleanup + real exhibition crawlers.

**Source registration:**
Each gallery gets a source record with `entity_family: "exhibitions"` and `owner_portal_id` set to arts portal ID.

**Rate limiting:**
- 1s delay between detail page fetches
- 2s delay between pages on aggregator sites

**Exhibition lifecycle on each crawl:**
- Mark exhibitions whose `closing_date < today` as `is_active: false`
- New exhibitions: `status` based on date range (current vs upcoming)

**Centralized lifecycle sweep:**
- Add post-crawl hook or scheduled query that marks expired exhibitions across all sources
- Prevents stale data when a crawler errors out or is disabled for weeks

### Phase 3: Studio Enrichment

**One-time enrichment + monthly refresh:**
- Visit each of the 56 unenriched studio venue websites
- Extract from "Rentals"/"Studios"/"Availability" subpages: studio type, availability status, monthly rate range, application URL
- This is legitimately enrichment (studio metadata lives on subpages, not event listings)
- **Monthly refresh script** rechecks studio subpages for availability/rate changes — not one-time-only
- Fix Cook's Warehouse venue_type classification

## Success Criteria

| Metric | Target | Current |
|--------|--------|---------|
| Active exhibitions (closing_date >= today or permanent) | 150+ from 40+ venues | ~107 unique but many stale, from 38 venues |
| Exhibition image coverage | 80%+ have og:image | Unknown |
| Exhibition-artist links | Every exhibition has 1+ linked artist | 13 total links |
| Studios with full metadata | 40+ | 5 |
| Junk/stale exhibition rows cleaned | 0 remaining | ~71 junk/stale/duplicate rows |
| Miscategorized arts events fixed | 50+ re-tagged + inference rules updated | 0 |

Note: "200+ visual artist records" is a derivative metric — if 150 exhibitions average 2-3 artists each, visual artist records follow automatically. Not tracked separately.

## Definition of Done

An artist in Atlanta can:
1. Browse 13,692+ open calls filtered by discipline, deadline, and scope
2. See what's currently showing across 40+ Atlanta galleries and museums
3. Click through to gallery pages and discover exhibiting artists
4. Find studio space with availability and pricing info

All backed by real, crawled data. No hardcoded content. No smoke and mirrors.

## Out of Scope

- Arts portal visual design/theming (separate project — "Underground Gallery" aesthetic)
- Exhibition or studio UI changes (existing components work)
- Artist profile page UI (data populates, display is separate)
- Living CV rendering (requires fuzzy artist dedup pass first)
- National exhibition data
- Historical exhibition backfill
- Fuzzy artist deduplication (later enrichment pass once volume exists)
- Artist social networking, marketplace, messaging
- ArtsATL as a production exhibition data source (discovery only)
