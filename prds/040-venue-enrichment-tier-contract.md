# Platform Venue Enrichment Tier Contract

**Status:** Active
**Surface:** All portals (platform-level)
**Purpose:** Define which venues need what level of data, then measure whether they have it.

---

## Why This Exists

We have 5,800+ venues. A museum with interactive exhibits, tours, and gift shops benefits from a rich detail page. A nonprofit that hosts monthly meetups just needs a name and address. Applying the same enrichment standard to both wastes effort and makes health metrics meaningless.

This contract:
1. **Classifies venues by how much data they need** (target tier)
2. **Defines what data each tier requires** (data contract)
3. **Measures compliance** — of the venues that SHOULD be at Tier 2, how many ARE?

---

## Target Tiers (Which Venues Need What)

### Tier 3: Landmarks & Major Destinations

Places people plan trips around. High decision complexity — users need parking, hours, what to expect, specials, and editorial credibility to commit.

**venue_types:** `museum`, `zoo`, `aquarium`, `theme_park`, `arena`, `convention_center`, `stadium`

**Also includes:** Any venue with `importance = 'flagship'` or known landmark status (Fox Theatre, Ponce City Market, etc.)

### Tier 2: Experiential Destinations

Places worth a dedicated outing. Users need to understand what they'll do there and practical logistics.

**venue_types:** `brewery`, `distillery`, `winery`, `cinema`, `entertainment`, `bowling`, `arcade`, `food_hall`, `farmers_market`, `sports_bar`, `comedy_club`, `nightclub`, `music_venue`, `rooftop`, `attraction`, `escape_room`, `games`, `gaming`, `club`, `amphitheater`, `lounge`, `wine_bar`, `cocktail_bar`, `pool_hall`, `karaoke`, `theater`, `gallery`, `historic_site`, `landmark`, `garden`, `arts_center`

**Why theaters, galleries, landmarks, etc. are T2:** These are dedicated-outing destinations where users need to know what's showing, what exhibits are up, or what they'll experience. Venue features capture exhibits, shows, and activities — the data that helps someone decide to go.

### Tier 1: Discoverable Venues

Places that host events or are worth browsing. Users need a photo, description, and location — enough to decide "do I want to learn more?"

**venue_types:** `restaurant`, `bar`, `coffee_shop`, `bookstore`, `record_store`, `library`, `park`, `fitness_center`, `studio`, `hotel`, `rec_center`, `recreation`, `dance_studio`, `cafe`, `nature_center`, `cooking_school`, `outdoor_venue`

### Tier 0: Event Containers

Places that exist primarily as locations for events. A name and address is sufficient. Includes rental spaces, community rooms, and organizational venues.

**venue_types:** `organization`, `church`, `venue`, `festival`, `college`, `university`, `hospital`, `event_space`, `community_center`, everything else

**Why event_space and community_center are T0:** These are overwhelmingly rental spaces (school gyms, HOA rooms, conference halls) — not destinations people discover. Standout event spaces (Colony Square, Infinite Energy) should be reclassified to a higher-tier type.

---

## Data Requirements Per Tier

### Tier 0: Floor

| Field | Table |
|---|---|
| `name` | venues |
| `slug` | venues |
| `lat` + `lng` | venues |
| `city` + `state` | venues |
| `venue_type` | venues |
| `active = true` | venues |

**User experience:** A dot on a map with a name.

### Tier 1: Discoverable

Everything in Tier 0, plus:

| Field | Table |
|---|---|
| `image_url` | venues |
| `description` (>30 chars, non-boilerplate) | venues |
| `neighborhood` | venues |

**User experience:** A card with photo, blurb, and location. Viable in search results.

### Tier 2: Destination

Everything in Tier 1, plus:

| Entity | Table | Minimum |
|---|---|---|
| `destination_details` | venue_destination_details | 1 record (commitment_tier, parking_type, family_suitability) |
| `venue_features` | venue_features | 2+ records |
| `vibes` | venues | Non-empty array — powers search filters and discovery pills |

**User experience:** Venue detail page answers "Should I go?" with practical info, feature highlights, and vibe tags for attribute-based discovery.

### Tier 3: Premium

Everything in Tier 2, plus at least 3 of:

| Signal | Table |
|---|---|
| `venue_specials` (1+ records) | venue_specials |
| `editorial_mentions` (1+ records) | editorial_mentions |
| `venue_occasions` (3+ records) | venue_occasions |
| `hours` | venues |
| `vibes` (non-empty array) | venues |
| `venue_highlights` (1+ records) | venue_highlights |

**Threshold:** 3 of 6 signals. Since vibes is already required at T2, T3-eligible venues automatically have 1/6 — they need 2 more from the remaining 5.

**venue_highlights types:** viewpoint, architecture, history, art, nature, photo_spot, hidden_feature. For museums and arenas, "what's notable?" is a key user question.

**User experience:** Complete decision page — competes with Google Maps/Yelp. Press mentions, deals, hours, vibe tags, "Perfect For" pills, notable highlights.

---

## Measurement

The health metric that matters: **compliance rate per target tier.**

```
"Of the 74 museums, how many meet Tier 3 requirements?" → 12/74 = 16%
"Of the 62 breweries, how many meet Tier 2 requirements?" → 8/62 = 13%
"Of the 470 restaurants, how many meet Tier 1 requirements?" → 306/470 = 65%
```

This tells us where to focus: a venue type with 10% compliance at its target tier needs work. One at 80% is healthy.

The tool also reports **per-field gap breakdowns** showing exactly which fields are the #1 blocker for each tier — e.g., "46% of T1 venues are missing descriptions."

**Tool:** `crawlers/scripts/venue_tier_health.py`

---

## Cross-Portal Extensions

Portal-specific contracts layer on top of platform tiers:

- **Adventure** (prds/034e): adds `difficulty_level`, `best_seasons`, `trail_distance_miles`
- **Arts**: adds exhibition count, artist associations
- **Family**: adds `age_min`/`age_max` suitability
- **Sports**: adds team/league associations

Platform tiers are the floor. Portal contracts are the ceiling.
