# Community Needs Tags — Activation Complete

## Overview
This document summarizes the implementation of community needs tags UX across the LostCity platform. The infrastructure (Phase M: tag_definitions, entity_tag_votes, entity_tag_summary, /api/tags/vote) already existed. This work adds the UX layer to collect and surface accessibility, dietary, and family needs data.

## What Was Built

### 1. Post-RSVP Needs Prompt
**File:** `web/components/PostRsvpNeedsPrompt.tsx`

After a user RSVPs "going" to an event, a dismissible prompt appears asking them to verify venue accessibility/needs tags.

**Features:**
- Shows 3-4 relevant tags based on venue type (restaurants get dietary tags, music venues get accessibility tags)
- Simple thumbs-up voting via TagVoteChip
- Auto-dismisses after 2 votes or manual skip
- Saves dismiss state to localStorage per venue (won't re-prompt for same venue)
- Compact, non-intrusive design matching dark theme

**Integration:**
- Modified `RSVPButton.tsx` to accept `venueId`, `venueName`, `venueType` props
- Triggers prompt 800ms after successful first-time RSVP (going status only)
- Venue data must be provided by parent component (event cards/detail pages)

**Venue Type → Tag Mapping:**
```typescript
const VENUE_TYPE_TAG_MAP: Record<string, string[]> = {
  restaurant: ["wheelchair-accessible", "gluten-free-options", "vegan-options", "kid-friendly"],
  bar: ["wheelchair-accessible", "accessible-restroom", "stroller-friendly"],
  music_venue: ["wheelchair-accessible", "accessible-restroom", "hearing-loop"],
  theater: ["wheelchair-accessible", "asl-interpreted", "hearing-loop"],
  // ... etc
};
```

### 2. Needs Badges on Venue Detail
**File:** `web/app/[portal]/spots/[slug]/page.tsx` (updated)

Added a "Community Verified" section above "Community Tags" on venue detail pages.

**Implementation:**
- Imported and rendered `NeedsTagList` component (already existed)
- Shows accessibility, dietary, and family tags with 3+ confirmations
- Users can vote on tags directly from venue page
- Displays tag groups (Accessibility, Dietary Options, Family Friendly)

**Example:**
```tsx
{/* Community Verified Needs */}
<SectionHeader title="Community Verified" />
<div className="mb-6">
  <NeedsTagList entityType="venue" entityId={spot.id} title="" />
</div>
```

### 3. Needs Badge Component (Optional Enhancement)
**File:** `web/components/NeedsBadge.tsx`

A compact badge component that can be added to event cards to show verified accessibility at a glance.

**Features:**
- Shows verified badge when venue has 3+ confirmations on accessibility tags
- Prioritizes most important tags (wheelchair access, ASL, hearing loop)
- Compact mode for event cards: "♿ Verified"
- Full mode for detail pages: "♿ Wheelchair Accessible (5)"
- Fetches from `/api/tags/vote` on mount

**Usage:**
```tsx
<NeedsBadge venueId={event.venue_id} compact />
```

**Note:** Not yet integrated into EventCard.tsx. To activate:
1. Import NeedsBadge in EventCard.tsx
2. Add venueId prop to FeedEventData type
3. Render badge in card metadata section

### 4. Needs in Onboarding
**Files:**
- `web/app/onboarding/page.tsx` (updated)
- `web/app/onboarding/steps/GenrePicker.tsx` (updated)
- `web/app/api/onboarding/complete/route.ts` (updated)

Added lightweight needs toggles at the bottom of the genres step (not a full new step).

**UI Changes:**
- 3 compact toggles: "♿ Wheelchair access", "🌱 Vegan options", "👨‍👩‍👧 Family-friendly"
- Appears below genre selection grid
- Optional (user can skip entirely)
- Saves to user_preferences.needs_accessibility/needs_dietary/needs_family

**Data Flow:**
1. User toggles needs → state in GenrePicker
2. GenrePicker passes needs to onComplete callback
3. OnboardingPage sends to `/api/onboarding/complete`
4. API saves to user_preferences table (needs_accessibility, needs_dietary, needs_family arrays)

**Example onboarding completion payload:**
```json
{
  "selectedCategories": ["music", "food_drink"],
  "selectedGenres": { "music": ["jazz", "electronic"] },
  "selectedNeeds": {
    "accessibility": ["wheelchair"],
    "dietary": ["vegan"],
    "family": ["kid-friendly"]
  }
}
```

### 5. Search Integration (Future Work)
Needs-aware search filtering was scoped but not implemented due to complexity of the search system. To add:

**Proposed API:**
```typescript
interface SearchFilters {
  // ... existing filters
  needs_accessibility?: string[];  // e.g., ["wheelchair-accessible"]
  needs_dietary?: string[];        // e.g., ["vegan-options"]
  needs_family?: string[];         // e.g., ["kid-friendly"]
}
```

**Implementation approach:**
1. Add needs filters to SearchFilters interface in `lib/search.ts`
2. Query `entity_tag_summary` to find venues with confirmed needs tags (score >= 3)
3. Filter events to only those at confirmed-accessible venues
4. Add filter UI in SimpleFilterBar or create NeedsFilterRow component

## Database Schema (Already Exists)

### tag_definitions
```sql
CREATE TABLE tag_definitions (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE,
  label TEXT,
  tag_group TEXT,  -- 'accessibility', 'dietary', 'family'
  entity_types TEXT[],  -- ['venue', 'event', 'series', 'festival']
  is_active BOOLEAN DEFAULT TRUE,
  is_official BOOLEAN DEFAULT FALSE
);
```

### entity_tag_votes
```sql
CREATE TABLE entity_tag_votes (
  id UUID PRIMARY KEY,
  entity_type TEXT CHECK (entity_type IN ('venue', 'event', 'series', 'festival')),
  entity_id INTEGER,
  tag_definition_id UUID REFERENCES tag_definitions(id),
  user_id UUID REFERENCES profiles(id),
  vote TEXT CHECK (vote IN ('confirm', 'deny')),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (entity_type, entity_id, tag_definition_id, user_id)
);
```

### entity_tag_summary (Materialized View)
```sql
CREATE MATERIALIZED VIEW entity_tag_summary AS
SELECT
  entity_type,
  entity_id,
  tag_id,
  tag_slug,
  tag_label,
  tag_group,
  confirm_count,
  deny_count,
  score  -- (confirm_count - deny_count)
FROM entity_tag_votes
JOIN tag_definitions ...
WHERE is_active = TRUE
GROUP BY ...;
```

### user_preferences
```sql
ALTER TABLE user_preferences
ADD COLUMN needs_accessibility TEXT[],  -- ['wheelchair', 'asl', 'sensory-friendly']
ADD COLUMN needs_dietary TEXT[],        -- ['vegetarian', 'vegan', 'gluten-free']
ADD COLUMN needs_family TEXT[];         -- ['stroller-friendly', 'changing-table', 'nursing-room']
```

## Tag Taxonomy

### Accessibility Tags
- `wheelchair-accessible` — Wheelchair Accessible
- `elevator-access` — Elevator Access
- `hearing-loop` — Hearing Loop
- `asl-interpreted` — ASL Interpreted
- `sensory-friendly` — Sensory Friendly
- `service-animals-welcome` — Service Animals Welcome
- `accessible-parking` — Accessible Parking
- `accessible-restroom` — Accessible Restroom

### Dietary Tags
- `gluten-free-options` — Gluten-Free Options
- `vegan-options` — Vegan Options
- `vegetarian-options` — Vegetarian Options
- `halal` — Halal
- `kosher` — Kosher
- `nut-free` — Nut-Free
- `dairy-free` — Dairy-Free
- `allergy-friendly-menu` — Allergy-Friendly Menu

### Family Tags
- `stroller-friendly` — Stroller Friendly
- `kid-friendly` — Kid Friendly
- `changing-table` — Changing Table
- `nursing-room` — Nursing Room
- `play-area` — Play Area

## API Endpoints (Already Exist)

### POST /api/tags/vote
Cast a confirm/deny vote on a tag.

**Request:**
```json
{
  "entity_type": "venue",
  "entity_id": 123,
  "tag_slug": "wheelchair-accessible",
  "vote": "confirm"
}
```

**Response:**
```json
{
  "success": true,
  "vote": { ... }
}
```

### GET /api/tags/vote
Get tag summary for an entity.

**Request:**
```
GET /api/tags/vote?entity_type=venue&entity_id=123
```

**Response:**
```json
{
  "tags": [
    {
      "tag_id": "uuid",
      "tag_slug": "wheelchair-accessible",
      "tag_label": "Wheelchair Accessible",
      "tag_group": "accessibility",
      "confirm_count": 5,
      "deny_count": 0,
      "score": 5,
      "user_vote": "confirm"  // or null if not voted
    }
  ]
}
```

### DELETE /api/tags/vote
Remove a vote.

**Request:**
```
DELETE /api/tags/vote?entity_type=venue&entity_id=123&tag_slug=wheelchair-accessible
```

## Testing Checklist

### Post-RSVP Prompt
- [ ] RSVP "going" to an event → prompt appears
- [ ] Click tag → vote registers, count updates
- [ ] Vote on 2 tags → prompt auto-dismisses
- [ ] Click "Skip" → prompt dismisses
- [ ] RSVP to same venue again → prompt does NOT re-appear
- [ ] Clear localStorage → prompt re-appears on next RSVP

### Venue Detail
- [ ] Visit venue page → Community Verified section shows (if tags exist)
- [ ] No verified tags → section shows empty state or loading skeleton
- [ ] Click tag chip → vote toggles, count updates
- [ ] 3+ confirmations → trust badge shows with count

### Onboarding
- [ ] Complete categories step → see genres + needs toggles
- [ ] Toggle needs → pills highlight
- [ ] Click finish → data saves to user_preferences
- [ ] Check database → needs_accessibility/dietary/family arrays populated

### Database
- [ ] Run migration 173 (already run): `psql $DATABASE_URL -f database/migrations/173_community_needs_tags.sql`
- [ ] Verify tag_definitions has accessibility/dietary/family tags
- [ ] Verify entity_tag_summary materialized view exists
- [ ] Check refresh schedule: `SELECT refresh_entity_tag_summary();` works

## Performance Considerations

### Materialized View Refresh
The `entity_tag_summary` view must be refreshed periodically to show updated vote counts.

**Current approach:** Manual refresh via `SELECT refresh_entity_tag_summary();`

**Recommended:** Set up a cron job (Supabase pg_cron extension):
```sql
SELECT cron.schedule(
  'refresh-tag-summary',
  '*/5 * * * *',  -- Every 5 minutes
  'SELECT refresh_entity_tag_summary();'
);
```

### Component Performance
- **PostRsvpNeedsPrompt:** Uses localStorage, no network cost on dismiss check
- **NeedsBadge:** Fetches on mount, could be optimized to batch with event data
- **NeedsTagList:** Already exists, fetches once per entity

## Future Enhancements

### 1. Needs-Aware Search (High Priority)
Add filtering to event/venue search:
- "Show only wheelchair accessible venues"
- "Vegan options available"
- "Kid-friendly events"

Implementation: Query `entity_tag_summary` with score >= 3 threshold.

### 2. Badge Integration in Event Cards (Medium Priority)
Show "♿ Verified" badge on event cards when venue has confirmed accessibility.

**To activate:**
1. Add `venue_id` to FeedEventData type in EventCard.tsx
2. Import and render `<NeedsBadge venueId={event.venue_id} compact />` in card metadata
3. Update event queries to include venue_id

### 3. Needs-Based Recommendations (Low Priority)
Use user_preferences.needs_* to:
- Boost events at accessible venues in ForYou feed
- Send notifications: "New accessible event near you"
- Create "Accessible Events" collection

### 4. Tag Verification Badges (Low Priority)
Show official verification badge when venue owner confirms tags.

**Implementation:**
- Add `is_official` flag to entity_tag_votes
- Display gold badge vs. community badge
- Require venue claim verification

### 5. Tag Suggestion Modal (Low Priority)
Allow users to suggest new tags for venues.

**Implementation:**
- Create modal similar to AddTagModal
- Submit to `entity_tag_suggestions` table
- Admin review and promote to tag_definitions

## Deployment Checklist

- [x] Create PostRsvpNeedsPrompt component
- [x] Update RSVPButton to trigger prompt
- [x] Add NeedsTagList to venue detail page
- [x] Update onboarding flow with needs toggles
- [x] Update onboarding API to save needs
- [x] Create NeedsBadge component
- [ ] Verify migration 173 ran on production
- [ ] Set up materialized view refresh cron job
- [ ] Update RSVPButton callsites to pass venue data (optional, falls back gracefully)
- [ ] Run `npx tsc --noEmit` to verify no type errors
- [ ] Test RSVP flow in staging
- [ ] Test onboarding flow in staging
- [ ] Verify venue detail page in staging

## Data Health Targets

**Success Metrics (90 days):**
- 20%+ of venues have at least 1 verified needs tag (3+ confirmations)
- 50%+ of RSVPs trigger needs prompt (not dismissed by localStorage)
- 10%+ of new users select at least 1 needs preference in onboarding

**Current Coverage:** 0% (no UX to collect data before this work)

**Path to 20% coverage:**
- RSVP prompt after 1000 "going" RSVPs → ~200 venues get votes
- Onboarding: 500 new users × 30% select needs → 150 venues get discovery boost
- Venue detail page: Organic voting by power users

## Related PRDs
- **PRD 004 Section 7:** Community Tags
- **PRD 004 Section 8.1:** Defensible Data (needs tags are nuclear moat)
- **Migration 173:** Community Needs Tags schema

## Files Modified
```
web/components/PostRsvpNeedsPrompt.tsx          (NEW)
web/components/NeedsBadge.tsx                   (NEW)
web/components/RSVPButton.tsx                   (MODIFIED)
web/app/[portal]/spots/[slug]/page.tsx          (MODIFIED)
web/app/onboarding/page.tsx                     (MODIFIED)
web/app/onboarding/steps/GenrePicker.tsx        (MODIFIED)
web/app/api/onboarding/complete/route.ts        (MODIFIED)
```

## Notes
- All mutations go through `/api/tags/vote` (no client-side Supabase)
- Rate limited: 20 votes per hour per user
- Needs tags apply to venues, events, series, festivals (entity_types)
- User must be authenticated to vote (RLS policies)
- Materialized view refresh is critical for performance
