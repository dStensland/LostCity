# Venue Feature Image Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect venue feature images from NULL-overwrite, add provenance tracking, and add images to the 3 crawlers that produce features without them.

**Architecture:** One bug fix in `upsert_venue_feature()` (P0), provenance metadata (P1), then image extraction in 3 crawler files (P2). The bulk of imageless features (2,500+) were created by the entity envelope pattern in 100+ generic crawlers — those are not addressed here (they need a separate design for how the envelope pattern sources images).

**Tech Stack:** Python, Supabase, requests

**Spec:** `docs/superpowers/specs/2026-04-10-venue-feature-image-pipeline-design.md`

---

### Task 1: Fix NULL-Overwrite Bug in `upsert_venue_feature`

**Context:** When a crawler emits a feature without `image_url`, the upsert writes NULL, erasing any existing image. This is a data integrity bug that must be fixed before any image work.

**Files:**
- Modify: `crawlers/db/places.py:1021-1074`
- Test: `crawlers/tests/test_venue_feature_validation.py`

- [ ] **Step 1: Write the failing test**

Add to `crawlers/tests/test_venue_feature_validation.py`:

```python
def test_upsert_venue_feature_does_not_null_overwrite_image():
    """When image_url is None in incoming data, it should not overwrite existing."""
    import inspect
    from db.places import upsert_venue_feature
    source = inspect.getsource(upsert_venue_feature)
    # The function must remove None-valued image_url before upsert
    assert "image_url" in source and "pop" in source or "del " in source or "if" in source, (
        "upsert_venue_feature must protect existing image_url from NULL overwrite"
    )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_venue_feature_validation.py::test_upsert_venue_feature_does_not_null_overwrite_image -v
```

- [ ] **Step 3: Add NULL-overwrite protection**

In `crawlers/db/places.py`, in `upsert_venue_feature()`, after the `row = { ... }` dict is built (after line ~1048) and before the upsert call, add:

```python
    # Don't overwrite existing images or source_url with NULL on re-upsert
    for protect_field in ("image_url", "source_url"):
        if row.get(protect_field) is None:
            row.pop(protect_field, None)
```

This removes NULL-valued fields from the row so the Supabase upsert leaves the existing value intact.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_venue_feature_validation.py -v
```

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/db/places.py crawlers/tests/test_venue_feature_validation.py
git commit -m "fix(pipeline): protect venue feature image_url from NULL overwrite on re-upsert

When a crawler emits a feature without image_url, the upsert was writing
NULL and erasing any existing image. Now omits NULL-valued image_url and
source_url from the upsert so existing values are preserved."
```

---

### Task 2: Add Image Provenance Tracking

**Context:** Store `metadata.image_source` to distinguish crawler-extracted images from other sources. This enables future overwrite hierarchy (crawler > og_image).

**Files:**
- Modify: `crawlers/db/places.py:1021-1074`
- Test: `crawlers/tests/test_venue_feature_validation.py`

- [ ] **Step 1: Write the failing test**

Add to `crawlers/tests/test_venue_feature_validation.py`:

```python
def test_upsert_venue_feature_tracks_image_provenance():
    """When image_url is set, metadata.image_source should be recorded."""
    import inspect
    from db.places import upsert_venue_feature
    source = inspect.getsource(upsert_venue_feature)
    assert "image_source" in source, (
        "upsert_venue_feature must track image provenance in metadata.image_source"
    )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_venue_feature_validation.py::test_upsert_venue_feature_tracks_image_provenance -v
```

- [ ] **Step 3: Add provenance tracking**

In `crawlers/db/places.py`, in `upsert_venue_feature()`, after the NULL-overwrite protection (from Task 1) and before the upsert call, add:

```python
    # Track image provenance in metadata
    if row.get("image_url"):
        metadata = row.get("metadata") or {}
        if "image_source" not in metadata:
            metadata["image_source"] = feature_data.get("image_source", "crawler")
        row["metadata"] = metadata
```

This sets `image_source` to whatever the crawler provides (defaulting to `"crawler"`). Crawlers using og:image can pass `image_source="og_image"`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_venue_feature_validation.py -v
```

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/db/places.py crawlers/tests/test_venue_feature_validation.py
git commit -m "feat(pipeline): track image provenance in venue feature metadata

Stores metadata.image_source when image_url is set. Values: 'crawler'
(feature-specific) or 'og_image' (venue-level). Enables future
overwrite hierarchy where crawler images take priority."
```

---

### Task 3: Add Images to NPS Atlanta Parks Features

**Context:** `nps_atlanta_parks.py` produces 12 features across 3 parks with no images. The NPS API returns park photos that can be used.

**Files:**
- Modify: `crawlers/sources/nps_atlanta_parks.py`

- [ ] **Step 1: Check if NPS API returns photos**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
import requests
resp = requests.get('https://developer.nps.gov/api/v1/parks', params={
    'parkCode': 'malu',
    'api_key': 'DEMO_KEY',
    'fields': 'images'
}, timeout=15)
data = resp.json()
for park in data.get('data', []):
    print(f'{park[\"fullName\"]}:')
    for img in park.get('images', [])[:3]:
        print(f'  {img[\"title\"]}: {img[\"url\"][:80]}')
"
```

- [ ] **Step 2: Add image extraction from NPS API**

Read the crawler file. The NPS API's `/parks` endpoint returns an `images` array when `fields=images` is requested. For each park, build a title→image map from the API response and match features to images by keyword.

For features that don't match API images, research and hardcode image URLs from the NPS website (nps.gov/malu, nps.gov/kemo, nps.gov/chat).

Add `"image_source": "crawler"` to each feature's metadata.

- [ ] **Step 3: Dry-run**

```bash
python3 main.py --source nps-atlanta-parks --dry-run
```

Verify features now include image_url in the output.

- [ ] **Step 4: Production write**

```bash
python3 main.py --source nps-atlanta-parks --allow-production-writes --skip-run-lock
```

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/nps_atlanta_parks.py
git commit -m "feat(crawler): add images to NPS Atlanta parks features

Uses NPS API images field + researched URLs from nps.gov for
feature-specific images across MLK, Kennesaw Mountain, Chattahoochee."
```

---

### Task 4: Add Images to Tabernacle Features

**Context:** `tabernacle_features.py` produces 3 features (Main Concert Hall, Cotton Club, Balcony) with no images.

**Files:**
- Modify: `crawlers/sources/tabernacle_features.py`

- [ ] **Step 1: Research image URLs**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
import requests
from bs4 import BeautifulSoup
headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
resp = requests.get('https://www.tabernacleatl.com', headers=headers, timeout=15)
soup = BeautifulSoup(resp.text, 'html.parser')
# Get og:image
og = soup.find('meta', property='og:image')
print(f'og:image: {og[\"content\"] if og else \"none\"}')
# Get all large images
for img in soup.find_all('img')[:10]:
    src = img.get('src', '')
    alt = img.get('alt', '')
    if src and not any(x in src.lower() for x in ['logo', 'icon', 'sprite']):
        print(f'  {alt[:40]}: {src[:80]}')
"
```

- [ ] **Step 2: Add image URLs to feature definitions**

For each feature in the `FEATURES` list, add an `"image_url"` field with a researched URL from tabernacleatl.com. If feature-specific images aren't available, use the venue's og:image and set `"image_source": "og_image"` in the feature metadata. If feature-specific images are found, set `"image_source": "crawler"`.

- [ ] **Step 3: Dry-run and production write**

```bash
python3 main.py --source tabernacle-features --dry-run
python3 main.py --source tabernacle-features --allow-production-writes --skip-run-lock
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/tabernacle_features.py
git commit -m "feat(crawler): add images to Tabernacle venue features"
```

---

### Task 5: Add Images to Variety Playhouse Features

**Context:** `variety_playhouse_features.py` produces 3 features (Main Theater, Outdoor Patio, Balcony) with no images.

**Files:**
- Modify: `crawlers/sources/variety_playhouse_features.py`

- [ ] **Step 1: Research image URLs**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
import requests
from bs4 import BeautifulSoup
headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
resp = requests.get('https://www.variety-playhouse.com', headers=headers, timeout=15)
soup = BeautifulSoup(resp.text, 'html.parser')
og = soup.find('meta', property='og:image')
print(f'og:image: {og[\"content\"] if og else \"none\"}')
for img in soup.find_all('img')[:10]:
    src = img.get('src', '')
    alt = img.get('alt', '')
    if src and not any(x in src.lower() for x in ['logo', 'icon', 'sprite']):
        print(f'  {alt[:40]}: {src[:80]}')
"
```

- [ ] **Step 2: Add image URLs to feature definitions**

Same approach as Task 4 — add `"image_url"` to each feature, with appropriate `"image_source"` provenance.

- [ ] **Step 3: Dry-run and production write**

```bash
python3 main.py --source variety-playhouse-features --dry-run
python3 main.py --source variety-playhouse-features --allow-production-writes --skip-run-lock
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/variety_playhouse_features.py
git commit -m "feat(crawler): add images to Variety Playhouse venue features"
```

---

## Verification

After all tasks:

```bash
cd /Users/coach/Projects/LostCity/crawlers

# All tests pass
python -m pytest tests/test_venue_feature_validation.py -v

# Check image coverage for the 3 fixed crawlers
python3 -c "
from db.client import get_client
client = get_client()
for slug in ['nps-atlanta-parks', 'tabernacle-features', 'variety-playhouse-features']:
    src = client.table('sources').select('id').eq('slug', slug).execute()
    if src.data:
        sid = src.data[0]['id']
        vf = client.table('venue_features').select('id,title,image_url').eq('source_id', sid).eq('is_active', True).execute()
        total = len(vf.data)
        with_img = sum(1 for f in vf.data if f['image_url'])
        print(f'{slug}: {with_img}/{total} features have images')
"

# Verify NULL-overwrite protection works
# (Run a crawler that doesn't provide image_url — it should NOT erase existing images)
python3 -c "
from db.client import get_client
client = get_client()
# Check a Zoo Atlanta feature that has an image
vf = client.table('venue_features').select('id,title,image_url').eq('place_id', 70).eq('is_active', True).limit(1).execute()
if vf.data and vf.data[0]['image_url']:
    print(f'Before: {vf.data[0][\"title\"]} has image: {bool(vf.data[0][\"image_url\"])}')
    print('(Run zoo-atlanta-features crawler — image should be preserved)')
"
```

---

## What's NOT in This Plan

The 2,500+ imageless features produced by the generic entity envelope pattern (`SourceEntityCapabilities(venue_features=True)` in 100+ crawlers) need a separate design. Those features are generated by `_build_destination_envelope()` or similar functions that produce generic amenity descriptions without images. Fixing those requires either:
- Adding og:image extraction to the entity envelope builder itself (affects all crawlers)
- Or replacing the generic features with crawler-specific features (per-venue work)

That's a different scope and a different decision.
