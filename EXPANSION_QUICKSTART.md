# Geographic Expansion Quick Start Guide

**TL;DR for adding a new city/area to LostCity coverage**

---

## 5-Minute Checklist

### 1. Identify Top 10 Sources

**Research order:**
1. Google: "[city name] events calendar"
2. City government: `[cityname].gov/events`
3. Local arts center/theater
4. Library system
5. Tourism board: `visit[cityname].com`
6. Chamber of commerce
7. Check Creative Loafing / Eventbrite for venues in that area

**Prioritize:**
- ✅ Venues with their own calendars (theaters, museums, breweries)
- ✅ Government/library calendars (high volume, good metadata)
- ❌ Skip aggregators that just rescrape other sources

### 2. Create First Crawler (15 minutes)

```bash
# Copy template
cp crawlers/sources/TEMPLATE.py crawlers/sources/new_venue_slug.py

# Edit the file - CRITICAL FIELDS:
VENUE_DATA = {
    "name": "Exact Official Name",
    "slug": "lowercase-slug",
    "address": "Full street address",
    "neighborhood": "Specific District/Area",  # Don't skip!
    "city": "Exact City Name",                  # Don't skip!
    "state": "GA",
    "zip": "30060",
    "lat": 33.9526,  # From Google Maps
    "lng": -84.5499,
    # ... other fields
}

# Implement parsing for that site's HTML structure
# Test it
python crawlers/main.py --source new-venue-slug --dry-run
```

### 3. Add to Registry

Edit `/crawlers/main.py`, add to `SOURCE_MODULES` dict:

```python
SOURCE_MODULES = {
    # ... existing entries
    "new-venue-slug": "sources.new_venue_slug",
}
```

### 4. Add to Database

```bash
# Insert source record (if not already in DB)
# Via Supabase UI or SQL:
INSERT INTO sources (name, slug, url, source_type, is_active)
VALUES ('New Venue Name', 'new-venue-slug', 'https://example.com', 'venue', true);
```

### 5. Test & Validate

```bash
# Full crawl
python crawlers/main.py --source new-venue-slug

# Check results
python -c "
from db import get_client
client = get_client()
result = client.table('events').select('title, start_date').eq('source_id', [SOURCE_ID]).execute()
print(f'Found {len(result.data)} events')
for e in result.data[:5]:
    print(f'  - {e[\"title\"]} on {e[\"start_date\"]}')
"
```

---

## Common Patterns Reference

### Pattern: Static HTML Site

```python
import requests
from bs4 import BeautifulSoup  # If using BeautifulSoup

response = requests.get(EVENTS_URL, timeout=30)
soup = BeautifulSoup(response.text, 'html.parser')

# Find events (adjust selectors to site structure)
events = soup.select('.event-card')
for event in events:
    title = event.select_one('.title').text.strip()
    date = event.select_one('.date').text.strip()
    # ... parse and insert
```

### Pattern: JavaScript Site (Playwright)

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(3000)  # Let JS render

    # Scroll to load lazy content
    for _ in range(5):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)

    # Get rendered HTML
    html = page.content()
    # Or get text directly
    body_text = page.inner_text("body")

    browser.close()
```

### Pattern: Multi-Location Source (Filter by Geography)

```python
# In process_event() or similar:
venue_address = event_data.get("address", {})
city = venue_address.get("city", "").lower()

# Filter to target area
if city not in ["marietta", "roswell", "alpharetta", "atlanta"]:
    logger.debug(f"Skipping event in {city} (outside coverage)")
    return None

# Create venue with accurate city
venue_data = {
    "name": venue_name,
    "city": venue_address.get("city", "Unknown"),
    "state": "GA",
    # ... other fields
}
```

---

## Critical Fields Checklist

**Every crawler MUST set:**
- ✅ `VENUE_DATA["name"]` - Official venue name
- ✅ `VENUE_DATA["city"]` - Exact city name (Marietta, not "Atlanta area")
- ✅ `VENUE_DATA["neighborhood"]` - Local district name (NOT "Downtown" - be specific)
- ✅ `VENUE_DATA["state"]` - State code
- ✅ `event_record["start_date"]` - YYYY-MM-DD format
- ✅ `event_record["category"]` - Valid category
- ✅ `event_record["content_hash"]` - For deduplication

**Strongly recommended:**
- `VENUE_DATA["lat"]` / `VENUE_DATA["lng"]` - Coordinates
- `VENUE_DATA["address"]` - Street address
- `event_record["start_time"]` - HH:MM format
- `event_record["description"]` - Event details
- `event_record["image_url"]` - Event image
- `event_record["tags"]` - Include city/area tags

---

## Geographic Validation

**Problem:** 40.9% of events missing neighborhood data → breaks filtering

**Solution:**

```python
# In every crawler:
VENUE_DATA = {
    "neighborhood": "Marietta Square",  # SPECIFIC local name
    "city": "Marietta",                  # NOT "Atlanta" if it's actually Marietta
    # ...
}

# Add geographic tags:
tags = ["marietta", "cobb-county", "marietta-square"]
```

**Validate after crawling:**

```bash
# Check neighborhood coverage
python -c "
from db import get_client
client = get_client()
result = client.table('events') \
    .select('venue:venues(city, neighborhood)') \
    .is_('venue.neighborhood', 'null') \
    .execute()
print(f'{len(result.data)} events missing neighborhood')
"
```

---

## Common Issues & Fixes

### Issue: Crawler finds 0 events

**Diagnosis:**
1. Check if site structure changed (view page source)
2. Check if JavaScript rendering needed (view in browser with JS disabled)
3. Check if URL pattern changed
4. Check if events are behind authentication/paywall

**Fix:**
- Update HTML selectors
- Switch to Playwright if JS-heavy
- Update URL pattern
- Skip if gated content

### Issue: Events appear in wrong city

**Diagnosis:**
```python
# Check what's in the database:
from db import get_client
client = get_client()
result = client.table('venues').select('name, city').eq('slug', 'venue-slug').execute()
print(result.data)
```

**Fix:**
- Update `VENUE_DATA["city"]` in crawler
- Re-run crawler to update venue

### Issue: High duplicate rate

**Diagnosis:**
- Check if aggregator (Creative Loafing, Eventbrite) also crawls this venue
- Check if multiple crawlers target same source with different URLs

**Fix:**
- Prefer direct source (venue website) over aggregator
- Disable aggregator for that venue
- Or improve `content_hash` to better dedupe

### Issue: Date parsing fails

**Common date formats:**
- "January 15, 2026" → Use `datetime.strptime(date, "%B %d, %Y")`
- "Jan 15" → Infer year based on today's date
- "01/15/2026" → Use `datetime.strptime(date, "%m/%d/%Y")`

**Tip:** Use existing parse functions in other crawlers as reference.

---

## Scaling a New Area (Marietta Example)

**Goal:** 10-15 sources, 150+ events/month

### Week 1: Core Venues (5 sources)
1. Earl and Rachel Smith Strand Theatre (theater)
2. Theatre in the Square (theater)
3. Marietta Square Farmers Market (food/community)
4. City of Marietta events (government)
5. Marietta/Cobb Museum (already exists ✅)

### Week 2: Nightlife & Food (3 sources)
1. Variant Brewing (brewery)
2. Ironmonger Brewing (brewery)
3. Local restaurants with events

### Week 3: Enhance Multi-Area Sources (2 tasks)
1. Ensure Creative Loafing tags Marietta events correctly
2. Ensure Cobb Library branches are properly tagged

### Week 4: Quality Check
1. Run neighborhood backfill script
2. Verify 150+ events in next 30 days
3. Check category distribution
4. Fix any missing data

**Expected coverage:**
- Theater: 30+ events
- Music: 20+ events
- Community: 40+ events
- Food/drink: 15+ events
- Art: 10+ events
- Family: 15+ events
- Other: 20+ events

---

## Testing Commands

```bash
# Test single source (no DB writes)
python crawlers/main.py --source venue-slug --dry-run

# Crawl single source (write to DB)
python crawlers/main.py --source venue-slug

# Crawl all sources for a city (if tagged)
# (No built-in city filter - crawl all, then query DB)

# Check crawl logs
python crawlers/main.py --circuit-status | grep venue-name

# View events for a source
python -c "
from db import get_client
client = get_client()
result = client.table('events') \
    .select('title, start_date, category') \
    .eq('source.slug', 'venue-slug') \
    .limit(10) \
    .execute()
for e in result.data:
    print(f\"{e['start_date']}: {e['title']} ({e['category']})\")
"
```

---

## Next Steps After First 10 Sources

1. **Monitor crawl health:** Check daily for errors, fix broken crawlers
2. **Identify gaps:** Run coverage report by category/date
3. **Add specialized sources:** LGBTQ+ venues, ethnic community centers, sports leagues
4. **Enhance aggregators:** Better geographic tagging for Eventbrite/CL
5. **Backfill data:** Run geocoding script for venues missing coordinates
6. **User feedback:** Check which events get engagement, add similar sources

---

## Resources

- **Full playbook:** `/GEOGRAPHIC_EXPANSION_PLAYBOOK.md`
- **Crawler template:** `/crawlers/sources/TEMPLATE.py`
- **Existing crawlers:** `/crawlers/sources/*.py` (407 examples)
- **Database schema:** `/database/migrations/`
- **Utils:** `/crawlers/utils.py` (date parsing, geocoding helpers)

---

## Quick Reference: Valid Categories

**Primary categories:**
- `music` - Concerts, DJ nights, live music
- `art` - Galleries, exhibitions, art shows
- `comedy` - Stand-up, improv, comedy shows
- `theater` - Plays, musicals, dance performances
- `film` - Movies, screenings, film festivals
- `sports` - Games, matches, fitness events
- `food_drink` - Tastings, dinners, food festivals
- `nightlife` - Clubs, parties, DJ events
- `community` - Civic, cultural, social events
- `fitness` - Yoga, running, workout classes
- `family` - Kids events, family-friendly activities
- `learning` - Classes, workshops, lectures
- `dance` - Dance classes, social dances
- `tours` - Guided tours, walking tours
- `meetup` - Social gatherings, networking
- `words` - Readings, book clubs, storytelling
- `religious` - Faith-based events, services
- `markets` - Farmers markets, craft fairs
- `wellness` - Health, meditation, wellness events
- `gaming` - Esports, board games, arcade
- `outdoors` - Hiking, nature, outdoor recreation
- `activism` - Protests, organizing, advocacy

**Common subcategories:**
- `music`: `concert`, `dj`, `jazz`, `classical`, `open-mic`
- `theater`: `play`, `musical`, `ballet`, `opera`
- `film`: `screening`, `festival`, `premiere`
- `nightlife`: `drag-show`, `trivia`, `karaoke`, `party`
- `community`: `workshop`, `festival`, `volunteer`, `civic`

---

**Questions? Check the full playbook or existing crawler examples.**
