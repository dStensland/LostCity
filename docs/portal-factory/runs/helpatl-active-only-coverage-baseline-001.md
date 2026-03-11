# HelpATL Active-Only Coverage Baseline 001

Date: 2026-03-10
Portal: `helpatl`
Surface: `consumer`
Scope: post-active-filter civic/humanitarian baseline

## Why this baseline matters

After fixing `refreshEventChannelMatchesForPortal(...)` to exclude inactive events, HelpATL's old materialized channel totals were no longer trustworthy. This snapshot resets the baseline against the corrected active-only match set.

This is now the number set future execution work should use.

## Core portal totals

- active source subscriptions: `59`
- active channels: `20`
- materialized event-channel matches: `2783`
- active structured volunteer/civic opportunities: `61`

## Active channel counts

### Institutional / process lanes

- `atlanta-city-government`: `54`
- `fulton-county-government`: `5`
- `dekalb-county-government`: `6`
- `school-board-watch`: `14`
- `georgia-democracy-watch`: `3`
- `neighborhood-participation-atl`: `138`
- `civic-training-action-atl`: `88`

### Volunteer / commitment lanes

- `volunteer-this-week-atl`: `993`
- `ongoing-opportunities-atl`: `41`
- `commit-to-a-cause-atl`: `6`

### Cause lanes

- `civic-engagement`: `322`
- `food-security`: `650`
- `education`: `153`
- `environment`: `150`
- `housing`: `27`
- `health-wellness`: `41`
- `animals`: `26`
- `transit-mobility`: `47`
- `arts-culture`: `10`
- `public-safety`: `9`

## Structured opportunity mix

Active `volunteer_opportunities` by cause:

- `civic_engagement`: `24`
- `family_support`: `8`
- `immigrant_refugee`: `6`
- `housing`: `4`
- `legal_aid`: `4`
- `health_wellness`: `4`
- `education`: `4`
- `environment`: `3`
- `youth_education`: `2`
- `food_security`: `2`

## Next-7-day volunteer inventory

A direct active-event audit for `2026-03-10` through `2026-03-17`, using the same volunteer/service-style tag family and duplicate suppression logic, returns:

- distinct next-7-day volunteer/service events: `299`

This is broader than the home card inventory because it measures raw active event availability, not the shaped city-pulse feed surface.

Sample top-week events include:

- `SVdP Food Distribution-Chamblee`
- `Meal Delivery to Seniors`
- `Volunteer: Atlanta Community Food Center Afternoon Distr.`
- `PM Meal Packing`
- `Supplement Bagging & Box Assembly`
- `Star-C After-School Enrichment @ Springview Apts.`

## Statewide democracy lane

`georgia-democracy-watch` launched with `3` live events:

1. `Join us at the March 18 State Election Board Meeting`
2. `General Primary Election/Nonpartisan Election`
3. `General Primary Election/Nonpartisan Runoff`

This confirms the lane is real, but still intentionally narrow.

## Important read

### 1. The active-only fix materially changed the baseline

The corrected refresh path reduced materialized matches from inflated stale totals to `2783`.

That is the right direction. It means current counts are more honest even if they look smaller.

### 2. HelpATL is still strongest on participation breadth, not source-pack discipline

The current portal has:

- `59` active source subscriptions
- but the v5 manifest validates only `34` source-pack slugs

That means HelpATL is functionally broader than the current source-pack definition. This is a configuration-governance issue, not a user-facing outage, but it matters.

### 3. Volunteer depth is still very strong after cleanup

Even on the corrected baseline:

- `volunteer-this-week-atl = 993`
- `299` distinct next-7-day volunteer/service events in the active raw inventory audit

So the active-only correction did not weaken HelpATL's volunteer coverage claim.

### 4. Institutional civic depth is now meaningfully layered

HelpATL now has distinct active lanes for:

- city government
- county government
- school boards
- neighborhood participation
- statewide democracy process

That is materially better than a generic civic-action feed.

## Residual risks

### Source-pack drift

`59` active source subscriptions vs `34` manifest slugs means portal reality and source-pack truth are not fully aligned.

### Narrow statewide coverage

`georgia-democracy-watch` is useful but very small. It should stay narrow until there is enough real volume to justify a broader statewide institutional lane.

### Lane-count interpretation

High materialized counts like `volunteer-this-week-atl = 993` are channel-match totals across the forward window, not the same thing as “top visible this week” inventory. Product audits should keep those two metrics separate.

## Recommended next move

Before adding more breadth, fix source-pack governance:

1. inventory the `59` active HelpATL source subscriptions
2. compare them against the `34` declared v5 manifest slugs
3. decide which sources are intentional but undeclared, and which are legacy carryover

That is the cleanest next execution step because it improves control over every later coverage claim.
