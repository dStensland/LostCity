# Trampoline Park Crawlers

## Overview

Three new crawlers added to capture family-friendly events from Atlanta-area trampoline parks.

## Crawlers

### 1. Defy Atlanta (`defy_atlanta.py`)

**Location:** Kennesaw (2964 Cobb Pkwy NW)

**Venue Type:** Trampoline park with obstacle courses

**Event Types:**
- Toddler Time / Little Jumpers
- Glow Nights (black light events)
- Teen Nights
- Fitness classes
- Special events

**Tags:** family-friendly, kids, indoor, active, trampoline, toddlers, glow-night, fitness

**Crawl Strategy:**
- Uses Playwright (JavaScript rendering likely)
- Tries multiple URLs: /events, /calendar, /special-events, homepage
- Parses text for event keywords
- Extracts dates, times, prices from surrounding text

### 2. Urban Air Atlanta (`urban_air_atlanta.py`)

**Locations:**
- Snellville (1905 Scenic Hwy N)
- Buford (3235 Woodward Crossing Blvd)
- Kennesaw (400 Ernest W Barrett Pkwy NW)

**Venue Type:** Multi-attraction adventure park (trampolines, ninja course, climbing walls)

**Event Types:**
- Toddler Time
- Glow Nights
- Teen Nights
- Jump Time sessions
- Fitness classes
- Sensory-friendly events

**Tags:** family-friendly, kids, indoor, active, trampoline, climbing, sports

**Crawl Strategy:**
- Multi-location crawler (loops through all 3 locations)
- Creates separate venue record for each location
- Tries multiple URLs per location: /events, /calendar, main page
- Parses events from page text

### 3. Sky Zone Atlanta (`sky_zone_atlanta.py`)

**Locations:**
- Roswell (10800 Alpharetta Hwy)
- Alpharetta (5285 Windward Pkwy)

**Venue Type:** Original trampoline park chain

**Event Types:**
- Toddler Time
- Glow/Cosmic Jump nights
- Teen Nights
- SkyFit fitness classes
- Parents Night Out
- All Abilities (sensory-friendly)
- Open Jump sessions

**Tags:** family-friendly, kids, indoor, active, trampoline, fitness, sensory-friendly, parents-night-out

**Crawl Strategy:**
- Multi-location crawler (2 locations)
- Creates separate venue records
- Tries URLs: /events, /activities, main page
- Parses structured event data from page text

## Common Features

### Category & Subcategory
- **Category:** entertainment
- **Subcategory:** active

### Tags System
All crawlers intelligently tag events based on content:

- `family-friendly` - Always added (core audience)
- `kids` - Always added
- `indoor` - Always added
- `active` - Always added
- `trampoline` - Always added
- `toddlers` - For ages 2-6 events
- `glow-night` - For black light/glow events
- `fitness` - For workout/exercise classes
- `open-jump` - For general admission sessions
- `sensory-friendly` - For autism/special needs events
- `teens` - For teen-only nights
- `sports` - For dodgeball, basketball events
- `climbing` - For climbing wall events (Urban Air)
- `parents-night-out` - For drop-off events

### Price Extraction
- Scans surrounding text for dollar amounts
- Identifies "free" events
- Returns min/max price range

### Date/Time Parsing
- Handles multiple date formats:
  - "January 31, 2026"
  - "Jan 31"
  - "Friday, Jan 31"
  - MM/DD/YYYY
  - ISO format (YYYY-MM-DD)
- Extracts times from "7:00 PM" or "7pm" formats
- Assumes current or next year for dates without year

## Event Discovery Strategy

These crawlers focus on **scheduled special events** rather than regular operating hours:

**Include:**
- Toddler/Little Jumper sessions with specific times
- Glow Night events
- Teen Nights
- Fitness classes
- Special holiday events
- Sensory-friendly sessions
- Parents Night Out

**Exclude:**
- General "we're open" hours
- Birthday party availability (too granular)
- Regular admission (unless specifically promoted as event)

## Testing

Test individual crawlers:
```bash
cd /Users/coach/Projects/LostCity/crawlers
python main.py --source defy-atlanta --dry-run
python main.py --source urban-air-atlanta --dry-run
python main.py --source sky-zone-atlanta --dry-run
```

## Database Setup

Run migration to add sources:
```bash
psql $DATABASE_URL -f /Users/coach/Projects/LostCity/database/migrations/093_trampoline_parks.sql
```

## Notes

### Website Variations
These chains may update their websites independently per location. The crawlers are designed to:
- Try multiple URL patterns
- Parse flexibly from text rather than strict HTML structure
- Handle both JavaScript-rendered and static content

### Crawl Frequency
Set to weekly (168 hours) because:
- Event schedules don't change frequently
- Most events are recurring weekly/monthly
- Reduces API load on their servers

### Multi-Location Pattern
Urban Air and Sky Zone use a multi-location pattern where:
- Single crawler handles all locations
- Each location gets its own venue record
- Events are associated with specific location
- Reduces duplication in SOURCE_MODULES registry

### Future Improvements
If these sites prove difficult to scrape:
1. Check for calendar APIs or structured data
2. Consider rate-limiting between locations
3. May need to adjust selectors for specific site redesigns
4. Could add fallback to homepage parsing if event pages fail

## Source Registry

Added to `crawlers/main.py`:
```python
# ===== Family Entertainment & Trampoline Parks =====
"defy-atlanta": "sources.defy_atlanta",
"urban-air-atlanta": "sources.urban_air_atlanta",
"sky-zone-atlanta": "sources.sky_zone_atlanta",
```

## File Locations

- `/Users/coach/Projects/LostCity/crawlers/sources/defy_atlanta.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/urban_air_atlanta.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/sky_zone_atlanta.py`
- `/Users/coach/Projects/LostCity/database/migrations/093_trampoline_parks.sql`
- `/Users/coach/Projects/LostCity/crawlers/TRAMPOLINE_PARKS_CRAWLERS.md` (this file)
