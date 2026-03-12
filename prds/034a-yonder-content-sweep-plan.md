# Yonder Content Sweep Plan

**Parent PRD:** `prds/034-yonder-adventure-portal.md`  
**Status:** Draft  
**Purpose:** Audit what Yonder can actually launch with using the current Lost City data layer, crawler fleet, and likely near-term source additions before we commit to implementation sequencing.

---

## Why This Exists

Yonder is intentionally more ambitious than a standard city portal. It combines:

- destinations
- outdoor events
- artifacts
- quests
- camping
- conditions intelligence
- trip planning

That ambition is fine. The risk is building UX around content assumptions that are not yet true.

This sweep turns the PRD into an evidence-backed content plan.

---

## Working Thesis

Yonder does **not** need every feature fully populated at launch.

It **does** need enough real inventory to make three promises credible:

1. You can find something worth doing by commitment level.
2. You can discover places and stories you would not have found otherwise.
3. The portal feels alive this weekend, not like a static guidebook.

The sweep should therefore classify content into:

- `launchable now`
- `launchable with metadata enrichment`
- `editorial-only seed`
- `requires new source work`

---

## Current Accessible Surface: What Already Exists In Repo

### A. Outdoor / Adventure Event Sources Already Implemented

These should be audited first because they are already in the crawler fleet or clearly represented in source files:

| Source slug / family | What it likely gives us | Priority |
|---|---|---|
| `atlanta-outdoor-club` | group hikes, outdoor outings, social adventure trips | P0 |
| `blk-hiking-club` | guided hikes and community-led outdoor trips | P0 |
| `rei-atlanta` | outdoor classes, workshops, skills programming | P0 |
| `chattahoochee-riverkeeper` | paddle trips, cleanups, advocacy/outdoor stewardship | P0 |
| `chattahoochee-nature` | hikes, canoe trips, birding, adult/family nature programming | P0 |
| `dunwoody-nature` | hikes, walks, birding, campouts, nature programs | P0 |
| `park-pride` | park cleanups, greenspace workdays, improvement projects | P0 |
| `trees-atlanta` | trail maintenance, nature walks, arbor events | P0 |
| `beltline-fitness` | recurring run club / outdoor fitness along trail infrastructure | P0 |
| `big-peach-running` | social group runs across Atlanta locations | P1 |
| `monday-night-run-club` | recurring social run club | P1 |
| `meetup.outdoors` via `meetup.py` | hiking, kayaking, running, camping-adjacent community events | P1 |
| `central-rock-gym-atlanta` | climbing meetups and recurring climbing events | P1 |
| `bicycle-tours-atlanta` | guided cycling/tour inventory | P1 |
| `atlanta-parks-rec` | public outdoor/fitness/community events | P1 |
| `piedmont-park` | outdoor event density and recurring fitness/social programming | P1 |
| `south-river-forest` | environmental justice / forest stewardship actions | P2 |
| `urban-air-atlanta` | extended “adventure” / ropes-course-adjacent family activity inventory | P3 |

### B. Destination Seeds Already Referenced In Repo

The Yonder PRD already assumes a base layer of trails and parks, and the repo contains supporting work:

- Phase-1 destination set referenced in `prds/034-yonder-adventure-portal.md`
- outdoor venue seeding in `crawlers/scripts/import_outdoor_recreation.py`
- prior Atlanta trail/park work and explore-track editorial research in archived docs

Known seeded or partially seeded examples include:

- Sweetwater Creek State Park
- Chattahoochee River National Recreation Area
- Arabia Mountain
- Shoot the Hooch access point
- REI Atlanta
- climbing gyms / outdoor-recreation retail

### C. Existing Shared Product Substrate Relevant To Yonder

These do not solve Yonder, but they reduce the amount of net-new build required:

- portal routing, theme injection, and vertical dispatch
- find/list/map/detail infrastructure
- source federation and portal-scoped access
- interest channels
- hangs
- outing planner / playbook
- weather-aware city pulse logic that can inform conditions work

---

## Sweep Outputs

The sweep should produce six concrete artifacts:

1. **Outdoor source matrix**
   - source slug
   - source type
   - access method
   - current crawl status
   - event volume
   - freshness
   - metadata quality

2. **Destination matrix**
   - venue/destination
   - activity type
   - commitment tier
   - drive-time confidence
   - metadata completeness
   - image coverage

3. **Artifact candidate list**
   - candidate name
   - type
   - region
   - source of truth
   - editorial effort required

4. **Camping viability matrix**
   - source family
   - inventory type
   - access method
   - booking link quality
   - metadata quality

5. **Conditions intelligence feasibility note**
   - what inputs already exist
   - what rules can be implemented with confidence
   - what destination metadata is still missing

6. **Launch recommendation**
   - what Yonder can credibly ship in Phase 1
   - what should move to later phases
   - what needs manual/editorial seed before design starts

---

## Research Tracks

## Track 1: Existing Outdoor Event Source Audit

**Goal:** Determine which existing sources make Yonder feel alive immediately.

For each P0/P1 source above, answer:

- What is the actual upcoming volume in the next 14 and 30 days?
- What activity types does it reliably cover?
- Does it produce destination-rich records or generic meetup copy?
- Are title, date, image, location, and description quality good enough for Yonder cards?
- Can we infer commitment tier from existing fields plus destination mapping?
- Does it skew urban quick-hit activity, or does it support day-trip/weekend inventory too?

**Method:**

- run dry-run crawls for priority sources
- sample 10-20 items per source
- score each source on:
  - freshness
  - actionability
  - location precision
  - photo quality
  - Yonder fit

**Decision outputs:**

- `core launch source`
- `useful but secondary`
- `low-signal / not worth surfacing in Yonder`

---

## Track 2: Destination Coverage Audit

**Goal:** Validate whether the existing venue layer can support commitment-based outdoor discovery.

Audit buckets:

- urban trails and green spaces
- metro hiking / quick-drive parks
- water access points
- climbing locations
- cycling/run infrastructure
- weekend-trip destinations

For each destination candidate, score:

- name quality
- geo accuracy
- category / activity accuracy
- image availability
- suitability for commitment tiers
- minimum metadata present

**Minimum “launchable destination” metadata:**

- canonical name
- location / geo
- one primary activity framing
- commitment tier
- at least one useful practical field:
  - distance / drive time
  - duration
  - difficulty
  - reservation / permit friction

**Likely output:** a split between destinations already usable, destinations needing metadata enrichment, and destinations still missing from the data layer entirely.

---

## Track 3: Artifact Sweep

**Goal:** Build the proprietary Yonder layer that turns inventory into taste.

Start with the artifact categories from the PRD:

- waterfalls
- viewpoints / fire towers
- swimming holes / river spots
- hidden trails / green spaces
- historic / geological oddities
- urban artifacts

For each candidate artifact, capture:

- parent destination or nearest venue
- artifact type
- why it is interesting
- best season
- difficulty / access caveat
- whether it needs editorial writing or only a short blurb

**Critical rule:** artifacts must be intentionally curated, not bulk-generated from generic place data.

**Target output:**

- 50+ raw candidates
- 20 high-confidence launch candidates
- 5 quest-ready clusters

---

## Track 4: Camping Source and Inventory Audit

**Goal:** Determine whether Camp Finder is launchable as a real comparison surface or should begin as a curated/editorial layer.

Source families to audit:

- Georgia State Parks
- recreation.gov / USFS / National Forest inventory
- Hipcamp
- private campgrounds
- glamping and cabin operators

Questions to answer:

- Is the inventory accessible without auth walls?
- Are booking URLs stable?
- Do we get enough structure to compare options?
- Can we reliably normalize:
  - camp type
  - price range
  - amenities
  - dog-friendliness
  - reservation requirement

**Decision outputs:**

- `full finder ready`
- `curated list + link-out only`
- `defer until better inventory exists`

---

## Track 5: Conditions Intelligence Feasibility

**Goal:** Separate “cool idea” from implementable recommendation logic.

Questions:

- What destination/event metadata do we already have that can map to weather?
- Which recommendations can be automated confidently?
- Which require editorial ops?

Likely early rule buckets:

- after rain -> waterfalls / river volume / mud warnings
- too hot -> water, shaded trails, dawn/sunset suggestions
- nice and mild -> hikes, viewpoints, long trail days
- cold snap -> exposed summits downranked, lowland walks promoted
- seasonal windows -> foliage, wildflowers, leaf-off views

**Output:** a v1 conditions matrix that only includes recommendation rules we can defend with current data.

---

## Track 6: Planning and Social Reuse Audit

**Goal:** Decide what Yonder can inherit from existing planning primitives versus what must be built new.

Audit existing substrate:

- `hangs`
- outing planner
- playbook

Questions:

- Can existing planning flows support destination-first adventure planning?
- What is reusable for trip coordination versus nightlife/event planning only?
- What should be extended versus replaced?

**Likely answer:** use current planning primitives as the starting substrate, but do not promise full `trip_hangs` scope until the reuse audit is complete.

---

## Initial Scoring Rubric

Every audited content bucket should be scored on five dimensions:

| Dimension | Question |
|---|---|
| Volume | Is there enough inventory for repeat use? |
| Freshness | Does the content stay current without heroic manual effort? |
| Specificity | Does it help the user choose, or is it generic filler? |
| Structure | Do we have enough metadata to rank/filter/present it well? |
| Differentiation | Does it make Yonder feel unique, or could any portal do this? |

Use a 1-5 scale and prioritize content with a strong `specificity + differentiation` score even if raw volume is lower.

---

## Launch Readiness Thresholds

Yonder should not move from sweep to design/build assumptions until these are true:

### Minimum viable launch floor

- 8-12 dependable outdoor event sources with useful current inventory
- 30+ launchable destinations across the commitment spectrum
- 20+ strong artifact candidates already identified
- 10+ camping candidates with stable booking/link-out paths
- enough weather/destination metadata to support a **small** conditions module honestly

### Stronger launch target

- 12-15 outdoor/adventure source families
- 50+ launchable destinations
- 50+ artifact candidates
- 20+ camping candidates
- 5 quest-ready editorial clusters

---

## Recommended Sequence After The Sweep

If the sweep confirms the likely shape, the build order should be:

1. commitment-based discovery + destination enrichment
2. artifact seed + quest framing
3. conditions intelligence
4. camp finder
5. trip hangs extension

This keeps Yonder focused on the “find something worth doing” loop before it expands into heavier planning features.

---

## Immediate Next Actions

1. Run dry-run audits on the P0 outdoor event source pack.
2. Produce a destination spreadsheet from existing trail/park/outdoor venue seeds.
3. Build the first artifact candidate list from PRD targets plus archived trail research.
4. Audit camping source feasibility before promising a full search UX.
5. Convert findings into `034b-yonder-content-assessment.md` once evidence is gathered.
