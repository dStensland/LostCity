# HelpATL Civic + Humanitarian Execution Board V2 001

- Date: 2026-03-10
- Portal: `helpatl`
- Scope: execution plan for making HelpATL the strongest Atlanta source for civic participation, volunteer action, and humanitarian support
- Surfaces: `consumer`, `admin`, `data`
- Decision: `go`, but shift from feature sprawl to measured execution

## 1) North Star

HelpATL should be the best Atlanta destination for:

1. `Do something this week`
2. `Commit to a cause`
3. `Track and join public process`
4. `Find help, not just ways to help`

The product is only “definitive” if it is strong across all four, not just volunteer volume.

## 2) Current Baseline

Confirmed live baseline:

- active source subscriptions: `43`
- active channels: `19`
- active structured opportunities: `53`

Structured opportunity counts by cause:

| Cause | Count |
|---|---:|
| `civic_engagement` | `16` |
| `family_support` | `8` |
| `immigrant_refugee` | `6` |
| `education` | `4` |
| `legal_aid` | `4` |
| `housing` | `4` |
| `health_wellness` | `4` |
| `environment` | `3` |
| `food_security` | `2` |
| `youth_education` | `2` |

Qualitative read:

1. `Volunteer This Week` is strong enough to be a real user-facing promise.
2. Structured commitments are now broad enough to matter, but still need clearer ranking and surfacing discipline.
3. Civic participation is credible, especially for neighborhood and training/action lanes.
4. The biggest remaining authority gaps are:
   - official clerk/public-notice pathways
   - support-resource depth and discovery
   - ongoing source quality on a few high-volume volunteer sources

## 3) Program Rules

1. Do not add new lanes unless they close a scorecard gap.
2. Fix source truth before adding manual patches or one-off curation.
3. Prefer the right data shape:
   - `event` for dated scheduled action
   - `structured opportunity` for ongoing roles
   - `resource directory` for help infrastructure
4. Every phase must end with:
   - measurable evidence
   - a run artifact
   - an explicit `go / hold / cut` decision

## 4) Success Metrics

## Coverage KPIs

1. `Volunteer This Week` shows at least `25` distinct, credible, next-7-day opportunities at all times.
2. Structured opportunity inventory stays at `50+` active roles, with no major cause area below `2` active roles unless intentionally out of scope.
3. Civic participation inventory includes at least:
   - `10+` structured `civic_engagement` roles
   - `3+` official or official-adjacent boards/appointment pathways
   - `4+` metro election administration pathways

## Quality KPIs

1. Duplicate visible volunteer listings in the next-7-day top experience stay below `5%`.
2. Broken signup/application URLs stay below `2%` of sampled top results.
3. Placeholder or low-signal titles in top volunteer surfaces stay at `0`.
4. Top `10` volunteer sources have no unresolved source-specific quality defects older than `7` days.

## Authority KPIs

1. Every major civic-humanitarian lane is rated at least `Adequate` in the coverage matrix.
2. Only two known strategic gaps are allowed to remain `Thin`:
   - official clerk/public-notice feed
   - deep support-resource completeness
3. HelpATL must have a truthful answer for:
   - how to help this week
   - how to help long-term
   - how to join neighborhood/public process
   - where to go for help

## Product KPIs

1. Home feed top stack leads with action:
   - `Volunteer This Week`
   - `Ways To Help`
   - `Join Groups`
2. Support directory is reachable from hero, feed, mobile nav, and desktop header.
3. Structured opportunity browse supports cause-based discovery for every active humanitarian/civic cause lane.

## 5) Phases

## Phase 0: Baseline Audit and Instrumentation
- Window: `1 day`
- Objective: establish a trustworthy baseline before more expansion

Work:

1. Re-run a HelpATL quality audit against:
   - top volunteer sources
   - top civic participation sources
   - support directory discovery paths
2. Record current counts for:
   - distinct next-7-day volunteer opportunities
   - structured opportunities by cause
   - broken signup URLs in a top-surface sample
   - duplicate rate in top volunteer surfaces
3. Decide the weekly scorecard format and the exact metrics to update every cycle.

Exit bar:

1. We have one current baseline artifact with exact counts and known defects.
2. Every open issue is labeled as:
   - `source quality`
   - `product surfacing`
   - `authority gap`
   - `resource gap`

## Phase 1: Source Quality Hardening
- Window: `3-5 days`
- Objective: protect the credibility of the existing volunteer and civic surfaces

Priority sources:

1. `hands-on-atlanta`
2. `open-hand-atlanta`
3. `united-way-atlanta`
4. `trees-atlanta`
5. `park-pride`
6. next underperforming direct sources after audit

Work:

1. Remove duplicate rows and stale future rows in top volunteer sources.
2. Eliminate placeholder titles and bad slug/title pollution.
3. Keep aggregator sources in the right lane:
   - dated roles to events
   - ongoing roles to structured opportunities
4. Add or tighten source-specific regression tests where a bug was actually found.

Exit bar:

1. Duplicate rate under `5%` in top volunteer surfaces.
2. Placeholder top-surface titles at `0`.
3. No major aggregator is mis-modeled as an event source when it is really a structured-opportunity source.

## Phase 2: Commitment and Civic Discovery Quality
- Window: `3 days`
- Objective: make the non-drop-in side of HelpATL feel intentional, not secondary

Work:

1. Audit structured opportunity ranking and cause discoverability.
2. Ensure each key lane has a clear browse path:
   - `Commit to a Cause`
   - `Civic Engagement`
   - `Family Support`
   - `Health & Public Health`
3. Cut weak or redundant structured roles if they add noise.
4. Improve source-aware ranking so direct, high-trust local roles beat aggregator fallback roles where both exist.

Exit bar:

1. `Commit to a Cause` is not just populated; it is navigable and defensible.
2. Each major structured cause lane has at least `2` visible roles.
3. No aggregator-sourced role outranks a stronger direct-host equivalent without a specific reason.

## Phase 3: Civic Authority Completion
- Window: `5-7 days`
- Objective: close the largest remaining “definitive source” gap on the civic side

Work:

1. Solve or route around the Atlanta clerk/public-notice blocker.
2. If direct event feed access remains blocked, model the official participation pathways truthfully and document the limitation.
3. Add one more official or official-adjacent source only if it improves public-process authority, not just count inflation.

Exit bar:

1. Boards/commissions participation is at least `Adequate`.
2. Official public-process coverage has a documented trustworthy path, even if not every notice is yet machine-ingested.
3. Neighborhood participation, civic training/action, and boards participation work as a coherent civic layer.

## Phase 4: Support Resource Completion
- Window: `4-6 days`
- Objective: make HelpATL useful for people who need help, not just people looking to help

Work:

1. Expand the support directory where the current map is thin.
2. Audit the current support taxonomy for:
   - urgent help
   - housing
   - legal
   - family/youth
   - immigrant/refugee
   - health/public health
3. Add cross-links between support resources and relevant action/opportunity lanes when appropriate.

Exit bar:

1. Every core support section has at least `Adequate` coverage.
2. Support discovery is reachable from all intended entry points.
3. The support layer is good enough to claim “find help across Atlanta” without obvious blind spots.

## Phase 5: Weekly Operating Rhythm
- Window: `ongoing`
- Objective: keep HelpATL trustworthy instead of letting quality drift after expansion

Weekly checklist:

1. Review coverage scorecard.
2. Sample top volunteer, civic, and support surfaces for broken links and title quality.
3. Triage top `5` source-quality defects.
4. Decide one of:
   - `expand`
   - `harden`
   - `hold`

Exit bar:

1. No lane regresses from `Strong` or `Adequate` to `Thin` without a recorded decision.
2. No known P1 source-quality bug survives more than `7` days without explicit deferment.

## 6) Scorecard Standard

Use only these ratings:

| Rating | Meaning |
|---|---|
| `Strong` | clear user-facing strength with enough depth and trust to lead with it |
| `Adequate` | truthful and useful, but not a differentiator yet |
| `Thin` | real coverage exists, but gaps are too obvious to claim confidence |
| `Missing` | no defensible coverage |

Domains to update every scorecard cycle:

1. drop-in volunteering
2. ongoing volunteering
3. long-term commitments
4. food security
5. environment
6. housing / homelessness
7. legal aid / community rights
8. family support / survivor support
9. immigrant / refugee support
10. health / public health
11. animal welfare
12. youth / education
13. city / county / school meetings
14. neighborhood governance
15. civic training / action
16. boards / commissions participation
17. watchdog / observer roles
18. election administration
19. transit civic participation
20. support-resource directory

## 7) Verification Loop

## Data / crawler verification

```bash
cd /Users/coach/Projects/LostCity/crawlers
pytest
python3 -m py_compile scripts/content_health_audit.py
```

## Portal contract verification

```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts
```

## HelpATL feed / channel verification

```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts
```

## HelpATL shell / navigation verification

```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- components/__tests__/header-z-index.test.ts components/civic/CivicTabBar.test.ts lib/nav-labels.test.ts
```

## 8) Immediate Next Sequence

1. Run `Phase 0` and publish a single baseline artifact with:
   - exact volunteer top-surface distinct count
   - duplicate rate
   - broken signup sample
   - structured counts by cause
2. Finish `Phase 1` hardening on the remaining high-volume volunteer sources.
3. Only then decide whether the next week should be:
   - `civic authority completion`, or
   - `support resource completion`

## 9) Decision Rule

The plan is working if every week ends with one of two outcomes:

1. a scorecard domain moved from `Thin` to `Adequate`, or
2. a live user-facing quality defect was removed from a high-traffic HelpATL surface

If a week does neither, the work is drifting.
