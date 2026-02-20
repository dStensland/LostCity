# Content Health Assessment - 2026-02-19

## Scope
- Generated at: 2026-02-19T18:20:08.588198+00:00
- Future window: 2026-02-19 to 2026-03-21
- Window days: 30

## Core Counts
- Future events (total): **20,614**
- Future events (visible canonical): **19,634**
- Active sources: **477**
- Venues: **4,094**

## Duplicate Integrity
- All future events:
  - Same-source groups: **54** (rows: 56)
  - Cross-source groups: **39** (rows: 78)
- Visible future events:
  - Same-source groups: **53** (rows: 55)
  - Cross-source groups: **1** (rows: 2)

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
- Future events with genres: **9,058 / 20,614** (**43.9%**)
- Music+film with genres: **2,449 / 4,086** (**59.9%**)
- Venues with genres: **283 / 4,094** (**6.9%**)

### Walkability / Mobility
- Parking notes: **2,407 / 4,094** (**58.8%**)
- Transit notes: **73 / 4,094** (**1.8%**)
- Transit scores present: **3,308 / 4,094** (**80.8%**)
- Walkable-neighbor count > 0: **1,274 / 4,094** (**31.1%**)
- `walkable_neighbors` rows: **58,504**
- Dedicated `walkability_score` column present: **false**

### Historic Coverage
- Venues with `historic` vibe: **37**
- Venues with museum/historic types: **109**
- Venues with history-like descriptions: **206**
- Explore track venue blurbs: **417 / 459** (history-like: 66)
- Dedicated `historic_facts` column present: **false**

## Indie Showtime Coverage
- Plaza Theatre: **7/12** with times (58.3%), tomorrow events: 0
- Tara Theatre: **79/79** with times (100.0%), tomorrow events: 9
- Landmark Midtown Art Cinema: **58/61** with times (95.1%), tomorrow events: 7
- Starlight Drive-In Theatre: **35/35** with times (100.0%), tomorrow events: 5

## Closed Venue Leakage
- Closed registry venues matched: **9**
- Future visible events on registry-closed venues: **9**
- Future visible events on inactive venues: **155**

## Crawl Freshness (Last 24h)
- Runs: **631** across **477** sources
- Status counts: `{'success': 529, 'error': 62, 'running': 40}`
- Throughput: found **20,406**, new **1,600**, updated **17,119**
- Top erroring sources:
  - `atlanta-ballet` (3)
  - `atlanta-opera` (3)
  - `southern-museum` (2)
  - `silverspot-cinema-atlanta` (2)
  - `ticketmaster` (2)

## Notes
- Walkability/history are tracked as distributed metrics today; this audit intentionally reports both
  distributed coverage and dedicated-column presence checks to avoid false negatives.
