# Explore Tracks: Action Plan & Implementation Checklist

**Owner**: Product & Engineering  
**Timeline**: Week of 2026-02-15  
**Context**: Based on curation philosophy research (see `022-explore-tracks-curation-philosophy.md`)

---

## TL;DR: The Fix

**Current state**: 15 tracks, many with 40-80+ venues, feels like database dump  
**Target state**: 6 curated tracks, 8-15 venues each, strong editorial voice

**The 3-7-5 formula per track:**
- 3 icons (establishes credibility)
- 7 hidden gems (discovery value)
- 5 rising stars (freshness signal)
= **15 venues max**

---

## Phase 1: Data Audit (Day 1)

### [ ] Task 1.1: Export current track-venue mappings

```sql
-- Save to CSV: track_venue_audit.csv
SELECT 
  et.slug,
  et.name,
  COUNT(etv.venue_id) as current_venue_count,
  COUNT(CASE WHEN etv.is_featured THEN 1 END) as featured_count
FROM explore_tracks et
LEFT JOIN explore_track_venues etv ON etv.track_id = et.id
GROUP BY et.id, et.slug, et.name
ORDER BY current_venue_count DESC;
```

**Expected output**: CSV showing which tracks are bloated (>20 venues)

### [ ] Task 1.2: Identify auto-fill casualties

**Tracks likely to have 40+ venues** (based on migration patterns):
- `the-south-got-something-to-say` (all music_venue)
- `hard-in-da-paint` (all art galleries)
- `keep-swinging` (all sports venues)
- `city-in-a-forest` (all parks)

**Action**: Mark these for manual curation

### [ ] Task 1.3: Export full venue lists for top 6 tracks

For each of the 6 launch tracks, export full venue data:

```sql
-- Run 6 times, once per track slug
SELECT 
  v.slug,
  v.name,
  v.neighborhood,
  v.venue_type,
  v.explore_blurb,
  etv.is_featured,
  etv.editorial_blurb,
  (SELECT COUNT(*) FROM events e WHERE e.venue_id = v.id AND e.start_date >= CURRENT_DATE) as upcoming_events
FROM venues v
JOIN explore_track_venues etv ON etv.venue_id = v.id
JOIN explore_tracks et ON et.id = etv.track_id
WHERE et.slug = 'the-south-got-something-to-say'  -- Change per track
ORDER BY etv.is_featured DESC, v.name;
```

**Save as**: `the-south-got-something-to-say_venues.csv` (etc.)

---

## Phase 2: Curation Sprint (Days 2-4)

### The 6 Launch Tracks

1. **The South Got Something to Say** (Hip-Hop Heritage)
2. **Good Trouble** (Civil Rights Sites)
3. **The Itis** (Soul Food + Global Eats)
4. **The Midnight Train** (Quirky Hidden Gems)
5. **City in a Forest** (Urban Outdoors)
6. **Keep Swinging** (Sports & Game Day)

### [ ] Task 2.1: Curate "The South Got Something to Say"

**Theme**: Atlanta's hip-hop legacy + live music venues

**Target mix (15 total)**:
- 3 Icons: Terminal West, Variety Playhouse, The Tabernacle
- 7 Hidden Gems: The Earl, Aisle 5, Criminal Records, Vinyl, ??? (manual research)
- 5 Rising Stars: New venues or recently renovated (manual research)

**Checklist per venue**:
- [ ] Verify still open (Google Maps hours)
- [ ] Check upcoming events (our events table)
- [ ] Write 60-80 word editorial blurb
  - [ ] Why it matters (1 sentence)
  - [ ] What makes it special (1 sentence)
  - [ ] Insider tip (1 sentence)
- [ ] Mark 5-7 as `is_featured = true`
- [ ] Set `sort_order` (icons first, then gems, then rising)

**SQL template**:
```sql
-- Clear existing auto-fill
DELETE FROM explore_track_venues 
WHERE track_id = (SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say');

-- Insert curated picks (one by one, with editorial)
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT 
  (SELECT id FROM explore_tracks WHERE slug = 'the-south-got-something-to-say'),
  (SELECT id FROM venues WHERE slug = 'terminal-west'),
  1,
  true,
  'Where indie darlings and hip-hop legends pack the same room. The sight lines are perfect from every angle, and the sound engineer actually knows what they're doing. Pro tip: skip the Westside parking nightmare and take the free shuttle from MARTA.'
ON CONFLICT (track_id, venue_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_featured = EXCLUDED.is_featured,
  editorial_blurb = EXCLUDED.editorial_blurb;
```

**Deliverable**: `the-south-got-something-to-say_curated.sql`

### [ ] Task 2.2: Curate "Good Trouble"

**Theme**: Civil rights heritage sites

**Target mix (12 total)** - smaller list OK for museums/historical sites:
- 3 Icons: MLK National Park, Center for Civil & Human Rights, Ebenezer Baptist
- 7 Hidden Gems: Apex Museum, Herndon Home, Oakland Cemetery (civil rights section), ???
- 2 Rising Stars: Newly opened exhibits or renovated spaces

**Same checklist as 2.1**, save as `good-trouble_curated.sql`

### [ ] Task 2.3: Curate "The Itis"

**Theme**: Southern soul food + Buford Highway global eats

**Target mix (15 total)**:
- 3 Icons: Staplehouse, Twisted Soul, Busy Bee Cafe
- 7 Hidden Gems: Buford Hwy spots (Northern China Eatery, etc.), local favorites
- 5 Rising Stars: New James Beard semifinalists, recently opened

**Same checklist as 2.1**, save as `the-itis_curated.sql`

### [ ] Task 2.4: Curate "The Midnight Train"

**Theme**: Quirky, weird, hidden Atlanta

**Target mix (12 total)**:
- 3 Icons: Clermont Lounge, Junkman's Daughter, Sister Louisa's Church
- 7 Hidden Gems: Krog Street Tunnel, ??? (research quirky spots)
- 2 Rising Stars: New weird bars, oddity shops, etc.

**Same checklist as 2.1**, save as `the-midnight-train_curated.sql`

### [ ] Task 2.5: Curate "City in a Forest"

**Theme**: Parks, trails, outdoor spaces

**Target mix (15 total)**:
- 3 Icons: Piedmont Park, BeltLine, Arabia Mountain
- 7 Hidden Gems: Cascade Springs, Palisades Trail, ??? (local parks)
- 5 Rising Stars: New trail sections, recently renovated parks

**Same checklist as 2.1**, save as `city-in-a-forest_curated.sql`

### [ ] Task 2.6: Curate "Keep Swinging"

**Theme**: Sports venues + watch party spots

**Target mix (12 total)**:
- 3 Icons: Mercedes-Benz Stadium, Truist Park, State Farm Arena
- 7 Hidden Gems: Best sports bars for ATL United, Hawks watch parties, etc.
- 2 Rising Stars: New sports bars, fan zones

**Same checklist as 2.1**, save as `keep-swinging_curated.sql`

---

## Phase 3: Track Descriptions (Day 5)

### [ ] Task 3.1: Write banner descriptions

**NOT the quotes** - those stay on drill-in hero. These go on the banners.

**Format**: 1-2 sentences, 40-60 words, specific not generic

**Template**:
```typescript
// In explore_tracks table, update description field
UPDATE explore_tracks SET description = '...' WHERE slug = '...';
```

**Examples** (from comp D2):

- **The South Got Something to Say**: "The studios where OutKast recorded, the stages where trap was born, and the record shops that soundtrack the city."

- **Good Trouble**: "MLK's birthplace, lunch counter simulations, the Freedom Riders bus, and the streets where history marched."

- **The Itis**: "Soul food institutions, James Beard semifinalists, Buford Highway's global corridor, and the food halls rewriting the rules."

- **The Midnight Train**: "A cotton mill with goats, the oldest indie theater in Georgia, a 747 you can walk through, and the Clermont Lounge."

- **City in a Forest**: "Piedmont Park, the BeltLine, a flooded granite quarry, waterfall hikes 30 minutes from downtown, and the canopy that earned the name."

- **Keep Swinging**: "Mercedes-Benz Stadium, Truist Park, Atlanta United watch parties, and the sports bars where the city loses its mind."

**Deliverable**: `track_descriptions.sql`

---

## Phase 4: Hide/Merge Remaining Tracks (Day 5)

### [ ] Task 4.1: Mark non-launch tracks as inactive

```sql
-- Don't delete, just hide from UI
UPDATE explore_tracks SET is_active = false 
WHERE slug IN (
  'welcome-to-atlanta',
  'keep-moving-forward',
  'a-beautiful-mosaic',
  'tomorrow-is-another-day',
  'hard-in-da-paint',
  'the-devil-went-down-to-georgia',
  'too-busy-to-hate',
  'the-main-event',
  'lifes-like-a-movie'
);
```

**These can be re-enabled later** after manual curation.

**Note**: API routes already filter by `is_active = true`, so this hides them immediately.

---

## Phase 5: Design Polish (Day 6)

### [ ] Task 5.1: Update ExploreTrackList.tsx

**Banner pills priority** (line 383-424 in ExploreTrackList.tsx):

Current logic is good, but ensure:
- Tonight count shows first (if >0)
- Featured event shows second (if exists and not redundant with tonight)
- Weekend count shows third (if tonight == 0)
- Free count shows fourth (if <3 pills so far)

**No changes needed** - current logic already does this.

### [ ] Task 5.2: Update track descriptions in ExploreTrackList.tsx

Ensure banner descriptions (NOT quotes) render:

```tsx
{track.description && (
  <p className="explore-banner-text-sm ...">
    {track.description}
  </p>
)}
```

**Already implemented** (line 355-362).

### [ ] Task 5.3: Verify drill-in activity bar

Ensure `/api/explore/tracks/[slug]/route.ts` returns:
- `tonightCount`
- `weekendCount`
- `freeCount`
- `totalVenueCount`

**Already implemented** in detail API.

---

## Phase 6: Deploy & Monitor (Day 7)

### [ ] Task 6.1: Create migration

Combine all curation SQL into one migration:

```bash
# Create new migration file
cat > supabase/migrations/20260216000000_explore_tracks_v1_curation.sql << 'EOSQL'
-- Explore Tracks V1 Curation
-- Reduces tracks from 15 to 6, caps venues at 15 each, adds editorial voice

-- 1. Update track descriptions (banners)
-- (paste track_descriptions.sql here)

-- 2. Hide non-launch tracks
-- (paste task 4.1 SQL here)

-- 3. Curate The South Got Something to Say
-- (paste the-south-got-something-to-say_curated.sql here)

-- 4. Curate Good Trouble
-- (paste good-trouble_curated.sql here)

-- 5. Curate The Itis
-- (paste the-itis_curated.sql here)

-- 6. Curate The Midnight Train
-- (paste the-midnight-train_curated.sql here)

-- 7. Curate City in a Forest
-- (paste city-in-a-forest_curated.sql here)

-- 8. Curate Keep Swinging
-- (paste keep-swinging_curated.sql here)
EOSQL
```

### [ ] Task 6.2: Test locally

```bash
cd web
npm run dev

# Navigate to /atlanta/explore (or whatever portal)
# Click each track banner
# Verify:
# - 6 tracks show (not 15)
# - Each has <15 venues
# - Featured venues show event rows
# - Compact grid shows next event overlays
# - Pills show tonight/weekend/free counts
# - Descriptions are specific, not generic
```

### [ ] Task 6.3: Deploy to staging

```bash
git add supabase/migrations/20260216000000_explore_tracks_v1_curation.sql
git commit -m "Curate explore tracks: 6 tracks, 8-15 venues each, editorial voice"
git push origin main  # (or staging branch)
```

### [ ] Task 6.4: Set up analytics tracking

Track per track:
- `explore_track_banner_click` (banner → detail)
- `explore_track_venue_click` (detail → venue)
- `explore_track_filter_used` (Tonight, Weekend, Free, etc.)
- `explore_track_suggest_venue` (if we add suggestion button)

**Add to** `/web/lib/analytics/portal-interaction-metrics.ts`:

```typescript
export function trackExploreInteraction(
  action: 'track_click' | 'venue_click' | 'filter_used' | 'suggest_venue',
  trackSlug: string,
  metadata?: Record<string, any>
) {
  // ... existing pattern
}
```

### [ ] Task 6.5: Monitor for 1 week

**Success metrics** (per track):
- CTR >30% (banner → detail)
- Bounce rate <40% (detail → venue)
- Avg 2+ venue clicks per session
- 80%+ of venues get ≥1 click per week

**Kill criteria** (after 2 weeks):
- CTR <15%
- Bounce rate >60%
- Only top 3 venues getting clicks (rest are dead weight)

**Action if failing**: Re-curate (swap out low-click venues) or merge/hide track.

---

## Phase 7: Future Enhancements (Month 2+)

### [ ] Add "Suggest a venue" button

On each track detail page, add:

```tsx
<button 
  onClick={() => {
    // Open modal or drawer
    // POST to /api/explore/tracks/[slug]/suggest
    // Body: { venue_name, reason }
  }}
  className="..."
>
  Suggest a venue for this track
</button>
```

Store suggestions in new table:
```sql
CREATE TABLE explore_track_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES explore_tracks(id),
  user_id UUID REFERENCES profiles(id),
  venue_id UUID REFERENCES venues(id) NULL,
  venue_name TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',  -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### [ ] Add seasonal/special tracks

Examples:
- "Summer in Atlanta" (outdoor concerts, rooftop bars, festivals)
- "Holiday Lights Tour" (Dec only)
- "Festival Season" (Mar-Nov, major festivals)
- "Date Night Spots" (romantic, upscale, special occasion)
- "First-Time Visitor Hits" (tourist-friendly, iconic)

**Mark these with** `is_seasonal = true, season_start, season_end` in schema.

### [ ] Enable user-generated tracks

Let power users (verified visitors, admins) create tracks:
- `created_by` field on explore_tracks
- Approval workflow (auto-approve for staff, review for users)
- Public vs private tracks
- Sharing URLs

**Table updates**:
```sql
ALTER TABLE explore_tracks ADD COLUMN created_by UUID REFERENCES profiles(id);
ALTER TABLE explore_tracks ADD COLUMN is_public BOOLEAN DEFAULT true;
ALTER TABLE explore_tracks ADD COLUMN approved_at TIMESTAMPTZ;
```

---

## Appendix: SQL Snippets

### Venue blurb template (for copy-paste)

```sql
INSERT INTO explore_track_venues (track_id, venue_id, sort_order, is_featured, editorial_blurb)
SELECT 
  (SELECT id FROM explore_tracks WHERE slug = 'TRACK_SLUG'),
  (SELECT id FROM venues WHERE slug = 'VENUE_SLUG'),
  SORT_ORDER_NUM,
  IS_FEATURED_BOOL,
  'SENTENCE_1. SENTENCE_2. SENTENCE_3_INSIDER_TIP.'
ON CONFLICT (track_id, venue_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_featured = EXCLUDED.is_featured,
  editorial_blurb = EXCLUDED.editorial_blurb;
```

### Bulk venue check (are they open?)

```sql
-- List all venues in a track with Google Maps link for manual check
SELECT 
  v.slug,
  v.name,
  v.address,
  v.neighborhood,
  'https://www.google.com/maps/search/?api=1&query=' || REPLACE(v.name || ' ' || v.address, ' ', '+') as google_maps_link
FROM venues v
JOIN explore_track_venues etv ON etv.venue_id = v.id
JOIN explore_tracks et ON et.id = etv.track_id
WHERE et.slug = 'the-south-got-something-to-say'
ORDER BY etv.sort_order;
```

### Count upcoming events per venue

```sql
-- Which venues have the most upcoming events? (prioritize these as featured)
SELECT 
  v.slug,
  v.name,
  COUNT(e.id) as upcoming_events
FROM venues v
JOIN explore_track_venues etv ON etv.venue_id = v.id
JOIN explore_tracks et ON et.id = etv.track_id
LEFT JOIN events e ON e.venue_id = v.id AND e.start_date >= CURRENT_DATE
WHERE et.slug = 'the-south-got-something-to-say'
GROUP BY v.id, v.slug, v.name
ORDER BY upcoming_events DESC, v.name;
```

---

**END OF ACTION PLAN**

