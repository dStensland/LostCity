# Places Refactor: Unifying the Location Data Model

**Date:** 2026-03-28
**Status:** Design approved, pending implementation plan
**Scope:** Database schema, API routes, TypeScript types, React components, Python crawlers

---

## Problem Statement

LostCity's location data is fragmented across two parallel systems with no unified abstraction:

1. **`venues` table** — the original event-centric location record. Started as restaurants/bars, now holds parks, trails, museums, stadiums, and everything else. Has restaurant-specific columns (meal_duration, reservation_url) polluting non-restaurant records. ~30 columns of kitchen-sink growth.

2. **`places` table** (Google Places) — a separate PostGIS-enabled schema for the Piedmont healthcare portal. Has geographic queries, ratings, accessibility flags, but no connection to events.

This fragmentation causes recurring bugs:
- Portal data leaking across portals (no RLS on venues, no mandatory city filtering)
- Venue deduplication failures across portals/crawlers
- Events with `venue_id = NULL` from fragile fuzzy matching
- No unified geographic queries ("what's near me" only works on the Google `places` table)
- Image URLs scattered across 3+ tables
- Inconsistent venue detail pages across portals
- Extension table pattern started (`venue_destination_details`) but not generalized

## Design Principles

1. **A "place" is the primitive; a "venue" is a role.** A place is any location worth knowing about. A venue is a place that hosts events — an attribute, not an identity.
2. **Data describes the place truthfully; portals decide what to surface.** A park's trail difficulty exists whether Adventure or Family is looking at it.
3. **Places are public entities; isolation happens at the API layer.** A restaurant exists regardless of which portal discovers it. Portal scoping is via mandatory city filtering, not RLS read restrictions.
4. **Extension data is organized by concern, not by portal.** Avoids duplication when multiple portals need the same attributes.
5. **Phased migration over big bang.** Rename via `ALTER TABLE` + backward-compatible views. Migrate code module by module. Drop views when everything's moved.

---

## Schema Design

### Base `places` Table

Replaces both `venues` and the Google `places` table. Core identity for every physical location.

```sql
CREATE TABLE places (
  id              SERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  aliases         TEXT[] DEFAULT '{}',

  -- Location
  address         TEXT,
  neighborhood    TEXT,
  city            TEXT DEFAULT 'Atlanta',
  state           TEXT DEFAULT 'GA',
  zip             TEXT,
  lat             DECIMAL(10, 8),
  lng             DECIMAL(11, 8),
  location        GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
                    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
                  ) STORED,

  -- Classification
  place_type      TEXT NOT NULL DEFAULT 'other',  -- validated in app layer
  indoor_outdoor  TEXT CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'both')),
  location_designator TEXT NOT NULL DEFAULT 'standard',

  -- Contact
  website         TEXT,
  phone           TEXT,

  -- Primary display (avoids joins for card rendering)
  image_url       TEXT,
  hours           JSONB,

  -- Portal ownership (provenance, not read restriction)
  owner_portal_id INTEGER REFERENCES portals(id),

  -- Google Places bridge (NULL for non-Google-sourced places)
  google_place_id TEXT UNIQUE,

  -- Metadata
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Coordinate validation
  CONSTRAINT valid_coordinates CHECK (
    (lat IS NULL AND lng IS NULL) OR
    (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
  )
);

-- Indexes
CREATE INDEX idx_places_location ON places USING GIST (location);
CREATE INDEX idx_places_type ON places (place_type);
CREATE INDEX idx_places_city ON places (city);
CREATE INDEX idx_places_neighborhood ON places (neighborhood);
CREATE INDEX idx_places_active ON places (is_active) WHERE is_active = true;
CREATE INDEX idx_places_slug ON places (slug);
CREATE INDEX idx_places_google ON places (google_place_id) WHERE google_place_id IS NOT NULL;
```

**Column disposition from current `venues` table:**

The live `venues` table has ~60 columns accumulated via 70+ migrations. Every column needs an explicit destination:

| Column | Source | Destination |
|--------|--------|-------------|
| `id`, `slug`, `name`, `aliases` | base | stays on `places` |
| `address`, `neighborhood`, `city`, `state`, `zip` | base | stays on `places` |
| `lat`, `lng` | base | stays on `places` |
| `venue_type` | base | renamed to `place_type` on `places` |
| `indoor_outdoor` (enum `venue_environment`) | base | stays, converted from ENUM to TEXT CHECK |
| `location_designator` | base | stays on `places` |
| `website` | base | stays on `places` |
| `image_url` | 003 | stays on `places` |
| `active` | 003 | stays as `active` (NOT renamed to `is_active` to avoid cascade breakage) |
| `hours` (aliased from `hours_display`) | 003 | stays on `places` (JSONB, queried on every render) |
| `hours_source`, `hours_updated_at` | 241 | stays on `places` |
| `description`, `short_description` | 003 | moves to `place_profile` |
| `featured` | 003 | moves to `place_profile` |
| `vibes` | 003 | stays on `places` (queried in search/cards) |
| `spot_type`, `spot_types` | 003 | stays until deprecated (aliased to `place_type`) |
| `price_level` | 003 | moves to `place_vertical_details.dining` |
| `instagram`, `facebook_url` | 003/240 | stays on `places` (contact info) |
| `blurhash` | 144 | stays on `places` (card rendering) |
| `search_vector` (tsvector) | 046 | stays on `places` (full-text search) |
| `genres` | 165 | stays on `places` |
| `is_adult` | 051 | stays on `places` |
| `is_experience`, `typical_duration_minutes` | 270 | stays on `places` |
| `is_event_venue` | 060 | stays on `places` |
| `is_chain` | 249 | stays on `places` |
| `hero_image_url`, `explore_category`, `explore_featured`, `explore_blurb` | explore | moves to `place_profile` |
| `producer_id` | 037 | stays on `places` |
| `submitted_by`, `from_submission` | 054 | stays on `places` |
| `parent_venue_id` | artefacts | renamed to `parent_place_id`, stays on `places` |
| `venue_types` | 087 | stays until deprecated (redundant with `place_type`) |
| `menu_url`, `reservation_url` | base | moves to `place_vertical_details.dining` |
| `service_style`, `meal_duration_*`, `walk_in_wait_*`, `payment_buffer_*` | base | moves to `place_vertical_details.dining` |
| `accepts_reservations`, `reservation_recommended` | base | moves to `place_vertical_details.dining` |
| `dietary_options`, `menu_highlights`, `payment_notes` | 249 | moves to `place_vertical_details.dining` |
| `parking` | 249 | moves to `place_profile` |
| `planning_notes`, `planning_last_verified_at` | base | moves to `place_profile` |
| `library_pass`, `last_verified_at` | base | moves to `place_profile` |
| `created_at`, `updated_at` | base | stays on `places` |

**Key decisions:**
- `active` stays as `active` (not renamed to `is_active`) — 8+ RPC functions reference `v.active`. Renaming cascades through every function.
- `indoor_outdoor` ENUM → TEXT requires explicit type migration (see Phase 1)
- `venue_type` → `place_type` rename is explicit in Phase 1
- Columns that stay "until deprecated" will be dropped in Phase 4 once all consumers are migrated

**New columns (not on current `venues`):**
- `location` (PostGIS, generated from lat/lng) — enables spatial queries
- `phone` — basic contact info
- `google_place_id` — bridge to former Google Places data

**place_type values** — TEXT, validated in application layer. Current 62 values from `VALID_VENUE_TYPES` in `crawlers/tags.py` are the starting set. No enum — the taxonomy is still evolving (escape_room, entertainment, recreation were added via recent migrations).

**Note on `is_active` vs `active`:** The base table schema above uses `is_active` for the idealized end-state. During migration, the column stays as `active` and is renamed only in Phase 4 after all consumers are updated. The backward-compatible view maps the name.

### Extension Table: `place_profile`

1:1 with `places`. Slow-changing enrichment data used on detail pages, cards, and search. One join covers what would otherwise be 4 separate extension tables.

```sql
CREATE TABLE place_profile (
  place_id                  INTEGER PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,

  -- Editorial / display
  description               TEXT,
  hero_image_url            TEXT,
  gallery_urls              TEXT[],
  featured                  BOOLEAN DEFAULT false,

  -- Logistics
  parking_type              TEXT CHECK (parking_type IN (
                              'free_lot', 'paid_lot', 'street', 'garage', 'none')),
  transit_accessible        BOOLEAN,
  transit_notes             TEXT,
  capacity                  INTEGER,
  planning_notes            TEXT,
  planning_last_verified_at TIMESTAMPTZ,

  -- Accessibility
  wheelchair_accessible     BOOLEAN,
  family_suitability        TEXT CHECK (family_suitability IN ('yes', 'no', 'caution')),
  age_min                   INTEGER,
  age_max                   INTEGER,
  sensory_notes             TEXT,
  accessibility_notes       TEXT,

  -- Misc enrichment
  library_pass              JSONB,
  last_verified_at          TIMESTAMPTZ,

  updated_at                TIMESTAMPTZ DEFAULT now()
);
```

### Extension Table: `place_vertical_details`

1:1 with `places`. Portal-specific vertical data as typed JSONB columns. Each portal reads its own column. New verticals add a column, not a table.

```sql
CREATE TABLE place_vertical_details (
  place_id    INTEGER PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,

  -- Dining vertical (restaurants, bars, cafes)
  dining      JSONB,
  -- Schema: {
  --   cuisine: string[],
  --   service_style: "quick_service" | "casual_dine_in" | "full_service" |
  --                  "tasting_menu" | "bar_food" | "coffee_dessert",
  --   price_range: 1-4,
  --   menu_url: string,
  --   reservation_url: string,
  --   accepts_reservations: boolean,
  --   reservation_recommended: boolean,
  --   meal_duration_min_minutes: number,
  --   meal_duration_max_minutes: number,
  --   walk_in_wait_minutes: number,
  --   payment_buffer_minutes: number,
  --   serves_vegetarian: boolean,
  --   serves_vegan: boolean,
  --   diabetic_friendly: boolean,
  --   low_sodium_options: boolean,
  --   heart_healthy_options: boolean,
  --   serves_breakfast: boolean,
  --   serves_brunch: boolean,
  --   serves_lunch: boolean,
  --   serves_dinner: boolean,
  --   outdoor_seating: boolean,
  --   delivery: boolean,
  --   dine_in: boolean,
  --   takeout: boolean,
  --   reservable: boolean
  -- }

  -- Outdoor/adventure vertical (parks, trails, nature)
  outdoor     JSONB,
  -- Schema: {
  --   destination_type: string,
  --   commitment_tier: "hour" | "halfday" | "fullday" | "weekend",
  --   primary_activity: string,
  --   drive_time_minutes: number,
  --   difficulty_level: "easy" | "moderate" | "hard" | "expert",
  --   trail_length_miles: number,
  --   elevation_gain_ft: number,
  --   surface_type: string,
  --   best_seasons: string[],
  --   weather_fit_tags: string[],
  --   practical_notes: string,
  --   conditions_notes: string,
  --   best_time_of_day: "morning" | "afternoon" | "evening" | "any",
  --   dog_friendly: boolean,
  --   reservation_required: boolean,
  --   permit_required: boolean,
  --   fee_note: string,
  --   seasonal_hazards: string[],
  --   trail_geometry: null  // future: store as separate PostGIS column if needed
  -- }

  -- Civic vertical (government, community)
  civic       JSONB,
  -- Schema: {
  --   meeting_accessibility: string,
  --   public_comment_policy: string,
  --   livestream_url: string
  -- }

  -- Google Places enrichment (for places sourced from Google)
  google      JSONB,
  -- Schema: {
  --   rating: number,
  --   rating_count: number,
  --   price_level: 0-4,
  --   google_types: string[],
  --   primary_type: string,
  --   google_maps_url: string,
  --   google_score: number,
  --   event_venue_score: number,
  --   user_score: number,
  --   final_score: number,
  --   editor_pick: boolean,
  --   local_certified: boolean,
  --   hidden_gem: boolean,
  --   tourist_trap: boolean
  -- }

  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- GIN indexes for JSONB queries
CREATE INDEX idx_place_vertical_dining ON place_vertical_details
  USING GIN (dining) WHERE dining IS NOT NULL;
CREATE INDEX idx_place_vertical_outdoor ON place_vertical_details
  USING GIN (outdoor) WHERE outdoor IS NOT NULL;
```

### Renamed Many-to-One Tables

These stay as separate tables (many-to-one relationship), renamed:

```sql
-- venue_occasions → place_occasions
ALTER TABLE venue_occasions RENAME TO place_occasions;
ALTER TABLE place_occasions RENAME COLUMN venue_id TO place_id;

-- venue_specials → place_specials
ALTER TABLE venue_specials RENAME TO place_specials;
ALTER TABLE place_specials RENAME COLUMN venue_id TO place_id;

-- venue_tags / venue_tag_summary → place_tags / place_tag_summary
ALTER TABLE venue_tags RENAME TO place_tags;
-- (update columns similarly)

-- editorial_mentions → stays as-is, FK renamed
ALTER TABLE editorial_mentions RENAME COLUMN venue_id TO place_id;
```

### FK Renames on Dependent Tables

Every table with a `venue_id` FK must be updated. The `ALTER TABLE RENAME` on `venues` → `places` automatically updates FK constraints, but column names must be explicitly renamed:

```sql
-- Core event linkage (highest impact — referenced everywhere)
ALTER TABLE events RENAME COLUMN venue_id TO place_id;

-- Programs, exhibitions, open calls (arts/family portals)
ALTER TABLE programs RENAME COLUMN venue_id TO place_id;
ALTER TABLE exhibitions RENAME COLUMN venue_id TO place_id;
ALTER TABLE open_calls RENAME COLUMN venue_id TO place_id;

-- Venue management
ALTER TABLE venue_claims RENAME TO place_claims;
ALTER TABLE place_claims RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_inventory_snapshots RENAME TO place_inventory_snapshots;
ALTER TABLE place_inventory_snapshots RENAME COLUMN venue_id TO place_id;

-- Venue features/highlights (being absorbed into profile/vertical)
ALTER TABLE venue_features RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_highlights RENAME COLUMN venue_id TO place_id;

-- Spatial
ALTER TABLE walkable_neighbors RENAME COLUMN venue_id TO place_id;
ALTER TABLE walkable_neighbors RENAME COLUMN neighbor_id TO neighbor_place_id;

-- Self-referential
ALTER TABLE places RENAME COLUMN parent_venue_id TO parent_place_id;
```

**Note:** `events.venue_id` → `events.place_id` is the highest-blast-radius rename. Every API route, every crawler, every feed query references it. The backward-compatible view for `venues` does NOT help here since the column is on the `events` table. This rename must happen in lockstep with the `feed_events_ready` refresh function update. Code migration for this column is the critical path of Phase 3.

### New Table: `place_candidates`

Staging table for unmatched locations from crawlers. Replaces the current pattern of setting `venue_id = NULL` on events.

```sql
CREATE TABLE place_candidates (
  id                      SERIAL PRIMARY KEY,
  raw_name                TEXT NOT NULL,
  raw_address             TEXT,
  lat                     DECIMAL(10, 8),
  lng                     DECIMAL(11, 8),
  source_id               INTEGER REFERENCES sources(id),
  discovered_by_portal_id INTEGER REFERENCES portals(id),

  -- Matching
  matched_place_id        INTEGER REFERENCES places(id),
  match_confidence        DECIMAL(3, 2),
  match_method            TEXT,  -- 'slug', 'alias', 'proximity', 'geocode'

  -- Lifecycle
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'confirmed', 'rejected', 'merged')),
  promoted_to_place_id    INTEGER REFERENCES places(id),
  reviewed_by             UUID REFERENCES auth.users(id),
  reviewed_at             TIMESTAMPTZ,

  raw_data                JSONB,
  created_at              TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_candidate_coordinates CHECK (
    (lat IS NULL AND lng IS NULL) OR
    (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
  )
);

CREATE INDEX idx_place_candidates_status ON place_candidates (status) WHERE status = 'pending';
CREATE INDEX idx_place_candidates_source ON place_candidates (source_id);
```

**Security model:**
- Crawlers write via service role (bypass RLS)
- Promotion to real places is admin-only
- High-confidence matches (>0.9) can auto-confirm via a review function
- Medium-confidence (0.5-0.9) queue for manual review
- Low-confidence create new place candidates

### Denormalized Feed Table Update

`feed_events_ready` venue columns rename:

```sql
-- venue_id → place_id, venue_name → place_name, etc.
ALTER TABLE feed_events_ready RENAME COLUMN venue_id TO place_id;
ALTER TABLE feed_events_ready RENAME COLUMN venue_name TO place_name;
ALTER TABLE feed_events_ready RENAME COLUMN venue_slug TO place_slug;
ALTER TABLE feed_events_ready RENAME COLUMN venue_neighborhood TO place_neighborhood;
ALTER TABLE feed_events_ready RENAME COLUMN venue_city TO place_city;
ALTER TABLE feed_events_ready RENAME COLUMN venue_type TO place_type;
ALTER TABLE feed_events_ready RENAME COLUMN venue_image_url TO place_image_url;
ALTER TABLE feed_events_ready RENAME COLUMN venue_active TO place_active;
```

The `refresh_feed_events_ready` function must be updated in the same migration to read from `places` instead of `venues`.

---

## Portal Isolation Model

Places are public entities. Portal isolation is enforced at the API layer, not via RLS read restrictions.

### API Layer Rules

1. **Every list/search endpoint requires city context** — derived from portal server-side, not trusted from client. The current gap where venue search works without `city` gets closed.

2. **`owner_portal_id`** is provenance (which portal's crawlers discovered this place), not a read filter. All places in a city are visible to all portals in that city.

3. **Spatial queries** get a mandatory radius cap (50km) and are filtered by the portal's city context.

4. **`search_places_ranked` RPC** (replacing `search_venues_ranked`) gets a required `p_city` parameter.

### RLS Policies

```sql
ALTER TABLE places ENABLE ROW LEVEL SECURITY;

-- Public read access (all places are readable)
CREATE POLICY "places_read" ON places FOR SELECT USING (true);

-- Write: service role only (crawlers) + admin
CREATE POLICY "places_write" ON places FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- place_candidates: admin-only read + write
ALTER TABLE place_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_read" ON place_candidates FOR SELECT
  USING (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));
CREATE POLICY "candidates_write" ON place_candidates FOR ALL
  USING (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ))
  WITH CHECK (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

-- Extension tables: inherit access via FK join to places
-- No separate RLS needed IF all queries go through a JOIN to places.
-- Direct queries to extension tables by place_id bypass RLS on places.
-- Since places have public read access, this is acceptable.
ALTER TABLE place_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_read" ON place_profile FOR SELECT USING (true);
CREATE POLICY "profile_write" ON place_profile FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE place_vertical_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vertical_read" ON place_vertical_details FOR SELECT USING (true);
CREATE POLICY "vertical_write" ON place_vertical_details FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

---

## TypeScript Types

```typescript
// web/lib/types/places.ts

/** Base place — every physical location in the platform */
export interface Place {
  id: number;
  slug: string;
  name: string;
  aliases: string[] | null;
  address: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  place_type: string;
  indoor_outdoor: 'indoor' | 'outdoor' | 'both' | null;
  location_designator: string;
  website: string | null;
  phone: string | null;
  image_url: string | null;
  hours: Record<string, unknown> | null;
  owner_portal_id: number | null;
  google_place_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Minimal card type — used in listings, feed sections, search results */
export type PlaceCard = Pick<Place,
  'id' | 'slug' | 'name' | 'neighborhood' | 'place_type' |
  'image_url' | 'hours' | 'lat' | 'lng'
>;

/** Profile enrichment — joined for detail pages */
export interface PlaceProfile {
  place_id: number;
  description: string | null;
  hero_image_url: string | null;
  gallery_urls: string[] | null;
  featured: boolean;
  parking_type: string | null;
  parking: string | null;
  transit_accessible: boolean | null;
  transit_notes: string | null;
  capacity: number | null;
  planning_notes: string | null;
  planning_last_verified_at: string | null;
  wheelchair_accessible: boolean | null;
  family_suitability: 'yes' | 'no' | 'caution' | null;
  age_min: number | null;
  age_max: number | null;
  sensory_notes: string | null;
  accessibility_notes: string | null;
  library_pass: Record<string, unknown> | null;
  last_verified_at: string | null;
  explore_category: string | null;
  explore_blurb: string | null;
}

/** Vertical-specific details — JSONB typed at app layer.
 *  These interfaces match the JSONB schema comments on place_vertical_details exactly. */
export interface PlaceDiningDetails {
  cuisine: string[];
  service_style: string | null;
  price_range: number | null;
  menu_url: string | null;
  reservation_url: string | null;
  accepts_reservations: boolean | null;
  reservation_recommended: boolean | null;
  meal_duration_min_minutes: number | null;
  meal_duration_max_minutes: number | null;
  walk_in_wait_minutes: number | null;
  payment_buffer_minutes: number | null;
  serves_vegetarian: boolean | null;
  serves_vegan: boolean | null;
  diabetic_friendly: boolean | null;
  low_sodium_options: boolean | null;
  heart_healthy_options: boolean | null;
  serves_breakfast: boolean | null;
  serves_brunch: boolean | null;
  serves_lunch: boolean | null;
  serves_dinner: boolean | null;
  outdoor_seating: boolean | null;
  delivery: boolean | null;
  dine_in: boolean | null;
  takeout: boolean | null;
  reservable: boolean | null;
  dietary_options: string | null;
  menu_highlights: string | null;
  payment_notes: string | null;
}

export interface PlaceOutdoorDetails {
  destination_type: string | null;
  commitment_tier: 'hour' | 'halfday' | 'fullday' | 'weekend' | null;
  primary_activity: string | null;
  drive_time_minutes: number | null;
  difficulty_level: 'easy' | 'moderate' | 'hard' | 'expert' | null;
  trail_length_miles: number | null;
  elevation_gain_ft: number | null;
  surface_type: string | null;
  best_seasons: string[] | null;
  weather_fit_tags: string[] | null;
  practical_notes: string | null;
  conditions_notes: string | null;
  best_time_of_day: 'morning' | 'afternoon' | 'evening' | 'any' | null;
  dog_friendly: boolean | null;
  reservation_required: boolean | null;
  permit_required: boolean | null;
  fee_note: string | null;
  seasonal_hazards: string[] | null;
}

/** Composed types for specific contexts */
export type PlaceWithProfile = Place & { profile: PlaceProfile | null };
export type PlaceWithDining = Place & { dining: PlaceDiningDetails | null };
export type PlaceWithOutdoor = Place & { outdoor: PlaceOutdoorDetails | null };
export type PlaceDetail = Place & {
  profile: PlaceProfile | null;
  dining: PlaceDiningDetails | null;
  outdoor: PlaceOutdoorDetails | null;
};
```

---

## API Routes

### New Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/places/search` | GET | Public | Autocomplete + full search. **Required: `city` param.** |
| `/api/places/[id]` | GET | Public | Place detail with profile + vertical extensions |
| `/api/places/[id]/events` | GET | Public | Upcoming events at this place |
| `/api/places/[id]/tags` | GET/POST | Public/Auth | Community tags |
| `/api/places/[id]/tags/[tagId]/vote` | POST | Auth | Tag voting |
| `/api/places/by-slug/[slug]` | GET | Public | Place by slug |
| `/api/places/by-slug/[slug]/edit` | PATCH | Auth+Owner | Claimed owner edits |
| `/api/places/by-slug/[slug]/submit-event` | POST | Auth+Owner | Submit event |
| `/api/places/claim` | POST | Auth | Claim ownership |
| `/api/places/nearby` | GET | Public | PostGIS proximity query. **Required: `city`, max 50km radius.** |
| `/api/places/open` | GET | Public | Currently open places |

### Additional Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/places/hospital/[slug]` | GET | Public | Nearby places for hospital (replaces Google places version) |
| `/api/places/candidates` | GET | Admin | View pending place candidates |
| `/api/places/candidates/[id]/promote` | POST | Admin | Promote candidate to real place |

### Deprecated Routes (308 redirects during migration)

| Old Route | Redirects To |
|-----------|-------------|
| `/api/venues/search` | `/api/places/search` |
| `/api/venues/[id]/events` | `/api/places/[id]/events` |
| `/api/venues/[id]/tags` | `/api/places/[id]/tags` |
| `/api/venues/by-slug/[slug]/*` | `/api/places/by-slug/[slug]/*` |
| `/api/venues/claim` | `/api/places/claim` |
| `/api/spots/[slug]` | `/api/places/by-slug/[slug]` |
| `/api/spots/[slug]/walkable` | `/api/places/[slug]/nearby` |
| `/api/spots/open` | `/api/places/open` |
| `/api/places/nearby` (old Google) | Replaced by new `/api/places/nearby` |
| `/api/places/search` (old Google) | Replaced by new `/api/places/search` |
| `/api/places/hospital/[slug]` (old Google) | Replaced by new version |

Redirects stay for 90 days with deprecation logging, then are removed.

### RPC Functions

| Old | New | Changes |
|-----|-----|---------|
| `search_venues_ranked()` | `search_places_ranked()` | Add required `p_city` param. Update table/column refs. |
| `refresh_feed_events_ready()` | Same name | Update to join from `places` instead of `venues` |
| `get_nearby_places()` | Same name | Now queries unified `places` table instead of Google `places` |

---

## Component Renames

All components with "Venue" in the name rename to "Place". This is the known set — implementation should grep for any missed references.

| Old | New | Location |
|-----|-----|----------|
| `VenueCard.tsx` | `PlaceCard.tsx` | `components/` |
| `VenueAutocomplete.tsx` | `PlaceAutocomplete.tsx` | `components/` |
| `VenueEventsByDay.tsx` | `PlaceEventsByDay.tsx` | `components/` |
| `VenueShowtimes.tsx` | `PlaceShowtimes.tsx` | `components/` |
| `VenueTagList.tsx` | `PlaceTagList.tsx` | `components/` |
| `VenueTagBadges.tsx` | `PlaceTagBadges.tsx` | `components/` |
| `VenueVibes.tsx` | `PlaceVibes.tsx` | `components/` |
| `VenueSpecialsSection.tsx` | `PlaceSpecialsSection.tsx` | `components/` |
| `SubmitVenueModal.tsx` | `SubmitPlaceModal.tsx` | `components/` |
| `QuickAddVenue.tsx` | `QuickAddPlace.tsx` | `components/` |
| `VenueEventsSection.tsx` | `PlaceEventsSection.tsx` | `components/detail/` |
| `VenueFeaturesSection.tsx` | `PlaceFeaturesSection.tsx` | `components/detail/` |
| `VenueFilterSheet.tsx` | `PlaceFilterSheet.tsx` | `components/find/` |
| `VenueFilterBar.tsx` | `PlaceFilterBar.tsx` | `components/find/` |
| `VenueListView.tsx` | `PlaceListView.tsx` | `components/find/` |
| `VenueListSkeleton.tsx` | `PlaceListSkeleton.tsx` | `components/find/` |
| `VenueGroupedShowsList.tsx` | `PlaceGroupedShowsList.tsx` | `components/feed/` |
| `VenueHangStrip.tsx` | `PlaceHangStrip.tsx` | `components/hangs/` |
| `VenueHangStripLive.tsx` | `PlaceHangStripLive.tsx` | `components/hangs/` |
| `VenueDetailView.tsx` | `PlaceDetailView.tsx` | `components/views/` |
| `VenueDetailModal.tsx` (FORTH) | `PlaceDetailModal.tsx` | `app/[portal]/_components/concierge/` |
| `VenueIcon.tsx` | `PlaceIcon.tsx` | `components/family/illustrations/icons/` |

All components that accept venue props update to `Place` / `PlaceCard` types.

---

## Crawler Changes

### File Renames

| Old | New |
|-----|-----|
| `crawlers/db/venues.py` | `crawlers/db/places.py` |
| `crawlers/db/destination_details.py` | `crawlers/db/place_vertical.py` |
| `crawlers/db/venue_occasions.py` | `crawlers/db/place_occasions.py` |
| `crawlers/db/venue_specials.py` | `crawlers/db/place_specials.py` |
| `crawlers/venue_enrich.py` | `crawlers/place_enrich.py` |
| `crawlers/scrape_venue_specials.py` | `crawlers/scrape_place_specials.py` |
| `crawlers/scrape_venue_hours.py` | `crawlers/scrape_place_hours.py` |

### `get_or_create_venue()` → `get_or_create_place()`

Updated matching logic:
1. **Alias-aware matching** — search `aliases[]` column in addition to name/slug
2. **Proximity + name matching** — geographic proximity (ST_DWithin 500m) combined with name similarity. Catches "The Tabernacle" vs "Tabernacle Atlanta" at the same lat/lng.
3. **Confidence scoring** — instead of binary match/no-match:
   - High confidence (>0.9): auto-link
   - Medium confidence (0.5-0.9): write to `place_candidates` for review
   - No match: create new `place_candidates` entry
4. **Geocoding validation** — reverse-geocode to verify city matches claimed city
5. **Vertical detail routing** — `_destination_details` payload routes to `place_vertical_details.outdoor` JSONB column instead of separate table

### Pipeline Column Renames

Every crawler source that references `venue_id`, `venue_name_hint`, etc. updates to `place_id`, `place_name_hint`. This happens incrementally — the backward-compatible `venues` view means old crawlers continue working during migration.

---

## Migration Strategy

### Phase 1: Schema Evolution (multiple migrations, zero application code changes)

Phase 1 is split into sub-migrations to manage ordering constraints. Each is independently safe to deploy.

#### Migration 1a: Rename existing Google `places` table (name collision)

The existing Google `places` table (UUID PKs) must be renamed before `venues` can take the `places` name.

```sql
-- Rename Google places table to avoid collision
ALTER TABLE places RENAME TO google_places_legacy;

-- Update FKs on dependent tables
ALTER TABLE place_user_signals RENAME TO google_place_user_signals;
-- Note: google_place_user_signals.place_id is UUID, pointing at google_places_legacy.id
-- This table stays on UUID keys — it will be migrated or dropped in Phase 4

-- Rename the materialized view
DROP MATERIALIZED VIEW IF EXISTS hospital_nearby_places;
-- Will be recreated against unified places table later
```

#### Migration 1b: Rename `venues` → `places` + backward-compatible view

```sql
-- 1. Rename core table
ALTER TABLE venues RENAME TO places;

-- 2. Rename key columns
ALTER TABLE places RENAME COLUMN venue_type TO place_type;
-- Note: `active` stays as `active` (not renamed to is_active) to avoid
-- breaking 8+ RPC functions that reference v.active

-- 3. Convert indoor_outdoor from ENUM to TEXT
ALTER TABLE places ALTER COLUMN indoor_outdoor TYPE TEXT USING indoor_outdoor::TEXT;
DROP TYPE IF EXISTS venue_environment;
ALTER TABLE places ADD CONSTRAINT chk_indoor_outdoor
  CHECK (indoor_outdoor IS NULL OR indoor_outdoor IN ('indoor', 'outdoor', 'both'));

-- 4. Backfill NULL place_type before adding NOT NULL
UPDATE places SET place_type = 'other' WHERE place_type IS NULL;
-- NOT NULL constraint added in Phase 4 after all consumers are updated

-- 5. Add new columns
ALTER TABLE places ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS google_place_id TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) STORED;

-- 6. Coordinate validation
ALTER TABLE places ADD CONSTRAINT valid_coordinates CHECK (
  (lat IS NULL AND lng IS NULL) OR
  (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
);

-- 7. Spatial index (partial — skip NULLs)
CREATE INDEX idx_places_location ON places USING GIST (location)
  WHERE location IS NOT NULL;

-- 8. Backward-compatible view using INSTEAD OF triggers (not deprecated RULES)
CREATE VIEW venues AS SELECT * FROM places;

CREATE OR REPLACE FUNCTION venues_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO places (
    id, slug, name, aliases, address, neighborhood, city, state, zip,
    lat, lng, place_type, indoor_outdoor, location_designator,
    website, image_url, active, created_at, updated_at
    -- Only map columns that exist on the original venues table.
    -- The generated `location` column is auto-computed.
  ) VALUES (
    NEW.id, NEW.slug, NEW.name, NEW.aliases, NEW.address, NEW.neighborhood,
    NEW.city, NEW.state, NEW.zip, NEW.lat, NEW.lng, NEW.place_type,
    NEW.indoor_outdoor, NEW.location_designator, NEW.website,
    NEW.image_url, NEW.active, NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION venues_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE places SET
    name = NEW.name, slug = NEW.slug, aliases = NEW.aliases,
    address = NEW.address, neighborhood = NEW.neighborhood,
    city = NEW.city, state = NEW.state, zip = NEW.zip,
    lat = NEW.lat, lng = NEW.lng, place_type = NEW.place_type,
    indoor_outdoor = NEW.indoor_outdoor, website = NEW.website,
    image_url = NEW.image_url, active = NEW.active,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION venues_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM places WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER venues_insert INSTEAD OF INSERT ON venues
  FOR EACH ROW EXECUTE FUNCTION venues_view_insert();
CREATE TRIGGER venues_update INSTEAD OF UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION venues_view_update();
CREATE TRIGGER venues_delete INSTEAD OF DELETE ON venues
  FOR EACH ROW EXECUTE FUNCTION venues_view_delete();
```

#### Migration 1c: Rename related tables + FK columns

```sql
-- Rename related tables (backward-compatible views for each)
ALTER TABLE venue_destination_details RENAME TO place_vertical_details_legacy;
CREATE VIEW venue_destination_details AS SELECT * FROM place_vertical_details_legacy;

ALTER TABLE venue_occasions RENAME TO place_occasions;
ALTER TABLE place_occasions RENAME COLUMN venue_id TO place_id;
CREATE VIEW venue_occasions AS SELECT *, place_id AS venue_id FROM place_occasions;

ALTER TABLE venue_specials RENAME TO place_specials;
ALTER TABLE place_specials RENAME COLUMN venue_id TO place_id;
CREATE VIEW venue_specials AS SELECT *, place_id AS venue_id FROM place_specials;

-- FK column renames on dependent tables
ALTER TABLE events RENAME COLUMN venue_id TO place_id;
ALTER TABLE editorial_mentions RENAME COLUMN venue_id TO place_id;
ALTER TABLE programs RENAME COLUMN venue_id TO place_id;
ALTER TABLE exhibitions RENAME COLUMN venue_id TO place_id;
ALTER TABLE open_calls RENAME COLUMN venue_id TO place_id;
ALTER TABLE places RENAME COLUMN parent_venue_id TO parent_place_id;

-- Note: events.place_id rename is critical path. The refresh_feed_events_ready
-- function must be updated in the SAME migration (see 1d).
```

#### Migration 1d: Update feed + RPC functions

```sql
-- Update feed_events_ready column names
ALTER TABLE feed_events_ready RENAME COLUMN venue_id TO place_id;
ALTER TABLE feed_events_ready RENAME COLUMN venue_name TO place_name;
ALTER TABLE feed_events_ready RENAME COLUMN venue_slug TO place_slug;
ALTER TABLE feed_events_ready RENAME COLUMN venue_neighborhood TO place_neighborhood;
ALTER TABLE feed_events_ready RENAME COLUMN venue_city TO place_city;
ALTER TABLE feed_events_ready RENAME COLUMN venue_type TO place_type;
ALTER TABLE feed_events_ready RENAME COLUMN venue_image_url TO place_image_url;
ALTER TABLE feed_events_ready RENAME COLUMN venue_active TO place_active;

-- Replace refresh_feed_events_ready to read from `places` + `place_id`
CREATE OR REPLACE FUNCTION refresh_feed_events_ready() ...
-- (Full function body references places instead of venues,
--  e.place_id instead of e.venue_id, etc.)

-- Replace search_venues_ranked → search_places_ranked
-- Add required p_city parameter
CREATE OR REPLACE FUNCTION search_places_ranked(
  p_query TEXT,
  p_city TEXT NOT NULL,  -- NEW: required
  p_limit INTEGER DEFAULT 10,
  ...
) ...

-- Keep old function name as wrapper during migration
CREATE OR REPLACE FUNCTION search_venues_ranked(...) ...
  RETURN QUERY SELECT * FROM search_places_ranked(p_query, p_city, ...);

-- Enable RLS
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "places_read" ON places FOR SELECT USING (true);
CREATE POLICY "places_write" ON places FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

#### Migration 1e: Create new extension tables + candidates

```sql
CREATE TABLE place_profile (...);  -- as specified above
CREATE TABLE place_vertical_details (...);  -- as specified above
CREATE TABLE place_candidates (...);  -- as specified above

-- RLS on candidates
ALTER TABLE place_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_read" ON place_candidates FOR SELECT
  USING (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));
CREATE POLICY "candidates_write" ON place_candidates FOR ALL
  USING (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ))
  WITH CHECK (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));
```

#### Migration 1f: Data migration (populate extension tables)

```sql
-- Migrate venue_destination_details → place_vertical_details.outdoor
INSERT INTO place_vertical_details (place_id, outdoor, updated_at)
SELECT venue_id, jsonb_build_object(
  'destination_type', destination_type,
  'commitment_tier', commitment_tier,
  'difficulty_level', difficulty_level,
  'trail_length_miles', trail_length_miles,
  'elevation_gain_ft', elevation_gain_ft,
  -- ... all fields
), updated_at
FROM place_vertical_details_legacy;

-- Migrate dining columns from places base → place_vertical_details.dining
INSERT INTO place_vertical_details (place_id, dining)
SELECT id, jsonb_build_object(
  'menu_url', menu_url,
  'reservation_url', reservation_url,
  'service_style', service_style,
  -- ... all dining fields
)
FROM places
WHERE menu_url IS NOT NULL OR service_style IS NOT NULL
  OR accepts_reservations IS NOT NULL
ON CONFLICT (place_id) DO UPDATE SET dining = EXCLUDED.dining;

-- Migrate profile columns
INSERT INTO place_profile (place_id, description, hero_image_url, featured, planning_notes, ...)
SELECT id, description, hero_image_url, featured, planning_notes, ...
FROM places
WHERE description IS NOT NULL OR hero_image_url IS NOT NULL
  OR featured = true OR planning_notes IS NOT NULL;

-- Merge Google places data into unified places table
-- (Separate migration script — matches on address/name/coordinates)
```

### Phase 2: New Code Uses "places" (ongoing)

- New API routes at `/api/places/*`
- New components use `Place` types
- New crawlers reference `places` table

### Phase 3: Incremental Code Migration (per-module PRs)

Order: search → spots/find → feed → destinations → detail pages → crawlers

Each module gets its own PR. Each is independently deployable. The backward-compatible views mean nothing breaks during migration.

### Phase 4: Cleanup

- Drop backward-compatible views (`venues`, `venue_occasions`, etc.)
- Remove old API routes (or convert to permanent redirects)
- Remove old component files
- Drop legacy tables (`place_vertical_details_legacy`, Google `places`)

---

## Deduplication Improvements

### Current State (Problems)

1. No alias checking in `get_or_create_venue` matching
2. No geographic proximity component — two "The EARL" entries in different cities can merge
3. Cache-first architecture with stale caches across concurrent crawler processes
4. No merge capability for discovered duplicates
5. No staging area — unmatched locations get `venue_id = NULL` on events

### New State

1. **Alias-aware matching** as first-class lookup
2. **Proximity + name matching** with PostGIS `ST_DWithin(500m)`
3. **`place_candidates` staging table** — crawlers write unmatched locations here instead of NULL
4. **Confidence-scored matching** — auto-confirm > 0.9, review queue 0.5-0.9
5. **`merge_places(keep_id, remove_id)` function** — re-parents all FKs and soft-deletes the duplicate:

```sql
CREATE OR REPLACE FUNCTION merge_places(p_keep_id INTEGER, p_remove_id INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Re-parent all FK references
  UPDATE events SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE place_occasions SET place_id = p_keep_id WHERE place_id = p_remove_id
    ON CONFLICT (place_id, occasion) DO NOTHING;
  UPDATE place_specials SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE editorial_mentions SET place_id = p_keep_id WHERE place_id = p_remove_id
    ON CONFLICT (article_url, place_id) DO NOTHING;
  UPDATE programs SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE exhibitions SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE open_calls SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE walkable_neighbors SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE walkable_neighbors SET neighbor_place_id = p_keep_id WHERE neighbor_place_id = p_remove_id;

  -- Merge aliases (union of both)
  UPDATE places SET aliases = (
    SELECT array_agg(DISTINCT a) FROM (
      SELECT unnest(aliases) AS a FROM places WHERE id IN (p_keep_id, p_remove_id)
    ) sub
  ) WHERE id = p_keep_id;

  -- Soft-delete the duplicate
  UPDATE places SET active = false WHERE id = p_remove_id;

  -- Log the merge
  INSERT INTO place_candidates (raw_name, status, matched_place_id, promoted_to_place_id, reviewed_at)
  SELECT name, 'merged', p_remove_id, p_keep_id, now()
  FROM places WHERE id = p_remove_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Full-Text Search

The current `venues` table has a `search_vector` tsvector column (migration 046) used by `search_venues_ranked`. The Google `places` table has a separate `fts` tsvector column.

**Decision:** The `search_vector` column carries forward on the `places` table. The `search_places_ranked` function updates to use it. The Google `fts` column data is merged during the Google Places data migration (Phase 1f). The tsvector trigger/function that maintains `search_vector` must be updated to reference `places` instead of `venues`.

---

## What Gets Dropped

| Data/Feature | Disposition |
|---|---|
| Google `places` table | Data merged into unified `places` + `place_vertical_details.google`. Table dropped. |
| Google `neighborhoods` table | Stays as-is (separate concept from places) |
| `hospital_nearby_places` materialized view | Recreated against unified `places` table |
| `place_user_signals` table | Stays, FK updated to reference `places` |
| Old `explore_tracks` / `explore_track_venues` | Already migrated to `lists`. No change. |
| `venue_features` table | Absorbed into `place_profile` or `place_vertical_details` |
| `venue_highlights` table | Absorbed into `place_profile` |
| `walkable_neighbors` table | Updated FKs, stays as-is |

---

## Success Criteria

1. **Single `places` table** is the only location entity in the system
2. **PostGIS spatial queries** work on all places (not just Google-sourced ones)
3. **Zero cross-portal data leakage** — all list/search endpoints enforce city context
4. **Dedup improvements measurable** — track `place_candidates` volume vs old NULL venue_id rate
5. **All API routes** serve from `/api/places/*`
6. **All components** use `Place` / `PlaceCard` types
7. **All crawlers** write to `places` table via `get_or_create_place()`
8. **Backward-compatible views dropped** — no legacy `venues` references remain
9. **TypeScript builds clean** — no `venue` type references
10. **Zero downtime** throughout the migration
