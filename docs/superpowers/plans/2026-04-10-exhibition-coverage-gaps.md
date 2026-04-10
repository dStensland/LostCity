# Exhibition Coverage Gap Crawlers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the highest-impact coverage gaps identified in the exhibition audit: Margaret Mitchell House, Atlanta History Center features verification, NPS Atlanta parks, venue features for major music venues, and Fox Theatre investigation.

**Architecture:** New crawler files following existing patterns (`*_features.py` for venue features, standard crawl pattern for events). Each task is a standalone crawler or fix.

**Tech Stack:** Python, Playwright, requests, BeautifulSoup

---

## Tier 1: Embarrassing if Noticed

### Task 1: Margaret Mitchell House Crawler

**Context:** Place record exists (ID 224) but no active crawler. On every "Atlanta must-see" list. Need events + venue features.

**Files:**
- Create: `crawlers/sources/margaret_mitchell_house_features.py`

- [ ] **Step 1: Research the venue website**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
import requests
from bs4 import BeautifulSoup
headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
for url in ['https://www.atlantahistorycenter.com/explore/margaret-mitchell-house/', 'https://www.atlantahistorycenter.com/events/']:
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(resp.text, 'html.parser')
        print(f'{url}: {resp.status_code}')
        for h in soup.find_all(['h1','h2','h3'], limit=10):
            print(f'  {h.get_text(strip=True)[:60]}')
    except Exception as e:
        print(f'{url}: {e}')
"
```

Note: Margaret Mitchell House is operated by Atlanta History Center. The website may be a subpage of atlantahistorycenter.com.

- [ ] **Step 2: Build the crawler**

Create `crawlers/sources/margaret_mitchell_house_features.py` following the `zoo_atlanta_features.py` pattern:

PLACE_DATA:
- Name: "Margaret Mitchell House"
- Slug: "margaret-mitchell-house" (verify matches existing place record)
- Address: "979 Crescent Ave NE"
- Neighborhood: "Midtown"
- City: Atlanta, State: GA, ZIP: 30309
- Lat: 33.7862, Lng: -84.3792
- Place type: "museum"
- Website: "https://www.atlantahistorycenter.com/explore/margaret-mitchell-house/"

Venue features (hard-coded):
1. **The Apartment** — Where Margaret Mitchell wrote Gone with the Wind. Restored 1919 apartment. feature_type="attraction", admission_type="ticketed"
2. **Gone with the Wind Museum** — Exhibits on the novel, film, and cultural legacy. feature_type="exhibition", admission_type="ticketed"
3. **Historic Gardens** — Period-appropriate gardens surrounding the house. feature_type="attraction", admission_type="included"

Research image_url from the website. Description >= 100 chars each.

- [ ] **Step 3: Register source**

```python
python3 -c "
from db.client import get_client
client = get_client()
client.table('sources').insert({
    'slug': 'margaret-mitchell-house-features',
    'name': 'Margaret Mitchell House (Features)',
    'url': 'https://www.atlantahistorycenter.com/explore/margaret-mitchell-house/',
    'source_type': 'scrape',
    'is_active': True,
    'crawl_frequency': 'monthly'
}).execute()
print('Source created')
"
```

- [ ] **Step 4: Dry-run and verify**

```bash
python3 main.py --source margaret-mitchell-house-features --dry-run
```

Expected: 3+ features found.

- [ ] **Step 5: Production write**

```bash
python3 main.py --source margaret-mitchell-house-features --allow-production-writes
```

- [ ] **Step 6: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/margaret_mitchell_house_features.py
git commit -m "feat(crawler): add Margaret Mitchell House features crawler

Top-listed Atlanta tourist attraction. 3 permanent features:
the apartment, Gone with the Wind museum, historic gardens."
```

---

### Task 2: Verify Atlanta History Center Features Are Persisting

**Context:** The AHC crawler at `atlanta_history_center.py` already defines 5 venue features (Cyclorama, Swan House, Smith Farm, gardens, rotating exhibitions) in lines 103-139. But the audit showed only 10 exhibitions — need to verify features are actually being written to the DB.

**Files:**
- No new files expected — verification + possible fix

- [ ] **Step 1: Check if AHC features exist in DB**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
client = get_client()

# Find AHC place_id
p = client.table('places').select('id').eq('slug', 'atlanta-history-center').execute()
pid = p.data[0]['id'] if p.data else None
print(f'AHC place_id: {pid}')

# Check features
vf = client.table('venue_features').select('id,title,feature_type,image_url').eq('place_id', pid).eq('is_active', True).execute()
print(f'Features: {len(vf.data)}')
for f in vf.data:
    print(f'  {f[\"title\"]} ({f[\"feature_type\"]}) img={bool(f[\"image_url\"])}')
"
```

- [ ] **Step 2: If features are missing, check how the crawler emits them**

Read `crawlers/sources/atlanta_history_center.py` lines 103-139 to understand how features are defined. Check if they're emitted via `TypedEntityEnvelope` or direct `upsert_venue_feature()` calls. If the feature emission is defined but never called, wire it up.

- [ ] **Step 3: If features exist but have no images, add image URLs**

Research image URLs from atlantahistorycenter.com for each feature (Cyclorama, Swan House, Smith Farm). Update the crawler's feature definitions with `image_url` fields.

- [ ] **Step 4: Dry-run to verify**

```bash
python3 main.py --source atlanta-history-center --dry-run 2>&1 | grep -i "feature\|venue_feature"
```

- [ ] **Step 5: Production write if changes were needed**

```bash
python3 main.py --source atlanta-history-center --allow-production-writes
```

- [ ] **Step 6: Commit if changes were made**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/atlanta_history_center.py
git commit -m "fix(crawler): verify and enrich Atlanta History Center venue features"
```

---

### Task 3: NPS Atlanta Parks Base Crawler

**Context:** Three high-traffic NPS sites near Atlanta have no crawlers: MLK National Historical Park, Kennesaw Mountain National Battlefield Park, Chattahoochee River NRA. The NPS has a public API at `https://developer.nps.gov/api/v1/` that covers events, alerts, and park info. One base crawler can serve all three.

**Files:**
- Create: `crawlers/sources/nps_atlanta_parks.py`

- [ ] **Step 1: Get an NPS API key**

The NPS API requires a free API key from https://www.nps.gov/subjects/developer/get-started.htm. Check if one already exists in the project config:

```bash
grep -r "NPS\|nps_api\|nps.gov" /Users/coach/Projects/LostCity/crawlers/config.py
```

If not, the user will need to register for one. Report NEEDS_CONTEXT if no key is available.

- [ ] **Step 2: Build the NPS base crawler**

Create `crawlers/sources/nps_atlanta_parks.py`:

Cover three parks:
1. **MLK National Historical Park** (park code: `malu`) — 450 Auburn Ave NE, Sweet Auburn
2. **Kennesaw Mountain National Battlefield Park** (park code: `kemo`) — 900 Kennesaw Mountain Dr, Kennesaw
3. **Chattahoochee River NRA** (park code: `chat`) — 1978 Island Ford Pkwy, Sandy Springs

For each park:
- PLACE_DATA with correct address, coordinates, neighborhood
- `get_or_create_place()` for each park
- Venue features from the NPS API `/parks` endpoint (permanent attractions, trails, visitor centers)
- Events from the NPS API `/events` endpoint (ranger programs, tours, seasonal events)
- Exhibition-type records for any special exhibits mentioned

API endpoints:
- Parks: `https://developer.nps.gov/api/v1/parks?parkCode=malu,kemo,chat&api_key={key}`
- Events: `https://developer.nps.gov/api/v1/events?parkCode=malu,kemo,chat&api_key={key}`

- [ ] **Step 3: Register source**

```python
python3 -c "
from db.client import get_client
client = get_client()
client.table('sources').insert({
    'slug': 'nps-atlanta-parks',
    'name': 'National Park Service — Atlanta Area',
    'url': 'https://developer.nps.gov/api/v1/',
    'source_type': 'api',
    'is_active': True,
    'crawl_frequency': 'weekly'
}).execute()
print('Source created')
"
```

- [ ] **Step 4: Dry-run**

```bash
python3 main.py --source nps-atlanta-parks --dry-run
```

- [ ] **Step 5: Production write**

```bash
python3 main.py --source nps-atlanta-parks --allow-production-writes
```

- [ ] **Step 6: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/nps_atlanta_parks.py
git commit -m "feat(crawler): add NPS Atlanta parks crawler (MLK, Kennesaw Mtn, Chattahoochee)

Covers 3 National Park Service sites via the NPS public API.
Produces venue_features (permanent attractions) and events
(ranger programs, seasonal activities)."
```

---

## Tier 2: Important for Product Quality

### Task 4: Fox Theatre Source Investigation

**Context:** Fox Theatre (source active, `fox_theatre.py` exists) is only producing 3 events for a 5,000-seat landmark that hosts 100+ shows per year. The Playwright-based parser may have stale selectors.

**Files:**
- Modify: `crawlers/sources/fox_theatre.py`

- [ ] **Step 1: Debug the crawler**

```bash
cd /Users/coach/Projects/LostCity/crawlers
LOG_LEVEL=DEBUG python3 main.py --source fox-theatre --dry-run 2>&1 | tee /tmp/fox_debug.log
grep -i "found\|event\|parse\|error\|warn\|timeout" /tmp/fox_debug.log
```

- [ ] **Step 2: Check the website structure**

```bash
python3 -c "
import requests
from bs4 import BeautifulSoup
headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
resp = requests.get('https://www.foxtheatre.org/events', headers=headers, timeout=15)
soup = BeautifulSoup(resp.text, 'html.parser')
print(f'Status: {resp.status_code}, Title: {soup.title.get_text(strip=True) if soup.title else \"none\"}')
for h in soup.find_all(['h1','h2','h3','h4'], limit=20):
    print(f'  {h.get_text(strip=True)[:60]}')
"
```

- [ ] **Step 3: Fix based on diagnosis**

Common issues: stale CSS selectors, pagination not followed, Playwright timeout too short, date regex not matching current format. Fix the specific issue found.

- [ ] **Step 4: Dry-run to verify improvement**

```bash
python3 main.py --source fox-theatre --dry-run
```

Expected: significantly more than 3 events.

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/fox_theatre.py
git commit -m "fix(crawler): update Fox Theatre parser for current site structure"
```

---

### Task 5: Venue Features for Major Music Venues

**Context:** Tabernacle (79 events, 0 features) and Variety Playhouse (76 events, 0 features) are high-traffic venues with no venue-level enrichment. A user seeing a show gets zero context about the venue. These don't need full `*_features.py` crawlers — they need a few key features added.

**Files:**
- Create: `crawlers/sources/tabernacle_features.py`
- Create: `crawlers/sources/variety_playhouse_features.py`

- [ ] **Step 1: Build Tabernacle features crawler**

Create `crawlers/sources/tabernacle_features.py`:

PLACE_DATA: reuse from existing `tabernacle.py` (152 Luckie St NW, Downtown, lat: 33.7589, lng: -84.3914)

Features (hard-coded, researched):
1. **Main Concert Hall** — Historic 1911 Baptist church converted to a 2,600-capacity standing-room concert venue. feature_type="attraction", admission_type="ticketed"
2. **Balcony Level** — Upper level seating/standing with full venue views. feature_type="amenity", admission_type="included"
3. **Cotton Club** — Intimate 450-capacity room downstairs for smaller shows. feature_type="attraction", admission_type="ticketed"

Research image_url from tabernacleatl.com. Description >= 100 chars each.

- [ ] **Step 2: Build Variety Playhouse features crawler**

Create `crawlers/sources/variety_playhouse_features.py`:

PLACE_DATA: reuse from existing `variety_playhouse.py` (1099 Euclid Ave NE, Little Five Points, lat: 33.7635, lng: -84.3509)

Features (hard-coded, researched):
1. **Main Theater** — 1,100-capacity converted 1940s movie theater, one of Atlanta's most beloved live music rooms. feature_type="attraction", admission_type="ticketed"
2. **Outdoor Patio** — Pre-show gathering space in the heart of Little Five Points. feature_type="amenity", admission_type="included"
3. **The Balcony** — Upper level seating with tables for a more intimate concert experience. feature_type="amenity", admission_type="included"

Research image_url from variety-playhouse.com. Description >= 100 chars each.

- [ ] **Step 3: Register sources and dry-run**

```bash
python3 -c "
from db.client import get_client
client = get_client()
for slug, name in [('tabernacle-features', 'The Tabernacle (Features)'), ('variety-playhouse-features', 'Variety Playhouse (Features)')]:
    client.table('sources').insert({
        'slug': slug, 'name': name,
        'url': f'https://www.{slug.replace(\"-features\", \"\").replace(\"-\", \"\")}.com',
        'source_type': 'scrape', 'is_active': True, 'crawl_frequency': 'monthly'
    }).execute()
    print(f'{slug} created')
"

python3 main.py --source tabernacle-features --dry-run
python3 main.py --source variety-playhouse-features --dry-run
```

- [ ] **Step 4: Production writes**

```bash
python3 main.py --source tabernacle-features --allow-production-writes
python3 main.py --source variety-playhouse-features --allow-production-writes
```

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/tabernacle_features.py crawlers/sources/variety_playhouse_features.py
git commit -m "feat(crawler): add venue features for Tabernacle and Variety Playhouse

Two of Atlanta's highest-traffic music venues had 79 and 76 events
but zero venue context. Added permanent features: main halls,
balconies, Cotton Club (Tabernacle), outdoor patio (Variety)."
```

---

### Task 6: World of Coca-Cola Permanent Exhibitions

**Context:** World of Coca-Cola has 12 venue features but 0 exhibitions and 0 events. The permanent experiences (Taste It!, Vault of the Secret Formula, 4D Theater) should ALSO exist as permanent exhibition records so they surface in exhibition search and "What's On Now" feeds.

**Files:**
- Modify: `crawlers/sources/world_of_coca_cola_features.py`

- [ ] **Step 1: Add permanent exhibitions to the crawler**

In `world_of_coca_cola_features.py`, after the venue_features emission, add exhibition records for the key permanent experiences:

```python
PERMANENT_EXHIBITIONS = [
    {
        "title": "Taste It! Experience",
        "description": "Sample over 100 Coca-Cola beverages from around the world at this iconic tasting station — the most popular stop in the building.",
        "exhibition_type": "permanent",
        "admission_type": "included",
    },
    {
        "title": "The Vault of the Secret Formula",
        "description": "An interactive, multi-sensory experience exploring the mystery and lore behind Coca-Cola's famously guarded secret recipe.",
        "exhibition_type": "permanent",
        "admission_type": "included",
    },
    {
        "title": "Milestones of Refreshment",
        "description": "A journey through over 130 years of Coca-Cola history, advertising art, and cultural impact through original artifacts and memorabilia.",
        "exhibition_type": "permanent",
        "admission_type": "included",
    },
]
```

Use `build_exhibition_record()` and `insert_exhibition()` for each. Set `opening_date` and `closing_date` to NULL (permanent).

- [ ] **Step 2: Dry-run**

```bash
python3 main.py --source world-of-coca-cola-features --dry-run
```

Expected: 7 features + 3 exhibitions.

- [ ] **Step 3: Production write**

```bash
python3 main.py --source world-of-coca-cola-features --allow-production-writes
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/world_of_coca_cola_features.py
git commit -m "feat(crawler): add permanent exhibition records for World of Coca-Cola

Taste It!, Vault of the Secret Formula, and Milestones of Refreshment
now exist as permanent exhibitions in addition to venue features.
Surfaces in exhibition search and What's On Now feeds."
```

---

## Verification

After all tasks:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
client = get_client()

# Margaret Mitchell House
p = client.table('places').select('id').eq('slug', 'margaret-mitchell-house').execute()
pid = p.data[0]['id'] if p.data else None
vf = client.table('venue_features').select('id', count='exact').eq('place_id', pid).eq('is_active', True).execute()
print(f'Margaret Mitchell House: {vf.count} features')

# AHC features
p2 = client.table('places').select('id').eq('slug', 'atlanta-history-center').execute()
pid2 = p2.data[0]['id'] if p2.data else None
vf2 = client.table('venue_features').select('id', count='exact').eq('place_id', pid2).eq('is_active', True).execute()
print(f'Atlanta History Center: {vf2.count} features')

# Music venue features
for slug in ['tabernacle', 'variety-playhouse']:
    p3 = client.table('places').select('id').eq('slug', slug).execute()
    pid3 = p3.data[0]['id'] if p3.data else None
    vf3 = client.table('venue_features').select('id', count='exact').eq('place_id', pid3).eq('is_active', True).execute()
    print(f'{slug}: {vf3.count} features')

# WOCC exhibitions
p4 = client.table('places').select('id').eq('slug', 'world-of-coca-cola').execute()
pid4 = p4.data[0]['id'] if p4.data else None
ex = client.table('exhibitions').select('id', count='exact').eq('place_id', pid4).eq('is_active', True).execute()
print(f'World of Coca-Cola: {ex.count} exhibitions')

# Total coverage
total_vf = client.table('venue_features').select('id', count='exact').eq('is_active', True).execute()
total_ex = client.table('exhibitions').select('id', count='exact').eq('is_active', True).execute()
print(f'\nTotal venue features: {total_vf.count}')
print(f'Total exhibitions: {total_ex.count}')
"
```
