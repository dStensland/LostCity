# HelpATL Content Priorities Memo 003

- Date: 2026-03-11
- Portal: `helpatl`
- Purpose: translate the current live content audit into an execution brief with clear buckets: `fix now`, `fix soon`, `leave alone`

## Current live baseline

- live event sources: `36`
  - superseded after the General Assembly rollout; live event sources are now `37`
- active channels: `20`
- materialized event-channel matches: `2940`
- active ongoing opportunities: `61`
- resolved news / policy posts in 30 days: `191`
- local HelpATL policy / news posts in 30 days: `48`
- support organizations: `182`

Current visible section stack:
- `Volunteer This Week`
- `Ongoing Opportunities`
- `Commit to a Cause`
- `Neighborhood Participation`
- `Civic Training & Action`
- `Government Meetings`
- `School Board Watch`

## What is already good enough

### Volunteer This Week

This is already strong enough to operate.

Measured state:
- next 7 days: `335`
- next 30 days: `991`
- dominant-source blank descriptions: `0`
- dominant-source generic titles: `0`
- audited top source-url sample: `20 / 20` returned `200`

Interpretation:
- the lane is concentrated, but it is not low quality
- more source-count work is lower leverage than protecting trust on the dominant sources

### Support directory

This is now complete enough for the current done state.

Section counts:
- `Urgent Help & Crisis Support`: `22`
- `Food, Housing & Legal Help`: `23`
- `Family, Youth & Newcomer Support`: `27`
- `Health & Public Health`: `37`
- `Work, Money & Daily Life`: `20`
- `Disability, Aging & Long-Term Support`: `28`

Interpretation:
- no section looks abandoned
- further additions should be selective, not another broad fill wave

### Ongoing opportunities traceability

This governance problem is closed.

Measured state:
- active roles: `61`
- source-linked: `61`
- source-null: `0`

### Policy spine

This is now a coherent feature, not accidental inherited news.

Measured state:
- HelpATL-local policy sources: `4`
  - `georgia-recorder`
  - `capitol-beat`
  - `atlanta-civic-circle`
  - `gbpi`
- HelpATL-local policy posts in 30 days: `48`
- resolved posts in 30 days: `191`

## Fix now

### 1. Close the last statewide process authority gap

This is the highest-priority remaining content problem.

Measured state:
- `Georgia Democracy Watch` next 30 days: `21`
- done-state target: `5+`

Current lane contents:
- `Join us at the March 18 State Election Board Meeting`
- `GMA Newly Elected Officials Conference (Tifton)`
- `GAVERO Conference (Athens)`
- `COMMISSION MEETING: March 30, 2026`

Why this mattered:
- HelpATL is already strong on volunteer action and policy reporting
- the remaining credibility gap is institutional process authority

Outcome:
- closed via official `georgia-general-assembly` + `georgia-ethics-commission`
- no brittle DOM scraping required

Working rule:
- only add another statewide-process source if it is official or clearly high-trust
- do not force brittle SOS or legislature scraping just to hit the number

### 2. Tighten the presentation of long-term roles

`Commit to a Cause` is strong in structured inventory but weak as a dated section.

Measured state:
- active ongoing roles: `61`
- `Commit to a Cause` next 30 days: `2`
- `Ongoing Opportunities` next 30 days: `34`

Interpretation:
- the real content exists
- the event-like lane understates the depth of the long-term side

Aggressive next move:
- treat the structured role inventory as the canonical commitment surface
- keep the dated lane, but do not mistake it for the main inventory

## Fix soon

### 1. Reduce the editorial dominance of the top three volunteer sources

Current next-30-day share across the audited volunteer-balancing pool:
- `hands-on-atlanta`: `55.5%`
- `open-hand-atlanta`: `19.9%`
- `atlanta-community-food-bank`: `18.6%`

Top three total: `94.0%`

Interpretation:
- this is a mix issue, not a quality issue
- HelpATL is currently “excellent, but powered by a few giants”

What to do:
- prioritize presentation/ranking balance before chasing weak new sources
- ensure credible midsize contributors like `medshare` and `trees-atlanta` stay visible

### 2. Clarify civic lane hierarchy for policy-heavy users

Current next-30-day civic counts:
- `Civic Training & Action`: `69`
- `Neighborhood Participation`: `36`
- `School Board Watch`: `9`
- `Atlanta City Government`: `11`
- `Fulton County Government`: `6`
- `Georgia Democracy Watch`: `4`

Interpretation:
- the civic stack is broad
- but the statewide/institutional-process layer is still the thinnest important lane

What to do:
- keep `Policy Watch` and `Civic Updates` visually distinct
- avoid burying official process under generic activism volume

## Leave alone

### 1. Support-directory expansion

Do not start another broad support-directory build pass right now.

Reason:
- all six sections are already at the bar
- more additions now are likely to make it noisier, not better

### 2. Weak volunteer breadth sources as “strategy”

Do not spend more time pretending these rebalance volunteer depth:
- `atlanta-humane-society`
- `lifeline-animal-project`
- other low-yield breadth sources

Reason:
- they are useful for breadth
- they are not meaningful supply-side answers for the main volunteer lane

### 3. More generic policy/news source count

Do not expand the policy feed just to inflate the source count.

Reason:
- the spine is already good enough
- the real gap is official process authority, not article volume

## Recommended execution order

1. improve commitment-surface presentation so structured roles read as first-class content
2. tune volunteer visibility / ranking so the midsize trusted sources are not lost behind the top three
3. keep statewide process authority healthy without treating source-count inflation as a goal

## Bottom line

HelpATL no longer has a general “not enough content” problem.

The portal now has a narrower problem set:
- one authority gap
- one presentation gap
- one concentration gap

That is the right place to be.
