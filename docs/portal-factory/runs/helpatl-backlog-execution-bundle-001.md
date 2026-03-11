# HelpATL Backlog Execution Bundle 001

- Date: 2026-03-11
- Portal: `helpatl`
- Purpose: define a broad, bounded tranche of work that can be executed without constant check-ins
- Source inputs:
  - [helpatl-current-data-assessment-002.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-current-data-assessment-002.md)
  - [helpatl-ongoing-opportunity-traceability-wave1-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-ongoing-opportunity-traceability-wave1-001.md)

## 1) What you are approving

Approve the next HelpATL work as one execution bundle with four workstreams:

1. `Policy Watch Depth`
2. `Georgia Process Coverage`
3. `Support Directory Gap Fill`
4. `Volunteer Mix Hardening`

This is intentionally broad enough to make a real dent, but bounded enough to avoid random drift.

## 2) What is already done

These are no longer part of the approval ask:

- ongoing-opportunity traceability gap is closed
- HelpATL ongoing roles now have `0` source-null records
- HelpATL policy/news merge model is live
- HelpATL has a stable civic + humanitarian baseline

## 3) Bundle goals

By the end of this bundle, HelpATL should be measurably better at all three of these:

1. `Policy nerd utility`
2. `Support-resource completeness`
3. `Volunteer lane trust and balance`

## 4) Workstream A: Policy Watch Depth

### Goal

Make HelpATL’s policy/news layer feel intentional, not incidental.

### Approved scope

1. Add `1-3` high-signal policy/explainer/news sources appropriate for HelpATL.
2. Prefer sources with strong public feeds or stable parsing surfaces.
3. Keep Atlanta’s general city-news vibe lighter; add wonkier material locally to HelpATL where appropriate.
4. Decide whether `Atlanta Civic Circle` should remain inherited or become HelpATL-local.

### Target sources

Priority order:

1. `GBPI`
2. `Atlanta Civic Circle` as local policy authority if justified
3. `State Election Board` or another official statewide process feed only if the public surface is stable enough

### Acceptance criteria

- HelpATL local policy/news sources: `2 -> 3-5`
- accessible policy/news posts in 30d increases meaningfully without degrading relevance
- HelpATL’s policy mix is visibly more policy-oriented than Atlanta’s

## 5) Workstream B: Georgia Process Coverage

### Goal

Make HelpATL stronger on statewide public process for highly engaged civic users.

### Approved scope

1. Improve `Georgia Democracy Watch`
2. Add or refine official statewide process/event sources where the public source truth is good
3. Add targeted crossover routing only when there is a justified live example
4. Avoid fake authority by inventing scorecards or process coverage from weak sources

### Target surfaces

Examples:

- State Election Board meetings
- major election administration dates
- Georgia ethics / campaign finance reference surfaces if they support practical user tracking
- legislative or executive process only if the source is public, stable, and materially useful

### Acceptance criteria

- `georgia-democracy-watch` next-30-day count: `1 -> 5+`
- at least `1-2` new high-trust statewide process sources or equivalent routing improvements

## 6) Workstream C: Support Directory Gap Fill

### Goal

Strengthen the weakest help-seeking lane without destabilizing the rest of the portal.

### Approved scope

1. Expand `Work, Money & Daily Life`
2. Add trustworthy metro Atlanta organizations for jobs, workforce, benefits navigation, transportation access, digital access, and daily-life support
3. Keep this as a directory-quality layer, not fake real-time availability

### Acceptance criteria

- `Work, Money & Daily Life` organizations: `11 -> 20+`
- no dilution with low-trust or generic directory spam

## 7) Workstream D: Volunteer Mix Hardening

### Goal

Improve the quality and resilience of the volunteer lane without pretending weak sources solve concentration.

### Approved scope

1. Continue upstream hardening on the few sources that can materially affect trust
2. Improve metadata quality, titles, dedupe, broken links, and stale rows on major volunteer sources
3. Do not spend major effort on breadth sources that are not true volunteer-balancing sources

### Sources in scope

- `Hands On Atlanta`
- `Open Hand Atlanta`
- `Atlanta Community Food Bank`
- `MedShare`
- `Trees Atlanta`

### Explicitly lower priority

- `Atlanta Humane Society`
- `LifeLine Animal Project`
- similar breadth sources that do not materially change volunteer depth

### Acceptance criteria

- top-of-feed volunteer quality remains high
- no reintroduction of generic/broken/stale high-visibility volunteer items
- if concentration improves, it must be through real source yield, not counting tricks

## 8) Guardrails

### Do

- prefer source-truth fixes over presentation patches
- prefer high-trust official/public-interest sources
- keep HelpATL more policy-serious than Atlanta without polluting Atlanta’s vibe
- record each meaningful wave as a run artifact

### Do not

- add random activist/news/support sources just to inflate counts
- treat weak event surfaces as authoritative feeds
- expand admin tooling unless directly needed to support the approved work
- drift into unrelated UI redesign work

## 9) Stop conditions

Pause and ask for direction if any of these happen:

1. a proposed source is politically or editorially ambiguous enough that labeling policy is unclear
2. an official source is blocked enough that work would require brittle scraping
3. a schema change would materially broaden beyond HelpATL’s current platform model
4. the work starts requiring a new product surface instead of deepening current ones

## 10) Recommended execution order

1. `Policy Watch Depth`
2. `Georgia Process Coverage`
3. `Support Directory Gap Fill`
4. `Volunteer Mix Hardening`

Reason:

- policy/process is the highest-value identity gain
- support gap fill is straightforward and contained
- volunteer hardening is still useful, but no longer the best top-level leverage

## 11) Approval shorthand

If approved, the working instruction is:

`Execute the HelpATL backlog bundle through these four workstreams with the listed guardrails, acceptance criteria, and stop conditions. Only stop for blockers that hit the stop conditions.`
