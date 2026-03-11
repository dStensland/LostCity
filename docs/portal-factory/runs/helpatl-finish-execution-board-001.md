# HelpATL Finish Execution Board 001

- Date: 2026-03-11
- Portal: `helpatl`
- Scope: final execution board to move HelpATL from `build mode` to `operate mode`
- Source plans:
  - [helpatl-done-state-and-finish-plan-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-done-state-and-finish-plan-001.md)
  - [helpatl-backlog-bundle-progress-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-backlog-bundle-progress-001.md)

## 1) Done state

HelpATL is done when all of these are true at the same time:

1. it is the best Atlanta destination to:
   - `do something this week`
   - `commit to a cause`
   - `track and join civic process`
   - `stay smart on policy and public decisions`
   - `find help, not just ways to help`
2. the current surfaces are stable, attributable, and trustworthy enough that the work shifts from expansion to operation
3. the remaining backlog is maintenance or selective refinement, not product-definition work

## 2) Exit criteria

### Must be true

1. `Volunteer This Week`
   - `25+` distinct next-7-day high-quality volunteer opportunities on the main experience
   - `0` blank descriptions across the approved major volunteer-source set in the next 30 days
   - no known high-visibility broken volunteer URLs in the audited top sample
2. `Ongoing Opportunities`
   - `60+` active opportunities
   - `0` source-null active opportunities
3. `Policy / civic authority`
   - `4+` HelpATL-local policy/news sources
   - `175+` resolved posts in 30 days
   - `Georgia Democracy Watch` reaches `5+` useful next-30-day items
4. `Support directory`
   - every lane is `20+` organizations or intentionally justified as smaller
   - `Work, Money & Daily Life` stays `20+`
5. `Governance`
   - manifest matches live HelpATL source state
   - `Live Event Sources` and `Ongoing Opportunity Sources` stay distinct in tooling/docs
   - no open HelpATL-specific federation-critical drift

## 3) Current state

### Already closed

1. HelpATL has a real civic + humanitarian shape.
2. Ongoing opportunity traceability is closed.
3. HelpATL’s local policy/news spine is real:
   - `atlanta-civic-circle`
   - `georgia-recorder`
   - `capitol-beat`
   - `gbpi`
4. `Work, Money & Daily Life` is no longer obviously weak.
5. The major volunteer-source set now has `0` blank descriptions in the next 30 days.

### Still open

1. Volunteer concentration remains high, even if quality is improved.
2. The remaining work is operational monitoring, not finish-line definition work.

## 4) Now

These are the tasks to run immediately.

### A. Close statewide process authority

Goal:

- make `Georgia Democracy Watch` a real destination

Tasks:

1. Keep the new official `georgia-ethics-commission` source live and healthy.
2. Find one more stable official alternative to the still-blocked statewide process pages.
3. Route those items into `Georgia Democracy Watch`.
4. Verify the lane reaches `5+` useful next-30-day items.

Acceptance:

- `Georgia Democracy Watch` is no longer a token lane
- statewide democracy/process coverage is defensible without brittle scraping

Current measured state:

- `Georgia Democracy Watch` next-30-day items: `21`
- official statewide process sources in lane:
  - `georgia-general-assembly`
  - `georgia-ethics-commission`
  - `common-cause-georgia`

Status:

- `closed`

Reference:

- [helpatl-georgia-process-wave2-ethics-source-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-georgia-process-wave2-ethics-source-001.md)
- [helpatl-georgia-process-wave3-general-assembly-source-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-georgia-process-wave3-general-assembly-source-001.md)

### B. Verify policy spine coherence

Goal:

- make sure the current policy layer is actually functioning as one feature

Tasks:

1. Confirm the HelpATL-local policy sources remain active and current.
2. Verify their recent post volume stays above the done-state floor.
3. Audit the feed presentation so policy reporting, explainers, and civic-process items feel connected rather than scattered.

Acceptance:

- the policy layer reads as intentional, not incidental

Current measured state:

- HelpATL local policy/news sources: `4`
- HelpATL local policy/news posts in 30 days: `46`
- HelpATL resolved policy/news posts in 30 days: `187`
- product coherence artifact: [helpatl-policy-watch-coherence-wave3-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-policy-watch-coherence-wave3-001.md)

Status:

- `closed`

## 5) Next

These should run after `Now` is complete.

### A. Lock volunteer quality

Goal:

- keep the volunteer lane trustworthy under concentration

Tasks:

1. Maintain the major-source audit for:
   - blank descriptions
   - stale rows
   - broken URLs
   - generic titles
2. Only harden dominant sources when a real defect appears.
3. Do not spend significant effort pretending weak breadth sources rebalance the lane.

Acceptance:

- volunteer quality holds even if concentration does not materially improve

Current measured state:

- dominant-source blank descriptions in next 30 days: `0`
- dominant-source generic titles in next 30 days: `0`
- audited top source-url sample: `20 / 20` returned `200`
- quality artifact: [helpatl-volunteer-quality-lock-wave3-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-volunteer-quality-lock-wave3-001.md)

Status:

- `closed`

### B. Support-directory finish pass

Goal:

- move the support layer from “strong enough” to “finished”

Tasks:

1. Recheck all six sections for obvious thin spots or awkward overlap.
2. Fill only truly user-facing gaps.
3. Leave the directory readable and curated, not bloated.

Acceptance:

- no support lane feels abandoned or clearly underbuilt

Current measured state:

- all six sections are `20+`
- finish artifact: [helpatl-support-finish-pass-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-support-finish-pass-001.md)

Status:

- `closed`

## 6) Later

These are valid improvements, but they are not finish-line critical.

1. deeper policy/news source expansion beyond the current HelpATL-local spine
2. new volunteer breadth sources that do not materially improve trust or depth
3. further admin/operator UX work
4. broader civic-product expansion beyond the current HelpATL surfaces

Rule:

- do not work on `Later` items before `Now` and `Next` are closed, unless the finish board is fully satisfied

Current read:

- the finish board is materially satisfied
- HelpATL should now be managed on an operating cadence rather than a product-definition backlog

## 7) Blocked

These are known blockers, not open-ended tasks.

No current finish-line blockers.

Watch item:

- Georgia SOS and State Election Board pages are still access-blocked enough that scraping them directly would be brittle
- this is no longer a finish blocker because `Georgia Democracy Watch` now clears the authority bar through other official/high-trust sources

## 8) Operating rules

1. Prefer source-truth fixes over presentation patches.
2. Prefer official or clearly high-trust public-interest sources.
3. Use the right data shape:
   - `Live Event Sources` for dated action
   - `Ongoing Opportunity Sources` for longer-term roles
   - support directory for help-seeking infrastructure
4. Every meaningful wave gets:
   - a run artifact
   - measured evidence
   - an explicit `continue / hold / cut` decision

## 9) Suggested execution order

1. `Now / A` statewide process authority
2. `Now / B` policy spine coherence
3. `Next / A` volunteer quality lock
4. `Next / B` support-directory finish pass

## 10) Definition of complete

HelpATL moves from `build mode` to `operate mode` when:

1. `Now` is closed
2. `Next` is closed
3. no unresolved governance-quality gaps remain on HelpATL itself

Current reality:

- `Next` is now closed
- the only material open item is the last statewide-process authority gap inside `Now / A`

At that point, the default rhythm becomes:

- periodic quality audits
- selective source additions
- maintenance

not another broad backlog bundle.
