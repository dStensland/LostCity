# Yonder Category Content Analysis

**Parent docs:** `prds/034-yonder-adventure-portal.md`, `prds/034c-yonder-source-audit.md`, `prds/034d-yonder-destination-inventory.md`, `docs/portal-factory/runs/yonder-provisioning-run-001-source-foundation.md`  
**Status:** Draft  
**As of:** 2026-03-10  
**Purpose:** Give a grounded picture of what the draft Yonder portal can actually support by content lane, commitment tier, and destination depth, including the first live source-refresh pass after recovery work.

---

## 1. Executive Read

Yonder is now strong enough to support a real **discovery-first outdoor portal** for:

- `an hour`
- `half day`
- metro / near-metro nature
- running / movement
- stewardship / community outdoor activity
- curated day-trip adventure
- a first credible regional `full day` and curated `weekend` shelf
- a real `halfday` support layer that now includes river and close-in water access
- a first credible water-access and operator-led rafting lane

Yonder is **not yet strong enough** to fully support the PRD’s broader promise around:

- `weekend` / overnighters / camping
- water-first adventure at full destination density
- conditions intelligence
- artifacts / quests as a product loop

The main reason is no longer source registration. That part is largely solved.

Phase 0 changed the source picture materially:

- Yonder now has `357` upcoming events in the next `30` days across the actual v1 source pack, up from `287`
- `atlanta-outdoor-club` is now a real live source, not a theoretical recovery
- the next source-side risks are now quality and fit, not basic activation

The actual remaining risk has shifted to:

1. incomplete structured regional destination enrichment
2. missing structured outdoor metadata
3. uneven source quality in the recovery lane
4. unbuilt product capabilities for artifacts, quests, camping, and trip planning
5. limited support-layer density beyond the first 31 promoted anchors

---

## 2. Portal Snapshot

Current draft portal state:

- portal slug: `yonder`
- portal status: `draft`
- parent portal: `atlanta`
- active source subscriptions: `11`
- active channels: `6`
- active channel rules: `17`

Current launch-pack source list:

- `atlanta-outdoor-club`
- `blk-hiking-club`
- `meetup`
- `big-peach-running`
- `chattahoochee-nature`
- `piedmont-park`
- `trees-atlanta`
- `chattahoochee-riverkeeper`
- `park-pride`
- `central-rock-gym-atlanta`
- `dunwoody-nature`

Important exclusion:

- `rei-atlanta` is registered but removed from the v1 source pack because the crawler still fails on `ERR_HTTP2_PROTOCOL_ERROR`

---

## 3. Live Inventory Mix

### 3.1 Upcoming event counts by active Yonder source

Next `14` and `30` day counts from the current live DB as seen by Yonder:

| Source | Next 14 | Next 30 | Read |
|---|---:|---:|---|
| `meetup` | 76 | 91 | highest-volume source, broad but noisy |
| `chattahoochee-nature` | 51 | 82 | strongest structured nature source |
| `atlanta-outdoor-club` | 51 | 71 | now a core live adventure source |
| `piedmont-park` | 21 | 45 | strong metro outdoor/social utility |
| `big-peach-running` | 16 | 38 | strong recurring movement loop |
| `trees-atlanta` | 20 | 20 | stewardship + guided outdoor work |
| `chattahoochee-riverkeeper` | 4 | 4 | low volume, high signal |
| `central-rock-gym-atlanta` | 1 | 2 | real but niche |
| `park-pride` | 2 | 2 | small but useful |
| `blk-hiking-club` | 1 | 2 | now live, but still low-volume |
| `dunwoody-nature` | 0 | 0 | active source, currently empty |

Net effect:

- total upcoming events in next `30` days increased from `287` to `357`
- Atlanta Outdoor Club is now Yonder’s third-largest live source
- the portal now has materially better support for `half day` and curated `full day` discovery

### 3.2 What the live event table says about category mix

Current live category counts for Yonder’s active pack in the next `30` days:

| Category | Next 14 | Next 30 | Read |
|---|---:|---:|---|
| `Community` | n/a | 117 | now inflated by Atlanta Outdoor Club’s generic mapping |
| `Fitness` | n/a | 91 | running plus a small amount of rec-program spillover |
| `Meetup` | n/a | 91 | useful volume, poor precision for Yonder IA |
| `Art` | 35 | 52 | some of this is outdoor/public programming noise |
| `Learning` | n/a | 3 | weak |
| `Family` | 2 | 2 | present but thin |
| `Outdoors` | n/a | 2 | far too low for Yonder’s intended brand |
| `Food & Drink` | 0 | 1 | incidental |
| `Music` | 1 | 1 | incidental |
| `Sports` | 1 | 1 | incidental |

Interpretation:

- the raw category model is not sufficient for Yonder
- Atlanta Outdoor Club adds strong adventure inventory, but generic categories still flatten too much of it into `Community`
- Yonder’s “outdoor portal” reality is being carried by tags and source selection much more than by clean category semantics
- this is why commitment and activity lanes need explicit Yonder logic instead of relying on the generic event taxonomy

### 3.3 Tag / lane signal in the current live pack

Tag-derived lane grouping for next `30` days:

| Derived lane | Count | Read |
|---|---:|---|
| `hiking / walking / nature` | 161 | strongest lane by far |
| `other / misc` | 73 | too much leftover ambiguity |
| `running` | 39 | healthy, repeatable, low-friction |
| `stewardship` | 10 | meaningful but narrow |
| `skills / classes` | 2 | almost absent |
| `climbing` | 2 | exists, but too thin to carry a major lane |

Top live tags in the next `30` days:

- `free` `193`
- `outdoor` `139`
- `family-friendly` `70`
- `weekly` `69`
- `running` `40`
- `education` `35`
- `nature` `30`
- `hiking` `26`
- `volunteer` `23`
- `environment` `22`

Interpretation:

- Yonder already has enough live density to answer “what can I do outside soon?”
- Yonder still does not have enough live event density to answer “what serious adventure should I plan this weekend?” with confidence on freshness alone

---

## 4. Phase 0 Source Refresh Results

The first live qualification pass changed the source picture.

### `atlanta-outdoor-club`

- status: recovered and written live
- live crawl result: `125 found, 122 new, 0 updated, 2 rejected`
- current live contribution:
  - `51` upcoming in next `14` days
  - `71` upcoming in next `30` days
  - `91` upcoming in next `60` days
  - `103` upcoming in next `90` days
- key read:
  - this is now a core Yonder source
  - it materially improves `half day`
  - it makes curated `full day` real
  - it adds strong weekend-day supply, but not enough to solve overnight/camping depth

### `blk-hiking-club`

- status: recovered and now live
- latest live crawl result: `2 found, 2 new, 0 updated`
- current live contribution:
  - `1` upcoming in next `14` days
  - `2` upcoming in next `30` days
- current read:
  - the title-extraction blocker is resolved
  - BLK now adds a small but identity-rich hiking lane
  - the remaining issue is volume, not extraction correctness

### `atlanta-parks-rec`

- status: removed from the active Yonder v1 source pack
- live qualification read:
  - source exposes `774` records across `39` pages
  - run was terminated intentionally during qualification to avoid a blind bulk ingest
  - only `9` events currently exist from the source, with `6` upcoming in the next `30` days
- sample upcoming inventory:
  - swim team programs
  - aquatics training
  - general rec-center fitness
- implication:
  - this is not a broken crawler problem
  - it is a source-fit problem
  - Atlanta Parks Rec should stay outside Yonder’s core adventure lane until filtered or scoped
  - it is not part of the current launch-pack assumptions

### `rei-atlanta`

- status: still blocked
- issue: browser transport / anti-bot failure
- impact: hurts:
  - skills/classes
  - beginner outdoor education
  - gear-adjacent planning utility

---

## 5. Commitment-Tier Analysis

## 5.1 `AN HOUR`

**State:** strong

What supports it now:

- `meetup`
- `big-peach-running`
- `chattahoochee-nature`
- `piedmont-park`
- `trees-atlanta`

What it does well:

- quick outdoor activity
- recurring movement
- low-friction community participation
- close-in nature programming

Main risks:

- some inventory is “outside-ish” rather than distinctly adventurous
- still needs better curation to avoid drifting into generic city activity

## 5.2 `HALF DAY`

**State:** strong**

What supports it:

- live: metro nature centers, Meetup outdoor clusters, running, climbing gym events
- live: Atlanta Outdoor Club
- live: BLK Hiking Club

What it can become quickly:

- Yonder’s most defensible lane after `an hour`
- the best balance between high frequency and real adventure identity

Main risks:

- too much category flattening under `Community`
- still needs better destination metadata so `half day` means more than source vibe

## 5.3 `FULL DAY`

**State:** improved, but still destination-constrained**

What supports it now:

- Atlanta Outdoor Club
- some implied inventory from general hiking / outdoor tags
- a small regional/weekend-day event layer

What could improve it:

- BLK Hiking Club title/parser fix
- stronger regional destination coverage

Main risks:

- current feed can now prove some full-day adventure, but not at the destination depth the PRD implies
- weak destination graph makes this feel editorially asserted rather than structurally supported

## 5.4 `WEEKEND`

**State:** still a risk area, but more nuanced**

What supports it now:

- weekend-day event volume is no longer empty
- rough next-30-day Saturday/Sunday counts include:
  - `meetup` `41`
  - `atlanta-outdoor-club` `35`
  - `chattahoochee-nature` `28`
  - `piedmont-park` `20`
  - `trees-atlanta` `15`

Why it is weak:

- no true camping surface
- no robust overnighter / backpacking / rafting source mix
- only a thin booking-aware weekend support layer, not campsite inventory deep enough to make overnight planning feel complete
- no trip-planning or conditions layer to turn sparse inventory into high-confidence recommendations

Bottom line:

- this is still the clearest Yonder content weakness
- the portal can now support curated weekend escapes better than before
- it still cannot honestly position itself as a complete weekend / overnighter platform

Current Wave 6 read:

- promoted weekend anchors now have `13/13` explicit booking-decision coverage
- `11/13` currently carry a direct reservation URL
- this closes the “every weekend card feels the same” problem on the promoted set
- it does not yet create a true campsite, lodging-comparison, or booking-availability layer

Current Wave 7 read:

- promoted weekend anchors now have `13/13` explicit overnight-support coverage in the Yonder bridge
- the current weekend set now distinguishes `camp_capable`, `cabin_capable`, `lodge_capable`, `operator_bookable`, and `day_use_only`
- that materially improves weekend semantics without a schema change
- the next gap is still unit-level inventory and availability, not weekend-type ambiguity

Current Wave 8 read:

- promoted weekend anchors now have `13/13` explicit stay-option coverage
- the bridge now expresses concrete stay shapes like tent sites, cabins, lodge rooms, guide packages, and self-planned scenic objectives
- the bridge now also normalizes the booking surface across state parks, direct lodge flow, direct operators, and self-planned objectives
- that improves Yonder’s ability to explain the overnight setup, not just the booking posture
- the next gap is still live unit availability and comparison depth, not stay-option semantics

Current Wave 9 read:

- promoted weekend anchors now have `13/13` comparison-ready stay-profile coverage
- the bridge now expresses inventory depth, planning lead time, and coarse price signal for every weekend anchor
- that gives Yonder a real comparison layer for weekend shelves and detail pages
- the next gap is still actual availability, live pricing, and unit counts

Current Wave 10 read:

- promoted weekend anchors now have `13/13` accommodation-inventory source coverage
- weekend providers are now normalized across `ga_state_parks`, `unicoi_lodge`, `whitewater_express`, and `self_guided`
- Yonder can now distinguish provider-backed unit mix from self-guided weekend objectives
- the next gap is still real availability integration and exact provider inventory counts

---

## 6. Activity-Lane Analysis

## 6.1 Hiking / Trails / Nature

**State:** strongest lane**

Strengths:

- best overall signal density
- multiple source types
- aligns cleanly with Yonder brand
- improves substantially once Atlanta Outdoor Club writes are live

Weaknesses:

- too much tag-derived logic, not enough structured destination metadata
- regional trail depth is still incomplete

## 6.2 Running / Outdoor Movement

**State:** strong**

Strengths:

- recurring inventory
- social / low-friction activation
- good return-visit loop

Weaknesses:

- can start to tilt Yonder toward “outdoor fitness” if not balanced by more destination-driven adventure

## 6.3 Stewardship / Volunteer Outdoors

**State:** meaningful but secondary**

Strengths:

- good mission alignment
- clear partner and community value
- high signal from `trees-atlanta`, `park-pride`, `chattahoochee-riverkeeper`

Weaknesses:

- not enough volume to lead the portal
- should remain a meaningful lane, not the core identity

## 6.4 Climbing

**State:** present but thin**

Strengths:

- gives Yonder some breadth
- strong fit with later artifact/quest potential

Weaknesses:

- currently too dependent on one gym source
- no meaningful outdoor climbing / bouldering destination layer yet

## 6.5 Water

**State:** viable but still shallow**

Strengths:

- now has promoted destination support across the Chattahoochee core, Etowah River Park, and Whitewater Express
- some live event adjacency from Atlanta Outdoor Club and Riverkeeper

Weaknesses:

- live event density is still thinner than hiking and running
- the destination layer is now real, but still concentrated in a small number of river and operator nodes

## 6.6 Skills / Classes

**State:** weak**

Strengths:

- important for onboarding beginners

Weaknesses:

- REI is blocked
- little current live supply outside general nature-center education

## 6.7 Camping / Overnighters

**State:** not yet a real content lane**

Strengths:

- strategically important to Yonder’s weekend promise

Weaknesses:

- no real live inventory surface
- destination and metadata layers still missing
- more platform/data problem than section-merchandising problem

---

## 7. Destination Depth By Commitment Tier

Promoted anchor coverage from the destination audit:

### Present in promoted set

- `sweetwater-creek-state-park`
- `chattahoochee-river-nra`
- `panola-mountain`
- `cochran-shoals-trail`
- `shoot-the-hooch-powers-island`
- `island-ford-crnra-boat-ramp`
- `east-palisades-trail`
- `indian-trail-entrance-east-palisades-unit-chattahoochee-nra`
- `etowah-river-park`
- `whitewater-express-columbus`
- `amicalola-falls`
- `tallulah-gorge`
- `cloudland-canyon`
- `blood-mountain`
- `brasstown-bald`
- `vogel-state-park`
- `fort-mountain-state-park`
- `boat-rock`

### Interpretation by tier

| Commitment tier | Destination depth read |
|---|---|
| `an hour` | good |
| `half day` | strong |
| `full day` | credible |
| `weekend` | curated and more credible, but still thin |

This is why Yonder’s main structural risk has narrowed from “no destination graph” to “not enough weekend/camping breadth and water depth.”

---

## 8. Gap Analysis

## 8.1 Strong now

- metro / near-metro outdoor discovery
- quick-hit outdoor plans
- running / movement
- basic stewardship layer
- nature programming

## 8.2 Recovering fast

- group hikes
- destination-driven day hikes
- some `full day` signal

Main reason:

- Atlanta Outdoor Club and BLK Hiking Club are now crawler-feasible

## 8.3 Thin and needs focused work

- water
- climbing breadth
- skills / classes
- family adventure depth
- stronger commitment-aware filtering
- more water-support density beyond the first promoted access set

## 8.4 Weak and still strategic risk

- weekend trips
- camping
- broader weekend / overnight support beyond the now-seeded regional graph
- conditions intelligence
- artifacts / quests
- trip planning

---

## 9. Strategic Bottom Line

Yonder is now credible as:

- a commitment-framed metro/near-metro outdoor discovery portal
- a motivation engine for “do something outside soon”
- a platform testbed for reusable adventure primitives

Yonder is not yet credible as:

- a full regional weekend-adventure portal
- a camping finder
- a robust longer-trip planner
- a route-catalog completeness product, which it should not try to become

The weekend/longer-trip risk is still real.

It is now better understood though:

- part of it is now specifically missing weekend/camping breadth rather than anchor presence
- part of it is missing product capability
- only a shrinking part of it is “missing source rows”

That is good news because it means the next planning step can be much more precise.

---

## 10. Planning Implication

The next plan should not be “add more content” in the abstract.

It should separate work into four buckets:

1. **Write recovered inventory live**
   - run recovered crawlers in non-dry mode once quality is approved

2. **Close source-quality gaps**
   - especially `rei-atlanta`

3. **Deepen destination support density**
   - especially water, weekend-adjacent, and camping-adjacent destinations

4. **Decide which Yonder promises are V1 versus later**
   - weekend / camping / artifacts / quests / conditions / trip hangs
   - outbound route curation instead of internal trail comprehensiveness

This doc should be treated as the baseline for that gap-closing plan.
