# Exhibition Critical Blockers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 4 critical blockers preventing exhibition data from reaching users: dead feed section, missing venue type registrations, broken search, and wrong art/non-art detection.

**Architecture:** Four independent fixes touching separate files. No new components — just wiring and configuration that should have been connected.

**Tech Stack:** Next.js, TypeScript, PostgreSQL

---

### Task 1: Wire WhatsOnNowSection into CityPulseShell

**Context:** `WhatsOnNowSection` and `ExhibitionRowCard` are built and complete but imported by nothing. Zero users see exhibition data in any feed.

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx`

- [ ] **Step 1: Add the dynamic import**

At the top of the file with the other dynamic imports (around line 82-90), add:

```typescript
const WhatsOnNowSection = dynamic<{ portalSlug: string; title: string; exhibitionTypes?: string[] }>(
  () => import("./sections/WhatsOnNowSection").then((m) => ({ default: m.WhatsOnNowSection })),
  { ssr: false },
);
```

- [ ] **Step 2: Add the section to the feed block renderer**

Find the switch statement that renders feed blocks (around line 400+). Add a new case after the `"cinema"` block (VenuesSection) and before the `"sports"` block (GameDaySection):

```typescript
      case "exhibitions":
        return (
          <div
            key="city-pulse-exhibitions"
            id="city-pulse-exhibitions"
            data-feed-anchor="true"
            data-index-label="What's On"
            data-block-id="exhibitions"
            className="mt-8 scroll-mt-28"
          >
            <div className="h-px bg-[var(--twilight)]" />
            <div className="pt-6">
              <LazySection minHeight={200}>
                <WhatsOnNowSection
                  portalSlug={portalSlug}
                  title="What's On Now"
                />
              </LazySection>
            </div>
          </div>
        );
```

- [ ] **Step 3: Add "exhibitions" to the feed block order**

Find `DEFAULT_FEED_ORDER` in `web/lib/city-pulse/types.ts`. Add `"exhibitions"` after `"cinema"`:

```typescript
export const DEFAULT_FEED_ORDER: FeedBlockId[] = [
  "hero",
  "news",
  "lineup",
  "regulars",
  "places",
  "cinema",
  "exhibitions",  // ← add here
  "sports",
  "horizon",
];
```

Also add `"exhibitions"` to the `FeedBlockId` type union if it's not already there.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add web/components/feed/CityPulseShell.tsx web/lib/city-pulse/types.ts
git commit -m "feat(feed): wire WhatsOnNowSection into CityPulse feed

The component was built but never imported. Now surfaces exhibitions
in the Atlanta feed between Venues and Game Day sections."
```

---

### Task 2: Register Aquarium/Zoo/Garden as Feature-Heavy Venue Types

**Context:** `FEATURE_HEAVY_TYPES` includes museum, gallery, park, historic_site — but not aquarium, zoo, garden, or attraction. Georgia Aquarium's features render at position #6 (below events) instead of position #1 (above the fold).

**Files:**
- Modify: `web/lib/place-features.ts:67-72`
- Modify: `web/lib/place-features-config.ts:24-31`

- [ ] **Step 1: Add types to FEATURE_HEAVY_TYPES**

In `web/lib/place-features.ts`, change lines 67-72 from:

```typescript
const FEATURE_HEAVY_TYPES = new Set([
  "park",
  "historic_site",
  "museum",
  "gallery",
]);
```

to:

```typescript
const FEATURE_HEAVY_TYPES = new Set([
  "park",
  "historic_site",
  "museum",
  "gallery",
  "aquarium",
  "zoo",
  "garden",
  "attraction",
  "theme_park",
  "science_center",
]);
```

- [ ] **Step 2: Add section config entries**

In `web/lib/place-features-config.ts`, add entries to `FEATURE_SECTION_CONFIG` (after the existing entries, before the closing `}`):

```typescript
  aquarium: { title: "Exhibits & Habitats", Icon: Compass, color: "#38BDF8" },
  zoo: { title: "Animal Habitats", Icon: TreePalm, color: "#4ADE80" },
  garden: { title: "Gardens & Grounds", Icon: TreePalm, color: "#86EFAC" },
  attraction: { title: "What's Here", Icon: Star, color: "#FB923C" },
  theme_park: { title: "Rides & Attractions", Icon: Star, color: "#FB923C" },
  science_center: { title: "Exhibits & Experiences", Icon: Compass, color: "#38BDF8" },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add web/lib/place-features.ts web/lib/place-features-config.ts
git commit -m "fix(detail): register aquarium/zoo/garden as feature-heavy venue types

Features at aquariums, zoos, gardens, theme parks, and science centers
now render at position #1 (above the fold) with appropriate section
titles and accent colors."
```

---

### Task 3: Fix Exhibition Search to Match Venue Names

**Context:** Searching "aquarium" returns 1 result because the search RPC only queries exhibition title/description, not the venue name. The most natural queries (venue name + category) largely fail.

**Files:**
- Create: `supabase/migrations/20260410020001_fix_exhibition_search_venue_name.sql`

- [ ] **Step 1: Write the updated RPC**

Create `supabase/migrations/20260410020001_fix_exhibition_search_venue_name.sql`:

```sql
-- Fix exhibition search to include venue name in relevance scoring.
-- Before: only searched exhibition title + description.
-- After: also matches venue name, so "aquarium" finds Georgia Aquarium exhibitions.

CREATE OR REPLACE FUNCTION search_exhibitions_ranked(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_portal_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  slug TEXT,
  description TEXT,
  image_url TEXT,
  opening_date DATE,
  closing_date DATE,
  exhibition_type TEXT,
  admission_type TEXT,
  place_id INTEGER,
  venue_name TEXT,
  venue_neighborhood TEXT,
  combined_score REAL
) AS $$
DECLARE
  v_tsquery tsquery;
  v_search_terms TEXT;
BEGIN
  v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
  v_tsquery := to_tsquery('english', v_search_terms);

  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.slug,
    e.description,
    e.image_url,
    e.opening_date,
    e.closing_date,
    e.exhibition_type,
    e.admission_type,
    e.place_id,
    v.name AS venue_name,
    v.neighborhood AS venue_neighborhood,
    (
      -- Base text relevance (exhibition content + venue name)
      (
        ts_rank_cd(
          to_tsvector('english',
            COALESCE(e.title, '') || ' ' ||
            COALESCE(e.description, '') || ' ' ||
            COALESCE(v.name, '')
          ),
          v_tsquery,
          32
        ) * 0.5 +
        similarity(e.title, p_query) * 0.2 +
        similarity(COALESCE(v.name, ''), p_query) * 0.2 +
        CASE WHEN lower(e.title) = lower(p_query) THEN 1.0 ELSE 0 END +
        CASE WHEN lower(e.title) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END +
        CASE WHEN lower(v.name) LIKE '%' || lower(p_query) || '%' THEN 0.3 ELSE 0 END
      )
      -- Currently-showing boost
      * CASE
          WHEN e.closing_date IS NULL THEN 1.2
          WHEN e.closing_date >= CURRENT_DATE THEN 1.4
          ELSE 0.6
        END
      -- Data completeness multiplier
      * (0.7
          + CASE WHEN e.description IS NOT NULL AND length(e.description) > 50 THEN 0.1 ELSE 0 END
          + CASE WHEN e.image_url IS NOT NULL THEN 0.1 ELSE 0 END
          + CASE WHEN e.place_id IS NOT NULL THEN 0.1 ELSE 0 END
        )
    )::REAL AS combined_score
  FROM exhibitions e
  LEFT JOIN places v ON e.place_id = v.id
  WHERE
    e.is_active = true
    AND (
      to_tsvector('english',
        COALESCE(e.title, '') || ' ' ||
        COALESCE(e.description, '') || ' ' ||
        COALESCE(v.name, '')
      ) @@ v_tsquery
      OR similarity(e.title, p_query) > 0.2
      OR similarity(COALESCE(v.name, ''), p_query) > 0.3
    )
    AND (
      p_portal_id IS NULL
      OR e.portal_id = p_portal_id
    )
  ORDER BY combined_score DESC, e.closing_date ASC NULLS LAST, e.title ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_exhibitions_ranked(text, integer, integer, uuid)
IS 'Full-text + trigram search for exhibitions with venue name matching, currently-showing boost, and data-quality scoring. 2026-04-10.';
```

- [ ] **Step 2: Push the migration**

```bash
cd /Users/coach/Projects/LostCity && npx supabase db push
```

- [ ] **Step 3: Verify the fix**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
client = get_client()

for q in ['aquarium', 'high museum', 'zoo atlanta', 'botanical garden']:
    result = client.rpc('search_exhibitions_ranked', {
        'p_query': q, 'p_limit': 5, 'p_offset': 0, 'p_portal_id': None
    }).execute()
    print(f'\"{q}\": {len(result.data)} results')
    for r in result.data[:3]:
        print(f'  {r[\"title\"][:40]:40s} @ {r[\"venue_name\"] or \"?\"}  score={r[\"combined_score\"]:.3f}')
    print()
"
```

Expected: "aquarium" returns multiple Georgia Aquarium exhibitions, not just the Educators' Ball.

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add supabase/migrations/20260410020001_fix_exhibition_search_venue_name.sql
git commit -m "fix(search): include venue name in exhibition search scoring

Searching 'aquarium' now finds Georgia Aquarium exhibitions.
Added venue name to tsvector, similarity scoring, and WHERE clause."
```

---

### Task 4: Fix isArtExhibition to Use Portal Slug

**Context:** The exhibition detail page uses `ART_EXHIBITION_TYPES.has(exhibition.exhibition_type)` to decide art vs. non-art rendering. But a solo dinosaur exhibit at Fernbank with `type = "solo"` would render with Playfair italic and curator credits. The split should be portal-based, not type-based.

**Files:**
- Modify: `web/app/[portal]/exhibitions/[slug]/page.tsx:23-30`

- [ ] **Step 1: Change the detection logic**

In `web/app/[portal]/exhibitions/[slug]/page.tsx`, replace lines 23-30:

```typescript
const ART_EXHIBITION_TYPES = new Set([
  "solo",
  "group",
  "installation",
  "retrospective",
  "popup",
  "permanent",
]);
```

with:

```typescript
const ART_PORTAL_SLUGS = new Set(["arts"]);
```

- [ ] **Step 2: Update the isArtExhibition derivation**

Find where `isArtExhibition` is computed (should be something like `const isArtExhibition = ART_EXHIBITION_TYPES.has(exhibition.exhibition_type)`). Change to:

```typescript
const isArtExhibition = ART_PORTAL_SLUGS.has(portalSlug);
```

This means: on the Arts portal, all exhibitions render with gallery aesthetics. On every other portal, all exhibitions render with the platform-standard non-art template. The portal context determines the aesthetic, not the exhibition type.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add "web/app/[portal]/exhibitions/[slug]/page.tsx"
git commit -m "fix(exhibitions): use portal slug for art/non-art rendering, not exhibition type

A solo dinosaur exhibit at Fernbank was rendering with Playfair italic
and curator credits because type='solo' was in ART_EXHIBITION_TYPES.
Now the Arts portal gets gallery aesthetics; all other portals get
platform-standard rendering regardless of exhibition_type."
```

---

## Verification

After all 4 tasks:

```bash
# TypeScript clean
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit

# Search works for venue names
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
client = get_client()
for q in ['aquarium', 'high museum', 'zoo']:
    r = client.rpc('search_exhibitions_ranked', {'p_query': q, 'p_limit': 3, 'p_offset': 0, 'p_portal_id': None}).execute()
    print(f'{q}: {len(r.data)} results')
"

# Push everything
cd /Users/coach/Projects/LostCity && git push origin main
```
