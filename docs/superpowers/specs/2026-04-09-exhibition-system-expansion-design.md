# Exhibition System Expansion Design

## Problem

LostCity's exhibition system was built for art galleries but the city has museums, zoos, aquariums, botanical gardens, theme parks, and other attractions with notable experiences that drive visits. Current state:

- **Exhibitions table** exists with full infrastructure (schema, dedup, crawlers, API, web pages) but is art-gallery-only and has data quality issues (3x AHC duplication, Kai Lin junk titles, 7 inactive crawlers with working code)
- **`venue_features` table** exists with full pipeline (migration, write path, persistence layer, rendering) but is underutilized — 2,721 records, 0.3% have images, 0% hotel coverage, concentrated in family/arts verticals
- **Exhibitions are Arts-portal-exclusive** — invisible on Atlanta, Family, Adventure, FORTH portals
- **Exhibitions are not searchable** — not a search result type
- **No coverage** of Georgia Aquarium, Zoo Atlanta, Botanical Garden, Six Flags, Children's Museum, or any major attraction venue

## Design Decisions

1. **Evolve `venue_features`, don't create a new table.** The table exists, is wired end-to-end, and covers ~70% of what was proposed as `place_features`. Add missing columns via ALTER TABLE migration.

2. **Expand `exhibitions` for non-art venues.** New `exhibition_type` values handle seasonal events, special exhibits, and temporary attractions. Same table, same pipeline, same API.

3. **Two entity types, clear boundary:**
   - `venue_features` = what the place IS (permanent or seasonal attractions, physical installations)
   - `exhibitions` = curated time-boxed content with editorial identity (shows, seasonal events, limited-run experiences)
   - Decision rule: does it have a start/end date and would draw someone to visit specifically for it? → exhibition. Is it a persistent reason the place is worth going to? → venue feature.
   - Edge case — seasonal recurring experiences (e.g., "Garden Lights" returns every winter): these are `exhibitions` with `exhibition_type = 'seasonal'`, not venue features with `is_seasonal = true`. The feature `is_seasonal` flag is for permanent attractions that close part of the year (e.g., a water play area closed in winter). The exhibition `seasonal` type is for programmed experiences with a name, dates, and marketing identity that recur annually as distinct runs.

4. **Unified venue research pipeline** built as crawlers within existing `main.py`, not a separate system. One crawl pass per venue produces both features and exhibitions.

5. **Cross-portal exhibition visibility.** Non-art exhibition types surface on relevant portals via config-driven filtering.

6. **Features enrich place pages only (for now).** No standalone feature detail pages. Revisit if search/SEO signal warrants it.

7. **Fix existing data quality before expanding.** Pipeline issues (duplication, junk titles, inactive crawlers) are preconditions, not separate work.

## Schema Changes

### `venue_features` ALTER TABLE (additive columns)

| Column | Type | Notes |
|---|---|---|
| `source_id` | INTEGER FK → sources | Nullable. Tracks which crawler/research pass produced this |
| `portal_id` | UUID FK → portals | Nullable. Federation scoping |
| `admission_type` | TEXT | Nullable. Values: `free`, `ticketed`, `included`, `donation`, `suggested` |
| `admission_url` | TEXT | Link to buy tickets / reserve |
| `source_url` | TEXT | Provenance — where the data came from |
| `tags` | TEXT[] | Flexible tagging for discovery |
| `metadata` | JSONB DEFAULT '{}' | `content_hash` for dedup, `last_verified_at` for staleness |
| `created_at` | TIMESTAMPTZ DEFAULT now() | Audit trail |
| `updated_at` | TIMESTAMPTZ DEFAULT now() | + update trigger |

Existing columns preserved as-is: `title`, `feature_type`, `description`, `image_url`, `is_seasonal`, `start_date`, `end_date`, `price_note`, `is_free`, `sort_order`, `is_active`.

### `exhibitions` ALTER TABLE

| Change | Detail |
|---|---|
| Add `related_feature_id` | UUID FK → `venue_features(id)`, nullable. Links time-boxed exhibition to the permanent feature it's within. |
| Add index | `idx_exhibitions_related_feature ON exhibitions(related_feature_id) WHERE related_feature_id IS NOT NULL` |
| Expand `exhibition_type` | Add values: `seasonal`, `special-exhibit`, `attraction` |
| Expand `admission_type` | Add value: `included` (comes with general admission) |

### Exhibition type semantics

| Type | Meaning | Example | UI Label |
|---|---|---|---|
| `solo` | Single artist show | "Amy Sherald: American" | "Exhibition" |
| `group` | Multi-artist exhibition | "New Southern Photography" | "Exhibition" |
| `installation` | Site-specific art installation | "Chihuly in the Garden" | "Exhibition" |
| `retrospective` | Career survey | "Noguchi: Finding Form" | "Exhibition" |
| `popup` | Short-run art popup | Gallery weekend popup | "Exhibition" |
| `permanent` | Permanent collection display | "Folk Art Collection" | "Exhibition" |
| `seasonal` | Recurring seasonal experience | "Fright Fest", "Garden Lights" | "Seasonal Event" |
| `special-exhibit` | Limited-run non-art exhibit | "Bodies: The Exhibition" | "Special Exhibit" |
| `attraction` | Temporary attraction | "Lantern Festival at Zoo" | "Limited-Time Attraction" |

## Data Pipeline

### Unified venue research crawlers

Each target venue gets a source registration and crawler file in the existing pipeline:

1. **One crawler per venue** (or venue group for similar sites). Registered with `crawl_frequency` — `weekly` for time-boxed exhibitions, `quarterly` for feature-only venues.

2. **Each crawl produces two entity types** in a single pass:
   - `venue_features` — permanent/notable attractions
   - `exhibitions` — current time-boxed content
   
   Both lanes already exist in `entity_lanes.py`.

3. **LLM extraction** for marketing-heavy, unstructured sites (Six Flags, Botanical Garden). Prompt instructs: "Extract permanent notable attractions AND current limited-time experiences separately." Same pattern as `exhibition_hub.py`.

4. **Quality gates at ingestion:**
   - Features require: title, description (>=100 chars), valid `feature_type`
   - Image extraction required when source page has one
   - Exhibitions follow existing `insert_exhibition()` validation
   - `feature_type` validated against known values, unknown defaults to `attraction` with warning

### Refresh cadence

| Content type | Frequency | Mechanism |
|---|---|---|
| Permanent features | Quarterly | `crawl_frequency = 'quarterly'` on source |
| Seasonal features (`is_seasonal = true`, `end_date` within 60 days) | Monthly | Bumped via staleness check |
| Time-boxed exhibitions | Weekly | Normal `crawl_frequency` |
| Feature staleness | Tracked via `metadata.last_verified_at` | Flagged if >120 days stale |

### Target venues for initial seed (~25-30)

| Tier | Venues | Approach |
|---|---|---|
| Must-have cultural | High Museum, MOCA GA, Atlanta Contemporary, Fernbank, Center for Civil & Human Rights, World of Coca-Cola, College Football HoF | Fix existing + expand |
| Must-have attractions | Georgia Aquarium, Zoo Atlanta, Atlanta Botanical Garden, Six Flags, Stone Mountain | New crawlers |
| Must-have family | Children's Museum, Center for Puppetry Arts, Legoland Discovery, Medieval Times | New crawlers |
| Art galleries | SCAD FASH, Whitespace, Hammonds House, Sandler Hudson, Kai Lin, Besharat | Activate existing inactive crawlers |
| Science/history | Delta Flight Museum, Fernbank Science Center, Atlanta History Center (non-art) | Expand existing crawlers |

## Product Surface

### Cross-portal exhibition visibility

New exhibition types (`seasonal`, `special-exhibit`, `attraction`) surface on non-Arts portals via a feed section. Portal config drives which types each portal subscribes to:

| Portal | Exhibition types shown | Section title |
|---|---|---|
| Atlanta (base) | All types | "What's On Now" |
| Family | `seasonal`, `special-exhibit`, `attraction` | "What's On Now" |
| Adventure | `seasonal`, `attraction` | "What's On Now" |
| FORTH (hotel) | All types | "What's On Now" |
| Arts | `solo`, `group`, `installation`, `retrospective`, `popup` | "What's Showing" (existing, unchanged) |

### Exhibitions in search

Add `exhibition` as a search result type in unified search. Results show: title, venue name, date range, admission type, thumbnail. Searching "aquarium" returns Georgia Aquarium (place) + any current special exhibit (exhibition).

### On-venue exhibition links

"On View" cards on venue detail pages link to `/{portal}/exhibitions/{slug}` (internal detail page) instead of `source_url`. External source link stays available on the exhibition detail page.

### Portal-aware exhibitions page

Existing `/{portal}/exhibitions` route works for any portal. Page title and styling adapt: "What's Showing" with gallery aesthetics on Arts, "What's On" with neutral styling elsewhere. No new routes needed.

## Existing Data Quality Fixes (Preconditions)

These are fixed in Phase 1 before any expansion work:

1. **Activate inactive exhibition crawlers** — MOCA GA, SCAD FASH, Poem88, ABV, Mint. Dry-run each, fix extraction issues, activate.
2. **Fix Kai Lin junk titles** — 19 "View fullsize" records. Fix CSS selector, add title validation to exhibitions pipeline.
3. **Fix AHC 3x duplication** — investigate date variance across crawl runs causing hash mismatches.
4. **Create High Museum exhibitions source** — `high_museum_exhibitions.py` exists with no source record. Create and activate.
5. **Suspend Whitespace no-op** — documented React/ArtCloud site logging daily success with 0 records. Mark inactive or convert to Playwright.
6. **Add `feature_type` validation** — `upsert_venue_feature()` rejects unknown types, defaults to `attraction`. Fix 26 existing `space` records → `amenity`.

## Implementation Sequence

### Phase 1: Pipeline Quality (prerequisite)
All six data quality fixes above. No schema changes, no new features — just fixing what's broken.

### Phase 2: Schema Evolution
- `venue_features` ALTER TABLE migration (additive columns)
- `exhibitions` ALTER TABLE (related_feature_id, expanded enums)
- Add `exhibition` to unified search index

### Phase 3: Venue Research Pipeline
- Build LLM-extraction crawler template for attraction-type venues
- Seed Tier 1: Georgia Aquarium, Zoo Atlanta, Botanical Garden, Six Flags, Fernbank, Children's Museum
- Seed Tier 2: World of Coca-Cola, Center for Civil & Human Rights, Center for Puppetry Arts, Delta Flight Museum, Medieval Times, Legoland
- Each seed produces both `venue_features` and `exhibitions`

### Phase 4: Product Surface
- Cross-portal exhibition feed section ("What's On Now") with portal-config filtering
- Exhibitions in unified search results
- "On View" links point to internal detail pages
- Portal-aware styling on `/{portal}/exhibitions` page

### Phase 5: Ongoing Maintenance
- Quarterly re-research for permanent features (scheduled via `crawl_frequency`)
- Monthly for seasonal features approaching `end_date`
- Weekly crawls for time-boxed exhibitions at active venues

## Out of Scope

- Standalone detail pages for venue features (revisit with user signal)
- Structured pricing on features (admission_note / price_note handles the variety)
- Artist identity resolution across exhibitions (existing gap, separate project)
- Feature-to-feature relationships (e.g., "Ocean Voyager is part of Georgia Aquarium's Marine Galleries")
