# PRD 032: Atlanta Destination Intelligence Hydration

**Status**: Ready for execution
**Priority**: P1-P3 (parallel to event-feed repair)
**Estimated effort**: 18-28 agent hours, ~8-12 calendar hours with 2-3 parallel agents

## Problem

Atlanta portal quality cannot be measured on future events alone.

LostCity wins because it helps people decide how to spend time in the city, not
just which ticketed thing to attend. That includes restaurants, bars, food
halls, museums, cinemas, markets, and other destinations that support:

- pre-event and post-event recommendations
- hangs and low-friction group planning
- concierge and hotel use cases
- practical planning around hours, parking, transit, walkability, reservation
  friction, dietary needs, and accessibility

Right now Atlanta has useful venue breadth, but destination intelligence depth
is uneven. Basic identity fields are decent, while practical planning fields are
thin:

- strategic venue subset analyzed: 489
- website fill: 84.5%
- image fill: 97.8%
- hours fill: 70.3%
- planning notes fill: 0.0%
- active `venue_specials` coverage across active Atlanta venues: 1.7%

This creates a product gap. A venue may be present in the database, but still be
effectively unusable for recommendations, hangs, and concierge flows because we
cannot answer the questions users actually have.

## Goal

Make Atlanta materially stronger as a destination-decision product by improving
structured venue intelligence without polluting the event feed or drifting into
generic POI SEO.

This PRD covers three destination lanes:

1. Metadata hydration: hours, planning notes, and practical destination fields
2. Specials hydration: recurring offers and operational deals via
   `venue_specials`
3. Planning-friction coverage: parking, transit, walkability, accessibility,
   and dietary-support signals

## Non-Goals

- Replacing event-feed repair work in PRD 031
- Adding large amounts of undifferentiated POI inventory just to inflate venue counts
- Modeling recurring specials as `events`
- Manual one-off database patching instead of source-backed enrichment
- Broad schema expansion in this sprint unless a missing field blocks execution

## Current State

### Destination metadata by venue type (Atlanta, active venues)

| Venue Type | Total | Hours | Planning Notes | Parking Notes | Transit Notes | Specials |
|---|---:|---:|---:|---:|---:|---:|
| restaurant | 428 | 375 | 0 | 259 | 1 | 16 |
| bar | 199 | 167 | 0 | 148 | 4 | 20 |
| brewery | 31 | 25 | 0 | 16 | 2 | 2 |
| food_hall | 6 | 4 | 0 | 5 | 1 | 0 |
| music_venue | 42 | 26 | 0 | 35 | 6 | 0 |
| comedy_club | 4 | 2 | 0 | 2 | 0 | 0 |
| theater | 36 | 15 | 0 | 27 | 8 | 0 |
| gallery | 54 | 33 | 0 | 46 | 1 | 0 |
| museum | 34 | 21 | 0 | 26 | 2 | 0 |
| cinema | 16 | 4 | 0 | 12 | 0 | 0 |
| market | 49 | 34 | 0 | 46 | 1 | 0 |
| coffee_shop | 85 | 81 | 0 | 72 | 2 | 0 |

### Key observations

1. `planning_notes` are effectively empty across destination types.
2. Hours are the biggest immediate metadata gap for theaters, cinemas, museums,
   galleries, and music venues.
3. Specials coverage is too thin to support hotel or concierge surfaces at high
   confidence.
4. Parking coverage is decent in some categories, but transit and walkability
   context remain patchy.
5. Accessibility and dietary usefulness matter to the product vision and the web
   recommendation surfaces, but are not yet treated as a first-class crawler
   audit contract.

## Strategy

Use the current model well before expanding it:

- `venues.hours` and `hours_display` for operating hours
- `venues.planning_notes` for practical synthesis and friction reduction
- `venues.parking_note`, `venues.transit_note`, and walkability fields for
  getting-there guidance
- `venue_specials` for recurring operational offers
- venue tags / notes for accessibility and dietary-support signals where
  structured extraction is possible

Success is not “more venue rows.” Success is:

- stronger recommendation quality
- better hang suggestions
- lower planning friction
- better concierge-grade answers
- no contamination of the main event feed

## Architecture Context

### Existing tools we should use, not bypass

- `crawlers/hydrate_hours_google.py`
  - best immediate path for missing hours across destination-heavy venue types
- `crawlers/hydrate_hours_foursquare.py`
  - fallback or secondary hours source
- `crawlers/scrape_venue_specials.py`
  - current website + LLM extraction path for hours, specials, menu links,
    reservation links, phone, instagram, price level, and vibes
- `crawlers/enrich_parking.py`
  - current parking/transit enrichment path
- `crawlers/enrichment_pipeline.py`
  - current orchestration surface for recurring enrichment
- `crawlers/scripts/content_health_audit.py`
  - formal measurement surface for destination readiness

### Product contract

- A destination can be healthy with zero future events if it is useful and
  trustworthy for recommendations and planning.
- Destination hydration must remain source-backed and quality-scored.
- `venue_specials` are not `events`.
- `planning_notes` should summarize practical decision support, not generic
  marketing copy.

## Execution Plan

### Batch 1: Hours Hydration Quick Wins

**Goal**: materially improve hours coverage for fixed-hours destination types
using existing tooling.

Important scope rule:

- Do not force weekly hours onto event-led venues whose meaningful availability
  is tied to performances or event windows.
- `theater`, `music_venue`, `amphitheatre`, and some `comedy_club` rows should
  be judged primarily on planning guidance, not on stable daily hours.
- `hours` should be a quality target mainly for museums, galleries, cinemas,
  bars, restaurants, gardens, markets, and similar fixed-hours destinations.

Primary tool:

```bash
cd crawlers
python3 hydrate_hours_google.py --destinations --limit 250
```

Follow-up / fallback:

```bash
cd crawlers
python3 hydrate_hours_foursquare.py --limit 150
```

Priority venue classes:

1. `cinema`
2. `museum`
3. `gallery`
4. `bar`
5. `restaurant`

Named Atlanta targets from current live gaps:

- Cinemas: `Plaza Theatre`, `AMC Phipps Plaza 14`, `Regal Atlantic Station`,
  `Look Cinemas`, `Cinefest Film Theatre`, `Starlight Drive-In Theatre`
- Museums: `MOCA GA`, `Delta Flight Museum`, `Millennium Gate`,
  `David J. Sencer CDC Museum`
- Galleries: `Poem 88`, `Chastain Arts Center`, `The Bakery Atlanta`,
  `Atlanta Clay Works`
- Bars/restaurants: `Atlanta Eagle`, `Hard Rock Cafe - Atlanta`,
  `Trader Vic's`, `Red Phone Booth`, `City Winery Atlanta`

Success thresholds:

- strategic venue hours fill: `70.3% -> >= 82%`
- `cinema` hours fill: `25.0% -> >= 75%`
- `museum` hours fill: `61.8% -> >= 80%`
- `gallery` hours fill: `61.1% -> >= 80%`
- `bar`/`restaurant` hours fill improves materially across high-value Atlanta destinations

### Batch 2: Planning Notes and Practical Friction

**Goal**: populate `planning_notes` for the destinations most likely to appear
in hangs, explore, and concierge flows.

This is the primary readiness lane for event-led venues.

Definition of good `planning_notes`:

- practical, compact, and source-backed
- mention reservation friction when relevant
- mention parking/transit/walkability context when known
- mention time-of-day or arrival advice when helpful
- avoid empty editorial filler

Initial target clusters:

1. Downtown anchors
   - `College Football Hall of Fame`
   - `Red Phone Booth`
   - `Trader Vic's`
   - `Tabernacle`
   - `Cinefest Film Theatre`
2. Buckhead social destinations
   - `Blue Martini Atlanta`
   - `Fado Irish Pub`
3. Event-led cultural destinations
   - `7 Stages`
   - `Chastain Park Amphitheatre`
   - `Cobb Energy Performing Arts Centre`
   - `Atlanta Symphony Hall`
   - `Alliance Theatre`
   - `Gypsy Kitchen`
   - `Johnny's Hideaway`
   - `Lucian Books and Wine`
3. Eastside / walkable hang destinations
   - `Krog Street Market`
   - `Ladybird Grove & Mess Hall`
   - `Joystick Gamebar`
   - `Brewhouse Cafe`
   - `The Vortex`
4. Mixed-use / district anchors
   - `Ponce City Market`
   - `The Works Atlanta`
   - `Atlantic Station`
   - `Lee + White`
   - `Politan Row`

Execution order:

1. Use existing parking/transit/walkability fields as inputs where already present.
2. Use website scrape outputs (`reservation_url`, `menu_url`, hours, etc.) to
   support structured planning synthesis.
3. Write `planning_notes` only for venues with enough verified source material.
4. Keep copy operational and low-fluff.

Success thresholds:

- populate `planning_notes` for at least `75` high-value Atlanta destinations
- ensure at least `40` of those are restaurants/bars/food halls
- ensure at least `20` of those are event-adjacent anchors
  (`museum`, `cinema`, `theater`, `music_venue`, `attraction`)

### Batch 3: Specials Hydration

**Goal**: make specials useful enough for hospitality and after-plan surfaces.

Primary tool:

```bash
cd crawlers
python3 scrape_venue_specials.py --venue-type bar --limit 120
python3 scrape_venue_specials.py --venue-type brewery --limit 40
python3 scrape_venue_specials.py --venue-type food_hall --limit 20
```

Priority neighborhoods:

- Buckhead
- Downtown
- Midtown
- Old Fourth Ward / Inman Park
- West Midtown
- East Atlanta Village
- Summerhill

Named Atlanta targets:

- Bars: `Blue Martini Atlanta`, `Fado Irish Pub`, `Johnny's Hideaway`,
  `Joystick Gamebar`, `Argosy`, `Ladybird Grove & Mess Hall`,
  `Red Phone Booth`, `Brewhouse Cafe`
- Breweries: `Bold Monk Brewing Co`, `Halfway Crooks`,
  `Hippin' Hops Brewery & Oyster Bar`, `Atlantucky Brewing`,
  `Monday Night Brewing`
- Food halls / district dining: `Krog Street Market`, `Ponce City Market`,
  `Politan Row`, `Lee + White`, `The Works Atlanta`

Success thresholds:

- `bar` specials coverage: `10.1% -> >= 18%`
- `brewery` specials coverage: `6.5% -> >= 20%`
- `food_hall` specials coverage: `0.0% -> >= 50%`
- at least `35` new active Atlanta `venue_specials`

### Batch 4: Accessibility and Dietary-Support Contract

**Goal**: stop treating accessibility and dietary usefulness as implied quality.

This batch is definition plus targeted extraction, not a large schema project.

Current reality:

- consumer onboarding and recommendation surfaces already care about
  accessibility and dietary needs
- venue admin/edit surfaces already expose `accessibility_notes`
- extraction and audits do not yet measure destination suitability for these
  needs as a first-class lane

Execution order:

1. Audit current writable destination fields and tag surfaces that can already
   carry these facts without schema work.
2. Define the minimum viable hydration contract for:
   - accessibility
   - dietary-support / allergy-aware service
   - family / stroller / low-friction suitability where source-backed
3. Update the audit/reporting language to track these fields once extraction
   paths are clear.
4. Do not fabricate claims from marketing copy. If a venue does not explicitly
   support a fact, omit it.

Success thresholds:

- explicit destination-intelligence contract documented for accessibility and
  dietary-support hydration
- first target set of `25` venues with verified support signals in structured
  fields or controlled notes/tags

## Verification

Run before and after the sprint:

```bash
cd crawlers
python3 coverage_analysis.py
python3 gap_analysis_detailed.py
python3 scripts/content_health_audit.py --city Atlanta
python3 -m py_compile scripts/content_health_audit.py
```

Execution verification for specific batches:

```bash
cd crawlers
python3 hydrate_hours_google.py --destinations --dry-run --limit 50
python3 hydrate_hours_foursquare.py --dry-run --limit 50
python3 scrape_venue_specials.py --venue-type bar --dry-run --limit 20
python3 enrich_parking.py --limit 50
```

## Acceptance Criteria

This PRD is successful when all of the following are true:

1. Atlanta destination hydration is tracked as a first-class workstream, not as
   a footnote to event coverage.
2. Strategic hours coverage improves materially for destination-heavy venue
   types.
3. `planning_notes` become populated and operationally useful for top Atlanta
   hang and concierge targets.
4. `venue_specials` coverage becomes visibly useful for bars, breweries, and
   food halls.
5. Accessibility/dietary-support hydration stops being an implicit aspiration
   and becomes an explicit execution lane.
6. No recurring offers are inserted into `events`.
7. No quality work is counted as a “coverage win” unless it improves practical
   recommendation quality.

## Sequencing With PRD 031

This work should run **in parallel with, but after kickoff of**, PRD 031:

1. PRD 031 fixes broken museum/gallery feed coverage and source failures.
2. PRD 032 strengthens the destination-decision layer around those same
   neighborhoods and anchors.

If only one shared tranche is staffed immediately:

1. PRD 031 museum/gallery P0/P1 fixes
2. PRD 032 Batch 1 hours hydration
3. PRD 032 Batch 2 planning notes for high-value destinations
4. PRD 032 Batch 3 specials hydration

That sequence improves Atlanta both as an event-discovery product and as a
useful real-world decision engine.
