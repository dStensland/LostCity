# Atlanta Hotel Venue Crawlers

## Summary

Created crawlers for Atlanta hotel venues that host public events. Most major hotel chains do not maintain public event calendars (events are private/corporate), but boutique hotels and historic venues with public-facing bars and event spaces do.

## Working Crawlers

### 1. Hotel Clermont ✅ ACTIVE
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/hotel_clermont.py`
**URL:** https://www.hotelclermont.com/events
**Status:** Working perfectly
**Events Found:** 18 events (9 new on first run)

**Details:**
- Historic Poncey-Highland hotel with famous rooftop bar
- Uses Squarespace events calendar with JSON-LD structured data
- Regular recurring events:
  - Trivia Tuesdays (Dirty South Trivia)
  - Wine Down Wednesdays
  - Monday Movie Night
  - Special live music and DJ events

**Technical Notes:**
- Squarespace uses component-based structure with class names like `eapp-events-calendar-grid-item`
- Event data embedded in JSON-LD `<script type="application/ld+json">` tags
- Date displayed separately from time in UI
- Parser extracts: category, name, date (from JSON-LD), time, location

**Categories:** music, nightlife, trivia

---

## Monitoring Crawlers (Inactive)

### 2. Skylounge at Glenn Hotel ⏸️ INACTIVE
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/skylounge_glenn.py`
**URL:** https://glennhotel.com/skylounge
**Status:** Monitoring only - no regular public calendar

**Details:**
- Rooftop bar in downtown Atlanta
- Does not maintain a public events calendar
- Crawler created for future monitoring in case they add events

---

### 3. The Georgian Terrace Hotel ⏸️ INACTIVE
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/georgian_terrace.py`
**URL:** https://thegeorgianterrace.com/events
**Status:** Inactive - events page returns 404

**Details:**
- Historic Midtown hotel across from Fox Theatre
- Events page exists but returns "No Results Found"
- Likely only hosts private events (weddings, galas)
- Crawler created but marked inactive

---

## Hotels Investigated (No Public Events)

The following Atlanta hotels were checked but **do not have public event calendars**:

### Boutique Hotels Checked:
- **The Forth Hotel** (theforthhotel.com) - No events calendar
- **W Atlanta** locations - No public events calendar
- **Epicurean Atlanta** - Parent site (Tampa location only), no Atlanta location
- **Reverb by Hard Rock** - No Atlanta location found

### Chain Hotels:
- **Omni Atlanta CNN Center** - Private/corporate events only
- **Hyatt Regency Atlanta** - Private/corporate events only
- **Hotel Indigo Atlanta** - No events calendar

## Why Most Hotels Don't Have Crawlable Events

1. **Private Events Only:** Most hotels host weddings, corporate meetings, conferences - not public events
2. **No Public Calendar:** Events are managed internally, not published online
3. **Chain Hotels:** Focus on meetings/conventions with private booking systems
4. **Boutique Hotels:** May have bars/restaurants with events, but don't maintain structured calendars

## Best Sources for Hotel Events

The winning pattern for hotel event crawlers:
1. **Historic hotels with public-facing bars/lounges** (like Hotel Clermont)
2. **Hotels with regular recurring public events** (trivia, music, etc.)
3. **Squarespace or WordPress event calendars** (structured data)

## Database Registration

All sources registered in `sources` table:
```sql
-- Hotel Clermont: ACTIVE
id: 292, slug: hotel-clermont, is_active: true

-- Skylounge Glenn: INACTIVE (monitoring)
id: 294, slug: skylounge-glenn-hotel, is_active: false

-- Georgian Terrace: INACTIVE (no calendar)
id: 293, slug: georgian-terrace-hotel, is_active: false
```

## Crawler Registration

Added to `/Users/coach/Projects/LostCity/crawlers/main.py`:
```python
# ===== Hotel Venues =====
"hotel-clermont": "sources.hotel_clermont",
"georgian-terrace-hotel": "sources.georgian_terrace",
"skylounge-glenn-hotel": "sources.skylounge_glenn",
```

## Testing

```bash
# Test Hotel Clermont crawler
source venv/bin/activate
python main.py --source hotel-clermont

# Result: ✅ 18 events found, 9 new added
```

## Recommendations

### Immediate Actions:
1. ✅ Hotel Clermont is ready for production use
2. Monitor Clermont for new event types and adjust categories as needed
3. Periodically check inactive sources for new event calendars

### Future Expansion:
Look for similar venues:
- **Rooftop bars in hotels** that host regular events
- **Historic hotels** with active nightlife programming
- **Hotels with music venues** (like Hotel Congress in Tucson)
- **Boutique hotels** in O4W, Inman Park, Virginia Highland

### Other Atlanta Hotel Venues to Check:
- **Kimpton hotels** - Sometimes have bar programming
- **Loews Atlanta** - Has rooftop pool bar
- **Ellis Hotel** - Downtown with rooftop bar
- **AC Hotel Atlanta Midtown** - Sometimes has events

## Notes

- Most successful hotel crawler is Hotel Clermont due to:
  1. Regular public events (not private)
  2. Structured Squarespace calendar with JSON-LD
  3. Famous nightlife destination (Clermont Lounge)

- Hotel event crawling is generally low-yield compared to dedicated venues
- Focus should remain on standalone bars, clubs, and music venues rather than hotels
