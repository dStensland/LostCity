# PRD 021: Walkability, Transport & Parking Guide

**Status:** Brief — Ready for agent pickup
**Created:** 2026-02-14
**Context:** Spun out of Explore City Tracks design iteration (Comp D2). Making venue cards feel alive and useful means answering "how do I actually get there?"

---

## Problem

Every venue discovery app tells you WHAT to visit but not HOW to get there practically. In Atlanta specifically:

- MARTA coverage is uneven — some areas are a 2-min walk from a station, others need a car
- Parking ranges from free lots to $40 event-night garages, and knowing which is which saves real money
- BeltLine-adjacency is a huge unlock — you can walk/bike between dozens of venues but only if you know which ones connect
- Ride-share costs spike on event nights, but people don't know about the free trolley or nearby MARTA alternatives
- "Walkable from X" combos are the #1 way locals plan nights out — dinner here, drinks there, show there — but no app surfaces this

## Opportunity

We already have `lat`/`lng` on every venue. With that + MARTA station data + BeltLine path data + some editorial parking notes, we can build something nobody else has: a practical "getting there" layer that makes every venue card actionable.

## Data We Have

- `lat`, `lng` on all venues (geocoded)
- `neighborhood` on most venues
- `address` on venues
- Venue-to-venue distance is derivable from coordinates

## Data We Need

### 1. MARTA Station Proximity
- **Source:** MARTA publishes station coordinates (33 rail stations, bus stops)
- **Schema addition on venues:**
  - `nearest_marta_station` (text) — e.g., "Five Points"
  - `marta_walk_minutes` (int) — walking time from station to venue
  - `marta_line` (text[]) — e.g., ["red", "gold"]
- **Derivable:** Calculate from lat/lng to nearest station coords. Walking time ~= distance / 80m per minute
- **Display:** "🚇 5 min walk from Five Points (Red/Gold)" on venue cards
- **Threshold:** Only show if <= 15 min walk. Beyond that, show "Best by car"

### 2. BeltLine Adjacency
- **Source:** BeltLine trail coordinates (publicly available GeoJSON)
- **Schema addition on venues:**
  - `beltline_adjacent` (boolean) — within 0.25 miles of a BeltLine trail segment
  - `beltline_segment` (text) — e.g., "Eastside Trail", "Westside Trail", "Southside Trail"
  - `beltline_walk_minutes` (int) — walk from nearest trail access point
- **Display:** "🚶 On the Eastside Trail" or "3 min walk from Westside Trail"
- **High value:** Enables "BeltLine crawl" itineraries — walkable multi-venue routes

### 3. Parking Situation
- **Schema addition on venues:**
  - `parking_type` (text[]) — e.g., ["street", "lot", "deck", "valet"]
  - `parking_free` (boolean)
  - `parking_note` (text) — e.g., "Free deck behind building after 6pm", "$10 flat rate on Edgewood"
  - `parking_tip` (text) — editorial, e.g., "Park at Krog Street Market deck and walk 3 min"
- **Source:** Editorial/crowdsourced. Could seed from Google Maps parking data + local knowledge
- **Display:** "🅿️ Free lot" or "🅿️ Street parking · $10 deck nearby"
- **Event-night context:** Some venues have different parking on event nights (e.g., stadium area)

### 4. Walkable Combos / Clusters
- **Derivable from lat/lng:** Venues within 0.3 miles of each other
- **Schema:** No new columns needed — compute at query time or materialize as `venue_clusters`
- **Display on venue card:** "Walkable to: Ponce City Market (3 min), BeltLine Eastside (1 min), The Earl (8 min)"
- **Display on track detail:** "4 places in this track are walkable from each other" with mini-map
- **High value:** Enables "make a night of it" planning without switching to Google Maps

### 5. Ride-Share Context
- **No API needed — just helpful tips:**
  - `rideshare_note` (text) — e.g., "Surge pricing on game nights. Take MARTA Gold line instead."
  - `drop_off_tip` (text) — e.g., "Tell your driver Edgewood Ave entrance, not the Parkway side"
- **Display:** Only show when relevant (event venues, hard-to-find spots)

### 6. Transit Score (Computed)
- **Formula:** Composite of MARTA proximity + BeltLine adjacency + parking availability
- **Schema:** `transit_score` (int, 1-10) — computed, not manually entered
- **Scoring:**
  - MARTA <= 5 min: +4 points
  - MARTA 5-10 min: +2 points
  - BeltLine adjacent: +3 points
  - Free parking: +2 points
  - Any parking: +1 point
- **Display:** Small badge on venue cards: "Transit: 9/10" or color-coded dot (green/yellow/red)
- **Filter:** "Easy to get to" filter in Explore and Find views

## Display Patterns

### On Venue Card (compact)
```
🚇 5 min from Five Points  ·  🅿️ Free lot  ·  🚶 On BeltLine
```

### On Venue Detail (expanded)
```
Getting There
─────────────
🚇 MARTA: Five Points station (Red/Gold) — 5 min walk
🚶 BeltLine: Eastside Trail — 2 min walk
🅿️ Parking: Free deck behind building. Street parking on Edgewood.
📍 Walkable to: Ponce City Market (3 min), Krog Street Market (7 min)
💡 Tip: On Hawks game nights, park at Civic Center deck ($8) and walk.
```

### On Track Detail (cluster view)
```
4 of 9 places in this track are within walking distance:
[Mini map showing 4 clustered pins connected by walking paths]
Sweet Auburn Curb Market → APEX Museum (4 min) → MLK Park (6 min) → Ebenezer Baptist (2 min)
```

## Implementation Approach

### Phase 1: MARTA + BeltLine (Automated)
1. Import MARTA station coordinates (CSV/GeoJSON — public data)
2. Import BeltLine trail coordinates (GeoJSON — public data)
3. Run a one-time backfill script: for each venue, calculate nearest MARTA station + distance, BeltLine proximity
4. Add columns to venues table
5. Surface on venue cards + detail views

### Phase 2: Parking (Editorial + Crowdsource)
1. Add parking columns to venues table
2. Seed top 50 venues with parking notes (manual/editorial)
3. Add "Parking tip" field to community tips system (from Explore PRD 020)
4. Gradually fill in via community contributions

### Phase 3: Walkable Combos (Computed)
1. For each venue, find other venues within 0.3 miles
2. Group into clusters
3. Surface "walkable to" on venue cards
4. Build mini-map component for track detail view
5. Enable "walkable cluster" filter in Explore

### Phase 4: Transit Score (Computed)
1. Calculate composite score from MARTA + BeltLine + parking data
2. Store as materialized column (refresh nightly)
3. Add "Easy to get to" filter
4. Color-code on venue cards

## Data Sources

| Data | Source | Freshness |
|---|---|---|
| MARTA stations | itsmarta.com / GTFS feed | Static (stations don't move) |
| MARTA schedules | GTFS real-time feed | Could add "next train" later |
| BeltLine trail | beltline.org / Atlanta GIS | Static (trail segments rarely change) |
| Parking | Editorial + crowdsource | Refresh quarterly |
| Walkable combos | Computed from lat/lng | Recompute on venue add/update |
| Ride-share tips | Editorial | As-needed |

## Why This Matters

Atlanta is a car city trying to become a transit city. The BeltLine is changing that, but most apps still assume you're driving. By surfacing transit/walk/bike options prominently:

1. **Locals use it for planning:** "Can we walk between dinner and the show?"
2. **Visitors use it for confidence:** "Do I need to rent a car?"
3. **Nobody else does this:** Google Maps gives you directions, not venue-specific getting-there context
4. **It makes Explore stickier:** Knowing you can walk between 4 venues in a track makes the track feel like a real itinerary, not just a list

## Open Questions

1. Should we show real-time MARTA arrival data? (GTFS-RT feed available, but adds complexity)
2. Should walkable combos be per-track or global? (Per-track is more useful for Explore, global is more useful for Find)
3. Should we build a mini-map component? (High effort, high impact — could use Mapbox GL JS)
4. Is Uber/Lyft price estimation API worth integrating? (Probably not for V1 — too volatile)

---

## Files to Reference
- `prds/020-explore-city-tracks.md` — Explore feature this plugs into
- `web/components/explore/` — Explore components to add transport info to
- `web/components/views/VenueDetailView.tsx` — Venue detail where "Getting There" section lives
- `design/comp-d2-hybrid-v2.html` — Latest design comp showing venue card layout
- `ARCHITECTURE_PLAN.md` — Overall system architecture
