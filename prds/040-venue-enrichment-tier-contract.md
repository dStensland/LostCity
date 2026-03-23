# Platform Venue Enrichment Tier Contract

**Status:** Active
**Surface:** All portals (platform-level)
**Purpose:** Define what data a venue needs at each tier so we can measure enrichment health, prioritize backfill work, and set expectations for crawler output.

---

## Why This Exists

We have 4,000+ venues. Some have a name and coordinates. Some have destination details, 5 features, 8 occasion tags, and editorial mentions. There's no contract defining what "good enough" means, so:

- Crawlers don't know what to capture beyond events
- Enrichment scripts don't know when to stop
- The product can't differentiate "this venue is ready to display" from "this venue will look empty"
- Quality measurement (`compute_data_quality.py`) only scores basic field completeness — it's blind to enrichment entities

This contract defines 4 tiers. Each tier is measurable, automatable, and applies to all venue types across all portals.

---

## Tier Definitions

### Tier 0: Floor (Exists on a Map)

The venue exists and can be placed on a map. Bare minimum for any record to not be garbage.

| Field | Table | Required |
|---|---|---|
| `name` | venues | Yes |
| `slug` | venues | Yes |
| `lat` + `lng` | venues | Both |
| `city` + `state` | venues | Both |
| `venue_type` | venues | Yes |
| `active = true` | venues | Yes |

**Threshold:** All 6 checks pass.

**What this gets you:** A dot on a map with a name. Clickable but empty.

---

### Tier 1: Discoverable (Worth Showing in Search/Feed)

The venue has enough context that a user seeing it in search results or a feed card can make a basic decision: "Do I want to learn more?"

| Field | Table | Required |
|---|---|---|
| All Tier 0 fields | venues | Yes |
| `image_url` | venues | Yes |
| `description` (>30 chars, non-boilerplate) | venues | Yes |
| `neighborhood` | venues | Yes |
| `website` | venues | Recommended |

**Threshold:** Tier 0 + image + real description + neighborhood.

**What this gets you:** A card with a photo, description, and location context. Viable in search results and venue lists.

---

### Tier 2: Destination (Answers "Should I Go?")

The venue has structured enrichment data that helps a user decide whether to visit without leaving our app. This is where venue detail pages become useful.

| Entity | Table | Required |
|---|---|---|
| All Tier 1 fields | venues | Yes |
| `destination_details` (1 record) | venue_destination_details | Yes |
| `venue_features` (>= 2 records) | venue_features | Yes |
| `venue_occasions` (>= 1 record) | venue_occasions | Recommended |

**destination_details minimum fields:**
- `commitment_tier` (hour/halfday/fullday/weekend)
- `family_suitability` (yes/no/caution)
- `parking_type`

**What this gets you:** A venue detail page with "What to Expect" (features), "Perfect For" (occasions), and practical info (parking, commitment, family-friendliness). The user can plan a visit.

---

### Tier 3: Premium (Complete Experience Page)

The venue has a fully populated detail page with specials, editorial credibility, and enough data to answer every question a visitor might have.

| Entity | Table | Required |
|---|---|---|
| All Tier 2 fields | — | Yes |
| `venue_specials` (>= 1 record) | venue_specials | Recommended |
| `editorial_mentions` (>= 1 record) | editorial_mentions | Recommended |
| `venue_occasions` (>= 3 records) | venue_occasions | Recommended |
| `hours` | venues | Recommended |
| `vibes` (non-empty array) | venues | Recommended |

**Threshold:** Tier 2 + at least 3 of the 5 recommended items.

**What this gets you:** A venue page that competes with Google Maps / Yelp for decision-making completeness. "In the Press" section, specials, hours, vibe tags, multiple occasion pills.

---

## Tier Assignment Logic

A venue's tier is the **highest tier where ALL requirements are met**. Recommended fields don't block tier assignment — they're tracked separately as "tier completion percentage."

```
Tier 3: Tier 2 + 3/5 premium signals
Tier 2: Tier 1 + destination_details + 2+ features
Tier 1: Tier 0 + image + description + neighborhood
Tier 0: name + slug + coords + city/state + venue_type + active
```

A venue with perfect Tier 0 + image + description but no neighborhood = Tier 0 (not Tier 1).

---

## Which Venues Should Be at Which Tier

Not every venue needs Tier 3. The tier target depends on venue significance:

| Venue Category | Target Tier | Examples |
|---|---|---|
| Landmarks / major destinations | Tier 3 | Fox Theatre, Georgia Aquarium, Piedmont Park |
| Entertainment / experiential | Tier 2 | Painted Pickle, Starlight Drive-In, breweries |
| Event-hosting venues | Tier 1 | Concert halls, galleries, community centers |
| Event-only organizations | Tier 0 | Nonprofits, meetup groups, civic orgs |

---

## Measurement

`compute_data_quality.py` should report:
1. **Tier distribution** — how many venues at each tier
2. **Tier by venue_type** — which categories are underenriched
3. **Tier gap analysis** — venues closest to the next tier (easiest wins)

This replaces the current single 0-100 score with a tier label + a within-tier completion percentage.

---

## Cross-Portal Applicability

This contract is portal-agnostic. Portal-specific contracts (like `prds/034e` for Adventure destinations) can layer additional requirements on top:

- Adventure: adds `difficulty_level`, `best_seasons`, `trail_distance_miles`
- Arts: adds exhibition count, artist associations
- Family: adds `age_min`/`age_max` suitability
- Sports: adds team/league associations

The platform tiers define the floor. Portal contracts define the ceiling.
