# HelpATL Phase 0 Baseline Audit 001

- Date: 2026-03-10
- Portal: `helpatl`
- Scope: baseline audit for the civic + humanitarian execution board
- Decision: `go` to Phase 1 hardening

## 1) Live Baseline

Confirmed live counts:

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

## 2) Top-Surface Volunteer Audit

Method:

1. Pulled live `GET /api/portals/helpatl/city-pulse`
2. Applied the same volunteer-card logic used in [VolunteerThisWeekCard.tsx](/Users/coach/Projects/LostCity/web/components/feed/civic/VolunteerThisWeekCard.tsx#L1)
3. Measured raw matching items, distinct post-dedupe items, and source mix

Results:

- raw next-7-day volunteer-card matches: `14`
- post-ID dedupe: `14`
- distinct post-title/date/time dedupe: `14`
- duplicate rate in the current top volunteer surface: `0.0%`

Top-source concentration in the volunteer card candidate set:

| Source ID | Count | Read |
|---|---:|---|
| `13` | `7` | Hands On Atlanta dominates the current top-of-feed volunteer surface |
| `794` | `3` | Atlanta Community Food Bank is the second strongest contributor |
| `300` | `2` | Trees Atlanta still contributes meaningfully |
| `790` | `1` | Concrete Jungle contributes one event |
| `1084` | `1` | one false-positive government/community item leaked into the volunteer surface |

Interpretation:

1. The volunteer card is strong enough to be real, but it is still more concentrated than ideal.
2. Source hardening has materially improved duplicates.
3. The current matching logic is still letting at least one non-volunteer civic meeting through.

## 3) Signup URL Health Sample

Method:

1. Pulled the top `14` live volunteer-card candidates
2. Pulled the first `15` structured opportunities from `GET /api/portals/helpatl/volunteer/opportunities?limit=25`
3. Checked their primary user-facing URLs with a browser-like user agent

Sample size:

- event signup/detail URLs checked: `14`
- structured application URLs checked: `15`
- total checked: `29`

Results:

- clean `200` responses: `26`
- hard broken `404` responses: `1`
- bot-blocked / access-limited `403` responses: `2`

Rates:

- strict broken-link rate (`404/5xx only`): `3.45%`
- restricted-or-broken rate (`403 + 404/5xx`): `10.34%`

Known failing or restricted URLs in the sample:

1. `404`
   - `Tree Care in Downtown`
   - `https://www.treesatlanta.org/get-involved/events/tree-care-in-downtown-a0VUd00000VF5ggMAD`
2. `403`
   - `Apply for a City Board or Commission Seat`
   - `https://www.atlantaga.gov/government/boards-and-commissions/application-for-board-membership`
3. `403`
   - `Complete the BACE Appointment Process`
   - `https://www.atlantaga.gov/home/showpublisheddocument/14346/637031172570370000`

Interpretation:

1. The top volunteer surface is close to healthy, but not yet at the execution-board target of `<2%` broken signup URLs.
2. Trees Atlanta has at least one live broken event URL in a top surface.
3. The City of Atlanta boards/BACE links are still part of the known official-public-notice / access-blocker problem, not a random crawl miss.

## 4) Known Defects by Category

## `source quality`

1. Trees Atlanta has at least one broken top-surface event URL (`404`).
2. Volunteer surface concentration is still too reliant on Hands On Atlanta (`7/14` current candidates).
3. United Way is now correctly modeled, but contributes only structured roles right now, not dated events.

## `product surfacing`

1. `Volunteer This Week` currently includes one false-positive government/community meeting:
   - `Community Development/Human Services Committee — Regular Committee Meeting`
2. The current volunteer matcher is still too permissive because `support` is treated as a volunteer signal in all contexts.
3. The top volunteer card is truthful but still thin versus the execution-board target of `25+` distinct next-7-day opportunities.

## `authority gap`

1. Official City of Atlanta boards/application links still return `403` to our runtime checks.
2. Boards/commissions participation exists through structured pathways, but not yet through a robust official notice/feed path.

## `resource gap`

1. Support discovery is in place, but this audit cycle did not yet score section-level support completeness.
2. Support-resource completeness still remains a strategic gap rather than a solved lane.

## 5) Baseline Read

What is already working:

1. The top volunteer surface is no longer duplicate-heavy.
2. Structured opportunity breadth is now substantial at `53` active roles.
3. Civic and humanitarian lanes are broad enough to move from expansion into quality hardening.

What is not yet good enough:

1. `Volunteer This Week` is below the `25+` target at `14` distinct next-7-day items.
2. Top-surface URL health is above target because of one real `404` and two known official `403` barriers.
3. The volunteer matcher still leaks at least one civic meeting into the action lane.

## 6) Phase 1 Queue

Immediate hardening queue:

1. Fix Trees Atlanta broken event URL normalization or stale event retention.
2. Tighten `Volunteer This Week` matching so government meetings cannot qualify through generic support-related tags.
3. Run the same URL-health sample after the Trees and volunteer-matcher fixes.
4. Audit the next weak high-volume volunteer sources in this order:
   - `hands-on-atlanta`
   - `atlanta-community-food-bank`
   - `trees-atlanta`
   - `open-hand-atlanta`
   - `united-way-atlanta`

## 7) Verification Inputs

Data used for this artifact came from:

- local HelpATL city pulse API
- local HelpATL structured volunteer API
- production Supabase structured opportunity counts
- direct URL checks with browser-like request headers

This artifact satisfies the `Phase 0` requirement to capture:

1. exact top-surface volunteer count
2. duplicate rate
3. broken signup sample
4. structured counts by cause
5. categorized known defects
