# Portal Premium UX Agentic Execution Spec

`version`: `v2`  
`date`: `2026-02-10`  
`scope`: `/Users/coach/Projects/LostCity/web`  
`mode`: `agent-first` (optimized for parallel coding agents)  
`timebox`: `10-minute dispatch + parallel execution`

---

## 0) Run Contract

Use this file as an execution manifest, not a strategy memo.

`hard_rules`:
- Make atomic PR-sized edits.
- Keep changes within declared `target_paths`.
- No ad hoc design primitives; use semantic tokens.
- Run listed verification commands before handoff.
- Write handoff artifacts to `tmp/ux_agent_runs/`.

`global_success_criteria`:
- Discovery UX feels faster and simpler.
- Long sections use preview -> expand -> dedicated full-view pattern.
- Typography and color semantics are consistent across portal surfaces.
- Festival UX standards are applied across non-festival surfaces.

---

## 1) Standards Manifest (Carry Festival Decisions Portal-Wide)

These standards are mandatory for all work packets.

`STD-01 progressive_disclosure`:
- Default long lists to preview mode.
- Provide inline `See more` / `Show fewer`.
- Provide dedicated route for heavy full views when appropriate.

`STD-02 content_hierarchy`:
- Event/session is primary entity.
- Program/series is secondary context.
- Metadata should not outrank title/time/venue.

`STD-03 sticky_actions`:
- Detail pages keep primary action persistent when conversion is likely.

`STD-04 typography_scale`:
- Enforce one hierarchy: page title, section title, card title, metadata, label.
- Remove one-off text sizing/casing patterns where inconsistent.

`STD-05 color_semantics`:
- Category color = classification only.
- Action color = CTA only.
- State colors = live/free/sold-out/status only.
- No mixed semantic meaning for same color token.

---

## 2) Task Graph (Parallel)

### Machine-Readable Plan
```yaml
run_id: portal-premium-ux-v2
dispatch_order:
  - UX-00
  - [UX-01, UX-02, UX-03, UX-04, UX-05]
  - UX-06
tasks:
  - id: UX-00
    priority: P0
    est_minutes: 10
    parallel_group: setup
    objective: Create baseline metrics and ensure tmp output directory exists.
    target_paths:
      - /Users/coach/Projects/LostCity/web
      - /Users/coach/Projects/LostCity/tmp/ux_agent_runs
    deliverables:
      - /Users/coach/Projects/LostCity/tmp/ux_agent_runs/UX-00-baseline.md
    verify:
      - cd /Users/coach/Projects/LostCity/web && npm run lint

  - id: UX-01
    priority: P0
    est_minutes: 20
    parallel_group: core
    depends_on: [UX-00]
    objective: Route/state simplification for portal mode navigation.
    target_paths:
      - /Users/coach/Projects/LostCity/web/app/[portal]/page.tsx
      - /Users/coach/Projects/LostCity/web/components/headers/StandardHeader.tsx
      - /Users/coach/Projects/LostCity/web/components/views/DetailViewRouter.tsx
    deliverables:
      - /Users/coach/Projects/LostCity/tmp/ux_agent_runs/UX-01-routing.md
    verify:
      - cd /Users/coach/Projects/LostCity/web && npx eslint 'app/[portal]/page.tsx' 'components/headers/StandardHeader.tsx' 'components/views/DetailViewRouter.tsx'

  - id: UX-02
    priority: P0
    est_minutes: 20
    parallel_group: core
    depends_on: [UX-00]
    objective: Typography and semantic color normalization in high-impact components.
    target_paths:
      - /Users/coach/Projects/LostCity/web/app/globals.css
      - /Users/coach/Projects/LostCity/web/components/EventCard.tsx
      - /Users/coach/Projects/LostCity/web/components/SimpleFilterBar.tsx
      - /Users/coach/Projects/LostCity/web/components/feed/FeedShell.tsx
      - /Users/coach/Projects/LostCity/web/components/detail/DetailHero.tsx
    deliverables:
      - /Users/coach/Projects/LostCity/tmp/ux_agent_runs/UX-02-design-system.md
    verify:
      - cd /Users/coach/Projects/LostCity/web && npx eslint components/EventCard.tsx components/SimpleFilterBar.tsx components/feed/FeedShell.tsx components/detail/DetailHero.tsx app/globals.css

  - id: UX-03
    priority: P0
    est_minutes: 15
    parallel_group: core
    depends_on: [UX-00]
    objective: Apply progressive disclosure pattern to long-list components beyond festivals.
    target_paths:
      - /Users/coach/Projects/LostCity/web/components/VenueEventsByDay.tsx
      - /Users/coach/Projects/LostCity/web/components/SeriesCard.tsx
      - /Users/coach/Projects/LostCity/web/components/views/SeriesDetailView.tsx
    deliverables:
      - /Users/coach/Projects/LostCity/tmp/ux_agent_runs/UX-03-progressive-disclosure.md
    verify:
      - cd /Users/coach/Projects/LostCity/web && npx eslint components/VenueEventsByDay.tsx components/SeriesCard.tsx components/views/SeriesDetailView.tsx

  - id: UX-04
    priority: P0
    est_minutes: 15
    parallel_group: core
    depends_on: [UX-00]
    objective: Perceived-speed improvements (prefetch, loading behavior, skeleton flash reduction).
    target_paths:
      - /Users/coach/Projects/LostCity/web/components/find/FindViewLazy.tsx
      - /Users/coach/Projects/LostCity/web/components/find/FindView.tsx
      - /Users/coach/Projects/LostCity/web/app/[portal]/events/[id]/loading.tsx
      - /Users/coach/Projects/LostCity/web/components/FestivalSchedule.tsx
    deliverables:
      - /Users/coach/Projects/LostCity/tmp/ux_agent_runs/UX-04-performance.md
    verify:
      - cd /Users/coach/Projects/LostCity/web && npx eslint components/find/FindViewLazy.tsx components/find/FindView.tsx 'app/[portal]/events/[id]/loading.tsx' components/FestivalSchedule.tsx

  - id: UX-05
    priority: P1
    est_minutes: 20
    parallel_group: core
    depends_on: [UX-00]
    objective: Trust UX (freshness, source provenance, action clarity).
    target_paths:
      - /Users/coach/Projects/LostCity/web/app/[portal]/events/[id]/page.tsx
      - /Users/coach/Projects/LostCity/web/components/EventCard.tsx
    deliverables:
      - /Users/coach/Projects/LostCity/tmp/ux_agent_runs/UX-05-trust-ux.md
    verify:
      - cd /Users/coach/Projects/LostCity/web && npx eslint 'app/[portal]/events/[id]/page.tsx' components/EventCard.tsx

  - id: UX-06
    priority: P0
    est_minutes: 10
    parallel_group: merge
    depends_on: [UX-01, UX-02, UX-03, UX-04, UX-05]
    objective: Merge, resolve overlaps, run full validation, produce release note.
    target_paths:
      - /Users/coach/Projects/LostCity/web
      - /Users/coach/Projects/LostCity/tmp/ux_agent_runs
    deliverables:
      - /Users/coach/Projects/LostCity/tmp/ux_agent_runs/UX-06-merge-summary.md
    verify:
      - cd /Users/coach/Projects/LostCity/web && npm run lint
      - cd /Users/coach/Projects/LostCity/web && npm run build
```

---

## 3) Worker Packets (Copy/Paste Prompts For Agents)

### UX-01 Routing Agent
`prompt`:
Implement route/state simplification for portal mode navigation. Use `STD-01` to `STD-05`. Keep edits to declared `target_paths`. Run verification commands. Write a concise handoff to `tmp/ux_agent_runs/UX-01-routing.md` with: changed files, behavior changes, known risks.

### UX-02 Design System Agent
`prompt`:
Normalize typography and color semantics in high-impact components. Remove ad hoc styling where it conflicts with tokens and hierarchy. Preserve existing visual language direction. Run verification commands and write `tmp/ux_agent_runs/UX-02-design-system.md`.

### UX-03 Progressive Disclosure Agent
`prompt`:
Apply preview/expand/full-view pattern to non-festival long lists. Keep mobile-first readability. Avoid deep rewrites. Run verification commands and write `tmp/ux_agent_runs/UX-03-progressive-disclosure.md`.

### UX-04 Performance Agent
`prompt`:
Improve perceived speed in discovery and detail transitions. Prioritize prefetch and loading-state polish. Avoid large architectural migrations. Run verification commands and write `tmp/ux_agent_runs/UX-04-performance.md`.

### UX-05 Trust UX Agent
`prompt`:
Add data freshness and source/action clarity to event surfaces without visual clutter. Maintain existing CTA patterns. Run verification commands and write `tmp/ux_agent_runs/UX-05-trust-ux.md`.

### UX-06 Merge Agent
`prompt`:
Merge all packets, resolve conflicts, run full lint/build, and produce a release summary with validation output paths and residual risks in `tmp/ux_agent_runs/UX-06-merge-summary.md`.

---

## 4) 10-Minute Blitz Mode

If you want immediate visible wins in ~10 minutes, run only these:

`blitz_tasks`: `UX-03 + UX-04 + UX-05 (partial) + UX-06`

`blitz_acceptance`:
- At least one non-festival long list now uses preview/expand behavior.
- Festival/detail/find transitions feel faster via prefetch/loading polish.
- Event detail includes visible freshness/provenance hint.
- Lint passes for touched files.

---

## 5) Output Contract

Each worker artifact must include:

```md
# <TASK_ID> Handoff
## Files Changed
- absolute/path
## Behavior Changes
- concise bullets
## Verification
- command
- result
## Risks / Follow-ups
- concise bullets
```

---

## 6) KPI Checks (Post-Merge)

Track weekly after deployment:
- find -> detail latency (`p50`, `p95`)
- festival -> event latency (`p50`, `p95`)
- filter-to-click conversion rate
- save + RSVP conversion
- 7-day return rate
- UX regression bug count

---

## 7) Notes

- Festival schedule full-view route and lineup progressive disclosure are now reference implementations.
- New UX work should clone those patterns before introducing novel interaction paradigms.
