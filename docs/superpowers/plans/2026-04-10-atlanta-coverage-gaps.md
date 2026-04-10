# Atlanta Coverage Gaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 5 biggest gaps in Atlanta content coverage: AMC cinema dedup investigation, Falcons game schedule, hours enrichment, nightlife Instagram activation, and restaurant discovery seed.

**Architecture:** Mix of investigation (AMC), new crawler (Falcons), operational runs (hours), activation of existing code (Instagram), and new batch script (restaurants). Each task is independent.

**Tech Stack:** Python, Google Places API, Ticketmaster API, Playwright, PostgreSQL

---

### Task 1: Investigate AMC Cinema Showtime Duplicates

**Context:** The data audit found 2,232 "excess" records from AMC. However, investigation reveals that showtimes-as-separate-events is **intentional** — each showtime gets a unique hash via pipe-delimited time (`date|14:00`), linked by a film series. The "duplicates" may be legitimate showtime records, not bugs. Need to investigate before fixing.

**Files:**
- Investigate: `crawlers/sources/amc_atlanta.py`
- Investigate: `crawlers/dedupe.py`

- [ ] **Step 1: Query to understand the actual duplication pattern**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
from collections import Counter
client = get_client()

# Get AMC source IDs
sources = client.table('sources').select('id,name').ilike('name', '%AMC%').execute()
source_ids = [s['id'] for s in sources.data]
print(f'AMC sources: {len(source_ids)}')

# Get future AMC events
events = client.table('events').select('title,start_date,start_time,place_id,content_hash').in_('source_id', source_ids).eq('is_active', True).gte('start_date', '2026-04-10').limit(500).execute()

# Count by title+date+venue (ignoring time)
key_counts = Counter()
for e in events.data:
    key = (e['title'], e['start_date'], e['place_id'])
    key_counts[key] += 1

# Find actual duplicates (same title+date+venue with >1 record)
dupes = {k: v for k, v in key_counts.items() if v > 1}
print(f'Total future AMC events: {len(events.data)}')
print(f'Unique title+date+venue combos: {len(key_counts)}')
print(f'Combos with >1 record: {len(dupes)}')
print(f'Average records per combo with dupes: {sum(dupes.values()) / len(dupes) if dupes else 0:.1f}')

# Sample a duplicate to see if times differ
if dupes:
    sample_key = list(dupes.keys())[0]
    sample_events = [e for e in events.data if (e['title'], e['start_date'], e['place_id']) == sample_key]
    print(f'\nSample: \"{sample_key[0]}\" on {sample_key[1]}')
    for e in sample_events[:5]:
        print(f'  time={e[\"start_time\"]} hash={e[\"content_hash\"][:12]}')
"
```

- [ ] **Step 2: Diagnose based on findings**

**If times differ (e.g., 14:00, 17:00, 20:00):** This is working as intended. Each showtime is a separate bookable event linked by a series. No fix needed — close this task.

**If times are identical (true duplicates):** The crawler is inserting the same showtime multiple times. Fix by adding a `find_event_by_hash` check before insert in `amc_atlanta.py`.

**If format variants are the issue (IMAX vs Dolby vs Standard at same time):** The crawler treats each format as a separate event. Options:
- Accept it (each format IS a different ticket/experience)
- Collapse to one event per time, store formats in metadata

- [ ] **Step 3: Fix if needed, document if not**

If no fix needed:
```bash
git commit --allow-empty -m "docs: AMC showtime duplicates are intentional — each showtime is a separate bookable event linked by film series"
```

If fix needed, apply the fix and commit with appropriate message.

---

### Task 2: Atlanta Falcons Game Schedule Crawler

**Context:** The GameDay feature is fully built. Hawks, United, Braves, Dream all have crawlers. Falcons are the only missing major team — `teams-config.ts` has `sourceSlugs: []` and `defaultEnabled: false`.

**Files:**
- Create: `crawlers/sources/atlanta_falcons.py`
- Modify: `web/lib/teams-config.ts:131`

- [ ] **Step 1: Build the Falcons crawler**

Create `crawlers/sources/atlanta_falcons.py` following the Truist Park pattern but using Ticketmaster API filtered to Mercedes-Benz Stadium + Falcons:

```python
"""
Atlanta Falcons game schedule crawler.

Uses Ticketmaster Discovery API filtered to Mercedes-Benz Stadium
for Atlanta Falcons games. Produces events categorized as 'sports'
with appropriate series grouping for the NFL season.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

import requests

from db import get_or_create_place, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from config import get_config

logger = logging.getLogger(__name__)

MBS_VENUE_ID = "KovZpZAJledA"  # Ticketmaster venue ID for Mercedes-Benz Stadium
TM_API_KEY = get_config().ticketmaster_api_key

PLACE_DATA = {
    "name": "Mercedes-Benz Stadium",
    "slug": "mercedes-benz-stadium",
    "address": "1 AMB Drive NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7553,
    "lng": -84.4006,
    "place_type": "stadium",
    "spot_type": "stadium",
    "website": "https://mercedesbenzstadium.com",
}


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    venue_id = get_or_create_place(PLACE_DATA)
    
    found = new = updated = 0
    
    # Fetch Falcons events from Ticketmaster
    today = date.today()
    end = today + timedelta(days=180)  # 6-month lookahead
    
    url = "https://app.ticketmaster.com/discovery/v2/events.json"
    params = {
        "apikey": TM_API_KEY,
        "venueId": MBS_VENUE_ID,
        "keyword": "Falcons",
        "startDateTime": f"{today.isoformat()}T00:00:00Z",
        "endDateTime": f"{end.isoformat()}T23:59:59Z",
        "size": 50,
        "sort": "date,asc",
    }
    
    resp = requests.get(url, params=params, timeout=30)
    if resp.status_code != 200:
        logger.error("Ticketmaster API error: %s", resp.status_code)
        return 0, 0, 0
    
    data = resp.json()
    events = data.get("_embedded", {}).get("events", [])
    
    for event in events:
        title = event.get("name", "")
        if "falcons" not in title.lower() and "atlanta falcons" not in title.lower():
            continue
        
        # Extract date and time
        event_date = event.get("dates", {}).get("start", {}).get("localDate")
        event_time = event.get("dates", {}).get("start", {}).get("localTime")
        if not event_date:
            continue
        
        content_hash = generate_content_hash(title, PLACE_DATA["name"], event_date)
        existing = find_event_by_hash(content_hash)
        if existing:
            updated += 1
            continue
        
        # Extract image
        images = event.get("images", [])
        image_url = next((img["url"] for img in images if img.get("ratio") == "16_9" and img.get("width", 0) >= 640), None)
        if not image_url and images:
            image_url = images[0].get("url")
        
        # Extract price
        price_min = None
        price_ranges = event.get("priceRanges", [])
        if price_ranges:
            price_min = price_ranges[0].get("min")
        
        event_record = {
            "title": title,
            "start_date": event_date,
            "start_time": event_time[:5] if event_time else None,
            "place_id": venue_id,
            "source_id": source_id,
            "source_url": event.get("url"),
            "content_hash": content_hash,
            "description": f"Atlanta Falcons NFL game at Mercedes-Benz Stadium.",
            "category": "sports",
            "subcategory": "football",
            "image_url": image_url,
            "ticket_url": event.get("url"),
            "price_min": price_min,
            "tags": ["falcons", "nfl", "football", "sports", "mercedes-benz-stadium"],
            "is_all_day": False,
        }
        
        result = insert_event(
            event_record,
            series_hint={
                "series_type": "recurring_show",
                "series_title": "Atlanta Falcons 2026 Season",
                "frequency": "weekly",
            },
        )
        if result:
            new += 1
        found += 1
    
    logger.info("Atlanta Falcons: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
```

- [ ] **Step 2: Register the source**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
client = get_client()
client.table('sources').insert({
    'slug': 'atlanta-falcons',
    'name': 'Atlanta Falcons (Ticketmaster)',
    'url': 'https://www.ticketmaster.com/atlanta-falcons-tickets/artist/805900',
    'source_type': 'api',
    'is_active': True,
    'crawl_frequency': 'weekly'
}).execute()
print('Source created')
"
```

- [ ] **Step 3: Update teams-config.ts**

In `web/lib/teams-config.ts`, find the Falcons entry (around line 131). Change:

```typescript
sourceSlugs: [],
defaultEnabled: false,
```

to:

```typescript
sourceSlugs: ["atlanta-falcons"],
defaultEnabled: true,
```

- [ ] **Step 4: Dry-run**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source atlanta-falcons --dry-run
```

- [ ] **Step 5: Production write**

```bash
python3 main.py --source atlanta-falcons --allow-production-writes --skip-run-lock
```

- [ ] **Step 6: Verify in GameDay**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/atlanta_falcons.py web/lib/teams-config.ts
git commit -m "feat(crawler): add Atlanta Falcons game schedule via Ticketmaster

Uses Ticketmaster Discovery API filtered to Mercedes-Benz Stadium.
Enables Falcons in GameDay feed with defaultEnabled: true."
```

---

### Task 3: Hours Enrichment Run

**Context:** `hydrate_hours_google.py` already exists and works. 62% of places have no hours. This is an operational task — run the script.

**Files:**
- No code changes

- [ ] **Step 1: Check current hours coverage**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
client = get_client()
total = client.table('places').select('id', count='exact').eq('is_active', True).execute()
with_hours = client.table('places').select('id', count='exact').eq('is_active', True).not_.is_('hours', 'null').execute()
print(f'Total active places: {total.count}')
print(f'With hours: {with_hours.count} ({100*with_hours.count/total.count:.1f}%)')
print(f'Missing hours: {total.count - with_hours.count}')
"
```

- [ ] **Step 2: Run hours enrichment in batches**

Start with high-value venue types:

```bash
# Restaurants (biggest user need)
python3 hydrate_hours_google.py --venue-type restaurant --limit 200

# Bars (nightlife hours matter)
python3 hydrate_hours_google.py --venue-type bar --limit 200

# Museums and attractions
python3 hydrate_hours_google.py --venue-type museum --limit 100
python3 hydrate_hours_google.py --venue-type gallery --limit 100

# Music venues
python3 hydrate_hours_google.py --venue-type music_venue --limit 100
```

Note: This consumes Google Places API quota. Monitor usage.

- [ ] **Step 3: Verify improvement**

Re-run the coverage check from Step 1. Target: >60% of active places with hours (up from ~38%).

- [ ] **Step 4: Commit if any code changes were needed**

If no code changes: no commit needed. This is a data operation.

---

### Task 4: Activate Instagram Nightlife Scraper

**Context:** `scrape_instagram_specials.py` is 827 lines of production-ready code that's never been run at scale. It uses Playwright + LLM extraction to discover recurring programming (trivia, karaoke, DJ nights) from bar Instagram profiles.

**Files:**
- Possibly modify: `crawlers/scrape_instagram_specials.py` (if fixes needed)

- [ ] **Step 1: Check Instagram handle coverage**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
client = get_client()

# How many bars have Instagram handles?
bars = client.table('places').select('id,name,instagram').eq('place_type', 'bar').eq('is_active', True).not_.is_('instagram', 'null').limit(200).execute()
print(f'Bars with Instagram handles: {len(bars.data)}')
for b in bars.data[:10]:
    print(f'  {b[\"name\"]}: @{b[\"instagram\"]}')

# How many bars total?
total = client.table('places').select('id', count='exact').eq('place_type', 'bar').eq('is_active', True).execute()
print(f'\nTotal active bars: {total.count}')
print(f'Instagram coverage: {len(bars.data)}/{total.count} ({100*len(bars.data)/total.count:.1f}%)')
"
```

- [ ] **Step 2: If Instagram handles are sparse, hydrate them first**

```bash
# Run Foursquare hydration to populate Instagram handles
python3 hydrate_venues_foursquare.py --venue-type bar --limit 50 --dry-run
```

If the Foursquare script works, run it without `--dry-run` for the top bars.

- [ ] **Step 3: Test the Instagram scraper on 5 bars**

```bash
# Start with a small test run
python3 scrape_instagram_specials.py --venue-type bar --limit 5 --dry-run --verbose
```

Check output: Does it find specials? Events? Are the LLM extractions reasonable?

- [ ] **Step 4: Run on the top 30 culturally important bars**

Identify the top 30 bars by cultural significance (Clermont Lounge, Star Bar, Northside Tavern, Sister Louisa's, The Porter, Mary's, The EARL, Venkman's, etc.):

```bash
# Get venue IDs for priority bars
python3 -c "
from db.client import get_client
client = get_client()
priority = ['clermont-lounge', 'star-bar', 'northside-tavern', 'sister-louisas', 'the-porter-beer-bar', 'marys', 'the-earl', 'venkmans', 'eddies-attic', 'blind-willies']
for slug in priority:
    p = client.table('places').select('id,name,instagram').eq('slug', slug).execute()
    if p.data:
        print(f'{p.data[0][\"id\"]:5d} {p.data[0][\"name\"]:30s} @{p.data[0].get(\"instagram\") or \"NONE\"}')
"
```

Then run the scraper on those venue IDs:

```bash
python3 scrape_instagram_specials.py --venue-ids 123,456,789 --dry-run
# If looks good:
python3 scrape_instagram_specials.py --venue-ids 123,456,789
```

- [ ] **Step 5: Verify specials were created**

```bash
python3 -c "
from db.client import get_client
client = get_client()
specials = client.table('venue_specials').select('id,place_id,title,type,days_of_week', count='exact').execute()
print(f'Total venue specials: {specials.count}')
for s in specials.data[:10]:
    print(f'  {s[\"title\"]} ({s[\"type\"]}) — {s[\"days_of_week\"]}')
"
```

- [ ] **Step 6: Commit any fixes**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/scrape_instagram_specials.py
git commit -m "ops: activate Instagram nightlife scraper on top 30 Atlanta bars"
```

---

### Task 5: Restaurant Discovery Seed via Google Places

**Context:** No comprehensive restaurant layer exists. Need to seed the top 200-300 Atlanta restaurants from Google Places API with hours, cuisine-adjacent type, price level, photos.

**Files:**
- Create: `crawlers/scripts/seed_atlanta_restaurants.py`

- [ ] **Step 1: Build the restaurant seed script**

Create `crawlers/scripts/seed_atlanta_restaurants.py`:

```python
"""
Seed Atlanta's top restaurants from Google Places API.

Queries Google Places Text Search for restaurants in Atlanta neighborhoods,
creates place records with hours, price level, photos, and type metadata.
Uses existing get_or_create_place() to avoid duplicates.

Usage:
  python -m scripts.seed_atlanta_restaurants --dry-run
  python -m scripts.seed_atlanta_restaurants --neighborhood midtown --limit 50
  python -m scripts.seed_atlanta_restaurants --all --limit 300
"""

import argparse
import logging
import time
from typing import Optional

import requests

from db import get_or_create_place
from db.client import get_client, writes_enabled
from config import get_config

logger = logging.getLogger(__name__)

GOOGLE_API_KEY = get_config().google_places_api_key
GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"

FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,places.location,"
    "places.types,places.primaryType,places.rating,places.userRatingCount,"
    "places.priceLevel,places.regularOpeningHours,places.websiteUri,"
    "places.nationalPhoneNumber,places.photos,places.editorialSummary"
)

# Atlanta neighborhoods to search
NEIGHBORHOODS = [
    "Midtown Atlanta",
    "Downtown Atlanta",
    "Buckhead Atlanta",
    "Inman Park Atlanta",
    "Old Fourth Ward Atlanta",
    "Virginia-Highland Atlanta",
    "Decatur Georgia",
    "East Atlanta Village",
    "Little Five Points Atlanta",
    "Westside Atlanta",
    "Poncey-Highland Atlanta",
    "Grant Park Atlanta",
    "Kirkwood Atlanta",
    "Edgewood Atlanta",
    "Castleberry Hill Atlanta",
    "West Midtown Atlanta",
    "Reynoldstown Atlanta",
    "Cabbagetown Atlanta",
    "Summerhill Atlanta",
    "Avondale Estates Georgia",
]

PRICE_MAP = {
    "PRICE_LEVEL_FREE": None,
    "PRICE_LEVEL_INEXPENSIVE": "$",
    "PRICE_LEVEL_MODERATE": "$$",
    "PRICE_LEVEL_EXPENSIVE": "$$$",
    "PRICE_LEVEL_VERY_EXPENSIVE": "$$$$",
}


def search_restaurants(neighborhood: str, limit: int = 20) -> list[dict]:
    """Search Google Places for restaurants in a neighborhood."""
    headers = {
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
    }
    body = {
        "textQuery": f"best restaurants in {neighborhood}",
        "maxResultCount": min(limit, 20),  # Google caps at 20 per request
        "languageCode": "en",
    }
    
    resp = requests.post(GOOGLE_PLACES_URL, headers=headers, json=body, timeout=30)
    if resp.status_code != 200:
        logger.error("Google Places API error for %s: %s", neighborhood, resp.status_code)
        return []
    
    return resp.json().get("places", [])


def map_google_place_to_venue(place: dict, neighborhood: str) -> Optional[dict]:
    """Convert Google Places result to a venue_data dict for get_or_create_place."""
    name = place.get("displayName", {}).get("text")
    if not name:
        return None
    
    location = place.get("location", {})
    address = place.get("formattedAddress", "")
    
    # Extract hours
    hours = None
    raw_hours = place.get("regularOpeningHours", {})
    if raw_hours and "periods" in raw_hours:
        day_names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
        hours = {}
        for period in raw_hours["periods"]:
            open_info = period.get("open", {})
            close_info = period.get("close", {})
            day_idx = open_info.get("day", 0)
            day_name = day_names[day_idx]
            hours[day_name] = {
                "open": f"{open_info.get('hour', 0):02d}:{open_info.get('minute', 0):02d}",
                "close": f"{close_info.get('hour', 0):02d}:{close_info.get('minute', 0):02d}",
            }
    
    # Extract photo URL
    image_url = None
    photos = place.get("photos", [])
    if photos:
        photo_name = photos[0].get("name")
        if photo_name:
            image_url = f"https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=800&key={GOOGLE_API_KEY}"
    
    # Price level
    price_level = PRICE_MAP.get(place.get("priceLevel"))
    
    # Description
    description = place.get("editorialSummary", {}).get("text")
    
    # Determine specific venue type
    primary_type = place.get("primaryType", "restaurant")
    type_map = {
        "bar": "bar",
        "cafe": "coffee_shop",
        "coffee_shop": "coffee_shop",
        "bakery": "restaurant",
        "meal_delivery": "restaurant",
        "meal_takeaway": "restaurant",
    }
    venue_type = type_map.get(primary_type, "restaurant")
    
    return {
        "name": name,
        "slug": None,  # Auto-generated by get_or_create_place
        "address": address.split(",")[0] if address else None,
        "neighborhood": neighborhood.replace(" Atlanta", "").replace(" Georgia", ""),
        "city": "Atlanta",
        "state": "GA",
        "lat": location.get("latitude"),
        "lng": location.get("longitude"),
        "place_type": venue_type,
        "spot_type": venue_type,
        "website": place.get("websiteUri"),
        "phone": place.get("nationalPhoneNumber"),
        "description": description,
        "image_url": image_url,
        "hours": hours,
        "vibes": [],
        "metadata": {
            "google_rating": place.get("rating"),
            "google_review_count": place.get("userRatingCount"),
            "price_level": price_level,
            "google_place_id": place.get("id"),
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Seed Atlanta restaurants from Google Places")
    parser.add_argument("--neighborhood", help="Single neighborhood to seed")
    parser.add_argument("--all", action="store_true", help="Seed all neighborhoods")
    parser.add_argument("--limit", type=int, default=20, help="Restaurants per neighborhood")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to DB")
    args = parser.parse_args()
    
    logging.basicConfig(level=logging.INFO)
    
    neighborhoods = NEIGHBORHOODS if args.all else ([args.neighborhood] if args.neighborhood else NEIGHBORHOODS[:3])
    
    total_found = 0
    total_created = 0
    
    for hood in neighborhoods:
        logger.info("Searching restaurants in %s...", hood)
        places = search_restaurants(hood, limit=args.limit)
        
        for place in places:
            venue_data = map_google_place_to_venue(place, hood)
            if not venue_data:
                continue
            
            total_found += 1
            
            if args.dry_run:
                price = venue_data.get("metadata", {}).get("price_level", "?")
                rating = venue_data.get("metadata", {}).get("google_rating", "?")
                has_hours = "✓" if venue_data.get("hours") else "✗"
                has_img = "✓" if venue_data.get("image_url") else "✗"
                print(f"  [{price}] {venue_data['name']:40s} rating={rating} hours={has_hours} img={has_img}")
                continue
            
            venue_id = get_or_create_place(venue_data)
            if venue_id:
                total_created += 1
        
        # Rate limiting — Google Places API has per-minute quotas
        time.sleep(2)
    
    print(f"\nDone: {total_found} found, {total_created} created/updated")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Dry-run a few neighborhoods**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python -m scripts.seed_atlanta_restaurants --neighborhood "Midtown Atlanta" --limit 20 --dry-run
python -m scripts.seed_atlanta_restaurants --neighborhood "Inman Park Atlanta" --limit 20 --dry-run
```

Check: Are the restaurants real? Do they have hours, ratings, images?

- [ ] **Step 3: Seed all neighborhoods**

```bash
python -m scripts.seed_atlanta_restaurants --all --limit 20
```

This should produce ~300-400 restaurants across 20 neighborhoods (some will be deduped by `get_or_create_place`).

- [ ] **Step 4: Verify**

```bash
python3 -c "
from db.client import get_client
client = get_client()
restaurants = client.table('places').select('id', count='exact').eq('place_type', 'restaurant').eq('is_active', True).execute()
with_hours = client.table('places').select('id', count='exact').eq('place_type', 'restaurant').eq('is_active', True).not_.is_('hours', 'null').execute()
with_img = client.table('places').select('id', count='exact').eq('place_type', 'restaurant').eq('is_active', True).not_.is_('image_url', 'null').execute()
print(f'Total restaurants: {restaurants.count}')
print(f'With hours: {with_hours.count}')
print(f'With images: {with_img.count}')
"
```

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/scripts/seed_atlanta_restaurants.py
git commit -m "feat(scripts): seed Atlanta restaurants from Google Places API

Queries 20 Atlanta neighborhoods for top restaurants. Creates place
records with hours, price level, photos, ratings, and descriptions.
Initial seed: ~300 restaurants."
```

---

## Verification

After all tasks:

```bash
# Falcons in GameDay
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit

# Check overall coverage improvement
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
client = get_client()

# Hours coverage
total = client.table('places').select('id', count='exact').eq('is_active', True).execute()
hours = client.table('places').select('id', count='exact').eq('is_active', True).not_.is_('hours', 'null').execute()
print(f'Hours: {hours.count}/{total.count} ({100*hours.count/total.count:.1f}%)')

# Restaurant count
rest = client.table('places').select('id', count='exact').eq('place_type', 'restaurant').eq('is_active', True).execute()
print(f'Restaurants: {rest.count}')

# Venue specials (from Instagram)
spec = client.table('venue_specials').select('id', count='exact').execute()
print(f'Venue specials: {spec.count}')

# Falcons events
falc = client.table('events').select('id', count='exact').ilike('title', '%falcons%').eq('is_active', True).gte('start_date', '2026-04-10').execute()
print(f'Falcons future events: {falc.count}')
"

# Push
git push origin main
```
