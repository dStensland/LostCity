# Hooky Family Inventory Scorecard

**Portal:** `hooky`  
**Surface:** `consumer`  
**Status:** Active scorecard  
**Last Updated:** 2026-03-11  
**Depends on:** `prds/hooky-family-portal-health-plan.md`, `prds/hooky-family-program-workstream.md`

---

## Purpose

This scorecard grades the current Hooky family-program pack as a product surface,
not just a crawler accomplishment.

It answers:

- which lanes are strong enough to trust
- which lanes are thin or fragile
- which sources are foundational
- where the next crawler work should go

---

## Scope

This scorecard covers the current Hooky family-program source pack.

- `39` active family-program sources
- currently subscribed into Atlanta
- backed by the grouped family-program test sweep (`104` targeted tests passing)

It does **not** score:

- generic family-event feeds
- school-calendar data
- non-program event inventory

Current note:

- the civic/public wrapper pack is now materially live, not just activated
- a 2026-03-11 production civic write sweep now reads `230`
  future civic/public rows across:
  - `atlanta-family-programs` (`43`)
  - `dekalb-family-programs` (`67`)
  - `gwinnett-family-programs` (`50`)
  - `milton-parks-rec` (`31`)
  - `chamblee-parks-rec` (`10`)
  - `cobb-family-programs` (`29`)
- the grouped civic sweep now reads `19` venue hits, `82.0%` mean age coverage,
  `94.1%` mean price coverage, and `100.0%` ticket coverage
- the public lane still needs one cleanup rerun before the wrapper pack should be fully
  rescored, because live writes exposed adult-leakage on broad `ACTIVENet` catalogs and
  the shared family filter was tightened afterward

---

## Rubric

Each source is scored `0-3` on six dimensions.

### Dimensions

- `volume`
  - `0` negligible or too thin to matter
  - `1` small but useful
  - `2` solid weekly/seasonal contribution
  - `3` major inventory driver

- `age_fit`
  - `0` weak or absent age signal
  - `1` partial / banded / inconsistent
  - `2` mostly strong
  - `3` explicit and consistently useful

- `price_status`
  - `0` weak or mostly missing
  - `1` partial notes only
  - `2` usually useful
  - `3` strong and compare-ready

- `location_trust`
  - `0` weak location or venue identity
  - `1` usable but thin
  - `2` strong enough for planning
  - `3` highly reliable venue/location signal

- `planning_value`
  - `0` low-signal filler
  - `1` niche or marginal utility
  - `2` useful planning inventory
  - `3` high-value planning inventory

- `ops_confidence`
  - `0` fragile or repeatedly blocked
  - `1` works but brittle
  - `2` reasonably stable
  - `3` highly repeatable / pattern-strong

### Overall score

Overall source score = average of the six dimensions.

Interpretation:

- `2.5 - 3.0`: foundation source
- `2.0 - 2.4`: strong supporting source
- `1.5 - 1.9`: useful but thin / fragile
- `<1.5`: not strong enough to drive the lane

---

## Lane Heat Map

| Lane | Health | Read |
|---|---:|---|
| school camps | `2.7` | strongest lane; deep and structurally proven |
| museum / institution camps | `2.5` | strong seasonal utility with good trust |
| STEM / specialty enrichment | `2.4` | strong enough, but still concentrated in a few operators |
| arts / performance | `2.1` | good breadth, but many sources are small or seasonal |
| swim / movement | `2.0` | useful, but still narrow and not yet metro-wide |
| civic / municipal | `2.0` | no longer empty, but still the least stable lane because filter hardening is in flight |

### Lane conclusions

- **Strongest health:** school camps, museum/institution, core STEM
- **Good but not dominant:** arts/performance
- **Needs broadening:** swim/movement
- **Most urgent gap:** civic/municipal quality hardening, then broader public coverage

---

## Source Scorecard

| Source | Lane | Vol | Age | Price | Location | Planning | Ops | Overall |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `woodward-summer-camps` | school camps | 3 | 2 | 2 | 2 | 3 | 2 | `2.3` |
| `trinity-summer-camps` | school camps | 3 | 2 | 2 | 2 | 3 | 2 | `2.3` |
| `walker-summer-programs` | school camps | 3 | 2 | 2 | 2 | 3 | 2 | `2.3` |
| `pace-summer-programs` | school camps | 3 | 2 | 2 | 2 | 3 | 2 | `2.3` |
| `lovett-summer-programs` | school camps | 2 | 2 | 1 | 1 | 2 | 2 | `1.7` |
| `wesleyan-summer-camps` | school camps | 2 | 2 | 2 | 2 | 3 | 2 | `2.2` |
| `greater-atlanta-christian-specialty-camps` | school camps | 2 | 2 | 2 | 2 | 2 | 2 | `2.0` |
| `swift-summer-programs` | school camps | 1 | 2 | 2 | 2 | 2 | 2 | `1.8` |
| `marist-school` | school camps / civic-style rec | 2 | 2 | 2 | 2 | 2 | 3 | `2.2` |
| `club-scikidz-atlanta` | STEM / specialty | 3 | 3 | 2 | 2 | 3 | 2 | `2.5` |
| `mjcca-day-camps` | STEM / specialty / multi-program | 3 | 2 | 2 | 2 | 3 | 2 | `2.3` |
| `camp-invention-atlanta` | STEM / specialty | 1 | 2 | 1 | 2 | 2 | 2 | `1.7` |
| `kid-chess` | STEM / specialty | 1 | 2 | 2 | 2 | 2 | 2 | `1.8` |
| `dunwoody-summer-camp` | nature / outdoor | 2 | 2 | 2 | 2 | 3 | 2 | `2.2` |
| `dunwoody-island-ford-camps` | nature / outdoor | 1 | 3 | 3 | 3 | 2 | 2 | `2.3` |
| `frazer-nature-camp` | nature / outdoor | 1 | 3 | 2 | 2 | 2 | 2 | `2.0` |
| `blue-heron-summer-camps` | nature / outdoor | 1 | 2 | 1 | 2 | 2 | 2 | `1.7` |
| `piedmont-park-enviroventures-camp` | nature / outdoor / civic | 1 | 2 | 2 | 3 | 2 | 2 | `2.0` |
| `big-blue-swim-johns-creek` | swim / movement | 2 | 3 | 2 | 2 | 2 | 2 | `2.2` |
| `diventures-alpharetta-swim` | swim / movement | 1 | 2 | 1 | 2 | 2 | 2 | `1.7` |
| `nellya-beginner-camps` | movement / specialty | 1 | 2 | 1 | 2 | 1 | 2 | `1.5` |
| `atlanta-ballet-centre-summer-programs` | arts / performance / movement | 2 | 2 | 2 | 2 | 2 | 2 | `2.0` |
| `dads-garage-camps` | arts / performance | 2 | 2 | 2 | 2 | 2 | 2 | `2.0` |
| `spruill-summer-camps` | arts / performance | 2 | 2 | 2 | 2 | 2 | 2 | `2.0` |
| `vinings-school-of-art-summer-camps` | arts / performance | 1 | 2 | 2 | 2 | 2 | 2 | `1.8` |
| `callanwolde-creative-camps` | arts / performance | 1 | 0 | 1 | 2 | 1 | 2 | `1.2` |
| `mister-johns-music-summer-camp` | arts / performance | 1 | 2 | 2 | 2 | 1 | 2 | `1.7` |
| `high-museum-summer-art-camp` | museum / institution | 2 | 3 | 2 | 3 | 3 | 2 | `2.5` |
| `zoo-atlanta-summer-safari-camp` | museum / institution | 2 | 3 | 2 | 3 | 3 | 2 | `2.5` |
| `georgia-aquarium-camp-h2o` | museum / institution | 2 | 3 | 2 | 3 | 3 | 2 | `2.5` |
| `fernbank-summer-camp` | museum / institution | 2 | 3 | 2 | 3 | 2 | 2 | `2.3` |
| `atlanta-botanical-garden-camps` | museum / institution | 1 | 3 | 3 | 3 | 2 | 2 | `2.3` |
| `girl-scouts-greater-atlanta-camps` | civic / youth network | 2 | 2 | 1 | 2 | 2 | 2 | `1.8` |
| `milton-parks-rec` | civic / municipal | 3 | 2 | 1 | 2 | 3 | 2 | `2.2` |
| `chamblee-parks-rec` | civic / municipal | 2 | 2 | 1 | 2 | 2 | 3 | `2.0` |

---

## What The Scorecard Says

## Strong foundation sources

These are currently the best building blocks for Hooky’s perceived quality:

- `club-scikidz-atlanta`
- `high-museum-summer-art-camp`
- `zoo-atlanta-summer-safari-camp`
- `georgia-aquarium-camp-h2o`
- `trinity-summer-camps`
- `walker-summer-programs`
- `pace-summer-programs`
- `woodward-summer-camps`
- `milton-parks-rec`
- `dunwoody-island-ford-camps`

These sources either drive meaningful depth or offer unusually strong trust signals.

## Useful but thin sources

These help coverage, but they do not carry their lane:

- `swift-summer-programs`
- `kid-chess`
- `camp-invention-atlanta`
- `blue-heron-summer-camps`
- `vinings-school-of-art-summer-camps`
- `mister-johns-music-summer-camp`
- `diventures-alpharetta-swim`
- `nellya-beginner-camps`

These should not define roadmap confidence by themselves.

## Fragile / quality-constrained sources

These are currently live and useful, but they highlight field-quality gaps:

- `callanwolde-creative-camps`
  - dates and registration trust are good
  - age-fit is still weak on the public surface

- `lovett-summer-programs`
  - volume is healthy
  - trustable deep destination quality is weaker than the better school hubs

- `girl-scouts-greater-atlanta-camps`
  - strong brand and real inventory
  - registration/pricing normalization is less compare-ready than the best camp operators

---

## Biggest Health Gaps

## 1. Civic / municipal breadth

This is no longer the emptiest lane, but it is still the least mature one.

Why:

- the public-family wrapper pack only just became materially populated
- broad civic catalogs are more prone to adult leakage and noisy mixed-audience inventory
- civic inventory matters disproportionately for weekly utility
- private/school depth cannot fully substitute for public neighborhood coverage

### Consequence

Hooky is materially closer to a dependable family planning layer, but the public lane
still needs one cleanup pass before it becomes fully trustworthy.

## 2. Compare-readiness outside the best lanes

The strongest sources expose age, dates, location, and price clearly.

That is not yet true consistently across the full pack.

### Consequence

Hooky can support camp/program comparison in some lanes better than others, which creates uneven user trust.

## 3. Lane concentration risk

Some lanes feel healthy because one or two large sources are doing most of the work.

Examples:

- STEM relies heavily on `club-scikidz-atlanta` and `mjcca-day-camps`
- civic still relies too heavily on `milton-parks-rec`, `gwinnett-family-programs`, and
  the in-flight Atlanta/DeKalb wrappers relative to the rest of the public lane
- museum/institution is strong, but still seasonal

### Consequence

If one strong operator changes shape, a lane can degrade quickly.

---

## Backlog Implications

## Priority 1

Add `2-3` more civic/public family-program sources before widening private camp depth further.

That is the cleanest way to improve weekly utility and metro balance.

## Priority 2

Run trust/normalization hardening on the weakest useful sources:

- `callanwolde-creative-camps`
- `lovett-summer-programs`
- `girl-scouts-greater-atlanta-camps`
- `diventures-alpharetta-swim`

## Priority 3

Use the strong sources to define product-readiness gates for:

- `This Weekend`
- `Programs Starting Soon`
- `Camp Season`

---

## Recommended Sequence

1. fix stale workstream notes and keep DB reality in sync
2. expand civic/public coverage
3. harden weak but useful field-quality sources
4. run surface-readiness audit using this scorecard as the inventory baseline

---

## Bottom Line

Hooky family inventory health is now **good enough to build on, but not balanced enough to stop.**

The pack is strongest where official private, school, and institutional operators are structurally rich.

The portal is weakest where real family habit depends on public local breadth.

So the right move is clear:

- do **not** chase more random source count
- do **not** overinvest in already-strong school/private lanes
- **do** close the civic/public gap and harden field trust in the weakest supporting sources
