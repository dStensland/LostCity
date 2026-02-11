# PRD 009: Emory Demo Next Iteration Plan

## Objective
Increase launch-readiness by proving that the hospital experience can: (1) personalize recommendations by intent, and (2) hand off structured wayfinding payloads for partner integration (Gozio).

## Completed in this iteration
- Reworked Emory overview into a strategic 3-step golden path:
  - Step 1: choose intent mode
  - Step 2: choose hospital context
  - Step 3: execute highest-value next action
- Added mode-aware relevance scoring for hospital nearby recommendations (`urgent`, `treatment`, `visitor`, `staff`).
- Wired ranking into hospital landing data retrieval so mode changes both ordering and section flow.
- Added Gozio-oriented wayfinding payload contract on hospital endpoint:
  - `GET /api/portals/:slug/hospitals/:hospital?mode=:mode&include=wayfinding`
- Exposed wayfinding payload access from hospital landing page for integration demos.
- Added interaction event tracking foundation:
  - New attributed event stream (`portal_interaction_events`)
  - Action tracking API (`POST /api/portals/:slug/track/action`)
  - Hospital UI instrumentation for `mode_selected`, `wayfinding_opened`, `resource_clicked`
  - Admin and portal analytics dashboards now show interaction KPIs and trends
- Completed hospital experience design pass for sales demos:
  - Premium redesign of `/emory-demo/hospitals` directory with mode briefing, trust framing, and conversion-first campus cards
  - Premium redesign of `/emory-demo/hospitals/:hospital` with concierge snapshot, mode-aware section framing, and stronger public-health continuation rails
  - Improved nearby counts in concierge snapshot by deduplicating cross-category venues

## Why this matters for ROI proof
- Demonstrates audience intent impacts recommendation quality (not just UI labels).
- Enables measurable hypotheses:
  - Time-to-resource improves when ranking matches audience mode.
  - Wayfinding handoff conversion improves with structured, top-ranked destinations.

## Next 2 sprints
### Sprint A: Measurement + trust
- Expand KPI quality from counts to conversion slices:
  - clicks/session,
  - wayfinding handoff rate,
  - late-night resource CTR,
  - on-site service CTR.
- Add attribution labels per card (source + trust tier) where missing.

### Sprint B: Federation quality hardening
- Add freshness and confidence scoring to nonprofit/public health sources.
- Add low-quality suppression gates (stale/duplicate/off-topic).
- Add Emory-specific curation policy file for exclusions and priority source boosts.

## Open assumptions needing Emory validation
- Preferred wayfinding launch scheme and deep-link parameters.
- On-site service data owners per hospital and update cadence.
- Late-night support policy for each hospital campus.

## Demo acceptance criteria
- Changing mode alters top 5 recommendations per category.
- Wayfinding payload endpoint returns hospital + ranked destination sets.
- No Piedmont resources appear in Emory experience routes.
