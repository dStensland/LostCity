# HelpATL Content Remediation Plan 001

- Date: 2026-03-11
- Portal: `helpatl`
- Surface: `consumer`
- Based on: [helpatl-current-content-audit-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-current-content-audit-001.md)
- Decision: `go`

## 1) Objective

Use the current content audit to drive the next hardening wave with measurable goals.

This plan is intentionally narrow. It focuses on the three real weaknesses exposed by the live content audit:

1. source concentration in near-term event inventory
2. thinner long-term/commitment coverage relative to drop-in coverage
3. thinner statewide/process-watch and support-directory lanes

## 2) Current baseline

Live baseline carried forward from the audit:

- active channels: `20`
- materialized event-channel matches: `2783`
- active ongoing roles: `61`
- next-7-day volunteer matches: `332`
- next-30-day volunteer matches: `909`
- top-3 source share of next-30-day inventory: `79.1%`
- `Commit to a Cause` backing roles: broad but still visibly thinner than the volunteer event side
- `georgia-democracy-watch`: `3` future matches
- `Work, Money & Daily Life` support organizations: `11`

## 3) Success targets

### Content mix

1. Reduce top-3 source share of next-30-day event inventory from `79.1%` to `<= 70%`.
2. Raise the next tier of event sources so at least `5` sources contribute `20+` events in the next `30` days.
3. Keep `Volunteer This Week` above `25` distinct credible next-7-day opportunities at all times.

### Commitment / ongoing roles

1. Increase active ongoing roles from `61` to `70+`.
2. Reduce org-first ongoing roles from `11` to `<= 6` where source linkage is realistically available.
3. Ensure every visible commitment cause lane has at least `3` source-backed roles.

### Civic authority

1. Increase `georgia-democracy-watch` from `3` future matches to `10+`.
2. Add at least `2` more official or official-adjacent statewide institutional process sources before opening any new civic lane.

### Support resources

1. Increase `Work, Money & Daily Life` support orgs from `11` to `20+`.
2. Keep all existing support sections at or above current breadth while expanding the thinnest lane.

## 4) Workstreams

## Workstream A: Event inventory balancing

Goal: make HelpATL feel broad, not dependent on three volunteer sources.

Priority sources:

1. `trees-atlanta`
2. `medshare`
3. `mobilize-us`
4. `atlanta-humane-society`
5. `concrete-jungle`
6. `lifeline-animal-project`
7. `georgia-equality`
8. `atlanta-dsa`

Actions:

1. Audit each priority source for next-30-day yield, title quality, and stale-row pressure.
2. Fix underperforming sources at ingestion before adding more sources.
3. Prefer strengthening direct sources over adding more aggregators.
4. Track whether the source meaningfully reduces top-3 concentration after each hardening pass.

Exit bar:

1. at least `2` of the priority sources move above `20` next-30-day events
2. top-3 concentration drops below `75%` on the first pass

## Workstream B: Commitment lane depth

Goal: make `Commit to a Cause` feel like a destination, not a side rail.

Priority sources / org families:

1. `hope-atlanta`
2. `irc-atlanta`
3. `new-georgia-project`
4. `fair-fight`
5. `canopy-atlanta`
6. `our-house`
7. `new-american-pathways`

Actions:

1. Audit the `11` org-first roles and link them to a real backing source wherever possible.
2. Remove or rewrite weak roles that do not have enough specificity to rank well.
3. Add source linkage first for civic-engagement and immigrant/refugee roles, where traceability matters most.
4. Re-rank commitment browse views only after source linkage is improved.

Exit bar:

1. org-first roles drop from `11` to `<= 8` on the first pass
2. `Commit to a Cause` gains at least `5` additional source-backed roles

## Workstream C: Statewide process authority

Goal: give policy-heavy users a stronger institutional watch lane.

Priority sources:

1. Georgia General Assembly calendars / committee schedules
2. Georgia Secretary of State / State Election Board
3. Governor / OPB budget document and executive update surfaces
4. one strong statewide public-policy reporting layer:
   - `georgia-recorder`
   - `capitol-beat`
   - `atlanta-civic-circle` for Atlanta-local policy interpretation

Actions:

1. separate `official process` from `reporting/explainer` sources
2. do not merge scorecards, advocacy ratings, and neutral reporting into one lane
3. add only sources that help a user stay informed on actual state decisions, votes, calendars, or executive actions

Exit bar:

1. `georgia-democracy-watch` reaches `10+` future items
2. HelpATL has a truthful policy-watch answer for legislature, election administration, and executive/budget process

## Workstream D: Support-directory balancing

Goal: close the thinnest support lane without reworking the whole directory.

Priority areas for `Work, Money & Daily Life`:

1. workforce development
2. job placement / training
3. financial counseling
4. transportation assistance
5. benefits navigation

Actions:

1. inventory current organizations in the section and identify obvious missing anchor orgs
2. add only trusted metro Atlanta organizations with clear service descriptions
3. avoid turning this into a general “miscellaneous services” bucket

Exit bar:

1. section grows from `11` to `15+` on first pass
2. at least `4` sub-areas above are represented

## 5) Build order

Recommended order:

1. `Workstream A`
2. `Workstream B`
3. `Workstream C`
4. `Workstream D`

Reason:

- A and B improve the main user promise fastest
- C is strategically important, but should be done with clearer source discipline
- D matters, but the current support layer is already usable

## 6) Weekly review template

Update these every cycle:

1. top-3 next-30-day source share
2. number of sources with `20+` next-30-day events
3. active ongoing roles
4. org-first ongoing roles
5. `georgia-democracy-watch` future count
6. `Work, Money & Daily Life` organization count
7. any new duplicate clusters or broken-link regressions

## 7) Bottom line

HelpATL does not need more random breadth right now.

It needs:

1. a better event-source mix
2. stronger traceability and depth in long-term roles
3. a more serious statewide process-watch layer
4. a less thin practical-support lane

Those four fixes are enough to make the portal feel more definitive without reopening the architecture.
