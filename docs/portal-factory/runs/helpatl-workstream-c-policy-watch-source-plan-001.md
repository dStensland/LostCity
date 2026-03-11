# HelpATL Workstream C Policy Watch Source Plan 001

- Date: 2026-03-11
- Portal: `helpatl`
- Surface: `consumer`
- Scope: statewide policy/process coverage for policy-heavy Atlanta users
- Decision: `go`

## 1) Objective

Give HelpATL a real policy-watch layer for users who want to stay current on:

1. Georgia legislative process
2. election administration and democracy process
3. executive and budget decisions
4. serious policy reporting and interpretation
5. scorecards and accountability material, clearly labeled as such

This should **not** become a generic news dump.

The product goal is narrower:

1. help a motivated Atlanta user track what the state is doing
2. help them understand why it matters
3. help them distinguish neutral process/reporting from advocacy material

## 2) Current baseline

Current HelpATL state relevant to this workstream:

- `georgia-democracy-watch`: `3` future event matches
- existing statewide lane is process-light and source-thin
- HelpATL already has strong civic action/event breadth, but not enough institutional policy depth

Repo reality:

- there is **no dedicated statewide policy-watch source stack** yet
- the broader Atlanta portal already has a network-news pattern and an existing migration entry for [Atlanta Civic Circle](https://atlantaciviccircle.org/) in [264_network_sources_wave2.sql](/Users/coach/Projects/LostCity/database/migrations/264_network_sources_wave2.sql)
- HelpATL can support this work without inventing a new architecture

Environment validation:

- the current Atlanta network-feed stack is live in this environment with `16` active network sources and `142` posts in the last `30` days
- Atlanta already has `atlanta-civic-circle` active as a network source
- the current network-feed validator could not resolve `helpatl` as an active portal in this environment, so this plan should be treated as **implementation-ready but not yet provisioned for HelpATL here**

## 3) Live source validation

I validated public source surfaces on March 11, 2026.

### A. Reporting / explainers

These are the strongest current reporting sources for ongoing legislative, executive, election, and policy interpretation.

| Source | Public surface | Validation | Recommendation |
|---|---|---|---|
| [Atlanta Civic Circle](https://atlantaciviccircle.org/) | [RSS feed](https://atlantaciviccircle.org/feed/) | live RSS `200` | `P0` Atlanta-local policy explainer source |
| [Georgia Recorder](https://georgiarecorder.com/) | [RSS feed](https://georgiarecorder.com/feed/) | live RSS `200` | `P0` statewide legislature/executive source |
| [Capitol Beat](https://capitol-beat.org/) | [RSS feed](https://capitol-beat.org/feed/) | live RSS `200` | `P0` statewide process and politics source |
| [Georgia Budget and Policy Institute](https://gbpi.org/) | [RSS feed](https://gbpi.org/feed/) | live RSS `200` | `P1` budget/policy analysis source |
| [WABE politics/government](https://www.wabe.org/news/politics/) | category page | feed path returned `403` in direct validation | `P2` manual/secondary until a clean feed path is proven |
| [AJC Politically Georgia](https://www.ajc.com/politics/) | politics/newsletter product | public subscription/news surface exists, but not a simple open feed target | `P2` reference/newsletter source, not initial ingestion target |

### B. Official process

These are the best current official or official-adjacent process surfaces.

| Source | Public surface | Validation | Recommendation |
|---|---|---|---|
| [Georgia General Assembly](https://www.legis.ga.gov/) | official legislature site | live `200`; site is app-like and not obviously feed-friendly | `P0` official process target, likely custom/manual integration |
| [State Election Board](https://sos.ga.gov/state-election-board) | official SOS page | direct request returned `403` | `P1` official but access-constrained; treat as blocker/fallback case |
| [Governor's Office of Planning and Budget budget reports](https://opb.georgia.gov/budget-information/budget-documents/governors-budget-reports) | official budget docs | live `200` | `P0` executive/budget reference source |
| [Georgia Ethics Commission](https://ethics.ga.gov/) | [records search](https://ethics.ga.gov/records-search-all/) and [commission meetings](https://ethics.ga.gov/category/commission-meetings/) | live `200` | `P0` campaign-finance / ethics process source |

### C. Accountability / scorecards

These are useful, but they must stay in a separately labeled bucket.

| Source | Public surface | Validation | Recommendation |
|---|---|---|---|
| [Georgia Conservation Voters scorecards](https://gcvoters.org/scorecards/) | scorecards page | live `200` | `P1` labeled accountability source |
| [Common Cause Georgia](https://www.commoncause.org/georgia/) | democracy scorecard / accountability coverage | public site is live | `P1` labeled democracy-accountability source |

## 4) Source strategy

HelpATL should treat policy-watch content as **three distinct source families**.

### 1. Reporting & Explainers

Use for:

1. "What happened?"
2. "Why does this matter?"
3. "What is moving in the legislature, budget, elections, or city-state power structure?"

Phase-1 sources:

1. `atlanta-civic-circle`
2. `georgia-recorder`
3. `capitol-beat`

Phase-2 source:

1. `gbpi`

Hold:

1. `wabe`
2. `ajc-politically-georgia`

Reason:

- the first three have the cleanest current open publication surfaces
- GBPI is high-value but more analysis-heavy than beat-news-heavy
- WABE and AJC are valuable, but they are weaker initial ingestion targets than the RSS-friendly stack above

### 2. Official Process

Use for:

1. bill calendars
2. committee schedules
3. election-board meetings
4. budget releases
5. campaign-finance / ethics disclosures

Phase-1 sources:

1. `georgia-general-assembly`
2. `opb-budget-reports`
3. `georgia-ethics`

Phase-2 source:

1. `state-election-board`

Reason:

- General Assembly, OPB, and Ethics all answer real policy-nerd questions directly
- the State Election Board matters, but the current public access behavior is still a risk

### 3. Accountability & Scorecards

Use for:

1. ideology- or issue-shaped accountability material
2. legislative scorecards
3. democracy-health scoring

Phase-1 labeled sources:

1. `georgia-conservation-voters-scorecards`
2. `common-cause-georgia-accountability`

Rule:

- never mix these into neutral reporting or official-process modules without an explicit label

## 5) Recommended HelpATL product shape

Do **not** dump all of this into the main civic feed as a flat list.

Use three clearly separated surfaces.

### Policy Watch

For reporting and explainers.

Entry promise:

- "Stay smart on Georgia policy, elections, budgets, and public power."

Initial source mix:

1. Atlanta Civic Circle
2. Georgia Recorder
3. Capitol Beat
4. later: GBPI

### Official Process

For calendars, budgets, disclosures, and state institutional process.

Entry promise:

- "Track bills, votes, budgets, election rules, and ethics activity directly."

Initial source mix:

1. Georgia General Assembly
2. OPB budget reports
3. Georgia Ethics
4. later: State Election Board

### Scorecards & Accountability

For advocacy-labeled evaluations and ratings.

Entry promise:

- "See how outside groups are rating lawmakers and institutions."

Initial source mix:

1. Georgia Conservation Voters
2. Common Cause Georgia

## 6) Build order

### Wave 1: Reporting layer

Targets:

1. Atlanta Civic Circle
2. Georgia Recorder
3. Capitol Beat

Why first:

- easiest implementation path
- highest user value
- gives HelpATL a real policy-intelligence answer quickly

Success bar:

1. at least `3` live reporting sources
2. at least `20` recent policy articles available through the policy-watch layer
3. every source clearly attributed

### Wave 2: Official process

Targets:

1. Georgia General Assembly
2. OPB budget reports
3. Georgia Ethics

Why second:

- harder integration paths
- more durable authority value
- closes the "show me the actual process" gap

Success bar:

1. legislature, budget, and ethics each have at least one working official path
2. HelpATL has a truthful answer for bills, budgets, and campaign-finance oversight

### Wave 3: Accountability

Targets:

1. Georgia Conservation Voters
2. Common Cause Georgia

Why third:

- useful, but must be framed carefully
- lower priority than neutral reporting and official process

Success bar:

1. at least `2` clearly labeled accountability sources live
2. no mixed presentation that implies scorecards are neutral institutional reporting

### Wave 4: Access-constrained sources

Targets:

1. State Election Board
2. WABE politics/government
3. AJC Politically Georgia

Why fourth:

- each has current access or packaging constraints
- worth solving, but not necessary to establish the layer

Success bar:

1. either a reliable ingestion path is proven
2. or the source is intentionally kept as a linked reference/newsletter source

## 7) Measurable goals

Workstream C should be considered successful when HelpATL reaches all of these:

1. `georgia-democracy-watch` grows from `3` future items to `10+`
2. at least `3` policy-reporting sources are live
3. at least `3` official-process sources are live or clearly linked
4. at least `2` accountability sources are live and labeled
5. users can answer:
   - what bills or meetings are moving?
   - what budget/executive decisions matter?
   - what are serious reporters saying about it?
   - how are advocacy groups scoring it?

## 8) Implementation notes

### Best fit for existing architecture

1. RSS-friendly reporting sources should use the existing network/news feed pattern
2. official-process sources may require custom source records or reference-page modules instead of article RSS
3. scorecards should be a separate labeled source family in copy and placement
4. Atlanta already has a working network-source stack, so the fastest first move is to extend that stack with statewide reporting sources before deciding whether HelpATL should inherit or own a separate local policy-watch feed

### Important product rule

Do not pretend every source is equal.

The right labels are:

1. `Reporting`
2. `Official Process`
3. `Accountability`

That distinction is the difference between a serious policy layer and a muddy civic-news page.

## 9) Bottom line

HelpATL already has enough civic action to be useful.

What it lacks is a serious `stay smart on power` layer.

The fastest truthful path is:

1. add Atlanta Civic Circle, Georgia Recorder, and Capitol Beat first
2. add General Assembly, OPB, and Georgia Ethics second
3. add scorecards only as explicitly labeled accountability material

That is enough to turn HelpATL from "good for volunteering and public meetings" into "credible for policy nerds too."
