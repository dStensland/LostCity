# Unified Find — Phase 0: Data Layer Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `place_profile` and `place_vertical_details` into the discovery and detail APIs so all downstream UI work has real data.

**Architecture:** Add PostgREST foreign key joins to the existing `/api/spots` route and `getSpotDetail()` function. Create a new `PlaceGoogleDetails` type. Add a `get_right_now_feed` Supabase RPC for the unified stream's temporal section.

**Tech Stack:** Supabase (PostgREST joins, RPC), TypeScript types, Next.js API routes

**Spec:** `docs/superpowers/specs/2026-03-29-unified-find-and-detail-redesign.md` — Sections 3 (API Strategy) and 4 (Prerequisite)

---

### Task 1: Add PlaceGoogleDetails type

**Files:**
- Modify: `web/lib/types/places.ts:127-131`

- [ ] **Step 1: Add the PlaceGoogleDetails interface**

Add after `PlaceOutdoorDetails` (line ~121) and before the composed types:

```typescript
export interface PlaceGoogleDetails {
  place_id: string | null;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  types: string[] | null;
  google_maps_url: string | null;
  enriched_at: string | null;
}
```

- [ ] **Step 2: Update PlaceDetail composed type**

Replace the existing `PlaceDetail` type (lines 127-131):

```typescript
export type PlaceDetail = Place & {
  profile: PlaceProfile | null;
  dining: PlaceDiningDetails | null;
  outdoor: PlaceOutdoorDetails | null;
  google: PlaceGoogleDetails | null;
};
```

- [ ] **Step 3: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS (no consumers of PlaceDetail yet)

- [ ] **Step 4: Commit**

```bash
git add web/lib/types/places.ts
git commit -m "feat(types): add PlaceGoogleDetails type and update PlaceDetail composed type"
```

---

### Task 2: Wire place_profile and place_vertical_details into getSpotDetail()

**Files:**
- Modify: `web/lib/spot-detail.ts:192-209` (SpotDetailPayload type)
- Modify: `web/lib/spot-detail.ts:444-582` (Promise.all block)
- Modify: `web/lib/spot-detail.ts:616-635` (return object)

- [ ] **Step 1: Extend SpotDetailPayload type**

Add two new fields to the `SpotDetailPayload` type (after `walkableNeighbors`, before the closing brace):

```typescript
  placeProfile: PlaceProfile | null;
  placeVerticalDetails: {
    dining: PlaceDiningDetails | null;
    outdoor: PlaceOutdoorDetails | null;
    google: PlaceGoogleDetails | null;
  } | null;
```

Add the imports at the top of the file:

```typescript
import type { PlaceProfile, PlaceDiningDetails, PlaceOutdoorDetails, PlaceGoogleDetails } from "@/lib/types/places";
```

- [ ] **Step 2: Add parallel fetches to Promise.all block**

Add two new promises to the array inside `Promise.all` (after the walkable neighbors promise, before the closing bracket):

```typescript
    // Place profile
    supabase
      .from("place_profile")
      .select("*")
      .eq("place_id", spotData.id)
      .maybeSingle(),
    // Place vertical details
    supabase
      .from("place_vertical_details")
      .select("dining, outdoor, google")
      .eq("place_id", spotData.id)
      .maybeSingle(),
```

- [ ] **Step 3: Destructure the new results**

Add to the destructuring of the Promise.all result (after `walkableNeighborsRaw`):

```typescript
    { data: placeProfileData },
    { data: verticalDetailsData },
```

- [ ] **Step 4: Add to return object**

Add to the return object (after `walkableNeighbors`):

```typescript
    placeProfile: (placeProfileData as PlaceProfile) ?? null,
    placeVerticalDetails: verticalDetailsData
      ? {
          dining: (verticalDetailsData.dining as PlaceDiningDetails) ?? null,
          outdoor: (verticalDetailsData.outdoor as PlaceOutdoorDetails) ?? null,
          google: (verticalDetailsData.google as PlaceGoogleDetails) ?? null,
        }
      : null,
```

- [ ] **Step 5: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/lib/spot-detail.ts
git commit -m "feat(api): wire place_profile and place_vertical_details into getSpotDetail()"
```

---

### Task 3: Add Google rating to discovery card API (/api/spots)

**Files:**
- Modify: `web/app/api/spots/route.ts:270-273` (select statement)
- Modify: `web/app/api/spots/route.ts:216-266` (VenueRow and SpotRow types)
- Modify: `web/app/api/spots/route.ts:540-585` (shape mapping)

- [ ] **Step 1: Extend the select to join place_vertical_details**

Replace the select string at line 272 to add the PostgREST foreign key join:

```typescript
  .select("id, name, slug, address, neighborhood, place_type, location_designator, city, image_url, lat, lng, price_level, hours, hours_display, vibes, short_description, genres, place_vertical_details(google)")
```

Note: PostgREST joins use the table name as a nested object. The `google` column is JSONB and will come back as `place_vertical_details: { google: {...} } | null`.

- [ ] **Step 2: Extend VenueRow type**

Add to the `VenueRow` type (around line 216):

```typescript
  place_vertical_details: { google: { rating: number | null; rating_count: number | null } | null } | null;
```

- [ ] **Step 3: Extend SpotRow type**

Add to the `SpotRow` type (around line 240):

```typescript
  google_rating: number | null;
  google_rating_count: number | null;
```

- [ ] **Step 4: Map the joined data in the shape block**

In the venue mapping block (around line 550), extract the Google data:

```typescript
  const googleData = venue.place_vertical_details?.google;
  const baseSpot: SpotRow = {
    // ... existing fields ...
    google_rating: googleData?.rating ?? null,
    google_rating_count: googleData?.rating_count ?? null,
  };
```

- [ ] **Step 5: Run type check and test**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

Run the dev server and test: `curl 'http://localhost:3000/api/spots?portal=atlanta&limit=5' | jq '.[0] | {name, google_rating, google_rating_count}'`
Expected: google_rating and google_rating_count fields present (may be null if no data)

- [ ] **Step 6: Commit**

```bash
git add web/app/api/spots/route.ts
git commit -m "feat(api): add Google rating to /api/spots via place_vertical_details join"
```

---

### Task 4: Create get_right_now_feed Supabase RPC

**Files:**
- Create: `supabase/migrations/20260329100000_right_now_feed_rpc.sql`
- Create: `web/app/api/find/right-now/route.ts`

- [ ] **Step 1: Write the migration SQL**

```sql
-- RPC: get_right_now_feed
-- Returns up to 6 items (events + places) ranked by temporal relevance
-- Used by the unified Find stream's "Right Now" section

CREATE OR REPLACE FUNCTION get_right_now_feed(
  p_portal_id INTEGER DEFAULT NULL,
  p_city TEXT DEFAULT 'Atlanta',
  p_limit INTEGER DEFAULT 6
)
RETURNS TABLE (
  entity_type TEXT,
  id INTEGER,
  name TEXT,
  slug TEXT,
  image_url TEXT,
  place_type TEXT,
  neighborhood TEXT,
  -- Event-specific
  start_date DATE,
  start_time TIME,
  category_id TEXT,
  is_free BOOLEAN,
  price_min NUMERIC,
  -- Place-specific
  is_open BOOLEAN,
  closes_at TEXT,
  google_rating NUMERIC,
  google_rating_count INTEGER,
  short_description TEXT,
  -- Shared
  relevance_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH upcoming_events AS (
    SELECT
      'event'::TEXT AS entity_type,
      e.id,
      e.title AS name,
      e.id::TEXT AS slug,
      COALESCE(e.image_url, p.image_url) AS image_url,
      p.place_type,
      p.neighborhood,
      e.start_date,
      e.start_time,
      e.category_id,
      e.is_free,
      e.price_min,
      FALSE AS is_open,
      NULL::TEXT AS closes_at,
      NULL::NUMERIC AS google_rating,
      NULL::INTEGER AS google_rating_count,
      NULL::TEXT AS short_description,
      -- Score: closer start time = higher score
      (1.0 - LEAST(EXTRACT(EPOCH FROM (e.start_date + e.start_time - NOW())) / 10800.0, 1.0))::NUMERIC AS relevance_score
    FROM events e
    JOIN places p ON p.id = e.place_id
    WHERE e.start_date = CURRENT_DATE
      AND e.start_time IS NOT NULL
      AND e.start_time > (CURRENT_TIME - INTERVAL '1 hour')
      AND e.start_time < (CURRENT_TIME + INTERVAL '3 hours')
      AND e.is_feed_ready = TRUE
      AND p.city ILIKE p_city || '%'
      AND (p_portal_id IS NULL OR e.portal_id = p_portal_id OR e.portal_id IS NULL)
    ORDER BY relevance_score DESC
    LIMIT 10
  ),
  open_places AS (
    SELECT
      'place'::TEXT AS entity_type,
      p.id,
      p.name,
      p.slug,
      COALESCE(pp.hero_image_url, p.image_url) AS image_url,
      p.place_type,
      p.neighborhood,
      NULL::DATE AS start_date,
      NULL::TIME AS start_time,
      NULL::TEXT AS category_id,
      NULL::BOOLEAN AS is_free,
      NULL::NUMERIC AS price_min,
      TRUE AS is_open,
      NULL::TEXT AS closes_at,
      (pvd.google->>'rating')::NUMERIC AS google_rating,
      (pvd.google->>'rating_count')::INTEGER AS google_rating_count,
      p.short_description,
      -- Score: places with events today get a boost
      (0.5 + COALESCE(p.final_score / 200.0, 0))::NUMERIC AS relevance_score
    FROM places p
    LEFT JOIN place_profile pp ON pp.place_id = p.id
    LEFT JOIN place_vertical_details pvd ON pvd.place_id = p.id
    WHERE p.is_active != FALSE
      AND p.city ILIKE p_city || '%'
      AND p.hours IS NOT NULL
      AND p.place_type IS NOT NULL
      AND (p_portal_id IS NULL OR p.owner_portal_id = p_portal_id OR p.owner_portal_id IS NULL)
    ORDER BY relevance_score DESC
    LIMIT 10
  ),
  combined AS (
    SELECT * FROM upcoming_events
    UNION ALL
    SELECT * FROM open_places
  )
  SELECT * FROM combined
  ORDER BY relevance_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant access
GRANT EXECUTE ON FUNCTION get_right_now_feed TO anon, authenticated;
```

- [ ] **Step 2: Apply the migration locally**

Run: `cd web && npx supabase db push` (or your local migration command)
Expected: Migration applied successfully

- [ ] **Step 3: Create the API route**

Create `web/app/api/find/right-now/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 minute cache

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const portalSlug = searchParams.get("portal") || "atlanta";
  const limit = Math.min(parseInt(searchParams.get("limit") || "6"), 12);

  const supabase = await createClient();
  const portal = await getPortalBySlug(portalSlug);
  const city = portal?.city || "Atlanta";

  const { data, error } = await supabase.rpc("get_right_now_feed", {
    p_portal_id: portal?.id ?? null,
    p_city: city,
    p_limit: limit,
  });

  if (error) {
    console.error("[right-now] RPC error:", error);
    return NextResponse.json([], { status: 500 });
  }

  return NextResponse.json(data ?? [], {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
```

- [ ] **Step 4: Test the API**

Run: `curl 'http://localhost:3000/api/find/right-now?portal=atlanta' | jq '.[] | {entity_type, name, relevance_score}'`
Expected: Mix of events and places with relevance scores

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260329100000_right_now_feed_rpc.sql web/app/api/find/right-now/route.ts
git commit -m "feat(api): add get_right_now_feed RPC and /api/find/right-now route"
```

---

### Task 5: Data completeness audit

Before proceeding to Phase 1, audit the data to determine which conditional features can ship.

**Files:**
- No code changes — this is a diagnostic task

- [ ] **Step 1: Audit artists table completeness**

```sql
-- Total artist records linked to events
SELECT COUNT(DISTINCT a.id) AS total_artists,
       COUNT(DISTINCT CASE WHEN a.bio IS NOT NULL AND a.image_url IS NOT NULL AND a.genres IS NOT NULL THEN a.id END) AS complete_artists,
       ROUND(COUNT(DISTINCT CASE WHEN a.bio IS NOT NULL AND a.image_url IS NOT NULL AND a.genres IS NOT NULL THEN a.id END)::NUMERIC / NULLIF(COUNT(DISTINCT a.id), 0) * 100, 1) AS pct_complete
FROM event_artists ea
JOIN artists a ON a.id = ea.artist_id;
```

**Decision:** If `pct_complete >= 60`, Artist Detail is approved. Otherwise, defer.

- [ ] **Step 2: Audit dining vertical details completeness**

```sql
-- Places with dining data populated
SELECT COUNT(*) AS total_restaurants,
       COUNT(CASE WHEN pvd.dining IS NOT NULL AND pvd.dining != '{}' THEN 1 END) AS with_dining_data,
       ROUND(COUNT(CASE WHEN pvd.dining IS NOT NULL AND pvd.dining != '{}' THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS pct_complete
FROM places p
LEFT JOIN place_vertical_details pvd ON pvd.place_id = p.id
WHERE p.place_type IN ('restaurant', 'bar', 'brewery', 'cocktail_bar', 'coffee_shop', 'food_hall');
```

**Decision:** If `pct_complete >= 30`, Restaurant dining variant ships. Otherwise, fall back to standard layout.

- [ ] **Step 3: Audit festival schedule data**

```sql
-- Festivals with structured lineup data
SELECT f.name, COUNT(DISTINCT fp.id) AS programs, COUNT(DISTINCT fs.id) AS sessions
FROM festivals f
LEFT JOIN festival_programs fp ON fp.festival_id = f.id
LEFT JOIN festival_sessions fs ON fs.program_id = fp.id
GROUP BY f.name
ORDER BY programs DESC
LIMIT 10;
```

**Decision:** If festivals have programs + sessions, the schedule grid ships.

- [ ] **Step 4: Document audit results**

Create a brief note in the spec or plan with the audit results and which conditional features are approved/deferred.

- [ ] **Step 5: Commit audit documentation**

```bash
git add docs/superpowers/specs/2026-03-29-unified-find-and-detail-redesign.md
git commit -m "docs: record data completeness audit results for conditional features"
```
