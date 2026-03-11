# Yonder Source Audit

**Parent docs:** `prds/034-yonder-adventure-portal.md`, `prds/034a-yonder-content-sweep-plan.md`, `prds/034b-yonder-content-assessment.md`  
**Status:** Draft  
**Method:** live `sources` registry audit + current upcoming event counts from production DB + limited dry-run validation

---

## 1. Purpose

This audit answers three questions:

1. Which Yonder priority sources are actually present in the live source registry?
2. Which of those sources are active and currently producing upcoming inventory?
3. Which source gaps are provisioning problems versus true crawler/content gaps?

This is the first quantified pass. It is not yet a precision/content-quality review of every source item.

---

## 2. Audit Scope

Priority source set audited:

- `atlanta-outdoor-club`
- `blk-hiking-club`
- `rei-atlanta`
- `chattahoochee-riverkeeper`
- `chattahoochee-nature`
- `dunwoody-nature`
- `park-pride`
- `trees-atlanta`
- `beltline-fitness`
- `big-peach-running`
- `monday-night-run-club`
- `meetup`
- `central-rock-gym-atlanta`
- `bicycle-tours-atlanta`
- `atlanta-parks-rec`
- `piedmont-park`
- `south-river-forest`

Important source-pack note:

- use `meetup` as the actual source slug
- treat `meetup.outdoors` as internal taxonomy / subcategory logic, not as a standalone source row

---

## 3. Source Registry Status

## 3.1 Present vs Missing

### Missing from live `sources`

These crawler modules exist in the repo but do **not** currently have matching live source rows in the audited DB target:

- `atlanta-outdoor-club`
- `blk-hiking-club`
- `rei-atlanta`
- `atlanta-parks-rec`

Interpretation:

- these are immediate Yonder source-pack blockers
- they should be treated as provisioning/activation work, not as hypothetical future sources

### Present but inactive

- `monday-night-run-club`
- `bicycle-tours-atlanta`
- `south-river-forest`

Interpretation:

- these sources exist structurally
- they are not currently contributing live inventory
- Yonder can choose to reactivate them later, but should not count them in launch assumptions today

### Present and active

- `chattahoochee-riverkeeper`
- `chattahoochee-nature`
- `dunwoody-nature`
- `park-pride`
- `trees-atlanta`
- `beltline-fitness`
- `big-peach-running`
- `meetup`
- `central-rock-gym-atlanta`
- `piedmont-park`

Important provisioning nuance:

- `beltline-fitness` is live in the DB and contributes inventory
- it is **not** currently portal-factory-ready because `validate-source-pack.ts` cannot find a local crawler module or source profile for that slug
- it should not be included in the first Yonder manifest until that support exists

---

## 4. Upcoming Inventory Counts

Counts below are from current upcoming events in the production DB.

| Source | Active | Next 14 Days | Next 30 Days | Initial read |
|---|---:|---:|---:|---|
| `meetup` | yes | 78 | 92 | broad volume, likely noisy but valuable |
| `chattahoochee-nature` | yes | 54 | 82 | very strong structured nature programming |
| `piedmont-park` | yes | 24 | 45 | strong recurring outdoor/social density |
| `big-peach-running` | yes | 19 | 39 | strong recurring movement/social loop |
| `beltline-fitness` | yes | 20 | 20 | dependable urban quick-hit inventory |
| `trees-atlanta` | yes | 20 | 20 | strong stewardship + guided nature activity |
| `chattahoochee-riverkeeper` | yes | 4 | 5 | lower volume, high signal |
| `central-rock-gym-atlanta` | yes | 1 | 2 | niche but useful for climbing lane |
| `park-pride` | yes | 2 | 2 | low volume, high signal stewardship |
| `dunwoody-nature` | yes | 0 | 0 | source is active but currently contributes nothing upcoming |
| `bicycle-tours-atlanta` | no | 0 | 0 | inactive |
| `monday-night-run-club` | no | 0 | 0 | inactive |
| `south-river-forest` | no | 0 | 0 | inactive |

Sources missing from live registry have no production counts yet:

- `atlanta-outdoor-club`
- `blk-hiking-club`
- `rei-atlanta`
- `atlanta-parks-rec`

---

## 5. Dry-Run Validation Snapshot

Limited crawler dry-runs were attempted to distinguish source-pack issues from crawl issues.

### Confirmed runnable now

- `chattahoochee-riverkeeper`
  - dry-run succeeded
  - result: `11 found, 0 new, 11 updated`

### After source-foundation migration

The missing source rows were registered and the Yonder source pack was provisioned into a draft portal. Follow-up crawler work materially improved three of the four recovery sources:

- `atlanta-outdoor-club`
  - crawler rewritten from generic Playwright template to direct HTML/detail-page parsing
  - result: now emits large upcoming inventory from the live listing
  - observed read: `125` future event rows on the listing page

- `blk-hiking-club`
  - crawler rewritten to use event detail JSON-LD
  - result: `2 found, 2 new, 0 updated`

- `rei-atlanta`
  - dry-run failed
  - issue: Playwright navigation hit `net::ERR_HTTP2_PROTOCOL_ERROR` on `rei.com/events`
  - current posture: keep registered, but remove from the launch manifest until transport stability is fixed

- `atlanta-parks-rec`
  - legacy calendar crawler replaced with a wrapper over the stronger ACTIVENet implementation in `atlanta_dpr.py`
  - result: source now emits parks/recreation program inventory in dry-run

Interpretation:

- the source-pack blocker is no longer source registration
- the remaining blocker has narrowed to REI transport stability

---

## 6. Source Tiering For Yonder

## 6.1 Core Launch Sources

These are strong enough to count in Yonder Phase 1 assumptions.

- `meetup`
- `chattahoochee-nature`
- `piedmont-park`
- `big-peach-running`
- `trees-atlanta`
- `chattahoochee-riverkeeper`

Why:

- they are live
- they have current upcoming inventory
- they span multiple outdoor intent lanes:
  - social adventure
  - urban movement
  - stewardship
  - nature programming

Operational caveat:

- `beltline-fitness` remains strategically valuable but should be treated as a source-pack follow-up until it has local crawler/profile support

## 6.2 Useful Secondary Sources

- `central-rock-gym-atlanta`
- `park-pride`

Why:

- lower volume
- still strategically useful because they deepen the climbing and stewardship lanes

## 6.3 Watchlist Sources

- `dunwoody-nature`

Why:

- active but no current upcoming inventory
- might be seasonal or temporarily empty
- should not be dropped yet, but should not carry launch assumptions

## 6.4 Source-Pack Recovery Candidates

These should be activated or deliberately excluded in a Yonder source-pack decision.

- `atlanta-outdoor-club`
- `blk-hiking-club`
- `rei-atlanta`
- `atlanta-parks-rec`

Why:

- they fit Yonder’s thesis well
- their absence is currently a provisioning / registration gap
- they are likely among the highest-value missing sources in the whole launch pack

## 6.5 Deferred / Non-core For Launch

- `monday-night-run-club`
- `bicycle-tours-atlanta`
- `south-river-forest`

Why:

- all currently inactive
- each may still be useful later, but none should be required to make Yonder feel alive at launch

---

## 7. Main Findings

### Finding 1: Yonder’s event freshness is not the main risk

There is already enough live outdoor/event inventory to support a discovery-first launch.

The biggest current volume drivers are:

- Meetup
- Chattahoochee Nature Center
- Piedmont Park
- Big Peach Running
- BeltLine Fitness
- Trees Atlanta

That is enough to make the portal feel active if presented well.

### Finding 2: Source-pack hygiene is a real launch blocker

Four priority Yonder sources exist in code but are not present in live `sources`.

This means Yonder’s source sweep must include:

- source row creation
- activation
- subscription/federation setup

before any portal provisioning claim is considered valid.

### Finding 3: The source mix is skewed toward `hour` and `halfday`

The current live source pack is best at:

- urban movement
- guided nature programming
- stewardship
- recurring social outdoor activity

It is weaker at:

- full-day trip inventory
- weekend mountain inventory
- camping freshness

This reinforces the earlier recommendation that Yonder launch discovery-first, not expedition-first.

### Finding 4: High-volume does not always mean high-fit

Meetup is likely useful, but it will need filtering and fit review because it is broad and can easily dilute Yonder’s point of view.

The likely Yonder content hierarchy should favor:

- curated or high-confidence sources first
- broad aggregators second

---

## 8. Recommended Next Actions

1. Create or backfill live source rows for:
   - `atlanta-outdoor-club`
   - `blk-hiking-club`
   - `rei-atlanta`
   - `atlanta-parks-rec`

2. Decide whether to reactivate:
   - `monday-night-run-club`
   - `bicycle-tours-atlanta`
   - `south-river-forest`

3. Run item-level quality sampling on the top six volume sources:
   - title quality
   - location precision
   - image coverage
   - Yonder fit

4. Build the Yonder source pack from:
   - core launch sources
   - source-pack recovery candidates
   - a smaller deliberate set of secondary sources

---

## 9. Bottom Line

Yonder already has enough live event-source energy to support a compelling Phase 1 discovery product.

The source problem is not “we have no outdoor content.”

The source problem is:

- some of the best-fit sources are not yet activated in the data layer
- and the current live mix leans urban/metro more than regional/weekend

That is manageable, but it needs to be treated as provisioning work immediately.
