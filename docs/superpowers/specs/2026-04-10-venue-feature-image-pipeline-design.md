# Venue Feature Image Pipeline Design

## Problem

98% of venue_features (2,706 of 2,758) have no `image_url`. Features render as plain text cards when imageless and as rich 16:9 image cards when they have one. Only the 52 records from new attraction crawlers have images. The visual gap undermines the "destinations as first-class entities" bet.

## Design Decisions

1. **Crawler-level image extraction only.** No batch enrichment script. Text cards are honest; recycled venue hero images are misleading (a bar's entrance photo on "outdoor-patio" creates a visual non-sequitur). This aligns with the project principle: enrichment scripts are crawler failures.

2. **Fix the NULL-overwrite bug first.** `upsert_venue_feature` currently builds a full row unconditionally — when `image_url` is not in the incoming data, it writes NULL, erasing any existing image. This must be fixed before any image extraction work, or crawler runs will destroy images set by earlier crawls.

3. **Add image provenance tracking.** Store `metadata.image_source` on each feature to distinguish crawler-extracted images from other sources. Values: `"crawler"` (feature-specific, extracted during crawl) or `"og_image"` (venue-level og:image, not feature-specific). This enables future upgrades: a crawler-extracted image should never be overwritten by a lower-quality source.

4. **Prioritize by venue type and portal presence, not event count.** Cultural institutions and galleries first (features are above the fold), then portal-subscribed venues, then nightlife/dining.

## Changes

### P0: Fix NULL-Overwrite Bug in `upsert_venue_feature`

**File:** `crawlers/db/places.py` — `upsert_venue_feature()` around line 1021-1037

**Problem:** The `row` dict always includes `"image_url": feature_data.get("image_url")`. When a crawler emits a feature without an image, this becomes `"image_url": None`. The Supabase upsert on `(place_id, slug)` conflict then overwrites any existing image with NULL.

**Fix:** Omit `image_url` from the row dict when the incoming value is None AND the feature already exists. Simplest approach: remove NULL-valued `image_url` from the row before upsert:

```python
# Don't overwrite existing images with NULL
if row.get("image_url") is None:
    row.pop("image_url", None)
```

This matches the existing pattern in `get_or_create_place()` which already protects `image_url` from NULL overwrites.

Same protection for `source_url` — don't erase a known source URL with NULL on re-crawl.

### P1: Add `metadata.image_source` Provenance

When a crawler sets `image_url` on a venue feature, also set `metadata.image_source`:
- `"crawler"` — image was extracted by the source crawler, feature-specific
- `"og_image"` — image came from the venue's og:image tag (venue-level, not feature-specific)

This is stored in the existing `metadata` JSONB field (added in Phase 2 migration). No schema change needed.

The provenance enables an overwrite hierarchy: `crawler` images are never overwritten by `og_image`. If a crawler later provides a feature-specific image for a feature that currently has an og_image, it upgrades.

### P2: Update Crawlers to Extract Feature Images

**Which crawlers:** The ~12 that produce venue_features but don't extract images. Prioritized:

**Tier 1 — Cultural institutions (features above the fold):**
These venues show features at position #1 on their detail page. Image-less features are most visible here.
- Crawlers producing features for galleries, museums, theaters, historic sites
- Pattern: Playwright crawlers call `extract_images_from_page(page)` to build title→image map, then match features to images

**Tier 2 — Portal-subscribed venues:**
Venues that appear on active portals (FORTH, Family, Arts). Their detail pages are actively shown to portal users.

**Tier 3 — Nightlife/dining:**
Bars, restaurants, breweries. Features are at position #6 on their detail pages (below events). Lower visibility, lower priority.

**Implementation pattern per crawler:**

For Playwright crawlers:
```python
from utils import extract_images_from_page

# During page visit
image_map = extract_images_from_page(page)

# When building feature record
feature_data["image_url"] = image_map.get(feature_title)
if feature_data["image_url"]:
    feature_data.setdefault("metadata", {})["image_source"] = "crawler"
```

For BeautifulSoup crawlers (no Playwright):
```python
# Extract og:image as venue-level fallback
og_tag = soup.find("meta", property="og:image")
og_image = og_tag["content"] if og_tag else None

# Apply to features (venue-level, not feature-specific)
if og_image:
    feature_data["image_url"] = og_image
    feature_data.setdefault("metadata", {})["image_source"] = "og_image"
```

**URL validation before writing:**
- Reject social media domains (facebook, twitter, google, gstatic, gravatar)
- Reject logo/icon/favicon patterns
- Reject SVGs and tracking pixels
- Optionally HEAD-request to verify 200 status (cheap, catches dead links)

Reuse the existing `_is_valid_image_url()` from `place_image_enrich_family.py`.

## What This Does NOT Include

- **No batch enrichment script.** Features without crawler-extracted images stay as text cards. This is honest UX.
- **No Supabase Storage.** Images remain external URLs. SmartImage handles proxy/fallback.
- **No blurhash generation.** The `venue_features` table doesn't have a blurhash column. Could add later but not worth the migration for this scope.
- **No Google Places photo integration.** The API costs money per request and produces generic street-view-quality images, not feature-specific content.

## Implementation Sequence

1. **P0: Fix NULL-overwrite bug** — one function edit, protects all existing and future images
2. **P1: Add image_source provenance** — pass-through in `upsert_venue_feature`, no migration
3. **P2: Tier 1 crawlers** — cultural institutions, galleries (~4-6 crawlers)
4. **P2: Tier 2 crawlers** — portal-subscribed venues (~3-4 crawlers)
5. **P2: Tier 3 crawlers** — nightlife/dining (~3-4 crawlers)

## Success Criteria

- The NULL-overwrite bug is fixed and tested
- Image provenance is tracked in metadata
- Tier 1 crawlers (cultural institutions) produce feature-specific images on their next crawl
- No enrichment script creates false visual richness
- Text cards remain for features where no image was found — that's the correct behavior
