# Content Health Assessment - 2026-02-22

## Scope
- Generated at: 2026-02-22T16:40:38.653441+00:00
- Future window: 2026-02-22 to 2026-03-24
- Window days: 30

## Core Counts
- Future events (total): **19,745**
- Future events (visible canonical): **18,811**
- Active sources: **488**
- Venues: **4,160**

## Duplicate Integrity
- All future events:
  - Same-source groups: **40** (rows: 41)
  - Cross-source groups: **41** (rows: 84)
- Visible future events:
  - Same-source groups: **38** (rows: 39)
  - Cross-source groups: **3** (rows: 6)

## Initiative Coverage
### Specials / Happy Hour
- Active `venue_specials`: **560**
- Active `happy_hour`: **73**
- `event_night`: 192
- `daily_special`: 120
- `recurring_deal`: 79
- `happy_hour`: 73
- `holiday_hours`: 36
- `brunch`: 33
- `holiday_special`: 21
- `seasonal_menu`: 5
- `holiday_specials`: 1

### Genres
- Future events with genres: **8,668 / 19,745** (**43.9%**)
- Music+film with genres: **2,243 / 3,495** (**64.2%**)
- Venues with genres: **283 / 4,160** (**6.8%**)

### Walkability / Mobility
- Parking notes: **2,416 / 4,160** (**58.1%**)
- Transit notes: **73 / 4,160** (**1.8%**)
- Transit scores present: **3,313 / 4,160** (**79.6%**)
- Walkable-neighbor count > 0: **1,273 / 4,160** (**30.6%**)
- `walkable_neighbors` rows: **58,322**
- Dedicated `walkability_score` column present: **false**

### Historic Coverage
- Venues with `historic` vibe: **40**
- Venues with museum/historic types: **106**
- Venues with history-like descriptions: **214**
- Explore track venue blurbs: **409 / 459** (history-like: 66)
- Dedicated `historic_facts` column present: **false**

## Indie Showtime Coverage
- Plaza Theatre: **10/16** with times (62.5%), tomorrow events: 0
- Tara Theatre: **28/28** with times (100.0%), tomorrow events: 0
- Landmark Midtown Art Cinema: **51/54** with times (94.4%), tomorrow events: 9
- Starlight Drive-In Theatre: **35/35** with times (100.0%), tomorrow events: 5

## Closed Venue Leakage
- Closed registry venues matched: **9**
- Future visible events on registry-closed venues: **7**
- Future visible events on inactive venues: **301**

## Crawl Freshness (Last 24h)
- Runs: **527** across **488** sources
- Status counts: `{'success': 485, 'error': 27, 'running': 15}`
- Throughput: found **18,904**, new **938**, updated **16,103**
- Top erroring sources:
  - `atlanta-city-events` (2)
  - `lifeline-animal-project` (2)
  - `atlanta-dogwood` (2)
  - `hdsa-georgia` (2)
  - `moca-ga` (2)

## Notes
- Walkability/history are tracked as distributed metrics today; this audit intentionally reports both
  distributed coverage and dedicated-column presence checks to avoid false negatives.
