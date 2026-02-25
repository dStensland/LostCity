# Content Health Assessment - 2026-02-17

## Scope
- Generated at: 2026-02-18T01:51:22.727922+00:00
- Future window: 2026-02-17 to 2026-03-19
- Window days: 30

## Core Counts
- Future events (total): **19,521**
- Future events (visible canonical): **18,409**
- Active sources: **468**
- Venues: **4,053**

## Duplicate Integrity
- All future events:
  - Same-source groups: **132** (rows: 245)
  - Cross-source groups: **53** (rows: 106)
- Visible future events:
  - Same-source groups: **131** (rows: 244)
  - Cross-source groups: **7** (rows: 14)

## Initiative Coverage
### Specials / Happy Hour
- Active `venue_specials`: **337**
- Active `happy_hour`: **46**
- `daily_special`: 91
- `event_night`: 82
- `recurring_deal`: 77
- `happy_hour`: 46
- `brunch`: 27
- `holiday_special`: 8
- `holiday_hours`: 6

### Genres
- Future events with genres: **9,158 / 19,521** (**46.9%**)
- Music+film with genres: **2,642 / 3,119** (**84.7%**)
- Venues with genres: **283 / 4,053** (**7.0%**)

### Walkability / Mobility
- Parking notes: **2,404 / 4,053** (**59.3%**)
- Transit notes: **71 / 4,053** (**1.8%**)
- Transit scores present: **3,308 / 4,053** (**81.6%**)
- Walkable-neighbor count > 0: **1,274 / 4,053** (**31.4%**)
- `walkable_neighbors` rows: **58,504**
- Dedicated `walkability_score` column present: **false**

### Historic Coverage
- Venues with `historic` vibe: **37**
- Venues with museum/historic types: **109**
- Venues with history-like descriptions: **206**
- Explore track venue blurbs: **417 / 459** (history-like: 66)
- Dedicated `historic_facts` column present: **false**

## Indie Showtime Coverage
- Plaza Theatre: **52/66** with times (78.8%), tomorrow events: 7
- Tara Theatre: **78/78** with times (100.0%), tomorrow events: 17
- `landmark-midtown`: venue record not found
- `starlight-drive-in-theatre`: venue record not found

## Closed Venue Leakage
- Closed registry venues matched: **9**
- Future visible events on registry-closed venues: **9**
- Future visible events on inactive venues: **164**

## Crawl Freshness (Last 24h)
- Runs: **1,028** across **468** sources
- Status counts: `{'success': 833, 'error': 136, 'running': 59}`
- Throughput: found **36,898**, new **5,388**, updated **27,427**
- Top erroring sources:
  - `atlanta-city-events` (6)
  - `lifeline-animal-project` (6)
  - `home-depot-kids-workshops` (3)
  - `piedmont-athens` (3)
  - `morningside-civic` (3)

## Notes
- Walkability/history are tracked as distributed metrics today; this audit intentionally reports both
  distributed coverage and dedicated-column presence checks to avoid false negatives.
