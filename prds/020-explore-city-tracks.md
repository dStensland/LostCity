# PRD 020: Explore City Tracks

**Status:** Draft
**Created:** 2026-02-14
**Owner:** Product
**Epic:** Explore V2 — Track-Based City Guide

---

## Executive Summary

Explore is a curated city guide organized into thematic "tracks" — collections of venues with editorial voice, community contributions, and live event context. It bridges the temporal focus of the main feed ("what's happening tonight") with the spatial/identity focus of what makes Atlanta, Atlanta.

**Position in the app:**
- **Feed** = temporal ("what's happening tonight/this week")
- **Explore** = spatial/identity ("what makes Atlanta, Atlanta")
- **Find** = utilitarian directory ("search and filter everything")

Explore is evergreen but alive — venues show current exhibitions, upcoming events, and seasonal context. It's NOT a static brochure.

---

## Problem Statement

Current problems with city discovery:
1. **No curatorial voice** — Users get algorithmic feeds or blank directories, not a guided tour with perspective
2. **Events-only thinking** — Everything is temporal. No evergreen places to just know about
3. **Tourist vs. local divide** — Tourism sites are generic; local guides are fragmented on social media
4. **No community layer** — No way for locals to share tips or surface hidden gems
5. **Static content dies** — Curated lists get stale without live event context

Explore solves this by:
- Providing editorial curation with Atlanta-native voice
- Organizing venues into identity-driven tracks (not just categories)
- Adding community tips and upvotes for local wisdom
- Keeping content alive with event enrichment and "now" indicators
- Making discovery feel like an adventure, not a brochure

---

## Design Principles

### Emotional Register
**Curious, adventurous, wonder.** Reference: Atlas Obscura. Anti-reference: Facebook.

### Visual Direction
**Bold urban editorial meets gonzo journalism** — neon-edged, packed with raw content, every scroll feels like discovering something you weren't supposed to find.

**Color Palette:**
- Background: `#0E0E0E` (near-black charcoal)
- Primary accent: `#C1D32F` (Hawks Volt Green — neon with Atlanta roots)
- Secondary accent: `#E03A3E` (Torch Red)
- Highlight: `#39FF14` (pure neon for micro-moments)
- Text: `#FFFFFF`
- Muted: `#A0A0A0`

**Typography:**
- Bold condensed display for track titles/quotes (go BIG)
- Clean sans for body text
- Match Atlanta portal type system

**Photography:**
- Candid, gonzo, film grain overlay, muted color grading
- NO stock photos, NO tourism brochure aesthetic
- Prefer user-submitted, archival, or street photography

**Layout:**
- Stacked track cards with peek pattern
- Vertical scroll through all 14 tracks
- Each card shows quote + portrait background + 2-3 venue previews
- Tap to expand/drill into full track
- Masonry grid inside tracks for venue cards

**Motion:**
- Parallax on portraits (0.5x scroll speed)
- Cards lift on tap (200ms spring)
- Neon pulse on live indicators (2s loop)
- Scroll-triggered reveals (fade + slide up)
- Feels like a hum, not a bounce

**Anti-Patterns:**
- No tourism brochure look
- No Facebook feed feel
- No cute illustrations
- No pastels
- No excessive whitespace
- No stock photos

---

## The 14 Tracks

Each track has:
- **Name** (famous Atlanta quote)
- **Quote source** (who said it / context)
- **Portrait photo** (for background)
- **5-20 curated venues** inside

| # | Track Theme | Name | Quote Source | Portrait |
|---|---|---|---|---|
| 1 | Classic Atlanta<br>(Aquarium, Coke Museum, Six Flags, Zoo, big tourist hits) | "Welcome to Atlanta" | Ludacris & Jermaine Dupri | Ludacris |
| 2 | Civil Rights Heritage<br>(MLK sites, Sweet Auburn, Center for Civil & Human Rights) | "Good Trouble" | John Lewis | John Lewis |
| 3 | Hip-Hop & Music<br>(studios, venues, zones, music history) | "The South Got Something to Say" | Andre 3000, 1995 Source Awards | Andre 3000 |
| 4 | The BeltLine<br>(trail, art, food, breweries, neighborhoods) | "Keep Moving Forward" | Martin Luther King Jr. | MLK |
| 5 | Food Scene<br>(soul food, James Beard, food halls, Buford Hwy) | "The Itis" | The Boondocks / Aaron McGruder<br>(Adult Swim HQ is in Atlanta) | Boondocks art style |
| 6 | Great Outdoors<br>(trails, parks, nature, hiking, swimming) | "City in a Forest" | Official Atlanta slogan | Aerial canopy shot |
| 7 | Museums & Curiosities<br>(High Museum, Puppetry Arts, Oddities Museum, CDC Museum) | "Tomorrow Is Another Day" | Margaret Mitchell,<br>Gone with the Wind | Margaret Mitchell |
| 8 | Street Art & Public Art<br>(Krog Tunnel, Tiny Doors, BeltLine murals, Doll's Head Trail) | "Hard in Da Paint" | Waka Flocka Flame | Waka Flocka |
| 9 | International Atlanta<br>(Buford Hwy, Clarkston refugees, Korean Duluth, Ethiopian DeKalb, temples) | "A Beautiful Mosaic" | Jimmy Carter | Jimmy Carter |
| 10 | Craft Beer & Spirits<br>(brewery districts, West End trio, distilleries) | "The Devil Went Down to Georgia" | Charlie Daniels Band | Charlie Daniels |
| 11 | LGBTQ+ Atlanta<br>(Midtown, Pride, drag, ballroom, lesbian bars) | "Too Busy to Hate" | Mayor Hartsfield, 1955 | 1970 Piedmont Park<br>Pride rally |
| 12 | Atlanta Gets Weird<br>(Crypt of Civilization, one-person jail, 747 Experience, Clermont Lounge) | "The Midnight Train" | Gladys Knight & the Pips | Gladys Knight |
| 13 | Sports & Game Day<br>(Mercedes-Benz, Truist Park + Battery, Atlanta United, FIFA 2026) | "Keep Swinging" | Hank Aaron | Hank Aaron |
| 14 | Kids & Family<br>(Children's Museum, LEGOLAND, Zoo, Fernbank, Puppetry Arts, playgrounds) | "Life's Like a Movie" | Kermit the Frog /<br>Jim Henson | Jim Henson |

---

## User Experience

### Entry Points

**Primary:** Explore tab in Feed view (2nd tab: Feed → Explore → For You → Find → Tonight)

**Secondary:**
- Deep link from push notifications ("New in the BeltLine track")
- Share links to tracks or specific venues within tracks
- Portal homepage hero ("Discover Atlanta in 14 tracks")

### Track Discovery Flow

1. **Track List View** (default Explore tab view)
   - Vertical scroll of 14 track cards
   - Each card shows:
     - Quote + portrait background (parallax)
     - Track name + source attribution
     - Venue count + tip count
     - "X locals contributed" stat
     - 2-3 peeking venue previews (masonry snippet)
   - Tap card to expand into Track Detail

2. **Track Detail View** (drill-in)
   - Expanded hero with full quote + portrait (parallax)
   - Editorial description (2-3 sentences of curatorial context)
   - Masonry grid of all venues in track
   - "Suggest a Place" button (auth-gated)
   - Back to Track List

3. **Venue Card** (within track)
   - Candid photo (film grain treatment)
   - Venue name + neighborhood badge
   - Editorial blurb (track-specific context)
   - "Alive" badge if applicable:
     - "Now: [current exhibition name]"
     - "X upcoming events"
     - "Opens [season]"
   - Upvote button + count
   - Top tip peeking ("Locals say: ...")
   - Tap card to open Venue Tips Sheet

4. **Venue Tips Sheet** (bottom sheet)
   - Full editorial blurb
   - List of tips (sorted by upvotes)
   - Each tip shows:
     - Content (10-500 chars)
     - Author username (+ "Verified visitor" badge if applicable)
     - Upvote button + count
     - Flag button (report)
   - "Add a Tip" form (auth-gated, rate-limited)
   - "View Full Venue" link (to VenueDetailView)

### Community Features (Built into V1)

#### Upvotes
- Users can upvote venues within tracks to surface the best
- No downvotes (keep it positive)
- Vote count visible on venue cards
- Rate limit: **100 votes/hour**
- Upvote button: thumb icon, toggles between outlined and filled
- Optimistic UI update, rollback on error

#### Tips ("Locals Say")
- Short blurbs (10-500 chars) displayed as "Locals say: ..." alongside editorial descriptions
- Sorted by upvotes within each venue
- **Trust-tiered approval:**
  - New users → pending queue (visible only to admins)
  - Trusted users → auto-approve (live immediately)
- **Profanity filter** required (use `bad-words` library or similar)
- Rate limits:
  - **10 tips/hour**
  - **1 tip per venue per week** (prevent spam)
- **"Verified visitor" badge** for users with RSVPs/check-ins at that venue
- **Flag system:** 3+ flags from different users → auto-hide tip, send to review queue

#### Suggest a Place
- Users can suggest venues for tracks
- Goes into approval queue (leveraging existing submissions system)
- Form fields:
  - Track selection (dropdown)
  - Venue name (autocomplete from existing venues, or free text)
  - Reason (50-500 chars: "Why does this belong in this track?")
- Community upvotes on suggestions (in admin dashboard)
- Auto-add threshold (e.g., 10+ upvotes) or admin approval

#### Display Pattern

**On Venue Card (collapsed):**
```
[Venue Photo with film grain]
The Bakery
Sweet Auburn

"The museum that puts you in a lunch counter sit-in
simulation — you'll leave shaken and grateful."

▲ 127  |  "Go on a weekday morning. The interactive..." — @marcus_atl
```

**In Venue Tips Sheet (expanded):**
```
[Editorial Blurb]
The museum that puts you in a lunch counter sit-in
simulation — you'll leave shaken and grateful. The
adjoining archives hold the original Freedom Riders bus.

[Locals Say]

▲ 34  🏅 @marcus_atl · 2 weeks ago
"Go on a weekday morning. The interactive exhibits
hit different when the room is quiet."

▲ 21  @jess_atl · 1 month ago
"Don't skip the Morehouse memorabilia upstairs.
MLK's handwritten notes from jail are there."

▲ 8  @visitor_2024 · 3 days ago
"The gift shop is actually incredible. Found a
first-edition John Lewis graphic novel."

[Add Your Own Tip]
```

---

## Data Model

### New Tables

#### `explore_tracks`
Track definitions (14 rows).

```sql
CREATE TABLE explore_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- "welcome-to-atlanta", "good-trouble"
  name TEXT NOT NULL, -- "Welcome to Atlanta"
  quote TEXT NOT NULL, -- Full quote text
  quote_source TEXT NOT NULL, -- "Ludacris & Jermaine Dupri, 2001"
  quote_portrait_url TEXT, -- Portrait background image
  description TEXT, -- Editorial intro (2-3 sentences)
  sort_order INT NOT NULL DEFAULT 0, -- 1-14
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracks_active_sort ON explore_tracks(is_active, sort_order);
```

#### `explore_track_venues`
Many-to-many: tracks → venues.

```sql
CREATE TABLE explore_track_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES explore_tracks(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  editorial_blurb TEXT, -- Track-specific context for this venue
  sort_order INT DEFAULT 0, -- Within track
  is_featured BOOLEAN DEFAULT FALSE, -- Show in peek preview on track card
  added_by UUID REFERENCES profiles(id), -- NULL if editorial
  status TEXT DEFAULT 'approved', -- 'approved', 'pending', 'rejected'
  upvote_count INT DEFAULT 0, -- Denormalized
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(track_id, venue_id)
);

CREATE INDEX idx_track_venues_track ON explore_track_venues(track_id, status, sort_order);
CREATE INDEX idx_track_venues_venue ON explore_track_venues(venue_id);
CREATE INDEX idx_track_venues_status ON explore_track_venues(status) WHERE status = 'pending';
```

#### `explore_tips`
Community blurbs on venues.

```sql
CREATE TABLE explore_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  track_id UUID REFERENCES explore_tracks(id) ON DELETE SET NULL, -- Optional track context
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (LENGTH(content) BETWEEN 10 AND 500),
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'flagged'
  upvote_count INT DEFAULT 0, -- Denormalized
  flag_count INT DEFAULT 0, -- Denormalized
  is_verified_visitor BOOLEAN DEFAULT FALSE, -- Has RSVP/check-in at venue
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tips_venue ON explore_tips(venue_id, status, upvote_count DESC);
CREATE INDEX idx_tips_user ON explore_tips(user_id);
CREATE INDEX idx_tips_status ON explore_tips(status) WHERE status IN ('pending', 'flagged');
CREATE INDEX idx_tips_track ON explore_tips(track_id) WHERE track_id IS NOT NULL;
```

#### `explore_upvotes`
Upvotes on track venues and tips.

```sql
CREATE TABLE explore_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('track_venue', 'tip')),
  entity_id UUID NOT NULL, -- track_venue.id or tip.id
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, user_id)
);

CREATE INDEX idx_upvotes_entity ON explore_upvotes(entity_type, entity_id);
CREATE INDEX idx_upvotes_user ON explore_upvotes(user_id, created_at DESC);
```

#### Triggers

**Auto-update `updated_at`:**
```sql
CREATE TRIGGER update_explore_tracks_updated_at BEFORE UPDATE ON explore_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_explore_track_venues_updated_at BEFORE UPDATE ON explore_track_venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_explore_tips_updated_at BEFORE UPDATE ON explore_tips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Auto-increment denormalized counts:**
```sql
-- On explore_upvotes INSERT/DELETE, update track_venues.upvote_count or tips.upvote_count
-- (Implement as AFTER INSERT/DELETE triggers)
```

**Auto-hide flagged tips:**
```sql
-- On explore_tips.flag_count >= 3, set status = 'flagged'
-- (Implement as AFTER UPDATE trigger)
```

### Existing Tables Modified

**`venues`** table already has:
- `explore_category` — Legacy, maps to old 6-category system
- `explore_featured` — Legacy boolean
- `explore_blurb` — Fallback blurb if `explore_track_venues.editorial_blurb` is null
- `hero_image_url` — Used for venue card images

**No schema changes needed.** New system uses `explore_track_venues.editorial_blurb` as primary, falls back to `venues.explore_blurb` if null.

**Migration path:**
1. Create new tables
2. Seed `explore_tracks` with 14 track definitions
3. Map existing `explore_category` venues into appropriate tracks (create `explore_track_venues` rows)
4. Use existing `venues.explore_blurb` as fallback where track-specific blurb isn't written
5. Replace ExploreView component with new track-based UI
6. Keep old API route (`/api/portals/[slug]/explore`) temporarily for backward compatibility
7. Eventually deprecate old explore columns on venues table

---

## API Routes

### Public Routes

#### `GET /api/explore/tracks`
Returns all active tracks with venue counts and preview data.

**Response:**
```json
{
  "tracks": [
    {
      "id": "uuid",
      "slug": "welcome-to-atlanta",
      "name": "Welcome to Atlanta",
      "quote": "Welcome to Atlanta where the playas play...",
      "quoteSource": "Ludacris & Jermaine Dupri, 2001",
      "quotePortraitUrl": "https://...",
      "description": "The big hits you came to see...",
      "venueCount": 12,
      "tipCount": 87,
      "contributorCount": 34,
      "previewVenues": [
        {
          "id": "uuid",
          "name": "Georgia Aquarium",
          "neighborhood": "Downtown",
          "imageUrl": "https://...",
          "upvoteCount": 234
        }
      ]
    }
  ]
}
```

**Cache:** `public, s-maxage=900, stale-while-revalidate=1800` (15 min)

---

#### `GET /api/explore/tracks/[slug]`
Returns a single track with all venues, tips, and event enrichment.

**Query params:**
- `includeEvents=true` (default: false) — Fetch upcoming events for each venue

**Response:**
```json
{
  "track": {
    "id": "uuid",
    "slug": "welcome-to-atlanta",
    "name": "Welcome to Atlanta",
    "quote": "Welcome to Atlanta where the playas play...",
    "quoteSource": "Ludacris & Jermaine Dupri, 2001",
    "quotePortraitUrl": "https://...",
    "description": "The big hits you came to see: the Aquarium, the Coke Museum...",
    "venues": [
      {
        "id": "uuid",
        "name": "Georgia Aquarium",
        "slug": "georgia-aquarium",
        "neighborhood": "Downtown",
        "imageUrl": "https://...",
        "editorialBlurb": "The largest aquarium in the Western Hemisphere. The whale sharks are the size of school buses.",
        "upvoteCount": 234,
        "hasUpvoted": false,
        "aliveBadge": {
          "type": "upcoming", // or "now"
          "label": "5 upcoming events",
          "detail": "Next: Shark Week After Dark, Feb 20"
        },
        "topTip": {
          "id": "uuid",
          "content": "Go right when it opens. Weekdays are half as crowded.",
          "author": {
            "username": "marcus_atl",
            "isVerifiedVisitor": true
          },
          "upvoteCount": 34,
          "hasUpvoted": false
        },
        "upcomingEvents": [ /* if includeEvents=true */ ]
      }
    ]
  }
}
```

**Cache:** `public, s-maxage=300, stale-while-revalidate=600` (5 min)

---

#### `GET /api/explore/venues/[venueId]/tips`
Returns all approved tips for a venue (across all tracks).

**Query params:**
- `trackId` (optional) — Filter tips by track context
- `limit` (default: 50, max: 100)

**Response:**
```json
{
  "tips": [
    {
      "id": "uuid",
      "content": "Go on a weekday morning. The interactive exhibits hit different when the room is quiet.",
      "author": {
        "id": "uuid",
        "username": "marcus_atl",
        "isVerifiedVisitor": true
      },
      "upvoteCount": 34,
      "hasUpvoted": false,
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ],
  "total": 12
}
```

**Cache:** `public, s-maxage=60, stale-while-revalidate=120` (1 min)

---

### Authenticated Routes

#### `POST /api/explore/tracks/[slug]/venues/[venueId]/upvote`
Toggle upvote on a venue within a track.

**Auth:** Required
**Rate limit:** 100 upvotes/hour

**Request body:** None

**Response:**
```json
{
  "success": true,
  "upvoted": true, // or false if toggled off
  "upvoteCount": 235
}
```

---

#### `POST /api/explore/tips`
Create a tip on a venue.

**Auth:** Required
**Rate limits:**
- 10 tips/hour
- 1 tip per venue per week

**Request body:**
```json
{
  "venueId": "uuid",
  "trackId": "uuid", // optional
  "content": "Go right when it opens. Weekdays are half as crowded."
}
```

**Response:**
```json
{
  "tip": {
    "id": "uuid",
    "content": "...",
    "status": "approved", // or "pending"
    "venueId": "uuid",
    "trackId": "uuid"
  }
}
```

**Business logic:**
1. Validate content length (10-500 chars)
2. Check profanity filter → reject if flagged
3. Check rate limits → 429 if exceeded
4. Check user trust tier:
   - Trusted user → status = 'approved'
   - New user → status = 'pending'
5. Check if user has RSVP/check-in at venue → set `is_verified_visitor`
6. Insert tip
7. Return tip object

---

#### `POST /api/explore/tips/[id]/upvote`
Toggle upvote on a tip.

**Auth:** Required
**Rate limit:** 100 upvotes/hour

**Response:**
```json
{
  "success": true,
  "upvoted": true,
  "upvoteCount": 35
}
```

---

#### `POST /api/explore/tips/[id]/flag`
Flag a tip for review.

**Auth:** Required
**Rate limit:** 20 flags/hour

**Request body:**
```json
{
  "reason": "spam" // or "offensive", "irrelevant", "other"
}
```

**Response:**
```json
{
  "success": true,
  "flagCount": 2 // total flags on this tip
}
```

**Business logic:**
1. Prevent duplicate flags (same user + tip)
2. Increment `explore_tips.flag_count`
3. If `flag_count >= 3` → set `status = 'flagged'`, hide from public view
4. Send notification to admin review queue

---

#### `POST /api/explore/suggest`
Suggest a venue for a track.

**Auth:** Required
**Rate limit:** 10 suggestions/hour

**Request body:**
```json
{
  "trackId": "uuid",
  "venueName": "Ponce City Market", // or venueId if existing
  "venueId": "uuid", // optional, if selecting from autocomplete
  "reason": "Iconic mixed-use building on the BeltLine with food hall, rooftop, arcade — perfect for the BeltLine track."
}
```

**Response:**
```json
{
  "suggestion": {
    "id": "uuid",
    "trackId": "uuid",
    "venueId": "uuid",
    "venueName": "Ponce City Market",
    "reason": "...",
    "status": "pending"
  }
}
```

**Business logic:**
1. If `venueId` provided, validate venue exists
2. If `venueName` only, create as text suggestion (admin will resolve)
3. Create `explore_track_venues` row with `status = 'pending'`, `added_by = user_id`
4. Return suggestion object

---

### Admin Routes

#### `GET /api/admin/explore/tips`
Review queue for pending/flagged tips.

**Auth:** Admin only

**Query params:**
- `status` (pending, flagged, approved, rejected)
- `limit` (default: 50)
- `offset` (default: 0)

**Response:**
```json
{
  "tips": [
    {
      "id": "uuid",
      "content": "...",
      "author": { "id": "uuid", "username": "...", "trustTier": "new" },
      "venue": { "id": "uuid", "name": "..." },
      "track": { "id": "uuid", "name": "..." },
      "status": "pending",
      "flagCount": 0,
      "createdAt": "2026-02-14T10:00:00Z"
    }
  ],
  "total": 23
}
```

---

#### `PATCH /api/admin/explore/tips/[id]`
Approve/reject/unflag a tip.

**Auth:** Admin only

**Request body:**
```json
{
  "status": "approved" // or "rejected", "pending"
}
```

**Response:**
```json
{
  "success": true,
  "tip": { /* updated tip */ }
}
```

---

#### `GET /api/admin/explore/suggestions`
Review queue for venue suggestions.

**Auth:** Admin only

**Query params:**
- `status` (pending, approved, rejected)
- `limit` (default: 50)

**Response:**
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "track": { "id": "uuid", "name": "The BeltLine" },
      "venue": { "id": "uuid", "name": "Ponce City Market" },
      "reason": "Iconic mixed-use building on the BeltLine...",
      "addedBy": { "id": "uuid", "username": "jessica_atl" },
      "upvoteCount": 7,
      "status": "pending",
      "createdAt": "2026-02-10T14:00:00Z"
    }
  ],
  "total": 12
}
```

---

#### `PATCH /api/admin/explore/suggestions/[id]`
Approve/reject a venue suggestion.

**Auth:** Admin only

**Request body:**
```json
{
  "status": "approved", // or "rejected"
  "editorialBlurb": "The 1920s Sears building turned food hall and rooftop playground." // if approved
}
```

**Response:**
```json
{
  "success": true,
  "trackVenue": { /* created track_venue if approved */ }
}
```

**Business logic:**
1. If approved:
   - Set `explore_track_venues.status = 'approved'`
   - Set `editorial_blurb` if provided
   - Set `sort_order` to max + 1 for track
2. If rejected:
   - Set `explore_track_venues.status = 'rejected'`

---

## Component Architecture

```
/web/components/explore/

ExploreView.tsx (tab container, replaces current ExploreView)
├── ExploreTrackList (vertical scroll of track cards)
│   └── ExploreTrackCard (for each of 14 tracks)
│       ├── TrackHero (quote + portrait + gradient overlay, parallax)
│       ├── TrackStats (venue count, tip count, "X locals contributed")
│       └── TrackVenuePreview (2-3 peeking venue cards, masonry snippet)
│
├── ExploreTrackDetail (drill-in view for single track)
│   ├── TrackHero (expanded, full-bleed, parallax)
│   ├── TrackDescription (editorial intro, 2-3 sentences)
│   ├── VenueGrid (masonry layout)
│   │   └── ExploreVenueCard (for each venue in track)
│   │       ├── VenueImage (candid, film grain treatment)
│   │       ├── VenueName + Neighborhood
│   │       ├── EditorialBlurb (truncated to 2 lines)
│   │       ├── AliveBadge ("Now: [exhibition]" or "X upcoming")
│   │       ├── UpvoteButton + count
│   │       └── TipPreview (top tip peeking, truncated)
│   └── SuggestPlaceButton (fixed bottom, auth-gated)
│
├── VenueTipsSheet (bottom sheet on venue card tap)
│   ├── VenueHeader (name, neighborhood, image)
│   ├── EditorialBlurb (full)
│   ├── TipList (sorted by upvotes)
│   │   └── TipCard
│   │       ├── TipContent
│   │       ├── TipAuthor (username, verified badge)
│   │       ├── UpvoteButton + count
│   │       └── FlagButton (icon only)
│   ├── AddTipForm (auth-gated, rate-limited)
│   │   ├── Textarea (10-500 chars, with counter)
│   │   └── SubmitButton
│   └── VenueLink (to full VenueDetailView)
│
├── SuggestPlaceSheet (bottom sheet)
│   ├── TrackSelector (dropdown, pre-filled if opened from track)
│   ├── VenueAutocomplete (search existing venues or free text)
│   ├── ReasonInput (50-500 chars, "Why does this belong?")
│   └── SubmitButton
│
└── shared/
    ├── UpvoteButton.tsx (reusable, optimistic UI)
    ├── AliveBadge.tsx (event enrichment indicator)
    └── FilmGrainOverlay.tsx (CSS filter or canvas overlay)
```

### Key Component Patterns

**ExploreTrackCard** (collapsed state):
- Fixed aspect ratio (16:9 or 3:4)
- Portrait photo background with dark gradient overlay
- Quote text overlaid (bold condensed, large)
- Attribution in small text below quote
- Stats bar at bottom: "12 places · 87 tips · 34 locals"
- 2-3 venue preview cards peeking from bottom (partial scroll hint)

**ExploreTrackDetail** (expanded state):
- Hero section with parallax portrait (scrolls at 0.5x speed)
- Editorial description in content area below hero
- Masonry grid of venue cards (2-column on mobile, 3-column on tablet)
- Infinite scroll or pagination if > 20 venues
- Floating "Suggest a Place" button in bottom-right

**ExploreVenueCard**:
- Card aspect ratio: 4:3
- Image with film grain overlay (CSS `filter: contrast(1.1) grayscale(0.2)` or canvas layer)
- Gradient overlay at bottom for text readability
- Venue name + neighborhood badge
- Editorial blurb (2 lines, ellipsis)
- Alive badge if applicable (positioned top-right, neon background)
- Upvote button (bottom-left) + top tip peek (bottom-right, single line)

**VenueTipsSheet**:
- Bottom sheet modal (80vh max height, scroll)
- Header with venue image, name, neighborhood
- Editorial blurb (full, no truncation)
- "Locals Say" section header
- List of tips (sorted by upvote count desc)
- "Add Your Own Tip" form at bottom (auth-gated)
- "View Full Venue" link in footer (to VenueDetailView)

**UpvoteButton**:
- Thumb icon (outlined when not upvoted, filled when upvoted)
- Count next to icon
- Optimistic UI: update count immediately, rollback on error
- Disabled state while request in flight
- Bounce animation on successful upvote

**AliveBadge**:
- Small pill badge (neon background, dark text)
- "Now: [exhibition name]" (current event/exhibition)
- "X upcoming events" (if no current event, but has upcoming)
- "Opens [season]" (if venue is seasonal/temporarily closed)
- Subtle pulse animation (2s loop, opacity 0.8 → 1.0)

---

## Moderation System (Built Day One)

### Profanity Filter
- **Library:** `bad-words` (npm) or `better-profanity` (Python, if server-side)
- **Applied to:** All tip content and suggestion reasons
- **Behavior:** Reject submission with error message "Please revise your language."
- **Edge cases:** Allow bypass for verified/trusted users (false positives on cultural terms)

### Trust Tier System
Leverage existing trust tier from submissions system:

- **New users** (< 5 approved contributions):
  - Tips → `status = 'pending'`, hidden from public until admin approval
  - Suggestions → `status = 'pending'`

- **Trusted users** (5+ approved contributions, no flags):
  - Tips → `status = 'approved'`, live immediately
  - Suggestions → `status = 'pending'` (always require admin review for venue additions)

- **Flagged users** (3+ flagged tips):
  - All contributions → `status = 'pending'`, require manual review

### Flag System
- **Flag reasons:** spam, offensive, irrelevant, other
- **Auto-moderation threshold:** 3+ flags from different users
  - Tip automatically hidden (status = 'flagged')
  - Sent to admin review queue
  - Author notified (optional)
- **Admin actions:**
  - Approve (unflag) → status = 'approved', flag_count reset
  - Reject → status = 'rejected', hidden permanently
  - Ban user (if egregious)

### Rate Limits
Implemented via `applyRateLimit()` middleware:

| Action | Limit | Window |
|---|---|---|
| Upvote venue or tip | 100 | 1 hour |
| Submit tip | 10 | 1 hour |
| Submit tip (per venue) | 1 | 1 week |
| Submit suggestion | 10 | 1 hour |
| Flag tip | 20 | 1 hour |

### Velocity Checks
Monitor for abuse patterns:

- **Upvote bombing:** 50+ upvotes in 5 minutes from one user → flag for review, temp disable upvotes
- **Spam tips:** 5+ identical tips across venues → auto-reject, flag user
- **Coordinated flagging:** 5+ flags on same tip from new users in 1 minute → ignore flags, investigate accounts

### Admin Dashboard
**Location:** `/admin/explore` (new page)

**Tabs:**
1. **Pending Tips** — Tips awaiting approval
2. **Flagged Tips** — Auto-hidden tips needing review
3. **Pending Suggestions** — Venue suggestions awaiting approval
4. **Flagged Users** — Users with 3+ flagged tips

**Features:**
- Bulk approve/reject
- User context (trust tier, contribution history)
- One-click ban/trust user
- Preview tip in context (show venue + track)

---

## Event Enrichment ("Alive" Indicators)

Venues in Explore are not static — they show live context:

### Alive Badge Types

1. **"Now: [Exhibition Name]"** (current event/exhibition)
   - If venue has event with `is_all_day = true` and `start_date <= today <= end_date`
   - Example: "Now: Van Gogh Immersive" (High Museum)

2. **"X upcoming events"** (no current event, but has upcoming)
   - Count events with `start_date > today` and `start_date < today + 30 days`
   - Click badge to see event list

3. **"Opens [Season]"** (seasonal venue, currently closed)
   - If venue has `operational_status = 'seasonal'` and next opening date known
   - Example: "Opens May" (outdoor pool)

4. **No badge** (no upcoming events or exhibitions)
   - Still shows venue, just no live context

### Data Requirements

**Track Detail API** (`GET /api/explore/tracks/[slug]?includeEvents=true`):
- For each venue, fetch:
  - Current events (ongoing today)
  - Upcoming events (next 30 days, limit 5)
- Cache aggressively (5 min) to avoid N+1 queries

**Optimization:**
- Denormalize `next_event_date` on venues table (updated nightly)
- Query: `SELECT * FROM venues WHERE id IN (...) AND next_event_date IS NOT NULL`
- Only fetch full event details if user taps "X upcoming" badge

---

## Mobile-First Responsive Design

### Breakpoints
- **Mobile:** < 640px (default design target)
- **Tablet:** 640px - 1024px
- **Desktop:** > 1024px

### Mobile (< 640px)
- Track cards: full-width, 16:9 aspect
- Venue grid: 1 column (stacked)
- Typography: quote text 32px, venue names 18px
- Bottom sheets: 80vh max height
- Tips: single column, full-width cards

### Tablet (640px - 1024px)
- Track cards: full-width, 3:4 aspect (taller for more quote room)
- Venue grid: 2 columns, masonry
- Typography: quote text 48px, venue names 20px
- Tips: 2 columns if space allows

### Desktop (> 1024px)
- Track list: 2-column grid of track cards
- Venue grid: 3 columns, masonry
- Typography: quote text 64px, venue names 22px
- Tips sheet: modal (max-width 800px) instead of bottom sheet

### Touch Targets
- All tap targets: min 44x44px
- Upvote buttons: 48x48px
- Track cards: full card tappable (no separate CTA)

---

## Performance Requirements

### Load Time
- **Track list view:** < 1.5s on 3G
- **Track detail view:** < 2s on 3G
- **Venue tips sheet:** < 1s on 3G

### Image Optimization
- Portrait photos: WebP, 1200px width, lazy load below fold
- Venue photos: WebP, 800px width, lazy load
- Film grain overlay: CSS filter (no canvas if possible)
- Parallax: CSS `transform: translateY()`, not JS scroll listeners

### Caching Strategy
- Track list: 15 min CDN cache
- Track detail: 5 min CDN cache
- Tips: 1 min CDN cache
- User upvotes/tips: no cache (auth-gated)

### API Optimization
- Track list: single query, JOIN to get venue counts
- Track detail: batch venue queries, avoid N+1
- Event enrichment: optional query param, separate fetch
- Denormalize counts (upvote_count, tip_count) to avoid COUNT queries

---

## Accessibility (WCAG 2.1 AA)

### Keyboard Navigation
- All interactive elements focusable
- Track cards: Enter/Space to expand
- Tips sheet: Escape to close
- Upvote buttons: Enter/Space to toggle

### Screen Readers
- Track cards: "Track: [name], quote by [source], [X] venues, [Y] tips"
- Upvote buttons: "Upvote [venue name], currently [X] votes, [upvoted/not upvoted]"
- Alive badges: "Live context: [badge text]"
- Tips: "Tip by [username], [verified visitor], [X] upvotes"

### Color Contrast
- All text: min 4.5:1 contrast (WCAG AA)
- Neon accents: use as highlights only, not for body text
- Dark overlays on portraits: ensure quote text is readable (7:1 contrast)

### Focus Indicators
- Visible focus ring on all interactive elements (2px solid, primary accent color)
- No :focus-visible only (support keyboard users on all browsers)

---

## Analytics & Metrics

### Track Engagement
- Track views (list view)
- Track detail views (drill-in)
- Track completion rate (scrolled to bottom of venue grid)
- Time spent in track detail

### Venue Engagement
- Venue card taps (to tips sheet)
- Upvotes per venue (track which venues are most popular per track)
- Tip views
- "View Full Venue" link clicks (conversion to VenueDetailView)

### Community Metrics
- Tips submitted (approved vs. pending)
- Suggestions submitted
- Upvotes given
- Flags submitted (monitor for abuse)
- Tip approval rate (trusted vs. new users)

### Funnel Metrics
- Track list → Track detail (drill-in rate)
- Track detail → Venue tips sheet (engagement rate)
- Venue tips sheet → Full venue detail (conversion rate)
- Venue tips sheet → Add tip (contribution rate)

### Events
```typescript
// Track list view
trackEvent('explore_track_list_viewed', {
  portal: 'atlanta'
});

// Track detail view
trackEvent('explore_track_viewed', {
  trackSlug: 'welcome-to-atlanta',
  venueCount: 12
});

// Venue card tap
trackEvent('explore_venue_tapped', {
  trackSlug: 'welcome-to-atlanta',
  venueId: 'uuid',
  venueName: 'Georgia Aquarium'
});

// Upvote
trackEvent('explore_venue_upvoted', {
  trackSlug: 'welcome-to-atlanta',
  venueId: 'uuid',
  upvoted: true // or false if toggled off
});

// Tip submitted
trackEvent('explore_tip_submitted', {
  venueId: 'uuid',
  trackId: 'uuid',
  status: 'approved', // or 'pending'
  isVerifiedVisitor: true
});

// Suggestion submitted
trackEvent('explore_suggestion_submitted', {
  trackId: 'uuid',
  venueId: 'uuid'
});
```

---

## Success Criteria (Launch Metrics)

### Pre-Launch (Seeding Phase)
- [ ] All 14 tracks defined in database
- [ ] Each track has 5+ venues with editorial blurbs
- [ ] Each track has portrait photo + quote attribution
- [ ] 50+ venues seeded across all tracks
- [ ] Profanity filter tested and enabled
- [ ] Admin dashboard functional for tip/suggestion review

### Week 1 Post-Launch
- [ ] 100+ unique users visit Explore tab
- [ ] 50+ venue upvotes submitted
- [ ] 10+ tips submitted (target: 50% approval rate for new users)
- [ ] 5+ venue suggestions submitted
- [ ] No flagged tips (indicates healthy community start)
- [ ] Track detail drill-in rate > 30%
- [ ] Venue tips sheet open rate > 20%

### Month 1 Post-Launch
- [ ] 500+ unique users visit Explore tab
- [ ] 1,000+ venue upvotes submitted
- [ ] 100+ approved tips (target: 200+ submitted)
- [ ] 20+ approved suggestions (target: 50+ submitted)
- [ ] Top 3 tracks have 10+ tips each
- [ ] 5+ verified visitor tips (users with RSVPs/check-ins)
- [ ] Track completion rate (scrolled to bottom) > 40%
- [ ] Conversion to VenueDetailView > 15%

### Long-Term (3 Months)
- [ ] 2,000+ unique users visit Explore tab
- [ ] 5,000+ venue upvotes
- [ ] 500+ approved tips
- [ ] All 14 tracks have 10+ venues
- [ ] All 14 tracks have 5+ tips
- [ ] 20+ trusted users (auto-approve tips)
- [ ] < 5% flagged tip rate
- [ ] Track engagement parity with Feed tab (time spent)

---

## Risks & Mitigations

### Risk: Low Community Participation
**Mitigation:**
- Seed initial tips from staff/beta users (mark as editorial)
- Incentivize contributions (badges, leaderboards in future)
- Make tip submission UX frictionless (no login wall, just auth gate)
- Show "Be the first to share a tip!" prompt on venues with 0 tips

### Risk: Moderation Overload
**Mitigation:**
- Trust tier system auto-approves trusted users (reduces queue by 80%+)
- Auto-hide flagged tips (reduces manual review)
- Profanity filter catches most spam
- Start with small user base, scale moderation as needed

### Risk: Stale Content (Tracks Feel Dead)
**Mitigation:**
- Event enrichment keeps venues alive
- Quarterly editorial refresh (add new venues, update blurbs)
- Community suggestions surface new places
- "Last updated" timestamp on tracks (motivates freshness)

### Risk: Portrait Rights / Quote Attribution
**Mitigation:**
- Use public domain images or licensed portraits
- Clearly attribute all quotes (name + context)
- Avoid celebrity endorsement language (just attribution)
- Legal review before launch

### Risk: Spammy Upvotes / Vote Manipulation
**Mitigation:**
- Rate limits (100/hour)
- Velocity checks (50+ in 5 min → flag)
- Auth required (no anonymous upvotes)
- Monitor for bot patterns (same user, sequential IDs)

### Risk: Track Imbalance (Some Tracks Empty)
**Mitigation:**
- Seed all tracks with 5+ venues before launch
- Editorial commitment to populate thin tracks
- Community suggestions fill gaps
- Hide tracks with < 3 venues until populated

---

## Open Questions

1. **Verified Visitor Badge:** Should we show a count ("127 verified visitors recommended this") or just a boolean badge?
   - **Recommendation:** Boolean badge only to start. Count adds complexity and may feel gamified.

2. **Track Ordering:** Should track order be editable per-user (drag to reorder) or fixed editorial sequence?
   - **Recommendation:** Fixed editorial sequence for V1. User customization in V2.

3. **Tip Anonymity:** Should users be able to submit tips anonymously?
   - **Recommendation:** No. Require auth for accountability and trust tier system. Anonymous tips are spam-prone.

4. **Upvote Privacy:** Should other users see who upvoted?
   - **Recommendation:** No. Only show count, not individual voters. Reduces social pressure, increases honest voting.

5. **Track Exclusivity:** Can a venue appear in multiple tracks?
   - **Recommendation:** Yes. Ponce City Market fits in BeltLine + Food Scene. Many-to-many is intentional.

6. **Suggested Venue Auto-Approval:** Should 10+ upvotes auto-approve a suggestion, or always require admin review?
   - **Recommendation:** Always require admin review. Editorial quality control is critical.

7. **Editorial Attribution:** Should editorial blurbs show author byline ("Written by @lostcity_team")?
   - **Recommendation:** No byline for V1. Editorial voice is unified. Consider bylines if we add guest curators.

8. **Tip Editing:** Can users edit their tips after submission?
   - **Recommendation:** No. Prevents bait-and-switch. Users can delete and resubmit (rate limits apply).

9. **Seasonal Tracks:** Should we add seasonal tracks (e.g., "Atlanta Fall", "Holiday Markets")?
   - **Recommendation:** Backlog for V2. 14 evergreen tracks are enough for launch. Seasonal can be feed sections.

10. **Non-Atlanta Portals:** How does Explore work for other cities?
    - **Recommendation:** Explore is Atlanta-specific for V1. Other portals use category-based explore (existing system) until we have editorial capacity to curate tracks.

---

## Launch Plan

### Phase 1: Data Seeding (Week 1)
- [ ] Create 14 track definitions in database
- [ ] Seed 50+ venues across tracks (5+ per track minimum)
- [ ] Write editorial blurbs for all seeded venues
- [ ] Source portrait photos (public domain or licensed)
- [ ] Test profanity filter and rate limits

### Phase 2: Component Build (Week 2-3)
- [ ] Build ExploreTrackList + ExploreTrackCard
- [ ] Build ExploreTrackDetail + VenueGrid
- [ ] Build VenueTipsSheet + TipCard
- [ ] Build UpvoteButton + AliveBadge
- [ ] Build SuggestPlaceSheet
- [ ] Build admin dashboard at `/admin/explore`

### Phase 3: API Implementation (Week 3-4)
- [ ] Implement `GET /api/explore/tracks`
- [ ] Implement `GET /api/explore/tracks/[slug]`
- [ ] Implement `POST /api/explore/tracks/[slug]/venues/[venueId]/upvote`
- [ ] Implement `POST /api/explore/tips`
- [ ] Implement `POST /api/explore/tips/[id]/upvote`
- [ ] Implement `POST /api/explore/tips/[id]/flag`
- [ ] Implement `POST /api/explore/suggest`
- [ ] Implement admin routes

### Phase 4: Testing (Week 4)
- [ ] Manual QA on mobile/tablet/desktop
- [ ] Accessibility audit (keyboard nav, screen reader)
- [ ] Load testing (track detail with 50+ venues)
- [ ] Profanity filter testing (edge cases)
- [ ] Rate limit testing (verify 429 responses)
- [ ] Moderation workflow testing (pending → approved → flagged)

### Phase 5: Soft Launch (Week 5)
- [ ] Enable Explore tab for 10% of users (feature flag)
- [ ] Monitor analytics (track views, upvotes, tips)
- [ ] Monitor error logs (API failures, moderation issues)
- [ ] Collect user feedback (in-app or Discord)
- [ ] Iterate on UX issues

### Phase 6: Full Launch (Week 6)
- [ ] Enable Explore tab for 100% of users
- [ ] Announce on social media
- [ ] Blog post: "Discover Atlanta in 14 Tracks"
- [ ] Monitor community participation
- [ ] Weekly editorial updates (add new venues, refresh blurbs)

---

## Future Enhancements (V2 Backlog)

### User-Created Tracks
- Allow power users to create custom tracks ("My Favorite Coffee Shops", "Date Night Picks")
- Public/private toggle
- Upvote/follow other users' tracks

### Track Challenges
- Gamified completion ("Visit all 12 venues in this track")
- Check-in system (integrate with RSVP)
- Badges/achievements

### Seasonal Tracks
- "Atlanta Fall", "Holiday Markets", "Summer Outdoors"
- Auto-rotate based on calendar
- Community voting on seasonal picks

### Collaborative Tracks
- Multiple users can contribute to a shared track
- Use case: "Best of r/Atlanta 2026" (community-sourced)

### Track Analytics
- "You've visited 7/12 venues in this track"
- Recommendations based on track engagement

### Guest Curators
- Invite local influencers, journalists, artists to curate tracks
- Byline attribution ("Curated by @foodatl")

### Tip Reactions
- Beyond upvotes: "Helpful", "Funny", "Outdated"
- Surfacing "Outdated" tips for review

### Venue Comparisons
- "Add to Compare" on venue cards
- Side-by-side view of 2-3 venues

### Track Sharing
- Social share cards with quote + top 3 venues
- Deep links to specific tracks

### Non-Atlanta Portals
- Curate tracks for other cities (Nashville, Charlotte, etc.)
- Template system for rapid track creation

---

## Appendix: Data Seed Examples

### Track 1: "Welcome to Atlanta"
**Quote:** "Welcome to Atlanta where the playas play / And we ride on them things like every day"
**Source:** Ludacris & Jermaine Dupri, "Welcome to Atlanta" (2001)
**Portrait:** Ludacris (licensed or public domain)

**Venues:**
1. Georgia Aquarium — "The largest aquarium in the Western Hemisphere. The whale sharks are the size of school buses."
2. World of Coca-Cola — "Taste 100+ sodas from around the world. The Beverly from Italy will make you reconsider everything."
3. SkyView Atlanta — "The big Ferris wheel downtown. Go at sunset for skyline views that'll make your Instagram."
4. Six Flags Over Georgia — "The Goliath is 200 feet tall and hits 70mph. You'll scream. Everyone screams."
5. Zoo Atlanta — "Home to the largest U.S. population of gorillas and giant pandas. The twins are named Ya Lun and Xi Lun."
6. The Varsity — "What'll ya have? The onion rings are mandatory. Don't leave without a Frosted Orange."
7. Ponce City Market — "1920s Sears building turned food hall and rooftop playground. The skyline mini-golf is absurd and perfect."
8. Atlanta BeltLine Eastside Trail — "The 3-mile trail that started the whole BeltLine movement. Murals, breweries, and half of Atlanta on a Saturday."
9. Fox Theatre — "1920s movie palace that still feels like time travel. The ceiling is a fake night sky with twinkling stars."
10. Centennial Olympic Park — "Built for the 1996 Olympics. The Fountain of Rings runs every hour and kids lose their minds."

---

### Track 2: "Good Trouble"
**Quote:** "Get in good trouble, necessary trouble."
**Source:** John Lewis
**Portrait:** John Lewis (public domain)

**Venues:**
1. National Center for Civil and Human Rights — "The lunch counter sit-in simulation will shake you. The Freedom Riders bus is upstairs."
2. Martin Luther King Jr. National Historical Park — "MLK's birth home, Ebenezer Baptist Church, and the reflecting pool with his tomb."
3. Sweet Auburn Curb Market — "The 1918 market where Atlanta bought groceries during segregation. Still alive, still feeding the city."
4. Atlanta History Center — "The Cyclorama is a 360-degree painting of the Battle of Atlanta. You stand in the middle and spin."
5. Herndon Home — "Alonzo Herndon was born enslaved and became Atlanta's first Black millionaire. This is his house."
6. APEX Museum — "African American Panoramic Experience. The Sweet Auburn neighborhood's story, told by the people who lived it."
7. Oakland Cemetery — "Segregated in life, integrated in death. Maynard Jackson, Margaret Mitchell, and 70,000 others rest here."
8. Hammonds House Museum — "Dr. Otis Thrash Hammonds' Victorian home, now a museum of African American and African diasporic art."

---

### Track 3: "The South Got Something to Say"
**Quote:** "The South got something to say!"
**Source:** Andre 3000, 1995 Source Awards
**Portrait:** Andre 3000 (licensed or public domain)

**Venues:**
1. Patchwerk Recording Studios — "Where OutKast recorded Stankonia. Where TLC recorded CrazySexyCool. The walls have stories."
2. The Tabernacle — "Converted church turned concert hall. The stained glass is still there. The sound is sacred."
3. Terminal West — "King Plow Arts Center venue. Indie, hip-hop, electronic. The bar is on a mezzanine overlooking the floor."
4. Eddie's Attic — "Decatur listening room where John Mayer, Sugarland, and Jennifer Nettles got their start."
5. The Earl — "East Atlanta dive bar with a stage. Punk, indie, whatever. Cheap beer, loud music, no pretense."
6. Variety Playhouse — "Little Five Points' 1,000-capacity gem. The marquee is neon. The floor is sticky. The shows are legendary."
7. Center Stage — "Midtown's all-ages haven. Three stages, every genre. The basement room (The Loft) is where you discover your new favorite band."
8. Vinyl — "Crescent Avenue record store and bar. Buy a record, drink a beer, watch a DJ set."
9. Criminal Records — "Little Five Points institution. Comics, vinyl, and the wall of local band flyers that's been there since 1991."

---

(Tracks 4-14 would follow similar structure, with 5-20 venues each and 1-2 sentence editorial blurbs.)

---

## Appendix: Design Mockup Descriptions

### Track List View (Mobile)
- Vertical scroll of 14 full-width cards
- Each card: 16:9 aspect ratio
- Portrait photo background (dark overlay, 60% opacity)
- Quote text: bold condensed, 32px, white, centered
- Attribution: 14px, #A0A0A0, below quote
- Stats bar at bottom: "12 places · 87 tips · 34 locals" (14px, white)
- 2-3 venue cards peeking from bottom edge (masonry snippet, 40% visible)
- Tap card to expand to Track Detail

### Track Detail View (Mobile)
- Hero section: full-bleed portrait (parallax, scrolls at 0.5x)
- Quote overlaid on hero (bold condensed, 40px)
- Editorial description below hero (18px, 2-3 sentences, #FFFFFF)
- Venue grid: single column, stacked cards
- Each venue card: 4:3 aspect, film grain overlay
- Venue name + neighborhood (18px, white)
- Editorial blurb (14px, #A0A0A0, 2 lines max, ellipsis)
- Alive badge (top-right, neon pill, 12px)
- Upvote button (bottom-left, thumb icon + count, 14px)
- Top tip peek (bottom-right, 12px, italic, single line)
- "Suggest a Place" button (fixed bottom, neon background, full-width)

### Venue Tips Sheet (Mobile)
- Bottom sheet modal (80vh, scroll)
- Header: venue image (4:3, film grain), name, neighborhood
- Editorial blurb (16px, #FFFFFF, full)
- "Locals Say" section header (18px, bold, #C1D32F)
- Tip cards (stacked, 16px)
  - Content (16px, #FFFFFF)
  - Author (14px, #A0A0A0) + verified badge (if applicable)
  - Upvote button (thumb icon + count, 14px)
  - Flag button (icon only, gray, bottom-right)
- "Add Your Own Tip" form:
  - Textarea (16px, 10-500 char counter)
  - Submit button (neon background, bold, 16px)
- "View Full Venue" link (footer, 14px, underlined)

---

## Appendix: Technical Debt & Future Refactors

### Current Explore Migration
- Deprecate `venues.explore_category`, `venues.explore_featured`, `venues.explore_blurb` columns after V2 launch
- Keep `venues.hero_image_url` (used across app)
- Remove old `/api/portals/[slug]/explore` route after 3 months

### Performance Optimizations
- Add `next_event_date` to venues table (denormalized, updated nightly)
- Add materialized view for track venue counts (refresh on INSERT/DELETE)
- Add Redis cache for track list (15 min TTL)

### Moderation Scaling
- Move profanity filter to server-side (Python) for better performance
- Add ML-based spam detection (Phase 2)
- Add user reputation score (trust tier + flag history)

### Image Pipeline
- Auto-generate film grain overlays on upload (save client CPU)
- Auto-crop portrait photos to 16:9 + 3:4 variants
- Serve via CDN with WebP + AVIF fallbacks

---

## Sign-Off

**Product Owner:** [Name]
**Engineering Lead:** [Name]
**Design Lead:** [Name]
**Content Lead:** [Name]

**Target Launch Date:** [TBD]
**Estimated Engineering Effort:** 4 weeks (1 engineer)
**Dependencies:** Admin dashboard, trust tier system, profanity filter

---

**END OF PRD**
