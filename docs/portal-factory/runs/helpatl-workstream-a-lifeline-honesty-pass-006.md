# HelpATL Workstream A LifeLine Honesty Pass 006

- Date: 2026-03-11
- Portal: `helpatl`
- Surface: `consumer`
- Source: `lifeline-animal-project`
- Follows: [helpatl-workstream-a-source-audit-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-workstream-a-source-audit-001.md)

## 1) Objective

Decide whether LifeLine Animal Project meaningfully helps volunteer balancing and fix any obvious source-truth defects.

## 2) Current source shape

Active next-45-day inventory:

1. `LifeLine Super Adopt-a-thon`
2. `Healthy Pets`
3. `Good Human Gala`

Measured read:

- next `7` days: `1`
- next `30` days: `2`
- `volunteer`-tagged events: `0`
- `fundraiser`-tagged events: `1`

This is not a volunteer-shift source. It is an animal-welfare breadth source with adoption, clinic, and fundraiser programming.

## 3) Data-quality bug found

The `LifeLine Super Adopt-a-thon` description was wrong in live data because the permanent event page carried stale Open Graph metadata for `Spooky Pooch 5K & Fun Walk`.

That meant HelpATL was showing a clearly incorrect description for one of the source’s main current events.

## 4) Change

Updated [lifeline_animal_project.py](/Users/coach/Projects/LostCity/crawlers/sources/lifeline_animal_project.py#L1) to reject stale cross-event OG descriptions and fall back to body copy when the metadata clearly refers to a different known LifeLine event.

Added regression coverage in [test_lifeline_animal_project.py](/Users/coach/Projects/LostCity/crawlers/tests/test_lifeline_animal_project.py#L1).

## 5) Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_lifeline_animal_project.py
python3 -m py_compile sources/lifeline_animal_project.py tests/test_lifeline_animal_project.py
python3 main.py --source lifeline-animal-project --allow-production-writes --skip-launch-maintenance
```

Live outcome after refresh:

- `LifeLine Super Adopt-a-thon` description is now:
  - `Three shelters are coming together for one big day of lifesaving. All dog adoptions are free and include spay or neuter, vaccines, microchip, and more.`

## 6) Decision

Keep `lifeline-animal-project` in HelpATL for animal-welfare breadth, but remove it from any volunteer-balancing reasoning.

It is currently valuable for:

1. adoption-event coverage
2. community pet-health support
3. fundraiser breadth

It is not currently valuable for:

1. weekly volunteer depth
2. rebalancing the top volunteer source mix

## 7) Bottom line

The animal-welfare honesty pass is now complete enough to act on:

1. `atlanta-humane-society` and `lifeline-animal-project` should stay for breadth
2. neither should be treated as a meaningful volunteer-balancing source
3. Workstream A should stop chasing animal-welfare sources as if they will materially diversify `Volunteer This Week`
