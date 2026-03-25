# Arts Portal Data Layer Round 2 — Design Spec

## Goal

Complete the arts data layer so the portal can be designed against real, comprehensive data. Four workstreams: visual artist pipeline, exhibition crawler fixes, closing date backfill, and medium inference.

## Non-Goals

- Frontend/portal design or components
- Artist discovery features (rising artists, shared-exhibition connections)
- Claimable artist profiles (the `claim` endpoint already exists; we're just seeding data)
- Open calls geographic tagging
- Studio expansion beyond existing 10 records

---

## Workstream 1: Visual Artist Pipeline

### Problem

The `artists` table contains 5,767 records — all musicians, comedians, authors, speakers. Zero visual artists. The `exhibition_artists` junction table has 37 name-only rows with no real profiles linked. The arts portal's unique value prop (artist profiles with exhibition history) cannot function.

### Solution

1. **Crawl artist rosters from gallery websites.** The 43 venues with active exhibitions publish "Artists" or "Gallery Artists" pages listing represented artists with bios, headshots, and portfolio links. Scrape these pages to extract artist data.

2. **Create artist records with `discipline='visual_artist'`.** Extend `get_or_create_artist()` to accept an optional `extra_fields: dict = None` parameter that gets merged into the insert payload (e.g., `{"bio": "...", "image_url": "...", "website": "..."}`). Existing callers are unaffected since it defaults to `None`. On the "get" path (artist already exists), update any null fields with provided extra_fields values (don't overwrite existing data).

3. **Resolve `exhibition_artists.artist_id` FKs.** For each `exhibition_artists` row where `artist_id IS NULL`, match `artist_name` against the artists table (normalized) and set the FK.

4. **Build artist browse API endpoints:**
   - `GET /api/artists` — List with filters: `discipline`, `medium` (via exhibitions), `q` (search), pagination (`limit`/`offset`). Portal-scoped via exhibition source access.
   - `GET /api/artists/[slug]` — Detail: profile fields + exhibition history via existing `getArtistExhibitions()` in `web/lib/artists.ts`.

### Data Flow

```
Gallery website → artist roster scraper → normalize_artist_name()
  → get_or_create_artist(name, discipline="visual_artist")
  → backfill exhibition_artists.artist_id FKs
```

### Artist Roster Sources

Priority: galleries with the most active exhibitions and published artist pages.

| Gallery | Exhibitions | Website | Expected Approach |
|---------|------------|---------|-------------------|
| Kai Lin Art | 36 | kailinart.com | Artist page scrape |
| Atlanta History Center | 29 | atlantahistorycenter.com | Exhibition pages (no artist roster) |
| High Museum of Art | 23 | high.org | Artist pages per exhibition |
| Atlanta Contemporary | 14 | atlantacontemporary.org | Artist archive |
| Besharat Contemporary | 14 | besharatcontemporary.com | WP pages with artist names |
| Ernest G. Welch / GSU | 13 | art.gsu.edu | Exhibition pages |
| MODA | 12 | museumofdesign.org | Exhibition credits |
| College Football HoF | 9 | cfbhall.com | Skip — not visual art |
| ADAM | 6 | adamatl.org | Artist archive |

Target: 200+ artist profiles from top 15-20 gallery rosters. Rate-limit requests (1s delay between pages per domain) and use the standard crawler user-agent from `_exhibitions_base.py`.

### Artist Table Fields Used

Existing columns — no schema changes needed. Verify that `is_verified`, `claimed_by`, and `claimed_at` columns exist on the `artists` table in production before starting (they should from the claim endpoint migration but are not in tracked migration files):

| Field | Source | Required |
|-------|--------|----------|
| `name` | Gallery roster page | Yes |
| `slug` | Auto-generated via `slugify_artist()` | Yes |
| `discipline` | Hardcoded `'visual_artist'` | Yes |
| `bio` | Gallery artist page, truncated to 500 chars | No |
| `image_url` | Headshot from roster page | No |
| `website` | Portfolio link from roster page | No |

### API Design

**`GET /api/artists`**

Query params:
- `limit` (default 20, max 100), `offset` (default 0)
- `discipline` — filter by artist discipline (default `visual_artist` for arts portal)
- `q` — ilike search on `name`
- Portal scoping via RPC: Create `get_portal_artists(portal_id, limit, offset, discipline, q)` that handles the multi-table join server-side. The join path is: `artists` -> `exhibition_artists` -> `exhibitions` (filtered by `source_id IN portal-accessible sources`). This avoids complex client-side Supabase query chaining. The RPC returns artists with an `exhibition_count` field computed as the count of portal-scoped active exhibitions per artist (not global count).

Response:
```json
{
  "artists": [
    {
      "id": "uuid",
      "name": "Artist Name",
      "slug": "artist-name",
      "discipline": "visual_artist",
      "bio": "Short bio...",
      "image_url": "https://...",
      "website": "https://...",
      "exhibition_count": 3,
      "is_verified": false
    }
  ],
  "total": 250,
  "offset": 0,
  "limit": 20
}
```

**`GET /api/artists/[slug]`**

Response: Full artist profile + exhibition history. Uses existing `getArtistExhibitions()` query pattern from `web/lib/artists.ts`.

```json
{
  "artist": {
    "id": "uuid",
    "name": "Artist Name",
    "slug": "artist-name",
    "discipline": "visual_artist",
    "bio": "...",
    "image_url": "...",
    "website": "...",
    "is_verified": false,
    "exhibitions": [
      {
        "id": "uuid",
        "title": "Exhibition Title",
        "slug": "exhibition-slug",
        "opening_date": "2026-01-15",
        "closing_date": "2026-04-30",
        "exhibition_type": "group",
        "image_url": "...",
        "venue": { "id": 235, "name": "Kai Lin Art", "slug": "kai-lin-art", "neighborhood": "Inman Park" },
        "role": "artist"
      }
    ]
  }
}
```

---

## Workstream 2: Fix All 6 Failing Exhibition Crawlers

### Problem

6 exhibition crawlers are broken — 2 with connection errors (30% of catalog), 4 returning 0 results.

### Crawlers to Fix

| Crawler | File | Exhibitions | Error | Likely Cause |
|---------|------|-------------|-------|-------------|
| Kai Lin Art | `sources/kai_lin_art.py` | 36 | Server disconnected | Site change or Playwright issue |
| Atlanta History Center | `sources/atlanta_history_center.py` | 29 | Server disconnected | Site change or Playwright issue |
| Whitespace Gallery | `sources/whitespace_gallery.py` | 3 | Success but 0 found | React-only rendering, needs Playwright |
| Michael C. Carlos Museum | `sources/carlos_museum.py` | 5 | Success but 0 found | DOM structure change |
| Hammonds House Museum | `sources/hammonds_house.py` | 2 | Success but 0 found | Multi-path fallback failing |
| Atlanta Printmakers Studio | `sources/atlanta_printmakers_studio.py` | 2 | Success but 0 found | Squarespace block structure change |

### Approach

For each crawler:
1. Fetch the target URL manually to verify the site is up and has exhibition data
2. Diagnose the specific failure (selector change, rendering requirement, API change)
3. Fix the crawler — prefer HTTP/BS4 over Playwright where possible (per pipeline redesign direction)
4. Verify with `--dry-run`, then `--allow-production-writes`

### Success Criteria

All 6 crawlers produce >0 exhibitions on dry-run. Combined catalog should recover the ~77 exhibitions these sources represent.

---

## Workstream 3: Closing Date Backfill

### Problem

135 of 218 exhibitions (62%) have `closing_date = NULL`. This prevents "on view through [date]" display and accurate "current vs. past" filtering.

### Approach

1. **Script: `crawlers/scripts/exhibition_closing_dates.py`** — For each exhibition missing `closing_date`, visit the `source_url` and attempt to extract the closing date from the exhibition detail page.

2. **Date extraction strategy:**
   - Look for date range patterns: "Month DD – Month DD, YYYY", "through Month DD", "closes Month DD"
   - Look for structured data: JSON-LD `endDate`, meta tags, schema.org markup
   - For exhibitions with `opening_date` but no closing date and `exhibition_type != 'permanent'`, infer a 3-month default window and write it directly to `closing_date` (the inferred value is usable for filtering; provenance is tracked via `metadata.closing_date_inferred = true`)

3. **Update crawlers** — Where a crawler is extracting opening_date but not closing_date, fix the parser to capture both. Going forward, crawlers must capture closing_date on first pass. This backfill script addresses historical records only.

### Success Criteria

Reduce missing closing_date from 62% to <25%.

---

## Workstream 4: Medium Inference

### Problem

The `medium` column on `exhibitions` is 0% populated. No "filter by photography/sculpture/painting" is possible.

### Approach

1. **Script: `crawlers/scripts/exhibition_medium_inference.py`** — Keyword-match medium from exhibition titles, descriptions, and artist discipline context.

2. **Medium taxonomy** (aligned with standard art categories):
   - `painting` — oil, acrylic, watercolor, gouache, tempera, fresco
   - `photography` — photograph, photo, daguerreotype, cyanotype, darkroom
   - `sculpture` — sculpture, bronze, marble, carved, statue
   - `mixed_media` — mixed media, assemblage, collage, multimedia
   - `printmaking` — print, lithograph, screenprint, etching, woodcut, intaglio, monoprint
   - `drawing` — drawing, charcoal, pencil, ink, pastel, graphite
   - `textile` — textile, fiber, weaving, quilt, tapestry, embroidery
   - `digital` — digital, video, projection, new media, generative, AI
   - `ceramics` — ceramics, pottery, porcelain, stoneware, glaze

3. **Inference rules:**
   - Match keywords in title first (highest confidence)
   - Match keywords in description second
   - If multiple media detected, use `mixed_media`
   - If no match, leave NULL (don't guess)
   - Never overwrite existing non-null values

4. **Wire into insert pipeline** — Add `infer_exhibition_medium(title, description)` call in `db/exhibitions.py:insert_exhibition()` after the junk-title check and before the dedup hash, only when `medium` is not already set in `exhibition_data`. Also call it in `update_exhibition()` when the existing record has null medium. The function is synchronous and in-process (keyword matching, no network calls).

### Success Criteria

Populate medium on 50%+ of exhibitions. Remaining nulls are genuinely ambiguous.

---

## Dependency Order

```
Workstream 2 (fix crawlers) → runs first, recovers lost data
Workstream 3 (closing dates) → depends on working crawlers for re-scraping
Workstream 4 (medium inference) → independent, can run in parallel with 3
Workstream 1 (artist pipeline) → independent of 2-4, but benefits from recovered data
```

Recommended execution: 2 first, then 1+3+4 in parallel.

---

## Out of Scope

- Frontend components or portal pages
- Artist social features (follow, connect)
- Artist claimable profile UX (endpoint exists, no UI needed yet)
- Open calls geographic tagging or quality improvements
- Studio data expansion
- New gallery crawler discovery (only fixing existing 6)
