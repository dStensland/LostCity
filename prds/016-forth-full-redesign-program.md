# PRD-016: FORTH Full Redesign Program (Vertical Blueprint Method)

Status: Proposed
Priority: P0
Owner: Product + Design + Frontend
Companions:
- `prds/005a-forth-strategy-context.md`
- `prds/014-forth-consumer-experience-blueprint.md`
- `prds/013-elite-portal-studio-agent-system.md`

## 1. Why This Is A Full Redesign
FORTH has moved beyond incremental UI polish. We now need a structural redesign that:
1. Feels like an elite concierge, not a control interface.
2. Prioritizes quick exploration over schedule construction.
3. Supports pre-arrival planning for future nights (dining, reservations, events).
4. Becomes a repeatable blueprint model for future vertical/customer portals.

## 2. Redesign Outcome
Build a FORTH experience with two primary guest jobs:
1. "Help me decide what to do now."
2. "Help me plan my stay before I arrive."

The experience must remain connected to shared federated data while expressing a distinctly premium FORTH interaction model.

## 3. Blueprint Packet System (Repeatable)
Each vertical redesign must ship a standard packet.

### BP-1 Strategy Lock
- Problem, target personas, business hypothesis, non-negotiables.
- Success metrics and demo proof points.

### BP-2 Consumer IA
- Primary journeys.
- Route architecture and page purpose.
- Section hierarchy by intent.

### BP-3 Design Direction
- Visual language, typography, spacing, photography rules, motion profile.
- Voice and copy rules.

### BP-4 Data and Curation Contract
- Federated vs local data boundaries.
- Ranking inputs and tie-break logic.
- Fallback and provenance policy.

### BP-5 Build Map
- Exact routes, components, API contracts.
- Phase-by-phase implementation sequence.

### BP-6 Validation Plan
- UX quality gates.
- Device QA.
- Launch analytics instrumentation.

## 4. FORTH Target Experience Architecture

### Primary Nav
- Tonight
- Plan Ahead
- Dining + Drinks
- Stay at FORTH
- Club

### Core Journeys
1. Quick explore (arrival or same-day)
- One short preference prompt.
- Immediate best bets.
- Near-FORTH rail.

2. Plan ahead (pre-arrival)
- Date selection for future nights.
- Future-night events and reservation-oriented dining discovery.
- Save/share shortlist.

3. Stay operations (in-house)
- Restaurants + bars in-house.
- Amenities and service requests.

## 5. Program Phases

### Phase 0: Blueprint freeze
Deliverables:
- Finalized BP-1 through BP-6 for FORTH.
- Cross-agent review scorecard (Art Direction, UX, Content, Architecture, Security, Analytics).
Exit criteria:
- No unresolved IA contradictions.
- Clear route separation and product narrative.

### Phase 1: Route and module decomposition
Deliverables:
- Break monolith into route-focused views.
- Keep shared state minimal and explicit.
Exit criteria:
- "Tonight" page can be reasoned about without stay/club complexity.

### Phase 2: Consumer-first construction
Deliverables:
- Quick exploration defaults.
- Plan Ahead flow as first-class path.
- Planner demoted to optional detailed mode.
Exit criteria:
- First useful action in under 10 seconds.

### Phase 3: Premium visual + content pass
Deliverables:
- Editorial photography hierarchy.
- Simplified copy and CTA language.
- Reduced on-screen control density.
Exit criteria:
- Experience reads as premium hospitality, not dashboard software.

### Phase 4: Validation + extraction
Deliverables:
- QA matrix, instrumentation checks, demo script.
- Reusable template pack for next portal.
Exit criteria:
- FORTH playbook reusable with minimal changes for next hotel portal.

## 6. Build Map For Current Codebase

### Existing entrypoints
- `web/app/[portal]/page.tsx`
- `web/app/[portal]/_templates/hotel.tsx`
- `web/app/[portal]/stay/page.tsx`

### Existing FORTH core
- `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`

### Target decomposition
- `web/app/[portal]/_components/hotel/forth/views/TonightExperienceView.tsx`
- `web/app/[portal]/_components/hotel/forth/views/PlanAheadExperienceView.tsx`
- `web/app/[portal]/_components/hotel/forth/views/DiningExperienceView.tsx`
- `web/app/[portal]/_components/hotel/forth/views/StayExperienceView.tsx`
- `web/app/[portal]/_components/hotel/forth/views/ClubExperienceView.tsx`
- `web/app/[portal]/_components/hotel/forth/state/guestJourneyState.ts`
- `web/app/[portal]/_components/hotel/forth/ranking/rankRecommendations.ts`
- `web/app/[portal]/_components/hotel/forth/content/copybook.ts`

### Route additions
- `web/app/[portal]/plan/page.tsx` (Plan Ahead)
- `web/app/[portal]/dining/page.tsx` (Dining + Drinks)
- `web/app/[portal]/club/page.tsx` (Club)

## 7. Quality Gates (Hard Gates)
1. Action Clarity Gate
- Guest can identify primary next action in under 10 seconds.

2. Exploration Speed Gate
- Guest reaches first relevant card in 1 interaction or less.

3. Plan Ahead Gate
- Future date, events, and reservation path are obvious and usable.

4. Density Gate
- No section should feel like an admin panel in guest mode.

5. Mobile Integrity Gate
- No horizontal scroll regressions.

6. Federated Backbone Gate
- Data source provenance and freshness remain visible.

## 8. Metrics
Primary:
- Time to first meaningful action.
- Click-through on best bets.
- Plan Ahead mode engagement.
- Reservation-action click rate.

Secondary:
- Share action usage.
- Return sessions during stay window.
- Session depth for non-admin guests.

## 9. Working Rules
1. No ad-hoc feature additions outside blueprint scope.
2. All UX changes must map to BP packet decisions.
3. Guest mode and admin mode remain explicitly separated.
4. Every phase ends with a measurable checkpoint.

## 10. Definition Of Done
FORTH is considered redesigned when:
1. Guest quick-explore journey is dominant and clear.
2. Plan-ahead journey is robust and reservation-oriented.
3. Stay operations are separated from discovery-first flow.
4. The same process can be applied to another vertical without reinvention.
