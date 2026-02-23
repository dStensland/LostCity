# Content Health Assessment - 2026-02-23

## Scope
- Generated at: 2026-02-23T16:46:30.525512+00:00
- Future window: 2026-02-23 to 2026-03-25
- Window days: 30

## Core Counts
- Future events (total): **19,417**
- Future events (visible canonical): **18,500**
- Active sources: **488**
- Venues: **4,438**

## Duplicate Integrity
- All future events:
  - Same-source groups: **38** (rows: 39)
  - Cross-source groups: **40** (rows: 82)
- Visible future events:
  - Same-source groups: **36** (rows: 37)
  - Cross-source groups: **3** (rows: 6)

## Initiative Coverage
### Specials / Happy Hour
- Active `venue_specials`: **850**
- Active `happy_hour`: **50**
- `daily_special`: 489
- `event_night`: 105
- `holiday_special`: 56
- `recurring_deal`: 55
- `happy_hour`: 50
- `holiday_hours`: 42
- `brunch`: 35
- `seasonal_menu`: 16
- `daily_deal`: 2

### Genres
- Future events with genres: **8,561 / 19,417** (**44.1%**)
- Music+film with genres: **2,205 / 3,261** (**67.6%**)
- Venues with genres: **414 / 4,438** (**9.3%**)

### Walkability / Mobility
- Parking notes: **2,424 / 4,438** (**54.6%**)
- Transit notes: **73 / 4,438** (**1.6%**)
- Transit scores present: **3,313 / 4,438** (**74.7%**)
- Walkable-neighbor count > 0: **1,273 / 4,438** (**28.7%**)
- `walkable_neighbors` rows: **58,322**
- Dedicated `walkability_score` column present: **false**

### Historic Coverage
- Venues with `historic` vibe: **97**
- Venues with museum/historic types: **106**
- Venues with history-like descriptions: **336**
- Explore track venue blurbs: **409 / 459** (history-like: 66)
- Dedicated `historic_facts` column present: **false**

## Indie Showtime Coverage
- Plaza Theatre: **1/7** with times (14.3%), tomorrow events: 0
- Tara Theatre: **22/22** with times (100.0%), tomorrow events: 0
- Landmark Midtown Art Cinema: **42/45** with times (93.3%), tomorrow events: 9
- Starlight Drive-In Theatre: **30/30** with times (100.0%), tomorrow events: 5

## Closed Venue Leakage
- Closed registry venues matched: **9**
- Future visible events on registry-closed venues: **7**
- Future visible events on inactive venues: **308**

## Crawl Freshness (Last 24h)
- Runs: **542** across **488** sources
- Status counts: `{'success': 481, 'error': 39, 'running': 22}`
- Throughput: found **18,255**, new **875**, updated **15,397**
- Top erroring sources:
  - `atlanta-city-events` (2)
  - `lifeline-animal-project` (2)
  - `peach-state-roller-derby` (2)
  - `hdsa-georgia` (2)
  - `southern-fried-gaming` (2)

## Notes
- Walkability/history are tracked as distributed metrics today; this audit intentionally reports both
  distributed coverage and dedicated-column presence checks to avoid false negatives.
