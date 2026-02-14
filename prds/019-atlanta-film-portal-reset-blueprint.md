# PRD 019: Atlanta Film Portal Reset Blueprint

Status: Proposed
Priority: P0
Owner: Product + Design + Frontend + Content Ops
Date: 2026-02-13
Companions:
- `prds/016a-vertical-blueprint-packet-template.md`
- `prds/013-elite-portal-studio-agent-system.md`
- `prds/019a-atlanta-film-portal-implementation-checklist.md`

## 1. Why Reset
The current page direction is not yet a coherent premium product. It feels visually busy, structurally noisy, and strategically under-scoped relative to our architecture.

Reset goal:
- Define the Atlanta film portal as a product system first, then design expression, then implementation.

Core issue to solve:
- We built UI before locking information architecture, sponsor product shape, and curation contract.

## 2. Product Thesis
`/atlanta-film` should be the operating system for Atlanta film culture, not just a listings page.

This means the portal must serve four simultaneous jobs:
1. Fast utility: find what to watch tonight.
2. Cultural depth: understand why these screenings matter.
3. Community participation: connect people, groups, and programs.
4. Sponsor outcomes: drive measurable partner value without intrusive ad patterns.

## 3. Users + Jobs-to-be-Done
### A. Filmgoer (primary)
1. "Show me the best films playing right now."
2. "Help me choose quickly by venue, vibe, or format."
3. "Let me save, ticket out, and share without friction."

### B. Film community member (secondary)
1. "Show me independent screenings, clubs, and series I care about."
2. "Give me trusted context, not algorithmic noise."

### C. Sponsor/partner (commercial)
1. "Place my brand natively in a premium context."
2. "Convert attention into memberships, tickets, and program engagement."
3. "Get reporting that proves value."

## 4. Strategy Lock (Non-Negotiables)
1. Comp-first workflow before implementation.
2. One dominant visual narrative per viewport.
3. Native sponsor modules only; no intrusive banner pattern.
4. Data trust visible near decisions (freshness/provenance).
5. Mobile-first clarity with no horizontal overflow.
6. Keep architecture reusable for future film-city portals.

## 5. Experience Principles
1. Cinematic utility over decorative complexity.
2. Strong hierarchy: hero -> tonight engine -> calendar -> editorial -> community -> partners.
3. Every block must answer one user question only.
4. No strategy/scaffolding copy in user-facing UI.
5. Sponsor modules should feel like programming support, not ad inventory.

## 6. Information Architecture (Locked v1)
Default route: `/{portal}`

### Section order
1. Hero Identity + Primary Actions
- Message: city film layer with premium positioning.
- CTAs: `Showtimes`, `Calendar`, `Festivals`.

2. Tonight Engine
- Live "now screening" film cards.
- Showtimes by film with venue/time chips.
- Quick route to full showtimes mode.

3. Date Rail + Weekly Calendar
- Today + next 6 days.
- Fast context switch for planning.

4. Venue Pulse
- Top active cinemas by screening density.
- Neighborhood cues + peak times.

5. Curated Programs
- Repertory, retrospectives, spotlight programming.
- Strong editorial framing.

6. Festivals + Series
- ATLFF and other program entities.
- Clear CTA to schedule and passes.

7. Film Community
- Clubs, filmmaker groups, classes, collectives.
- Follow/save pathways.

8. Partner Modules
- Presenting partner, membership pushes, co-branded takeovers.
- Structured placements with clear performance events.

9. Extended Feed
- Existing curated sections from portal feed system.

## 7. Feature Matrix (Architecture Leverage)
### Already supported by existing stack
1. Film showtimes API grouped by title/venue/date.
2. Portal feed sections (`now-showing`, `festivals-series`, `film-community`).
3. Event, series, festival, venue detail routes.
4. Find mode switching (`list/map/calendar/showtimes`).
5. Tracking endpoints for behavior instrumentation.
6. Admin-managed sections and source orchestration.

### Must add or tighten for this portal
1. Sponsor inventory model for film vertical (placement IDs + constraints).
2. Editorial program cards with richer curation metadata.
3. Trust chips near showtime decisions:
- freshness timestamp
- source confidence
- provenance label
4. Partner reporting slice for sponsor outcomes.
5. Visual QA gates specific to film portal aesthetics.

## 8. Sponsor Product Design (Non-Intrusive)
### Inventory types
1. `presenting_partner_hero` (single, premium, fixed).
2. `membership_native_card` (in program/screening context).
3. `series_takeover_row` (festival or themed week).
4. `community_partner_spotlight` (group/program support).

### Placement rules
1. Max one sponsor unit per major section cluster.
2. Keep sponsor copy short and context-linked.
3. No autoplay/video ads in feed.
4. Sponsor units inherit site typography and card language.

### Outcome metrics per inventory
1. Viewability (section enter + dwell).
2. CTA click-through.
3. Ticket-out or membership intent clicks.
4. Assisted conversions (later ticket actions).

## 9. Content + Curation Contract
### Federated backbone
1. Showtimes and film events.
2. Venues and neighborhoods.
3. Festivals and recurring series.
4. Community event inventory.

### Film-portal editorial overlay
1. Daily "editor's picks" narrative.
2. Weekly programming themes.
3. Sponsor-aligned programming context (where relevant).

### Freshness SLA
1. Showtimes: daily minimum refresh.
2. Festival/series details: per update cycle, verified weekly.
3. Sponsor modules: campaign start/end windows enforced.

## 10. Analytics + Success Metrics
### North-star metric
- `qualified_film_action_rate` = sessions with showtime click, ticket-out, save, or membership intent.

### Supporting metrics
1. Time to first meaningful action.
2. Showtimes -> ticket-out conversion.
3. Calendar interaction rate.
4. Community module engagement.
5. Sponsor module CTR and assisted conversion rate.
6. Repeat weekly active visitors.

## 11. Scope Boundaries
### In scope (v1)
1. Core route redesign for `/{portal}` film portal.
2. Sponsor-native placements (non-intrusive).
3. Data trust/freshness signals.
4. Performance and mobile QA pass.

### Out of scope (v1)
1. Full self-serve sponsor booking portal.
2. Complex paywall/membership commerce backend.
3. New crawler framework changes unless blocking data quality.

## 12. Delivery Plan
### Phase 0: Blueprint Freeze (1 day)
1. Approve IA, section order, and sponsor inventory map.
2. Approve copy voice and curation standards.

### Phase 1: Comp Sprint (1-2 days)
1. Produce two high-fidelity comps:
- Comp A: Festival-forward premium
- Comp B: Editorial cinema journal
2. Mobile and desktop variants for each.
3. Choose one direction only.

### Phase 2: Implementation Sprint (2-3 days)
1. Build selected comp in `FilmTemplate` + `FilmPortalExperience`.
2. Wire all core modules to live data.
3. Preserve existing feed integration.

### Phase 3: Trust + Sponsor Instrumentation (1 day)
1. Add freshness/provenance treatments.
2. Add sponsor placement metadata and tracking events.

### Phase 4: QA + Demo Readiness (1 day)
1. Visual polish pass.
2. Responsive/accessibility checks.
3. Sponsor demo walkthrough script.

## 13. Acceptance Criteria
1. First viewport communicates identity and utility within 3 seconds.
2. User can find tonight showtimes and click out in <=2 interactions.
3. Sponsor modules look native and do not reduce readability.
4. Page remains coherent when showtimes are unavailable.
5. Mobile experience preserves hierarchy and tap clarity.
6. Build/lint pass with no new regressions in touched files.

## 14. Immediate Decisions for Approval
1. Approve this IA and section order as locked v1.
2. Approve comp-first workflow (no additional production UI changes before comp selection).
3. Approve sponsor inventory set and non-intrusive rules.
4. Approve success metric stack for launch evaluation.
