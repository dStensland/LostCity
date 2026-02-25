# Content Health Assessment - 2026-02-21

## Scope
- Generated at: 2026-02-21T09:26:09.725056+00:00
- Future window: 2026-02-21 to 2026-03-23
- Window days: 30

## Core Counts
- Future events (total): **20,255**
- Future events (visible canonical): **19,300**
- Active sources: **488**
- Venues: **4,149**

## Duplicate Integrity
- All future events:
  - Same-source groups: **44** (rows: 46)
  - Cross-source groups: **44** (rows: 91)
- Visible future events:
  - Same-source groups: **41** (rows: 43)
  - Cross-source groups: **5** (rows: 10)

## Initiative Coverage
### Specials / Happy Hour
- Active `venue_specials`: **554**
- Active `happy_hour`: **72**
- `event_night`: 189
- `daily_special`: 118
- `recurring_deal`: 79
- `happy_hour`: 72
- `holiday_hours`: 36
- `brunch`: 33
- `holiday_special`: 21
- `seasonal_menu`: 5
- `holiday_specials`: 1

### Genres
- Future events with genres: **8,856 / 20,255** (**43.7%**)
- Music+film with genres: **2,318 / 3,743** (**61.9%**)
- Venues with genres: **283 / 4,149** (**6.8%**)

### Walkability / Mobility
- Parking notes: **2,412 / 4,149** (**58.1%**)
- Transit notes: **72 / 4,149** (**1.7%**)
- Transit scores present: **3,313 / 4,149** (**79.9%**)
- Walkable-neighbor count > 0: **1,273 / 4,149** (**30.7%**)
- `walkable_neighbors` rows: **58,322**
- Dedicated `walkability_score` column present: **false**

### Historic Coverage
- Venues with `historic` vibe: **40**
- Venues with museum/historic types: **107**
- Venues with history-like descriptions: **212**
- Explore track venue blurbs: **409 / 459** (history-like: 66)
- Dedicated `historic_facts` column present: **false**

## Indie Showtime Coverage
- Plaza Theatre: **16/19** with times (84.2%), tomorrow events: 9
- Tara Theatre: **34/34** with times (100.0%), tomorrow events: 6
- Landmark Midtown Art Cinema: **49/52** with times (94.2%), tomorrow events: 8
- Starlight Drive-In Theatre: **35/35** with times (100.0%), tomorrow events: 5

## Closed Venue Leakage
- Closed registry venues matched: **9**
- Future visible events on registry-closed venues: **8**
- Future visible events on inactive venues: **160**

## Crawl Freshness (Last 24h)
- Runs: **1,422** across **492** sources
- Status counts: `{'success': 1264, 'error': 102, 'running': 56}`
- Throughput: found **51,605**, new **1,733**, updated **44,605**
- Top erroring sources:
  - `atlanta-city-events` (4)
  - `lifeline-animal-project` (4)
  - `hdsa-georgia` (4)
  - `peach-state-roller-derby` (3)
  - `ticketmaster` (3)

## Notes
- Walkability/history are tracked as distributed metrics today; this audit intentionally reports both
  distributed coverage and dedicated-column presence checks to avoid false negatives.
