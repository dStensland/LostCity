# Content Health Assessment - 2026-02-20

## Scope
- Generated at: 2026-02-20T18:01:53.846440+00:00
- Future window: 2026-02-20 to 2026-03-22
- Window days: 30

## Core Counts
- Future events (total): **20,441**
- Future events (visible canonical): **19,481**
- Active sources: **481**
- Venues: **4,115**

## Duplicate Integrity
- All future events:
  - Same-source groups: **47** (rows: 49)
  - Cross-source groups: **38** (rows: 79)
- Visible future events:
  - Same-source groups: **43** (rows: 45)
  - Cross-source groups: **4** (rows: 8)

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
- Future events with genres: **8,961 / 20,441** (**43.8%**)
- Music+film with genres: **2,378 / 3,933** (**60.5%**)
- Venues with genres: **283 / 4,115** (**6.9%**)

### Walkability / Mobility
- Parking notes: **2,412 / 4,115** (**58.6%**)
- Transit notes: **72 / 4,115** (**1.7%**)
- Transit scores present: **3,313 / 4,115** (**80.5%**)
- Walkable-neighbor count > 0: **1,273 / 4,115** (**30.9%**)
- `walkable_neighbors` rows: **58,322**
- Dedicated `walkability_score` column present: **false**

### Historic Coverage
- Venues with `historic` vibe: **40**
- Venues with museum/historic types: **107**
- Venues with history-like descriptions: **211**
- Explore track venue blurbs: **409 / 459** (history-like: 66)
- Dedicated `historic_facts` column present: **false**

## Indie Showtime Coverage
- Plaza Theatre: **21/26** with times (80.8%), tomorrow events: 6
- Tara Theatre: **27/27** with times (100.0%), tomorrow events: 0
- Landmark Midtown Art Cinema: **57/60** with times (95.0%), tomorrow events: 8
- Starlight Drive-In Theatre: **35/35** with times (100.0%), tomorrow events: 5

## Closed Venue Leakage
- Closed registry venues matched: **9**
- Future visible events on registry-closed venues: **8**
- Future visible events on inactive venues: **158**

## Crawl Freshness (Last 24h)
- Runs: **548** across **479** sources
- Status counts: `{'success': 470, 'error': 52, 'running': 26}`
- Throughput: found **18,818**, new **861**, updated **16,121**
- Top erroring sources:
  - `atlanta-city-events` (2)
  - `lifeline-animal-project` (2)
  - `piedmont-womens-heart` (2)
  - `piedmont-athens` (2)
  - `morningside-civic` (2)

## Notes
- Walkability/history are tracked as distributed metrics today; this audit intentionally reports both
  distributed coverage and dedicated-column presence checks to avoid false negatives.
