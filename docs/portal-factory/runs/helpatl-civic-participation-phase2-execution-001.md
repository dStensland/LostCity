# HelpATL Civic Participation Phase 2 Execution 001

- Date: 2026-03-09
- Portal slug: `helpatl`
- Scope: first execution wave for the civic participation layer
- Decision: `go`

## Objective

Start Phase 2 with the highest-confidence civic participation sources already supported in-repo or already active in the data layer.

This wave is intentionally narrower than the full coverage matrix. It is designed to get HelpATL from `government-watch` into real `civic participation` quickly, without waiting for the harder citywide infrastructure sources.

## Wave 1 Source Pack

### Activate now

1. `atlanta-city-planning`
2. `marta-army`
3. `civic-innovation-atl`
4. `lwv-atlanta`

### Why these four

1. They already have crawler support or active source rows in the platform.
2. They represent four distinct participation lanes:
   - neighborhood and land-use process
   - transit advocacy and public engagement
   - civic training and issue events
   - voter education and democracy participation
3. They avoid the biggest blocker in the civic roadmap: trying to solve the entire NPU and boards/commissions system before shipping anything.

## Measured Source Signal

Current next-30-day source counts observed before rollout:

| Source slug | Next-30-day signal | Notes |
|---|---:|---|
| `atlanta-city-planning` | `37` | strongest participation source in this wave; includes NPU and planning hearings |
| `marta-army` | `7` | good transit and planning-adjacent community participation |
| `civic-innovation-atl` | `2` | lower volume, high-intent civic workshops/events |
| `lwv-atlanta` | `0` next 30 days, `4` future events found in crawl | lower-frequency but strategically important civic depth |

## Product Changes In This Wave

### Source subscriptions

Add these sources to the HelpATL manifest:

1. `atlanta-city-planning`
2. `marta-army`
3. `civic-innovation-atl`
4. `lwv-atlanta`

### New sections

1. `Neighborhood Participation`
   - source-backed by `atlanta-city-planning`
   - intended to surface NPU meetings, zoning hearings, and planning process events

2. `Civic Training & Action`
   - source-backed by `marta-army`, `civic-innovation-atl`, and `lwv-atlanta`
   - intended to surface transit advocacy, voter education, workshops, and participation events

### New interest channels

1. `neighborhood-participation-atl`
2. `civic-training-action-atl`

## Sources Deferred To Wave 2

These remain priority sources, but they should not block Wave 1:

1. `atlanta-npu-system`
2. `atlanta-municipal-clerk`
3. `common-cause-georgia`
4. `canopy-atlanta-documenters`

## Why They Are Deferred

1. `atlanta-npu-system` and `atlanta-municipal-clerk` need cleaner modeling and likely new source rows or more careful routing logic.
2. `common-cause-georgia` and `canopy-atlanta-documenters` are strategically right, but they are not yet first-class HelpATL sources in the current rollout path.
3. Shipping Wave 1 first gets HelpATL meaningful participation breadth today without stalling on edge-case modeling.

## Launch Bar

This wave counts as successful if:

1. HelpATL gains visible, non-empty civic participation sections beyond `Government Meetings`.
2. `Neighborhood Participation` shows current city planning / NPU process events.
3. `Civic Training & Action` shows a mix of transit, civic workshop, and voter education-style inventory.
4. The new civic participation lanes feel additive, not duplicative of existing meeting sections.

## Verification

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source atlanta-city-planning --dry-run
python3 main.py --source marta-army --dry-run
python3 main.py --source civic-innovation-atl --dry-run
python3 main.py --source lwv-atlanta --dry-run

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v3.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v3.json --dry-run
```
