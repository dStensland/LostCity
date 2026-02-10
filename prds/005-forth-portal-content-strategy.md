# PRD-005: FORTH Portal — Content & Design Strategy

**Status**: Draft
**Priority**: P0
**Timeline**: Demo-ready March, World Cup-ready May 2026

---

## The Demo Moment

FORTH GM opens portal at 5:30pm Tuesday and sees:
- Their own restaurants (Il Premio, Moonlight, Elektra) featured naturally
- "Happy Hour Now: Sound Table — $6 cocktails, ends 7pm (5 min walk)"
- "Tonight: Live jazz at Venkman's, 8pm (12 min walk)"
- "This Weekend: BeltLine Night Market, Saturday 6-10pm (2 min walk)"

That's a concierge in the guest's pocket. The GM understands this can't be done manually.

---

## What's Broken

| Issue | Severity |
|-------|----------|
| Amenities data is wrong ("Ember Restaurant" etc — FORTH has Il Premio, Elektra, Bar Premio, Moonlight) | Critical |
| No specials / happy hours (the key differentiator) | Critical |
| Spots fetched by hardcoded neighborhood name, not proximity to hotel | High |
| Same sections at 9am and 9pm — no time-aware ordering | High |
| No BeltLine section (#1 attraction near FORTH) | High |
| No walking time estimates on cards | Medium |

---

## FORTH Venue Data (correct)

| Venue | Type | Notes |
|-------|------|-------|
| Il Premio | Restaurant | Michelin steakhouse, dinner nightly |
| Elektra | Pool bar / restaurant | Poolside Mediterranean, lunch + dinner |
| Bar Premio | Bar | Cocktail bar adjacent to Il Premio |
| Moonlight | Rooftop bar | Rooftop cocktails, sunset views |
| FORTH Spa | Spa | Treatments, book via front desk |
| Fitness Center | Gym | 24/7 |

These must be real venue records in the DB (via `get_or_create_venue`), not hardcoded. Then they get specials, hours, and appear naturally in feeds.

---

## Time-of-Day Behavior

Portal reorders sections based on current time. Nothing hidden — just what appears FIRST.

| Time | Lead Section | Why |
|------|-------------|-----|
| 7-10am | Coffee + brunch + daytime plans | Morning mindset |
| 10am-2pm | Exhibits, BeltLine, lunch spots | Exploration mindset |
| 2-5pm | Happy hours starting soon + tonight preview | Pre-dinner planning |
| 5-8pm | "Right Now" specials + tonight's events | Peak decision time |
| 8pm-12am | Events happening now + bars + late-night | Night out |
| 12-7am | Tomorrow's highlights + breakfast | Minimal |

Contextual greeting subtitles:
- Morning: "Start your day on the BeltLine"
- Afternoon: "Happy hours are starting soon"
- Evening: "Your evening, curated"
- Match day: "Match day in Atlanta"
- Weekend: "Your weekend in Atlanta"

---

## New Sections to Build

### "Right Now" — Specials Carousel (the differentiator)

Horizontal carousel of time-sensitive content ACTIVE at this moment:
- Happy hours running now (with end time)
- Daily specials active today
- Events starting within 2 hours
- FORTH's own venues with current status

Each card: venue name, special title ("$6 Cocktails"), time remaining ("Until 7pm"), walking time ("5 min walk"), pulsing gold dot for "live."

### "Walk the BeltLine"

Linear path visual (not a card grid) showing stops along Eastside Trail from FORTH:
- PCM, Krog Street Market, Historic Fourth Ward Park, Inman Park
- Distance markers ("0.3 mi", "0.8 mi")
- BeltLine-specific events (markets, art, running)

### World Cup Mode (June 11 — July 19 only)

Conditional section: today's match (teams, time, MBS, MARTA from FORTH), watch parties at nearby bars, "between matches" itineraries, fan zone schedule. Match schedule is static JSON from FIFA.

---

## Enhancements to Existing Sections

- **Tonight**: Group by time (Afternoon / Evening / Late Night), add walking time, mix in evening specials
- **FORTH Hotel**: Replace hardcoded AMENITIES with real venue records from DB
- **Neighborhood**: Query by geo_center proximity (not hardcoded neighborhood names), add walking time + specials badges
- **Where to Eat/Drink**: Time-aware sort (dinner first in evening, brunch first in morning), walking time, specials badges
- **All cards**: Walking time from portal geo_center (haversine, 5 km/h walk speed)

---

## Proximity Tiers

Content granularity scales with distance. A coffee shop across the street is worth showing; a restaurant across town has to earn it.

| Tier | Distance | Inclusion Bar | Label | Content Density |
|------|----------|--------------|-------|----------------|
| **Walkable** | < 1.2km (~15 min) | Everything — coffee, dive bars, quick lunch, any active special | "X min walk" | High: show all venues + all specials |
| **Close** | 1.2–3km | Notable specials, good reputation, interesting programming | "X min walk" or "Short ride" | Medium: filter to venues worth the trip |
| **Destination** | 3km+ | Marquee only — Michelin, major venues, iconic spots, big events | "X min drive" | Low: curated tight, needs persuasive card |

The BeltLine corridor (PCM → Krog → Inman Park) spans the Close tier but gets its own section because walking the trail *is* the activity.

**Implementation**: Tier is computed from `haversineDistanceKm(portal.geo_center, venue.lat_lng)`. Filtering logic lives in the API — same `venues` and `venue_specials` tables, different inclusion thresholds per tier. The API returns `proximity_tier` and `distance_km` on each result so the frontend can render accordingly.

---

## venue_specials Schema

```sql
CREATE TABLE venue_specials (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL,           -- happy_hour, daily_special, recurring_deal, exhibit, seasonal_menu
  description TEXT,
  days_of_week INTEGER[],      -- {1,2,3,4,5} = Mon-Fri (ISO weekday)
  time_start TIME,
  time_end TIME,
  start_date DATE,             -- NULL = always active
  end_date DATE,               -- NULL = no end
  image_url TEXT,
  price_note TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_venue_specials_venue ON venue_specials(venue_id);
CREATE INDEX idx_venue_specials_type ON venue_specials(type);
CREATE INDEX idx_venue_specials_active ON venue_specials(is_active) WHERE is_active = true;
```

### API

```
GET /api/specials?lat=33.7834&lng=-84.3731&radius_km=5&active_now=true
```

Returns specials within radius, grouped by proximity tier. Each result includes `distance_km`, `walking_minutes`, `proximity_tier` (walkable/close/destination), and `proximity_label` ("5 min walk", "Short ride", etc.). Sorted by distance within each tier. `active_now=true` filters to specials running at current day/time.

---

## Build Plan

Three parallel tracks, not sequential phases. Agent executes all tracks concurrently.

### Track A: Data (crawlers repo)

- [ ] Create FORTH venue records via migration (Il Premio, Elektra, Bar Premio, Moonlight, Spa, Fitness)
- [ ] Create `venue_specials` table (migration)
- [ ] Build `scrape_venue_specials.py` — crawl venue websites in FORTH corridor, LLM-extract happy hours and specials
- [ ] Seed FORTH's own venue specials (Moonlight happy hour, Il Premio dinner service, etc.)
- [ ] Run specials scraper on 30-40 corridor bars/restaurants
- [ ] Verify corridor venue data quality (lat/lng, images, neighborhoods) via `data_health.py`

### Track B: API + Backend (web repo)

- [ ] Create `/api/specials` endpoint (proximity + time filtering)
- [ ] Add walking time utility (haversine from portal geo_center)
- [ ] Fix spots query to use geo_center proximity instead of hardcoded neighborhoods
- [ ] Add specials data to portal feed API response

### Track C: Frontend (web repo)

- [ ] Build `SpecialsCarousel` component (live indicator, countdown, walking time)
- [ ] Add "Right Now" section to HotelConciergeFeed
- [ ] Replace hardcoded AMENITIES with DB-backed venue cards
- [ ] Add walking time to HotelEventCard and HotelVenueCard
- [ ] Implement time-aware section ordering
- [ ] Build BeltLine section component
- [ ] World Cup section (May — conditional, static match data)

### QA Gate

- [ ] Mobile QA (iPhone primary — this is a phone-in-lobby product)
- [ ] Test time-aware sections across all 6 time windows
- [ ] Verify specials accuracy against actual venue websites
- [ ] Demo script dry run

---

## Success Criteria

**Demo**: GM sees correct FORTH venues + live specials from walking-distance bars + tonight's events in 5 seconds on phone.

**World Cup**: Match schedule, watch parties at 10+ nearby bars, MARTA directions, "between matches" content.

**Sales leverage**: Portal is referenceable for PCM (same BeltLine data), downtown hotels (World Cup urgency), and Bellyard/Clermont (hotel vertical proven).
