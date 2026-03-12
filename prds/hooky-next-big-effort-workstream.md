# Hooky Next Big Effort Workstream

**Portal:** `hooky`  
**Surface:** `consumer`  
**Status:** Batch B1 executed  
**Last Updated:** 2026-03-11  
**Depends on:** `prds/hooky-family-portal-health-plan.md`, `prds/hooky-competitive-matrix-and-activity-layer.md`, `prds/hooky-activity-layer-map.md`, `prds/atlanta-activity-queue-a-feasibility.md`, `prds/atlanta-activity-overlay-audit.md`, `prds/atlanta-hooky-activity-layer-large-effort.md`, `prds/atlanta-hooky-activity-layer-phase-2.md`, `prds/035-hooky-family-portal.md`

---

## Purpose

This document defines the next major block of work for Hooky that can be executed in large batches without requiring user check-in after every task.

The goal is not just more crawlers.

The goal is to turn Hooky from:

- a strong family-program graph

into:

- a strong family planning layer with programs, events, and activities

while preserving platform leverage across LostCity.

The consolidated execution charter for this work now lives in:

- `prds/atlanta-hooky-activity-layer-large-effort.md`

That document turns the current activity work into one large Atlanta-owned program with explicit
preflight hygiene gates, batch rules, and phase exit criteria.

The next expansion phase after the current `50`-target baseline is now defined in:

- `prds/atlanta-hooky-activity-layer-phase-2.md`

Batch A foundation is now captured in:

- `prds/hooky-activity-layer-map.md`
- `prds/atlanta-activity-queue-a-feasibility.md`

Those documents define the shared activity object, ownership rules, first-wave Atlanta target universe, implementation queue, and the overlay-first versus new-source split for Queue A.

The first overlay-readiness audit is now captured in:

- `prds/atlanta-activity-overlay-audit.md`

That audit identifies the `ready now`, `ready with light cleanup`, and `cleanup first` destination pack, plus the recommended first `6` implementations.

Execution results for the first Atlanta-owned overlay sweep are now captured in:

- `crawlers/reports/atlanta_activity_overlay_sweep_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave2_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_urban_air_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave3_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave4_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave5_catch_air_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave6_family_fun_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave7_family_outings_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave8_water_farm_fun_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave9_trampoline_and_farms_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave10_destinations_2026-03-11.md`
- `prds/hooky-activity-federation-rules.md`

The first `53` overlay-priority activity targets are now live in Atlanta as shared activity intelligence. Across the first overlay sweep, wave 2, the Urban Air location batch, wave 3, wave 4, the Catch Air batch, the family-fun batch, the family-outings batch, the water / farm / fun batch, the trampoline-and-farms batch, and the final-destinations batch, that work added `158` new `venue_features` rows and brought the live total across those targets to `169` feature rows because `Chattahoochee Nature Center` and `Stone Mountain Park` already had legacy feature inventory.

---

## Core Decision

The next big effort should be:

## **Build the Atlanta-owned family activity layer and federate it into Hooky**

This is the right next move because:

1. Hooky now has enough program depth that the bigger gap is "what can we do today?" utility.
2. Activities and destination-grade places improve both Hooky and the broader Atlanta portal.
3. Atlanta is the better system of record for reusable city-wide activity intelligence.
4. Hooky should consume that layer through family-specific framing, filtering, age-band logic, and planning moments.

---

## Ownership Rule

This is non-negotiable for this workstream:

- if an activity also makes sense in the Atlanta portal, **Atlanta should be the primary owner**
- Hooky should receive it through federation, not own a duplicate source graph

### What Atlanta should own

- source rows for broadly useful attractions / destinations / activity providers
- canonical venue and operator identity
- durable place intelligence
- category / type normalization that benefits multiple portals
- permanent or semi-permanent destination records

### What Hooky should own

- family-specific curation
- age-band suitability logic
- planning-moment packaging
- family-facing activity collections
- family-specific derived metadata where appropriate

### Why this matters

Because other portals are much more likely to benefit from:

- museums
- attractions
- animal experiences
- adventure parks
- seasonal family destinations
- indoor play and destination activities

than they are from Hooky-specific camp/program framing.

If Hooky owns those sources directly, LostCity loses compounding platform value.

---

## Workstream Goal

By the end of this effort, LostCity should have:

1. a first-wave Atlanta-owned activity graph for family-relevant destinations
2. a clear federation path from Atlanta into Hooky
3. enough activity coverage to materially improve:
   - `This Weekend`
   - `Rainy Day`
   - `No School`
   - `Gap Fill`
   - `Visitors In Town`
   - age-band fallback discovery

---

## Scope

### In scope

- activity-layer strategy and canonical object definition
- Atlanta-first source ownership for shared activities
- target universe mapping for the first 25-40 activity-layer places/providers
- source feasibility research
- first-wave implementation queue
- Hooky federation/packaging rules
- product-readiness implications for feed and browse surfaces

### Out of scope

- full frontend implementation of every Hooky activity surface
- broad city expansion beyond Atlanta
- child-profile product expansion
- bespoke one-off source work that does not strengthen the shared activity graph

---

## Activity-Layer Categories

The first wave should prioritize categories that solve real family planning gaps:

1. museums / learning places
2. animals / petting zoos / aquariums / nature centers
3. indoor play and energy-burn places
4. arcades / games / mini golf
5. adventure / climbing / ropes / aerial parks
6. seasonal water / tubing / splash destinations
7. family attractions / experiential destinations
8. low-lift perennial outings that help fill calendar gaps

These categories matter because they support both:

- spontaneous planning
- backup planning when programs or events are thin

---

## Execution Order

### Phase 1. Define The Shared Activity Object

**Goal:** stop talking about "activities" loosely and define a buildable object.

#### Deliverables

- Atlanta-owned canonical `activity` object proposal
- field definitions
- age-band suitability contract
- family-specific derived metadata rules for Hooky

#### Required decisions

- how activities differ from venues, events, and programs
- what should be durable versus derived
- what can be shared across portals versus Hooky-specific

#### Exit gate

- clear object contract
- clear ownership/federation rule

---

### Phase 2. Build The First-Wave Activity Map

**Goal:** identify the best Atlanta-owned activity universe before implementation starts.

#### Deliverables

- first-wave activity target list (`25-40` places/providers)
- grouped by category
- ownership recommendation:
  - Atlanta-owned and federated to Hooky
  - Hooky-only special case
  - skip for now
- source-type classification:
  - permanent attraction page
  - schedule-backed attraction
  - destination guide page
  - booking-backed experience page
  - seasonal destination

#### Research priority

- broad family utility
- neighborhood spread
- weather coverage
- age-band usefulness
- cross-portal value

#### Exit gate

- enough mapped targets to justify implementation batches

---

### Phase 3. Implement Atlanta-Owned First-Wave Activity Sources

**Goal:** create real shared inventory, not just a strategy map.

#### Priority rule

Choose sources that:

- clearly help Hooky
- clearly help Atlanta too
- create reusable place intelligence
- reduce family portal thinness in non-program moments

#### First-wave source profile

Ideal sources are:

- high-trust official pages
- public destination/experience pages
- stable attraction pages with durable metadata
- occasionally schedule-backed, but not dependent on ephemeral event inventory

#### Exit gate

- first meaningful Atlanta-owned activity pack is live
- Hooky can consume it via federation rules

---

### Phase 4. Family Federation Layer

**Goal:** make shared Atlanta activity inventory feel native to Hooky.

#### Deliverables

- Hooky activity inclusion rules
- age-band suitability derivation rules
- planning-moment tagging:
  - rainy day
  - outdoor day
  - toddler energy burn
  - tween boredom breaker
  - visitor-friendly
  - low-effort outing
- exclusion rules for family-unsuitable Atlanta activities

#### Exit gate

- Hooky can surface shared activity inventory without duplicating ownership

---

### Phase 5. Product Readiness Check

**Goal:** confirm the activity layer changes the real utility of the family portal.

#### Questions to answer

- does `This Weekend` get stronger when event/program inventory is thin?
- does Hooky gain better rainy-day and no-school fallback utility?
- do age-band rails become more useful?
- does the portal feel broader without becoming noisy?

#### Exit gate

- activity layer improves at least three core Hooky planning surfaces

---

## Bulk Work Policy

This workstream is meant to run in large autonomous batches.

### Default operating mode

Do not stop after each source or research task.

Instead:

1. complete a full research or implementation batch
2. verify the batch
3. update docs/workstream state
4. only stop for:
   - real blocker
   - unclear ownership conflict
   - schema decision that affects multiple systems
   - significant product tradeoff requiring human judgment

### Good batch units

- one full category map pass
- one full source-family implementation batch
- one federation/normalization hardening batch
- one grouped health/readiness audit

---

## What I Should Execute Without Check-In

These are safe to do autonomously:

1. research and rank first-wave activity targets
2. classify ownership as Atlanta-owned vs Hooky-only
3. write planning docs and scorecards
4. implement Atlanta-owned activity sources where the ownership is clear
5. add tests, validation sweeps, and health reports
6. improve federation/hardening paths that preserve the ownership rule

---

## What Should Trigger A Stop

I should stop only if one of these happens:

1. a target looks family-relevant but should clearly belong to a different portal owner than Atlanta
2. the activity object needs a schema change that affects multiple downstream systems
3. a proposed activity source is high-value for Hooky but low-value or awkward for Atlanta, making ownership ambiguous
4. the work starts pushing into frontend product decisions that change the Hooky experience beyond data readiness

---

## Recommended Immediate Batch

The first autonomous batch under this workstream should be:

### Batch A. Activity-Layer Foundation

1. write the `Hooky activity-layer map`
2. define the canonical shared activity object
3. produce the first-wave Atlanta activity target universe
4. classify each target by:
   - category
   - age-band utility
   - Atlanta ownership suitability
   - Hooky planning value
   - source feasibility
5. identify the first implementation queue (`8-12` best targets)

**Current status:** completed at the strategy layer in `prds/hooky-activity-layer-map.md`

### Batch B. First Implementation Sweep

After Batch A:

1. implement the first Atlanta-owned activity sources
2. register them under Atlanta ownership
3. verify family relevance and Hooky federation potential
4. update the Hooky health docs with the activity-layer effect

**Current status:** completed for the first major overlay expansion phase.

Live result:

- `53` Atlanta-owned activity targets verified across the overlay program
- `158` new feature overlays applied
- `169` total live `venue_features` rows across the overlay program
- `169 / 169` live feature rows with URL support

Open follow-up:

- curate legacy feature rows on `Chattahoochee Nature Center` and `Stone Mountain Park` so the family-facing activity pack is cleaner before Hooky federation logic becomes product-visible
- keep Atlanta as the system of record and apply Hooky-side federation filters where shared rows are valid for Atlanta but too noisy for family-facing presentation
- define Hooky-side family-fit presentation rules for selective destinations like `Urban Air`, `Illuminarium Atlanta`, and the more tween/teen-heavy arcade-adventure pack
- Phase 2 now has enough coverage that the next problem is mostly ranking, packaging, and deciding which marginal operators are still worth the effort

---

## Success Criteria

This next big effort is successful when:

1. Hooky no longer depends mostly on events + programs to feel useful
2. Atlanta owns the reusable family-friendly activity graph
3. Hooky gains a strong "what can we do?" layer for different age bands and planning contexts
4. the family portal becomes visibly broader without becoming less trustworthy

---

## Strategic Read

This is the right ambitious move.

The past day proved that LostCity can move quickly when the work is pattern-led and research-backed.

The next compounding advantage is:

- shared Atlanta activity intelligence
- federated into Hooky as family planning value

That is more defensible than building Hooky as a standalone family content island.
