# Hooky Activity-Layer Map

**Portal context:** `hooky` consumer, federated from `atlanta` where reusable  
**Status:** Batch A foundation  
**Last Updated:** 2026-03-11  
**Depends on:** `prds/hooky-next-big-effort-workstream.md`, `prds/hooky-competitive-matrix-and-activity-layer.md`, `prds/035-hooky-family-portal.md`

---

## Purpose

This document turns the new activity-layer strategy into a buildable map.

It defines:

1. the shared activity object
2. Atlanta vs Hooky ownership rules
3. the first-wave Atlanta activity universe
4. the first implementation queue

The goal is to make Hooky materially better at:

- `What can we do today?`
- `What works in this age band?`
- `What fills the gap between plans?`
- `What is a good fallback when programs or events are thin?`

---

## Strategic Read

Hooky now has enough progress on programs that its next meaningful jump in utility comes from **activities / places to go**, not just more camp depth.

The platform logic is:

- `Atlanta` should own durable city-wide activity intelligence
- `Hooky` should consume it through a family lens

That makes the activity layer a shared platform asset instead of a family-only content island.

---

## Core Rule

If an activity is broadly useful to:

- tourists
- local adults
- visitors
- hotel guests
- concierge flows
- neighborhood portals

then `Atlanta` should be the primary owner.

If an activity is only useful in a family-specific planning context and has weak broader portal value, it can be considered `Hooky`-owned.

### Default assumption

For this first wave, almost every serious destination-grade family activity should be treated as:

- **Atlanta-owned**
- **Hooky-federated**

---

## What The Activity Layer Is

An `activity` is a durable experience object that sits between:

- a `venue`
- a `program`
- an `event`

### Not a venue

A venue is a place.

An activity is the specific family-usable experience that place offers.

Example:

- `Stone Mountain Park` is a venue/destination
- `family outdoor attraction day at Stone Mountain Park` is an activity layer use case

### Not an event

An event is date-bound.

An activity is durable and visitable outside a single date.

Example:

- `Georgia Aquarium Toddler Time Saturday` is event/program-ish
- `Georgia Aquarium family visit` is activity-layer material

### Not a program

A program has enrollment, sessions, or recurring commitments.

An activity is more like:

- drop-in
- reserve-a-slot
- buy tickets
- show up during hours

---

## Proposed Shared Object

This is the proposed Atlanta-owned canonical object.

### Shared core fields

- `name`
- `slug`
- `activity_type`
- `operator_name`
- `venue_id`
- `source_id`
- `summary`
- `neighborhood`
- `indoor_outdoor`
- `seasonality`
- `weather_sensitivity`
- `visit_duration_band`
- `reservation_mode`
  - `walk_up`
  - `recommended`
  - `required`
  - `timed_entry`
- `cost_band`
  - `free`
  - `budget`
  - `moderate`
  - `premium`
  - `unknown`
- `minimum_age_band`
- `maximum_age_band`
- `multi_age_sibling_friendly`
- `family_confidence`
- `destination_url`
- `ticket_url`
- `hours_url`
- `parking_confidence`
- `food_confidence`
- `restroom_confidence`
- `accessibility_confidence`
- `is_permanent_destination`

### Hooky-derived fields

These should not drive Atlanta ownership. They are family-facing overlays:

- `good_for_toddlers`
- `good_for_preschool`
- `good_for_elementary`
- `good_for_tweens`
- `good_for_teens`
- `good_for_mixed_age_siblings`
- `rainy_day_ok`
- `low_effort_outing`
- `energy_burn`
- `visitor_friendly`
- `gap_fill_friendly`
- `best_with_adult_participation`

---

## Implementation Staging

The activity layer should not start by polluting the `events` table with durable attractions again.

That was already identified as a data-quality anti-pattern.

### Phase 1 bootstrap

Before a formal schema change, the right bootstrap is:

- Atlanta-owned source + venue intelligence
- activity metadata registry
- family-facing derived rules in Hooky

### Phase 2 formalization

If the surfaces prove useful, formalize a shared `activities` entity.

### Platform rule

Do **not** model permanent destinations as fake recurring events just to get them into the product quickly.

That creates cleanup debt and weakens the data layer.

---

## Taxonomy

Use parent-intent buckets, not tourism taxonomy.

### Primary buckets

1. `museums_learning`
2. `animals_nature`
3. `indoor_play`
4. `games_arcades`
5. `adventure_climbing_ropes`
6. `water_tubing_splash`
7. `family_attractions`
8. `low_lift_outings`

### Secondary tags

- `rainy_day`
- `outdoor_day`
- `toddlers`
- `preschool`
- `elementary`
- `tween`
- `teen`
- `mixed_ages`
- `visitor_friendly`
- `book_ahead`
- `walk_up`
- `budget`
- `premium`

---

## Age-Band Contract

The activity layer should be stricter than competitor-family directories.

### Allowed age bands

- `infant`
- `toddler`
- `preschool`
- `elementary`
- `tween`
- `teen`
- `adult_with_kids`
- `mixed_ages`

### Rules

1. `family-friendly` alone is not enough.
2. If a destination skews older-kid or teen, say so.
3. If toddler fit is weak, do not imply it works.
4. If a place works mainly for mixed-age sibling outings, that should be explicit.
5. If age fit is uncertain, mark it `mixed_ages` or `unknown`, not overconfident.

---

## Ownership Guide

### Atlanta-owned by default

These should almost always be Atlanta-owned:

- museums
- aquariums
- zoos
- botanical gardens
- destination attractions
- family entertainment centers
- adventure parks
- ropes/climbing destinations
- river/tubing operators
- large indoor play or game destinations with broader city utility

### Potential Hooky-only exceptions

These are not first-wave priorities:

- tiny toddler-only play cafes
- birthday-party-first venues with weak citywide value
- family support spaces that do not behave like destinations
- child-development spaces with weak broader consumer relevance

Rule:

If the place plausibly belongs in Atlanta as `things to do in the city`, Atlanta should own it.

---

## First-Wave Atlanta Activity Universe

This is the recommended first-wave target map.

### A. Museums / Learning Places

| Target | Status | Why it matters |
|---|---|---|
| High Museum | existing Atlanta signal | premium family destination, strong cross-portal value |
| Children's Museum of Atlanta | existing Atlanta signal | core younger-kid family utility |
| Fernbank Museum | existing Atlanta signal | strong perennial family destination |
| Fernbank Science Center | likely new/expand | good school-break and rainy-day utility |
| Atlanta History Center | existing Atlanta signal | broad family/tourism relevance |
| Center for Puppetry Arts | existing Atlanta signal | distinctive Atlanta family destination |
| Michael C. Carlos Museum | existing Atlanta signal | educational family utility, cross-portal value |
| Atlanta Botanical Garden | existing Atlanta signal | high-value outdoor destination |
| National Center for Civil and Human Rights | existing Atlanta signal | broader city value, family selectivity needed |
| Delta Flight Museum | existing Atlanta signal | niche but strong visitor/family learning fit |

### B. Animals / Nature

| Target | Status | Why it matters |
|---|---|---|
| Georgia Aquarium | existing Atlanta signal | top-tier family destination |
| Zoo Atlanta | existing Atlanta signal | top-tier family destination |
| Chattahoochee Nature Center | existing Atlanta signal | strong outdoor / nature / all-ages value |
| Dunwoody Nature Center | likely new/expand | local family outing utility |
| Yellow River Wildlife Sanctuary | likely new | distinctive animal experience |
| Blue Heron Nature Preserve | likely new/expand | low-lift nature outing |

### C. Indoor Play / Energy Burn

| Target | Status | Why it matters |
|---|---|---|
| LEGO Discovery Center | existing Atlanta signal | obvious rainy-day, elementary-age destination |
| Catch Air | likely new | strong younger-kid utility |
| Ready Set Fun | likely new | preschool / elementary energy-burn fit |
| Urban Air Adventure Park | likely new | broad family entertainment category |
| Sparkles Family Fun Center | existing Atlanta signal | skating / play crossover utility |

### D. Games / Arcades / Mini Golf

| Target | Status | Why it matters |
|---|---|---|
| Andretti Indoor Karting & Games | likely new | strong tween/teen/family group utility |
| Main Event | likely new | broad family entertainment option |
| Stars and Strikes | likely new | all-weather activity option |
| Monster Mini Golf | likely new | younger-leaning indoor game utility |
| Netherworld | existing Atlanta signal | older-kid / teen family option with clear age caveats |

### E. Adventure / Climbing / Ropes

| Target | Status | Why it matters |
|---|---|---|
| Treetop Quest Dunwoody | likely new | clean ropes/adventure fit |
| Treetop Quest Gwinnett | likely new | broadens metro spread |
| Stone Summit / Movement climbing gym | likely new | family climbing category entry |
| Skyline Park | likely new | mixed-age destination with tourist crossover |
| Activate / similar active game venue | verify market fit | newer activity category worth validating |

### F. Water / Tubing / Seasonal Splash

| Target | Status | Why it matters |
|---|---|---|
| Shoot the Hooch | likely new | iconic summer family activity |
| Chattahoochee River Tubing operators | likely new | classic Atlanta seasonal activity |
| Six Flags White Water | likely new | major summer utility |
| Lanier Islands water attractions | likely new | regional family draw |

### G. Family Attractions / Experiential Destinations

| Target | Status | Why it matters |
|---|---|---|
| Stone Mountain Park | existing Atlanta signal | large family destination, outdoor + seasonal utility |
| World of Coca-Cola | existing Atlanta signal | strong visitor and family crossover |
| College Football Hall of Fame | likely new | destination-grade family activity |
| Illuminarium Atlanta | likely new | experiential destination category |
| Puttshack / similar upscale game venue | verify family fit | useful older-kid family option if hours/family windows are clear |

### H. Low-Lift Perennial Outings

These are strategically important, but lower implementation priority because they may rely more on venue enrichment than crawler work.

| Target | Status | Why it matters |
|---|---|---|
| Piedmont Park family outing layer | existing Atlanta signal | core low-effort family fallback |
| Grant Park family outing layer | existing Atlanta signal | neighborhood family utility |
| Eastside Trail / BeltLine family-friendly segments | likely later | high local utility if framed carefully |
| Morgan Falls / major family park destinations | later | strong no-school / low-planning value |

---

## First Implementation Queue

These are the best `8-12` targets to promote first.

### Queue A: highest-leverage shared destinations

1. Georgia Aquarium
2. Zoo Atlanta
3. Atlanta Botanical Garden
4. High Museum
5. Children's Museum of Atlanta
6. Fernbank Museum / Fernbank Science Center
7. Center for Puppetry Arts
8. Atlanta History Center
9. Chattahoochee Nature Center
10. LEGO Discovery Center
11. Stone Mountain Park
12. Andretti Indoor Karting & Games

### Why this queue is right

- high cross-portal value
- obvious family utility
- strong rainy-day / outdoor-day coverage
- broad age-band relevance
- durable destination intelligence
- better immediate effect on Hooky breadth perception

---

## Queue B: next wave after the core pack

1. World of Coca-Cola
2. Delta Flight Museum
3. Yellow River Wildlife Sanctuary
4. Main Event
5. Stars and Strikes
6. Treetop Quest Dunwoody
7. Treetop Quest Gwinnett
8. Catch Air
9. Ready Set Fun
10. Shoot the Hooch
11. Six Flags White Water
12. College Football Hall of Fame

---

## Skip / Later Rules

Deprioritize for the first wave:

- destinations that only work as seasonal pop-ups
- places that are mostly birthday-party funnels
- weakly differentiated tourist attractions with little family-planning value
- venues with poor age-fit clarity
- places whose value is mostly event-driven rather than destination-driven
- hyper-local playgrounds and parks that are better handled through later venue enrichment

---

## How Hooky Should Consume This Layer

Hooky should not mirror the Atlanta activity graph wholesale.

It should use family-specific inclusion and framing:

### Core family rails

- rainy day
- good for toddlers
- good for tweens
- mixed-age sibling friendly
- low-effort outing
- visitor-friendly with kids
- outdoor energy burn
- no-school fallback

### Family-specific exclusions

Do not surface into Hooky by default if:

- age fit is mostly adult
- family utility is weak or ambiguous
- the place is primarily nightlife with occasional kid access
- the experience is too expensive or too niche to help normal family planning

---

## Product Effect We Want

If this work lands correctly, Hooky should stop feeling like:

- camps plus some family events

and start feeling like:

- a family operating layer for plans, gaps, weather pivots, and age-aware outings

That is the real step-change.

---

## Batch A Output

This document completes the first autonomous batch’s core strategic outputs:

1. shared activity object
2. ownership rules
3. first-wave target universe
4. first implementation queue

The next execution batch should be:

- classify Queue A targets by source feasibility
- separate `existing Atlanta signal` targets from true new-source targets
- choose the first Atlanta-owned implementation sweep
