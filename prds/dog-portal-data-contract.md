# BP-4 Data + Curation Contract: Atlanta Dog Portal

## Data Strategy

**Atlanta-first federation.** Content lives in the base Atlanta data layer. The
dog portal applies a dog-friendly filter on top. Dog-only sources (shelters,
pet stores) are added to Atlanta and tagged so the dog portal picks them up.

This means: improving the dog portal's data also improves Atlanta.

---

## Federated Data Sources

### Tier 1: Dog-Primary Sources (crawl for dog portal, also in Atlanta)

| Source | Type | Est. Events/Year | Crawler Status |
|--------|------|------------------|----------------|
| LifeLine Animal Project | Shelter | 20-40 | Exists (iCal) |
| Atlanta Humane Society | Shelter | 20-40 | Needs crawler |
| PAWS Atlanta | Rescue | 10-20 | Needs crawler |
| Furkids Animal Rescue | Rescue | 10-20 | Needs crawler |
| Petco (Atlanta locations) | Pet store | 30-50 | Needs crawler |
| PetSmart (Atlanta locations) | Pet store | 30-50 | Needs crawler |
| Fetch Dog Park & Bar | Dog bar | 5-10 | Needs crawler |

### Tier 2: Atlanta Sources with Dog-Relevant Content

These already exist in Atlanta crawlers. Dog portal federates from them via
tag/vibe filtering.

| Source | Dog-Relevant Content | Filter Strategy |
|--------|---------------------|-----------------|
| Zoo Atlanta | Family events, animal runs | Tag: `animals`, `family` |
| College Park Main Street | "Dog Days of Summer" | Tag: `pets` |
| Farmers markets (6+ sources) | Dog-friendly outdoor markets | Vibe: `dog-friendly` |
| Brewery crawlers (multiple) | Dog-friendly patio events | Vibe: `dog-friendly` |
| Atlanta Dogwood Festival | Outdoor festival | Tag: `outdoor`, `pets` |
| Park conservancy sources | Park events, trail runs | Tag: `outdoor` |

### Tier 3: Place Data (venues, not events)

Added manually or via batch import. Not event-driven.

| Category | Est. Count | Source |
|----------|-----------|--------|
| Dog parks (dedicated off-leash) | 10-15 | Manual entry |
| Dog-friendly restaurants/patios | 20-40 | Manual curation |
| Dog bakeries / treat shops | 5-10 | Manual entry |
| Vets / animal hospitals | 15-25 | Manual curation (top-rated) |
| Groomers / daycares | 10-15 | Manual curation |
| Pet supply (indie + chain) | 10-15 | Manual entry |
| Trails / nature (from Atlanta) | 20-30 | Federated from Atlanta |
| Parks (from Atlanta) | 15-25 | Federated from Atlanta |

---

## Filter Contract

### How the Dog Portal Selects Content

```sql
-- Events: anything from dog-primary sources OR tagged dog-relevant
SELECT * FROM events
WHERE source_id IN ({tier_1_source_ids})
   OR 'pets' = ANY(tags)
   OR 'dog-friendly' = ANY(tags)
   OR 'adoption' = ANY(tags)
   OR 'dog-training' = ANY(tags)

-- Venues: anything with dog-friendly vibe or dog-relevant type
SELECT * FROM venues
WHERE 'dog-friendly' = ANY(vibes)
   OR venue_type IN ('dog_park', 'pet_store', 'animal_shelter', 'vet')
   OR 'pets' = ANY(tags)
```

### Tag Contract

Events and venues must be tagged to appear in the dog portal:

| Tag | Meaning | Applied By |
|-----|---------|-----------|
| `pets` | Explicitly pet-related event | Crawler or manual |
| `dog-friendly` | Venue welcomes dogs | Crawler, manual, or crowdsource |
| `adoption` | Animal adoption event | Crawler (shelter sources) |
| `dog-training` | Training class or workshop | Crawler or manual |
| `off-leash` | Off-leash area | Manual (venue attribute) |

### Vibe Contract

Venues use the existing `vibes` array:

| Vibe | Meaning |
|------|---------|
| `dog-friendly` | Already exists in valid vibes. Dogs welcome. |

### Crowdsource Tagging

Users can submit "this place is dog-friendly" on any venue. Flow:
1. User taps "Tag as dog-friendly" on venue detail
2. Submission goes to a moderation queue (or auto-approves after N submissions)
3. Approved tags add `dog-friendly` to venue vibes
4. Venue appears in dog portal automatically

v1: Auto-approve (trust users). Monitor for abuse. Add moderation if needed.

---

## Ranking Logic

### Feed Ranking (Explore tab)

Events and places are interleaved in the blended feed. Ranking factors:

| Factor | Weight | Notes |
|--------|--------|-------|
| Temporal proximity (events) | High | Events happening sooner rank higher |
| Geographic proximity (places) | High | Closer places rank higher (requires location) |
| Content freshness | Medium | Recently added items get a boost |
| Has photo | Medium | Items with photos rank above no-photo items |
| Source tier | Low | Tier 1 sources get slight boost over Tier 2 |
| Is free | Low | Free events get slight boost |

### Interleaving Rules

The blended feed alternates content types to maintain variety:
- Never show more than 3 events in a row without a place
- Never show more than 3 places in a row without an event
- Weekend events get priority boost on Thursday-Sunday
- "Happening today" items always float to top

### Map Ranking

Map pins don't rank — all visible pins are equal. But the bottom sheet
card list sorts by proximity to map center.

---

## Freshness / Provenance Policy

| Content Type | Max Staleness | Refresh Cadence |
|-------------|---------------|-----------------|
| Events | Must have future `start_date` | Crawled daily |
| Venues (places) | No expiry | Updated on change |
| Curated lists | Review monthly | Operator updates |
| Crowdsourced tags | No expiry | User-submitted |
| Featured/pinned | Explicit `pinned_until` date | Operator sets |

### Provenance Rules

- Every event shows its source: "via Atlanta Humane Society" or "via LifeLine"
- Venues show "Added by ROMP" (operator) or "Tagged by community" (crowdsource)
- Curated lists show author: "Curated by ROMP editors"
- No content appears without provenance

---

## Fallback Behavior

| Scenario | Fallback |
|----------|----------|
| No events this weekend | Show "Quiet weekend? Parks never cancel." + parks carousel |
| No events today | Skip "Happening Today" section entirely |
| No events at all | Show places-only feed with "Events coming soon" banner |
| No places near user | Expand radius, show "Worth the drive" framing |
| User denies location | Show all Atlanta content, sorted by popularity instead of proximity |
| No photo on item | Color-block fallback card (per design direction) |
| Source goes down | Stale events age out naturally (past `start_date`). Places persist. |

---

## Competitor Exclusions

None for v1. The dog portal is not associated with a paying client that has
competitors. All dog-related content in Atlanta is welcome.

If sponsorship deals happen later, sponsored competitors may need governance.
Cross that bridge then.

---

## Source Policy File

Implementation: `web/lib/dog-source-policy.ts`

```typescript
export const DOG_PRIMARY_SOURCES = [
  "lifeline-animal-project",
  "atlanta-humane-society",
  "paws-atlanta",
  "furkids",
  "petco-atlanta",
  "petsmart-atlanta",
  "fetch-dog-park",
] as const;

export const DOG_RELEVANT_TAGS = [
  "pets",
  "dog-friendly",
  "adoption",
  "dog-training",
  "off-leash",
] as const;

export const DOG_RELEVANT_VIBES = [
  "dog-friendly",
] as const;
```
