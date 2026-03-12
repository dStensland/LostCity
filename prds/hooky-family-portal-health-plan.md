# Hooky Family Portal Health Plan

**Portal:** `hooky`  
**Surface:** `consumer`  
**Status:** Active plan  
**Last Updated:** 2026-03-11  
**Depends on:** `prds/035-hooky-family-portal.md`, `prds/hooky-content-research-plan.md`, `prds/hooky-family-program-workstream.md`, `prds/hooky-next-big-effort-workstream.md`, `prds/atlanta-hooky-activity-layer-large-effort.md`

---

## Purpose

This plan turns the current Hooky state into a full health-improvement program.

The question is no longer whether Hooky can ingest family programs.

It can.

The question now is how to turn that crawler progress into a healthy family portal:

- broad enough to feel useful every week
- structured enough to earn trust during planning moments
- stable enough to run without constant cleanup
- clear enough to support the actual Hooky product surfaces

The next major execution block after the current family-program push is now defined in:

- `prds/hooky-next-big-effort-workstream.md`
- `prds/atlanta-hooky-activity-layer-large-effort.md`

That workstream shifts the portal from "programs are real" to "family planning is broadly useful,"
with Atlanta as the primary owner of reusable activity/destination intelligence and Hooky as the
family-facing federated consumer. The large-effort document also makes the current repo hygiene
constraint explicit: live data is in good shape, but the worktree is not globally clean enough to
package this effort safely without an isolation step.

---

## Current Health Read

### What is healthy now

1. The program map is real.
2. The source-registration blocker is resolved.
3. The first-wave family-program pack is large enough to support real portal planning use cases.
4. Pattern risk is lower than it was at the start of the workstream because multiple source families are now proven.

### Concrete evidence

- `39` Hooky family-program sources are now activated in the live DB and subscribed into Atlanta.
- `104` targeted family-program tests are passing as a grouped sweep.
- High-value categories now have meaningful official-source depth:
  - school camps
  - STEM / specialty
  - swim / movement
  - arts / performance
  - institution-led camps
  - some civic / parks inventory

### What is not healthy yet

1. Civic and municipal breadth is still lighter than the private / school / institution lanes.
   The newest `Gwinnett`, `Cobb`, `Atlanta`, and `DeKalb` family-program wrappers improve that gap, but the
   public lane is now materially populated, but it still needs scorecard-level validation
   after the cleanup rerun on the broad `ACTIVENet` wrappers.
2. Taxonomy quality is uneven on some newer sources:
   - venue types
   - vibes
   - some provider-to-venue mappings
3. Product-readiness is behind crawler-readiness:
   - we have inventory, but not yet a formal feed-quality acceptance model
   - we have camp/program rows, but not yet a launch-quality compare / browse readiness audit
4. Documentation is slightly behind reality:
   - the family-program workstream still contains old DB-blocked notes that are now stale

---

## Health Goals

Hooky is healthy when all four are true:

1. **Coverage health**
   The portal has enough weekly and seasonal inventory across the major family planning moments.

2. **Trust health**
   Families can rely on age fit, timing, registration destination, and price/status signals often enough that Hooky feels safer than an aggregator.

3. **Operational health**
   The source pack runs without hidden activation gaps, repeated taxonomy drift, or pattern-level breakage.

4. **Product health**
   The inventory is shaped well enough to drive:
   - `This Weekend`
   - `Heads Up`
   - `Programs Starting Soon`
   - `Camp Season`
   - compare/browse flows

---

## Workstreams

## W1. Stabilize The Existing Pack

**Goal:** make the current family-program inventory operationally trustworthy before widening further.

### Tasks

- remove stale DB-blocked notes from the Hooky workstream docs
- audit the currently activated family-program sources for:
  - source row present
  - Hooky ownership present
  - Atlanta subscription present
  - dry-run success
- fix recurring taxonomy warnings on the existing pack:
  - invalid `venue_type`
  - invalid `vibes`
  - weak provider venue definitions
- create a small family-program health checklist per source:
  - row count
  - age-fit quality
  - price quality
  - registration destination quality
  - location quality

### Output

- corrected workstream docs
- source health ledger
- reduced warning count on the current pack

### Exit gate

- every current family-program source resolves in DB
- every current source can dry-run without source-registration failure
- taxonomy warnings are reduced to known exceptions, not ambient noise

---

## W2. Close The Civic Breadth Gap

**Goal:** fix the clearest current weakness in Hooky’s family-portal health.

### Why this matters

The current map is strongest in private, school, and institution-led programs.

That is good for quality and monetizable depth.

It is not enough for weekly family utility.

Public and civic sources are what make Hooky feel like a dependable local planning layer instead of a camp catalog.

Current state after the 2026-03-11 civic write sweep:

- Hooky now has `230` future civic/public family-program rows in
  the live DB across `atlanta-family-programs`, `dekalb-family-programs`,
  `gwinnett-family-programs`, `milton-parks-rec`, `chamblee-parks-rec`, and
  `cobb-family-programs`
- the grouped sweep reads `19` venue hits, `82.0%` mean age coverage,
  `94.1%` mean price coverage, and `100.0%` ticket coverage
- the blocker has shifted from source activation to wrapper quality:
  - shared DB validation now normalizes `programs -> family`, which unblocked public
    production writes
  - the shared `ACTIVENet` family filter was tightened after live writes exposed adult
    leakage in Atlanta-style catalogs
  - Atlanta and DeKalb should be rerun under the stricter filter before the civic lane
    is called healthy

### Priority targets

1. one more metro-relevant `MyRec` or similar public rec operator
2. one more reachable public / municipal family-program catalog
3. one more official parks or outdoor youth-program surface with recurring local inventory

### Tasks

- rank reachable civic candidates by:
  - public accessibility
  - age-signal quality
  - week-to-week volume
  - category diversity
  - platform reusability
- implement the top 2-3 candidates
- validate whether they materially improve:
  - younger-kid balance
  - after-school / no-school utility
  - neighborhood spread

### Output

- broader civic program layer
- revised metro coverage map

### Exit gate

- Hooky has more than one credible public-family-program operator family
- civic inventory is no longer obviously thin relative to school/private lanes

---

## W3. Build A Family Inventory Scorecard

**Goal:** stop relying on anecdotal confidence and start grading the family portal like a product.

### Scorecard dimensions

Each source and each content lane should be scored on:

- volume
- freshness
- age-fit quality
- registration trust
- price completeness
- location quality
- category diversity
- seasonal importance
- planning usefulness

### Tasks

- define a source score rubric from `0-3` per dimension
- score the current `35` family-program sources
- roll those source scores up into lane-level health:
  - school camps
  - STEM / specialty
  - swim / movement
  - arts / performance
  - civic / municipal
  - museum / institution
- identify:
  - strong lanes
  - weak lanes
  - fragile lanes that depend on only one or two sources

### Output

- Hooky family inventory scorecard
- lane heat map
- explicit backlog priorities based on health, not instinct

### Exit gate

- every major family lane has a visible health score
- the next crawler backlog is driven by health deficits

---

## W4. Product-Readiness Audit For Core Hooky Surfaces

**Goal:** verify that the current inventory actually supports the surfaces promised in PRD-035.

### Surfaces to audit

1. `This Weekend`
2. `Heads Up`
3. `Programs Starting Soon`
4. `Free This Week`
5. `Camp Season`
6. compare-ready programs

### Tasks

- define minimum inventory requirements for each surface
- sample current data against each requirement
- identify where the issue is:
  - not enough rows
  - rows present but weakly normalized
  - category imbalance
  - weak timing / status signals
- create a product-readiness matrix:
  - ready
  - usable but thin
  - blocked by data gaps

### Output

- page/surface readiness matrix
- launch blockers list

### Exit gate

- Hooky can defend the main promised surfaces with actual inventory evidence

---

## W5. Trust And Normalization Hardening

**Goal:** improve the reliability of the fields families care about most.

### Highest-value fields

- age fit
- date/session logic
- price
- registration destination
- registration status
- location

### Tasks

- audit the highest-traffic / highest-value sources for these fields
- separate issues into:
  - source limitation
  - parser bug
  - normalization gap
  - taxonomy gap
- prioritize fixes where they improve:
  - compare usefulness
  - camp-season decision support
  - panic-moment confidence

### Special focus

- formalize when `price_min/price_max` should be exact vs range vs note-only
- formalize when `age_min/age_max` are exact vs inferred vs unknown
- add explicit handling notes for mixed-track camp pages like Dunwoody

### Output

- normalization rules addendum
- field-quality backlog

### Exit gate

- top-tier family sources have reliable age/date/registration fields
- known field ambiguity is explicit, not hidden

---

## W6. Seasonal Launch Readiness

**Goal:** make Hooky genuinely strong for the next major family planning moments.

### Near-term seasonal moments

1. weekly family discovery
2. no-school / teacher-workday utility
3. summer camp comparison and signup support

### Tasks

- define the launch set for weekly utility
- define the launch set for camp-season utility
- define the minimum “heads up” signals Hooky needs:
  - school breaks
  - registration windows
  - programs starting soon
- identify which of those are already possible with current data and which still need data work

### Output

- seasonal readiness checklist
- `must-have before launch` list
- `good enough for beta` list

### Exit gate

- Hooky can answer the top family planning questions with confidence for at least one major season

---

## Sequence

### Phase 1: clean and stabilize

1. finish DB/documentation cleanup
2. build the family inventory scorecard
3. audit and fix the most visible taxonomy/normalization drift

### Activity-layer progress note

The next-big-effort activity layer has moved from planning into live Atlanta-owned execution:

- `53` activity targets are now live in the Atlanta-owned overlay program
- `158` new activity overlays were applied across the first overlay sweep, wave 2, the Urban Air location batch, wave 3, wave 4, the Catch Air batch, the family-fun batch, the family-outings batch, the water / farm / fun batch, the trampoline-and-farms batch, and the final-destinations batch
- this should now be treated as a real Hooky health input, not just future roadmap
- Hooky-side federation rules for that pack now live in `prds/hooky-activity-federation-rules.md`

### Phase 2: widen the weakest lane

1. add 2-3 civic/public sources
2. re-score portal health
3. confirm metro breadth is improving, not just source count

### Phase 3: prove product readiness

1. run surface-readiness audit
2. identify remaining blockers for:
   - weekend feed
   - heads-up moments
   - camp season
3. convert blockers into targeted crawler or normalization work

### Phase 4: launch discipline

1. freeze the first health scorecard
2. define weekly monitoring
3. only then keep expanding the map

---

## Metrics

These are the core portal-health metrics to track weekly:

- active Hooky family-program source count
- dry-run success rate across the family source pack
- source rows by family lane
- percentage of rows with explicit age fit
- percentage of rows with usable price signal
- percentage of rows with official registration destination
- count of sources with unresolved taxonomy warnings
- count of surfaces marked `ready` vs `thin` vs `blocked`

---

## Immediate Next Actions

1. Update the family-program workstream doc so the old DB-blocked notes are removed.
2. Build and maintain a family inventory scorecard for the active `35` family-program sources.
3. Run a product-readiness audit for:
   - `This Weekend`
   - `Programs Starting Soon`
   - `Camp Season`
4. Start the next civic/public source batch from the top-ranked reachable candidates.

---

## Success Condition

Hooky family portal health is strong when:

- the current source pack is stable
- civic/public coverage is no longer the obvious weakness
- the highest-value fields are reliable enough for planning
- the main Hooky surfaces are supported by real inventory
- the next backlog is driven by measured health gaps, not guesswork

Until then, the right move is disciplined health building, not just more source count.
