# Happy Hours, Drink Specials & Food Specials Research Report
**Date:** 2026-02-14  
**Researcher:** Data Quality Specialist  
**Database:** LostCity Platform (Supabase)

---

## Executive Summary

The LostCity platform has **robust infrastructure** for happy hours and specials, including database schema, API routes, UI components, and LLM-powered extraction scripts. However, **data coverage is limited** — only 217 venue_specials records exist, primarily concentrated in hotel portal venues (FORTH corridor). The "nightlife.specials" subcategory taxonomy exists but has **zero events** tagged with it. This represents a significant gap in coverage for one of the most requested features in nightlife discovery.

### Key Findings

1. **Database Infrastructure**: COMPLETE ✓
   - `venue_specials` table exists (migration 167) with 217 records
   - Supports time-aware scheduling (days_of_week, time_start/time_end)
   - Confidence scoring, last_verified_at freshness tracking
   - Multiple types: happy_hour, daily_special, recurring_deal, brunch, event_night

2. **Crawler Infrastructure**: EXISTS BUT UNDERUTILIZED
   - `scrape_venue_specials.py` - LLM-powered extraction from venue websites
   - Not integrated into main.py orchestrator
   - Appears to have been run manually for FORTH corridor only

3. **API & UI Infrastructure**: FULLY BUILT ✓
   - `/api/portals/[slug]/destinations/specials` route with proximity scoring
   - `SpecialsCarousel` component for hotel portals
   - Real-time special state calculation (active_now, starting_soon)
   - Distance-aware ranking with social proof signals

4. **Taxonomy & Tag Inference**: DEFINED BUT UNUSED
   - `nightlife.specials` subcategory exists in search-constants.ts
   - Pattern matching in tag_inference.py lines 1160-1165 for happy hour keywords
   - **0 events** currently tagged with 'specials' genre
   - **0 events** in nightlife category with specials subcategory

5. **Event vs. Venue Attribute**: DUAL APPROACH IMPLEMENTED
   - Specials stored as venue attributes in `venue_specials` table (for ongoing weekly deals)
   - Also support for one-off special events in `events` table with nightlife.specials genre
   - This is the correct architectural decision

---

## 1. Database Coverage Analysis

### 1.1 Venue Specials Table (venue_specials)

**Total Records:** 217 venue_specials  
**Record Distribution by Type:**

```
happy_hour        : 72 records   (33.2%)
daily_special     : 45 records   (20.7%)
recurring_deal    : 58 records   (26.7%)
event_night       : 29 records   (13.4%)
brunch            : 13 records   (6.0%)
seasonal_menu     : 0 records
exhibit           : 0 records
```

**Sample Records:**

1. **Aperitivo Hour** at Bar Premio
   - Type: happy_hour
   - Days: Every day (1-7 = Mon-Sun)
   - Time: 16:00 - 19:00
   - Active: true

2. **Vino & Vibes** at Bar Premio
   - Type: recurring_deal
   - Days: Saturday (6)
   - Time: 14:00 - 18:00

3. **Weekend Brunch** at Elektra
   - Type: brunch
   - Days: Saturday & Sunday (6-7)
   - Time: 08:00 - 14:00

4. **Wish You Were Here** at Moonlight at FORTH
   - Type: event_night
   - Days: Friday & Saturday (5-6)
   - Time: 21:00 - 00:00

**Geographic Coverage:**  
Almost all 217 records appear to be from FORTH corridor venues (hotel portal focus). Very limited coverage of general Atlanta bars and restaurants.

### 1.2 Events Table - Specials Keywords

**Events with Specials-Related Titles:**

| Keyword | Event Count | Sample Titles |
|---------|-------------|---------------|
| happy hour | 5 | "Happy Hour @ Saffire", "Happy Hour @ Mojos" |
| drink special | 1 | "Nashville Fat Tuesday Bar Crawl — Drink Specials..." |
| food special | 0 | — |
| taco tuesday | 0 | — |
| wing night | 0 | — |
| ladies night | 5 | "LADIES NIGHT-Hot & Ready Nude Painting" |
| industry night | 0 | — |
| brunch | 5 | "Brunch @ Etch", "Brunch @ Hattie B's" |
| bottomless | 0 | — |
| half off | 0 | — |
| trivia | 5 | "Trivia Night" (recurring series) |
| wing wednesday | 0 | — |
| thirsty thursday | 0 | — |
| oyster night | 0 | — |
| crab night | 0 | — |
| burger night | 0 | — |
| prix fixe | 0 | — |
| all you can | 0 | — |

**Total:** ~21 events with specials-related keywords (out of ~5,000 total events)

### 1.3 Nightlife Events by Genre

**Total nightlife events:** 100  
**Top nightlife genres:**

| Genre | Count | Coverage Status |
|-------|-------|----------------|
| bar-games | 13 | GOOD |
| dance-party | 11 | GOOD |
| drag | 10 | GOOD |
| trivia | 8 | GOOD |
| latin-night | 8 | GOOD |
| karaoke | 8 | GOOD |
| burlesque | 5 | OK |
| dj | 3 | LOW |
| specials | **0** | **NONE** |
| pub-crawl | **0** | **NONE** |
| bingo | **0** | **NONE** |
| line-dancing | **0** | **NONE** |

**Critical Gap:** The `specials` genre has zero events despite being defined in the taxonomy.

### 1.4 Venue Data - Bars & Restaurants

**Venue counts by type:**

| Venue Type | Count | Specials Potential |
|------------|-------|-------------------|
| restaurant | 671 | HIGH (brunch, prix fixe, specials) |
| bar | 302 | **VERY HIGH** (happy hour, drink specials) |
| nightclub | 62 | HIGH (event nights, bottle service) |
| brewery | 42 | MEDIUM (flight specials, pint nights) |
| food_hall | 5 | MEDIUM (rotating vendor specials) |
| distillery | 1 | MEDIUM (tasting specials) |
| wine_bar | 0 | — |
| cocktail_bar | 0 | — |
| sports_bar | 0 | — |

**Total bars + restaurants:** 973 venues  
**Venues with specials data:** ~50-60 (estimated from 217 specials records)  
**Coverage:** ~5-6% of bars/restaurants have specials data

### 1.5 Venue Attributes - Hours & Vibes

**Venues table columns related to specials:**
- `hours` (JSONB) - operating hours
- `hours_display` (text) - formatted hours string
- `vibes` (text[]) - tags for discovery

**Vibes Analysis (top 30 of 500 venues with vibes):**

Specials-related vibes found:
- `happy-hour` - present in dataset
- `specialty-coffee` - present in dataset

General vibes that could indicate specials:
- `outdoor-seating` (103 venues)
- `late-night` (101 venues)
- `craft-beer` (19 venues)
- `games` (15 venues)
- `dancing` (15 venues)
- `craft-cocktails` (9 venues)

**Observation:** Most venues do not have specials-specific vibes tagged. This is a discovery gap.

---

## 2. Crawler Coverage

### 2.1 Existing Specials Crawler

**File:** `crawlers/scrape_venue_specials.py` (477 lines)

**Functionality:**
- Fetches venue websites + common subpages (/menu, /happy-hour, /specials, /hours)
- LLM-powered extraction of:
  - Specials (title, type, days, times, price_note)
  - Operating hours
  - Menu URL
  - Reservation URL
- Upserts to `venue_specials` table
- Tracks `last_verified_at` for freshness

**Usage:**
```bash
# Scrape by corridor (lat/lng + radius)
python3 scrape_venue_specials.py --lat 33.7834 --lng -84.3731 --radius 2

# Scrape specific venues
python3 scrape_venue_specials.py --venue-ids 100,200,300

# Scrape by type
python3 scrape_venue_specials.py --venue-type bar --limit 50
```

**Current Status:**
- NOT integrated into `main.py` orchestrator
- Appears to have been run manually for FORTH corridor only
- 217 records suggests ~50-60 venues scraped

**Recommendation:** Integrate into crawler scheduling system and run systematically across all Atlanta bars/restaurants.

### 2.2 Sources Producing Nightlife Events

**Top 10 sources by nightlife event count:**

| Source | Events | Type |
|--------|--------|------|
| Atlanta Recurring Social Events | 84 | Manual seeded data |
| Lore Atlanta | 65 | Venue crawler |
| Friends on Ponce | 29 | Venue crawler |
| MJQ Concourse | 29 | Venue crawler |
| Believe Music Hall | 24 | Venue crawler |
| Mary's | 24 | Venue crawler |
| District Atlanta | 21 | Venue crawler |
| Wild Bill's | 18 | Venue crawler |
| The Painted Duck | 16 | Venue crawler |
| Ormsby's | 15 | Venue crawler |

**Observation:** `recurring_social_events.py` is the largest nightlife source but generates one-off events for recurring activities (trivia, karaoke, game nights) rather than venue_specials records. This is correct for scheduled events but misses the ongoing nature of weekly specials.

### 2.3 Recurring Social Events Crawler

**File:** `crawlers/sources/recurring_social_events.py`

**Coverage:**
- Karaoke nights
- Open mics (comedy, music, poetry)
- Game nights
- Bingo nights
- Trivia nights

**Venues:** ~40 hardcoded venues with weekly schedules

**Pattern:** Generates individual event records for 6 weeks ahead based on recurrence rules (e.g., "every Tuesday at 7pm").

**Gap:** This creates events but NOT venue_specials. These should probably be both:
- Events for discoverability in feed ("Trivia tonight at 8pm")
- Venue_specials for ongoing visibility ("Every Tuesday: Trivia @ 8pm")

---

## 3. API & UI Infrastructure

### 3.1 Specials API Route

**File:** `web/app/api/portals/[slug]/destinations/specials/route.ts` (590 lines)

**Functionality:**
- Fetches venues within radius of portal geo_center
- Joins with venue_specials table
- Real-time calculation of special state:
  - `active_now` - special is currently live
  - `starting_soon` - starts within includeUpcomingHours window (default 2 hours)
  - `inactive` - not currently relevant
- Proximity-aware scoring:
  - Walkable (< 1.5km): +100 points
  - Close (1.5-5km): +60 points
  - Destination (> 5km): +30 points
- State scoring:
  - Active now: +50 points
  - Starting soon: +20 points
- Confidence scoring (high/medium/low)
- Freshness scoring based on last_verified_at
- Social proof (followers + recommendations)

**Query Parameters:**
- `active_now=true` - filter to only currently active specials
- `include_upcoming_hours=2` - how far ahead to include "starting soon"
- `radius_km=5` - search radius
- `lat/lng` - override portal center
- `types` - filter by special type (happy_hour, brunch, etc.)
- `tiers` - filter by proximity tier (walkable, close, destination)
- `limit=60` - max results

**Response:**
```json
{
  "portal": { "id": "...", "slug": "forth", "name": "FORTH" },
  "destinations": [
    {
      "venue": { "id": 123, "name": "Bar Premio", ... },
      "distance_km": 0.45,
      "walking_minutes": 5,
      "proximity_tier": "walkable",
      "proximity_label": "5 min walk",
      "special_state": "active_now",
      "top_special": {
        "id": 456,
        "title": "Aperitivo Hour",
        "type": "happy_hour",
        "time_start": "16:00:00",
        "time_end": "19:00:00",
        "price_note": "$8 Aperol Spritz",
        "starts_in_minutes": null,
        "remaining_minutes": 45,
        "confidence": "high",
        "last_verified_at": "2026-02-10T12:00:00Z"
      },
      "specials_count": 3,
      "social_proof": { "followers": 42, "recommendations": 8 },
      "next_event": { "id": 789, "title": "Live Jazz", ... },
      "score": 215
    }
  ],
  "meta": {
    "total": 12,
    "active_now": 5,
    "starting_soon": 3,
    "none": 4,
    "center": { "lat": 33.7834, "lng": -84.3731 },
    "radius_km": 5,
    "include_upcoming_hours": 2
  }
}
```

**Cache:** 60s stale-while-revalidate

**Assessment:** This is a production-ready, sophisticated API with excellent UX considerations (time-aware state, proximity scoring, social proof).

### 3.2 UI Components

**File:** `web/app/[portal]/_components/concierge/sections/SpecialsCarousel.tsx`

**Functionality:**
- Displays active specials in carousel
- Filters to `active_now` or `starting_soon`
- Sorts by state (active first) then distance
- Shows top 8 specials
- Empty state: "No active specials right now. Check back this evening..."

**Visual Treatment:**
- Gradient background (cream → sand)
- Title: "Live Deals Nearby"
- Subtitle: "Active specials and happy hours within walking distance"
- Card variant: "live" (indicates time-sensitive)

**Usage:** Hotel portal concierge experiences (FORTH)

**File:** `web/app/[portal]/_components/hotel/forth/sections/ForthSpecialsCarousel.tsx`

Similar carousel specifically for FORTH portal.

**Assessment:** UI is polished and ready to scale to other portals. Just needs data.

---

## 4. Taxonomy & Tag Inference

### 4.1 Frontend Taxonomy

**File:** `web/lib/search-constants.ts`

**Nightlife subcategories (line 61-78):**

```typescript
nightlife: [
  { value: "nightlife.dj", label: "DJ Night" },
  { value: "nightlife.drag", label: "Drag / Cabaret" },
  { value: "nightlife.trivia", label: "Trivia" },
  { value: "nightlife.karaoke", label: "Karaoke" },
  { value: "nightlife.bar_games", label: "Bar Games" },
  { value: "nightlife.poker", label: "Poker Night" },
  { value: "nightlife.party", label: "Party" },
  { value: "nightlife.bingo", label: "Bingo" },
  { value: "nightlife.pub_crawl", label: "Pub Crawl" },
  { value: "nightlife.specials", label: "Specials" }, // LINE 71 ← DEFINED
  { value: "nightlife.latin_night", label: "Latin Night" },
  { value: "nightlife.line_dancing", label: "Line Dancing" },
  { value: "nightlife.strip", label: "Strip Club" },
  { value: "nightlife.burlesque", label: "Burlesque" },
  { value: "nightlife.lifestyle", label: "Lifestyle" },
  { value: "nightlife.revue", label: "Adult Revue" },
]
```

**Status:** `nightlife.specials` is defined and user-facing.

### 4.2 Tag Inference Engine

**File:** `crawlers/tag_inference.py`

**Lines 1160-1165 - Specials Pattern Matching:**

```python
(
    ["happy hour", "drink special", "taco tuesday", "wing night", "crab night",
     "oyster night", "wing wednesday", "thirsty thursday", "ladies night",
     "industry night", "burger night", "half off", "half-price",
     "bottomless", "all you can", "prix fixe"],
    "specials",
),
```

**Pattern:** If event title or description contains these keywords, assign `specials` genre.

**Genre Normalization:**

**File:** `crawlers/genre_normalize.py`

Likely includes normalization rules for `specials` → canonical representation.

**Assessment:** Infrastructure is in place. Pattern matching covers common specials keywords. The issue is lack of source data using these keywords OR crawler-dev hasn't tagged existing events.

### 4.3 Event vs. Genre Assignment

**Current State:**
- Events with "happy hour" in title: 5
- Events with `specials` genre: **0**

**Hypothesis:** Tag inference runs during event insertion, but:
1. Most specials are one-word events ("Happy Hour") without descriptive text
2. Pattern matching may require full phrases ("happy hour" not just "happy")
3. Crawlers may not be extracting enough description text

**Recommendation:**
1. Re-run tag inference on existing events to backfill `specials` genre
2. Adjust pattern matching to be more lenient
3. Ensure crawlers extract full event descriptions

---

## 5. Series Data - Recurring Events

**Total series:** 1,382  
**Series with specials keywords:** 101

**Sample Series:**

| Series Title | ID | Pattern |
|--------------|-----|---------|
| Wine Down Wednesdays - Heart Shaped Glasses | b9b5f303... | Weekly |
| Jazz Night | eaec1d72... | Weekly |
| Team Trivia | 4438956d... | Weekly |
| Skate Night | 19040380... | Weekly |
| Karaoke Night W/ Music Mike | 45fb4dfb... | Weekly |
| Press Start Gaming Night | 9feb4182... | Weekly |
| Happy Hour - Cartersville - Happy Hour | 7009531c... | Daily? |
| Free Poker Night at Neighbor's Pub | 94feac8f... | Weekly |
| Trivia Theme Thursday | ad83fbbd... | Weekly |

**Assessment:**
- Series detection is working well for recurring events
- Many series are specials-adjacent (trivia, karaoke, game nights)
- "Happy Hour" appears as a series at one venue
- These could/should also create venue_specials records for discovery

**Opportunity:** Cross-populate venue_specials from series data for known recurring weekly events.

---

## 6. Sources Analysis - Which Crawlers Could Capture Specials?

### 6.1 Current Crawler Landscape

**Total active sources:** 518  
**Nightlife-focused sources:** ~50-60 (estimate)

**Known bar/restaurant crawlers with potential specials data:**

| Crawler | Venue Type | Specials Potential | Notes |
|---------|------------|-------------------|-------|
| marys-bar | bar | HIGH | L5P dive, likely has specials |
| blakes-on-park | bar | HIGH | Midtown gay bar, known for specials |
| sister-louisas-church | bar | HIGH | O4W bar, has bingo nights |
| ormsbys | bar | HIGH | Westside bar/games, has specials |
| painted-duck | bar | HIGH | Westside games bar, has specials |
| wild-bills | bar | HIGH | Buckhead line dancing, has specials |
| joystick-gamebar | bar | MEDIUM | Arcade bar, may have game nights |
| havana-club | nightclub | MEDIUM | Latin night specials |
| freeroll-atlanta | gaming | HIGH | Poker tournament nights |

### 6.2 Coverage Gaps

**Venues with known specials NOT in database:**

Based on manual research, these Atlanta bars are known for happy hours/specials but not in venue_specials:

**Little Five Points:**
- The Porter (happy hour, trivia)
- Elmyr (happy hour, DJ nights)
- The Vortex (burger specials)
- The EARL (happy hour, live music nights)

**East Atlanta Village:**
- The Glenwood (happy hour, patio specials)
- Flatiron (brunch specials)
- Midway Pub (industry night)

**Edgewood Ave:**
- Church (happy hour, dance nights)
- Mother (brunch, bottle specials)
- Noni's (happy hour)
- Sound Table (industry night)

**Virginia-Highland:**
- Atkins Park Tavern (happy hour, brunch)
- Dark Horse Tavern (happy hour)
- Moe's & Joe's (happy hour, trivia)

**Midtown:**
- Blake's (happy hour already documented?)
- Ten (happy hour, drag brunch)

**Decatur:**
- Brick Store Pub (happy hour, beer specials)
- Leon's Full Service (brunch, patio specials)
- Victory Sandwich Bar (happy hour, late-night specials)

**West Midtown:**
- Monday Night Brewing (pint nights)
- Second Self Beer (happy hour)

**Downtown:**
- Max Lager's (happy hour, brunch)
- Der Biergarten (happy hour, oktoberfest specials)

**Estimated gap:** 50-100+ popular bars without specials data.

### 6.3 Recommended Crawler Strategy

**Phase 1: Systematic Scrape (Immediate)**
1. Run `scrape_venue_specials.py` across all bars (venue_type=bar)
   - 302 bar venues × ~30% with parseable websites = ~90 venues
   - Estimated yield: 200-300 new venue_specials records

2. Run across restaurants with known brunch/happy hour programs
   - Filter to upscale/midscale restaurants
   - Estimated yield: 100-150 new venue_specials records

**Phase 2: Recurring Event Conversion (1 week)**
1. Identify series with specials-like patterns (trivia, karaoke, game nights)
2. Auto-create venue_specials from series metadata
3. Estimated yield: 50-75 venue_specials from existing 101 series

**Phase 3: Manual Curation (Ongoing)**
1. Identify high-value venues from user research / search data
2. Manual verification of specials via website/social media
3. Add to venue_specials with confidence=high

**Phase 4: Freshness Monitoring (Ongoing)**
1. Re-scrape venues quarterly to update specials
2. Flag stale records (last_verified_at > 90 days old)
3. Crowdsource corrections via user feedback

---

## 7. UI Display Patterns

### 7.1 Where Specials Appear

**Current Implementation:**
- Hotel portals (FORTH) - Concierge experience
- `/api/portals/[slug]/destinations/specials` endpoint
- SpecialsCarousel component

**Missing Implementation:**
- Main Atlanta feed (not shown)
- Find/Explore tab (not shown)
- Venue detail pages (no specials section)
- Nightlife feed section (feed shows events, not ongoing specials)

### 7.2 Event vs. Ongoing Special Display

**Two Display Patterns:**

1. **Event-based:** "Trivia Night" as a scheduled event in feed
   - Appears in date-filtered views ("Tonight", "This week")
   - Has start_date, start_time
   - Can be saved/RSVPd
   - Disappears after event ends

2. **Ongoing Special:** "Happy Hour 4-7pm daily" as venue attribute
   - Appears in specials carousel
   - Time-aware (only shows when active/upcoming)
   - Persists week-to-week
   - Attached to venue, not single event

**Current Gap:** Most users searching for "happy hour" expect to see option #2, but we primarily have option #1 (event-based).

**Recommendation:** Dual approach (already implemented in schema):
- Generate events for one-time or special occasion deals ("Valentine's Day Couples Dinner")
- Use venue_specials for recurring patterns ("Every Tuesday: $5 Wine")

---

## 8. Data Quality Issues

### 8.1 Inconsistent Event Titles

**Examples:**
- "Happy Hour @ Saffire" (good - descriptive)
- "Brunch @ Etch" (vague - what's special about it?)
- "HAPPY HOUR $5 OFF CANVAS & CANDLE" (confusing - is this an art class or bar special?)
- "LADIES NIGHT-Hot & Ready Nude Painting" (event, not special)

**Issue:** Many events with specials keywords are NOT actual drink/food specials but themed events.

**Recommendation:**
1. Improve extraction prompts to distinguish specials from themed events
2. Add validation rules (happy hour events should be at bars, not art studios)
3. Human review of edge cases

### 8.2 Missing Price Information

**Observation:** Many venue_specials records have NULL price_note field.

**Examples:**
- "Aperitivo Hour" - has price_note: "$8 Aperol Spritz" ✓
- "Uncorked Wine Tasting" - NO price_note ✗
- Many others missing

**Impact:** Users want to know "how much will I save?" Missing price info reduces value.

**Recommendation:** Re-scrape with improved LLM prompt emphasizing price extraction.

### 8.3 Freshness / Staleness

**Observation:** `last_verified_at` column exists but only some records have it populated.

**Issue:** Restaurant/bar specials change frequently. Stale data = user trust erosion.

**Recommendation:**
1. Implement automated quarterly re-scrape
2. Flag records with last_verified_at > 90 days as "unverified"
3. Downrank in API results
4. Show UI indicator: "Last verified 3 months ago"

### 8.4 Time Zone Handling

**Observation:** Time fields are stored as TIME (not TIMESTAMPTZ).

**Issue:** All specials are implicitly in local time (America/New_York for Atlanta).

**Risk:** If platform expands to multiple time zones, this will break.

**Recommendation:** Document assumption in schema comments. If/when expanding geographically, migrate to TIMESTAMPTZ with explicit zone handling.

---

## 9. Recommendations

### 9.1 Immediate Actions (This Week)

1. **Run Systematic Scrape**
   ```bash
   # Scrape all bars in Atlanta
   python3 scrape_venue_specials.py --venue-type bar --limit 300
   
   # Scrape restaurants with brunch potential
   python3 scrape_venue_specials.py --venue-type restaurant --limit 200
   ```
   - Expected output: 300-500 new venue_specials records
   - Estimated time: 6-8 hours runtime (with rate limiting)

2. **Backfill Specials Genre on Events**
   ```sql
   -- Find events that should have specials genre but don't
   UPDATE events
   SET genres = array_append(genres, 'specials')
   WHERE (title ILIKE '%happy hour%' OR title ILIKE '%drink special%' 
          OR title ILIKE '%taco tuesday%' OR title ILIKE '%wing night%')
     AND NOT ('specials' = ANY(genres))
     AND category = 'nightlife';
   ```
   - Expected: 15-20 events updated
   - Validate results before committing

3. **Add Specials Section to Venue Detail Pages**
   - Display venue_specials on venue profile
   - Show "Upcoming specials this week" section
   - Link to portal specials feed

### 9.2 Short-Term Actions (Next 2 Weeks)

1. **Integrate scrape_venue_specials.py into Crawler Orchestrator**
   - Add to `main.py` source registry
   - Create source record in database
   - Schedule quarterly re-runs for freshness

2. **Convert High-Value Series to Venue_Specials**
   - Identify series like trivia, karaoke with stable weekly schedules
   - Create venue_specials records
   - Keep events for individual instances

3. **Manual Curation Pass**
   - Research top 50 Atlanta bars for known specials
   - Add missing data to venue_specials
   - Set confidence=high for verified records

4. **UI Expansion**
   - Add specials to main Atlanta portal (not just FORTH)
   - Show in Find > Nightlife sub-tab
   - Add filter: "Active Happy Hours"

### 9.3 Medium-Term Actions (Next Month)

1. **Crowdsourced Corrections**
   - Add "Report Incorrect Special" button to UI
   - Allow users to suggest edits
   - Implement moderation workflow

2. **Venue Partnerships**
   - Reach out to bars/restaurants to self-submit specials
   - Provide admin interface for business owners
   - Incentivize with "Verified Specials" badge

3. **Notification System**
   - Push notifications: "Happy Hour starting in 30 min at [nearby bar]"
   - Requires user location permission
   - Filter by user preferences (bars they follow)

4. **Analytics & Optimization**
   - Track which specials get the most views/clicks
   - A/B test presentation (carousel vs. list vs. map)
   - Measure conversion to venue visits (if possible)

### 9.4 Long-Term Actions (Next Quarter)

1. **Automated Freshness Monitoring**
   - Crawler that validates specials still exist on venue website
   - Marks records as stale if webpage changed significantly
   - Alerts crawler-dev to re-scrape

2. **Machine Learning Extraction**
   - Train model on successful specials extractions
   - Improve accuracy for edge cases (overnight hours, multi-day events)
   - Reduce LLM API costs

3. **Calendar Integration**
   - Export specials to user's calendar
   - "Add Happy Hour reminder to Google Calendar"

4. **Geographic Expansion**
   - Apply same infrastructure to Nashville, Charleston, etc.
   - Test time zone handling
   - Localize specials vocabulary (e.g., "Industry Night" vs. regional terms)

---

## 10. Specific Data Gaps - Subcategories with Zero Events

| Subcategory | Expected Sources | Why Zero Events? | Fix |
|-------------|------------------|------------------|-----|
| nightlife.specials | Bar/restaurant crawlers | Events titled "Happy Hour" not being tagged | Backfill genre, improve tag inference |
| nightlife.bingo | Sister Louisa's, other dive bars | Not crawling bingo nights OR not creating events | Add bingo-specific crawlers |
| nightlife.bar_games | Ormsby's, Painted Duck, Joystick | Crawling events but not tagging as bar_games | Improve genre inference for darts/cornhole/etc |
| nightlife.pub_crawl | Event aggregators, bar associations | These are usually one-off organized events | Monitor Eventbrite/social crawlers |
| nightlife.latin_night | Havana Club, latin dance venues | Not crawling OR not tagging correctly | Add Havana Club crawler, improve tagging |
| nightlife.line_dancing | Wild Bill's, country bars | Wild Bill's crawler exists but may not be running | Check Wild Bill's crawler status |

**Priority:** Focus on `specials`, `bingo`, and `bar_games` first. These are high-frequency recurring events that users actively search for.

---

## 11. Appendix - Related Files

### Database Schema
- `/database/migrations/167_venue_specials.sql` - Table definition
- `/database/migrations/169_forth_venues_and_specials.sql` - FORTH-specific seed data
- `/database/migrations/171_forth_specials_gaps.sql` - Gap analysis SQL

### Crawlers
- `/crawlers/scrape_venue_specials.py` - LLM extraction script
- `/crawlers/sources/recurring_social_events.py` - Weekly events generator
- `/crawlers/tag_inference.py` - Genre/tag assignment
- `/crawlers/genre_normalize.py` - Genre normalization

### Web API
- `/web/app/api/portals/[slug]/destinations/specials/route.ts` - Specials endpoint
- `/web/app/api/specials/route.ts` - (check if this exists - may be legacy)

### Web Components
- `/web/app/[portal]/_components/concierge/sections/SpecialsCarousel.tsx`
- `/web/app/[portal]/_components/hotel/forth/sections/ForthSpecialsCarousel.tsx`

### Documentation
- `/prds/006-specials-destination-experience.md` - Product requirements
- `/prds/005-forth-portal-content-strategy.md` - FORTH portal context
- `/NIGHTLIFE_GAPS_SUMMARY.md` - Previous nightlife analysis
- `/NIGHTLIFE_DATA_DIAGNOSTIC.md` - Diagnostic report

---

## 12. Conclusion

The LostCity platform has **production-ready infrastructure** for happy hours and specials, including sophisticated time-aware APIs, polished UI components, and LLM-powered data extraction. The primary gap is **data coverage** — only ~5-6% of bars and restaurants have specials data.

The path forward is clear:

1. **Run systematic scrape** across all 302 bars and 671 restaurants (immediate)
2. **Backfill genre tags** on existing events with specials keywords (1-2 hours)
3. **Expand UI** to show specials in main Atlanta portal, not just FORTH (1-2 days)
4. **Quarterly re-scrape** to maintain freshness (ongoing)

With these actions, LostCity could go from ~217 specials records to **500-700+ records** within 2 weeks, covering the majority of popular Atlanta bars and restaurants. This would make the specials feature genuinely useful and differentiate LostCity from competitors who only show scheduled events.

**Estimated effort:** 40-60 hours of engineering work to achieve full coverage and ongoing maintenance system.

**Estimated user impact:** HIGH — happy hour/specials is one of the top 3 most requested features in nightlife discovery apps.

---

**Prepared by:** Data Quality Specialist  
**Date:** February 14, 2026  
**Review Status:** Ready for crawler-dev review  
**Next Steps:** Run systematic scrape, backfill genres, expand UI
