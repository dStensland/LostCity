# PRD 033: Atlanta Coverage Execution Plan

**Status**: Ready for execution  
**Scope**: Atlanta only  
**Surface**: Data layer / crawler operations  
**Horizon**: 4-6 weeks  
**Operating mode**: Parallel event coverage + destination intelligence

## Why This Exists

Atlanta is no longer bottlenecked by a single broken crawler class.

We have moved past the obvious museum-anchor failures and into a more mature
execution phase:

- broken high-value sources still need repair
- district and neighborhood leverage matter more than one-off venue count
- destination intelligence is now as important as feed volume
- specials and planning depth are the weakest practical recommendation lanes

The next phase needs an operating plan, not just a backlog.

This document defines:

1. the scoreboard
2. the work lanes
3. weekly execution order
4. measurable exit criteria
5. rules for what counts as a real win

## Product Frame

Atlanta quality has two equal tracks:

1. **Feed health**
   The portal must feel alive, current, and culturally differentiated.
   This is driven by events, exhibits, programs, classes, and recurring social
   inventory.

2. **Destination intelligence**
   The portal must help people choose where to go before, after, or instead of
   an event.
   This is driven by hours, planning notes, venue specials, access friction,
   parking, transit, walkability, dietary usefulness, and accessibility.

The core operating rule remains:

- a venue can be healthy with zero future events
- a venue is not healthy if it is present but unusable for planning
- recurring offers belong in `venue_specials` or recurring series, not as
  generic event-feed spam

## Baseline

Use March 10, 2026 as the formal baseline.

From [`/Users/coach/Projects/LostCity/crawlers/reports/content_health_assessment_2026-03-10_city-atlanta.md`](/Users/coach/Projects/LostCity/crawlers/reports/content_health_assessment_2026-03-10_city-atlanta.md):

- visible future canonical events: `14,624`
- active sources: `474`
- venues: `3,766`
- active `venue_specials`: `67`
- venue website fill: `72.0%`
- venue image fill: `64.6%`
- venue hours fill: `43.4%`
- fixed-hours venue fill: `78.6%`
- venue description fill: `51.6%`
- event-led destination planning fill: `1.7%`
- parking notes fill: `56.2%`
- transit notes fill: `1.8%`
- walkable-neighbor count > 0: `27.2%`

These are the numbers the plan should move.

## Scoreboard

We should manage Atlanta on a small scorecard, not on raw anecdotes.

### A. Feed Health

1. **Visible future canonical events**
   Baseline: `14,624`
   Target: `>= 15,750`

2. **Active sources with zero visible future yield**
   Baseline: from current gap analysis board, still materially high
   Target: reduce by `>= 25%` from current baseline

3. **Inactive or underperforming district hubs**
   Baseline: Interlock still empty/inactive; several hubs only recently repaired
   Target: all credible Atlanta district hubs are either:
   - active and yielding, or
   - explicitly classified as upstream-empty / blocked with no false “healthy” read

4. **Priority museum/cultural anchors with healthy current coverage**
   Target:
   - no P0/P1 Atlanta museum anchor reads as a silent zero due to crawler failure
   - blocked or destination-first anchors must be explicitly classified as such

### B. Destination Intelligence

1. **Fixed-hours venue fill**
   Baseline: `78.6%`
   Target: `>= 86%`

2. **Event-led destination planning fill**
   Baseline: `1.7%`
   Target: `>= 12%`

3. **Active venue specials**
   Baseline: `67`
   Target: `>= 120`

4. **High-value venue planning-note coverage**
   Baseline: very thin
   Target:
   - `>= 100` Atlanta high-value venues with useful `planning_notes`
   - `>= 40` of those are food / nightlife destinations
   - `>= 25` are event-adjacent anchors

5. **Transit notes**
   Baseline: `1.8%`
   Target: `>= 5%`

### C. Quality / Integrity

1. **Same-source duplicate groups**
   Baseline: `0`
   Target: keep at `0`

2. **Visible cross-source duplicate groups**
   Baseline: `1`
   Target: keep `<= 2`

3. **Parked / dead domains treated as healthy**
   Target: `0`

4. **Blocked-source false empties**
   Target: `0`
   Every blocked source should log as blocked, not empty.

## Work Lanes

### Lane 1: Source Repair

Purpose:
- restore valid inventory suppressed by parser drift, blocked access, or stale assumptions

What belongs here:
- broken museum, gallery, district, venue, and recurring-program sources
- silent write-path failures
- bad source classification
- stale selectors / API drift

Success definition:
- a source is repaired only when live production rows improve or the source is
  correctly reclassified as destination-first / blocked / upstream-empty

### Lane 2: Destination Hydration

Purpose:
- make venues genuinely useful for recommendations, hangs, and concierge use

What belongs here:
- hours for fixed-hours destinations
- planning notes for event-led and destination-led venues
- parking/transit/walkability synthesis
- better phone / reservation / menu / website integrity

Success definition:
- not “field present”
- “field is useful and source-backed”

### Lane 3: Specials and Recurring Offer Coverage

Purpose:
- support “where should we go after?” and hospitality surfaces

What belongs here:
- `venue_specials`
- recurring food/drink nights that genuinely behave as weekly operations
- normalized recurring series when the experience is event-like

Success definition:
- specials and recurring weekly offers become meaningfully visible in Atlanta
- no pollution of the main event feed with low-signal operational noise

### Lane 4: Neighborhood and District Leverage

Purpose:
- improve real portal usefulness at the district level rather than isolated venue rows

What belongs here:
- district hub sources
- neighborhood normalization
- mixed-use district event/venue completeness

Success definition:
- district pages and neighborhood discovery stop looking empty or lopsided

## Immediate Priority Queue

### P0: Stabilize Shared Specials / Recurring Offers Lane

Rationale:
- this is the current operational bottleneck
- Anthropic failure previously made the whole lane brittle
- the fallback now works, but should be rolled out selectively

Immediate targets:
- normalize `Flight Club Atlanta` so fallback output maps to existing
  `Bottomless Brunch` instead of parallel `Weekend Brunch`
- continue selective rollout on venues with clear first-party specials pages
- avoid broad runs until the fallback has a stable allowlist profile

Success criteria:
- `>= 3` additional Atlanta venues live with clean recurring specials/offer coverage
- no new malformed series merges
- no parked-domain false positives

### P1: Expand Planning-First Event-Led Destination Coverage

Rationale:
- event-led planning fill is still far too low
- this improves real user outcomes faster than chasing more fringe source count

Target set:
- `Tabernacle`
- `Variety Playhouse`
- `Terminal West`
- `Plaza Theatre`
- `Tara Theatre`
- `Alliance Theatre`
- `Atlanta Symphony Hall`
- `Truist Park`
- `Chastain Park Amphitheatre`
- `Cobb Energy Performing Arts Centre`

Success criteria:
- `>= 15` additional event-led Atlanta venues gain useful `planning_notes`
- notes are practical, not promotional

### P1: District / Mixed-Use Completion

Rationale:
- district sources produce multi-venue leverage
- this remains the best coverage-per-source lane after museum repair

Target set:
- `The Interlock` decision:
  - active with live yield, or
  - explicitly marked upstream-empty
- `Atlantic Station` quality pass
- `Ponce City Market Area` maintenance
- `Krog Street` maintenance
- `East Lake` reality check / reclassification if upstream remains thin

Success criteria:
- no major Atlanta district reads as empty due to our own source failure

### P2: Destination-First Blind Spots

Rationale:
- some major attractions should be judged on destination utility, not event volume

Target set:
- `World of Coca-Cola`
- `APEX Museum`
- `SCAD FASH` destination fallback maintenance
- `CDC Museum`

Success criteria:
- each destination-first anchor is explicitly healthy or explicitly blocked
- none remain in a misleading “zero-event = broken” state

## Weekly Execution Cadence

### Monday: Scoreboard and Triage

Run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 coverage_analysis.py
python3 gap_analysis_detailed.py
python3 scripts/content_health_audit.py --city atlanta
```

Output:
- updated scoreboard snapshot
- top 5 broken-source targets
- top 10 destination-intelligence targets

### Tuesday-Wednesday: Source Repair Block

Rules:
- only work on sources that meet at least one of:
  - obvious major-venue gap
  - district leverage
  - broken source suppressing valid inventory
- if a source is blocked upstream, classify it honestly and move on

Expected weekly throughput:
- `2-4` source fixes or explicit source reclassifications

### Thursday: Destination Hydration Block

Rules:
- fixed-hours venues: hours-first
- event-led venues: planning-first
- only hydrate with source-backed useful fields

Expected weekly throughput:
- `10-20` meaningful destination updates

### Friday: Specials / Recurring Offers Block

Rules:
- use the fallback selectively
- prefer venues with obvious recurring-copy surfaces
- if output would create parallel labels for the same operation, stop and normalize first

Expected weekly throughput:
- `3-8` clean venue wins

## Per-Lane Acceptance Rules

### Source Repair Acceptance

A repair is done only if one of these is true:

- live rows materially improve
- stale / wrong rows are cleaned up
- source is reclassified to the correct state:
  - destination-first
  - blocked
  - upstream-empty

### Destination Acceptance

A destination hydration is done only if:

- the field adds real decision value
- the value is sourced from first-party or trusted structured data
- the note is practical enough to surface in the product

### Specials Acceptance

A specials write is done only if:

- title is user-facing and specific
- weekday schedule is explicit
- output does not create a misleading duplicate of an existing recurring concept
- recurring series titles remain stable across days

## What Not To Do

- do not broad-run the specials fallback across all bars/restaurants yet
- do not treat blocked sources as parser failures
- do not count field presence alone as quality
- do not force weekly hours onto venues whose useful availability is event-led
- do not inflate event volume with low-signal operational spam
- do not patch recurring series integrity manually unless the shared logic is fixed first

## Reporting Format

Every execution cycle should report:

1. rows or venues improved
2. scorecard movement
3. blocked items and why
4. next target set

Preferred summary format:

- `Feed wins`
- `Destination wins`
- `Integrity / blockers`
- `Next tranche`

## Phase Exit Criteria

This phase is complete when all of the following are true:

1. visible future canonical events are `>= 15,750`
2. fixed-hours venue fill is `>= 86%`
3. event-led destination planning fill is `>= 12%`
4. active `venue_specials` are `>= 120`
5. major Atlanta district and anchor gaps are either:
   - genuinely healthy, or
   - explicitly classified as blocked / upstream-empty / destination-first
6. same-source duplicate groups remain `0`
7. no recurring-series corruption is being introduced by the specials lane

## Next Tranche

Start here:

1. normalize and write `Flight Club Atlanta`
2. selective specials rollout on the next `3-5` first-party-friendly Atlanta venues
3. planning-first hydration pass on the next `10` event-led venues
4. rerun the Atlanta scorecard and compare against this baseline
