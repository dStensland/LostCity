# Emory Consumer V1 Execution Board

## Objective
Build a consumer-grade Emory portal using the current wireframe as a starting point, without mixing admin language or internal system framing.

## Product Rule
1. Consumer portal first.
2. Admin portal second.
3. No admin copy, analytics framing, trust telemetry, or system vocabulary in consumer UX.
4. Show capability through user outcomes, not explanatory blocks.

## Scope
In scope:
- `/[portal]` hospital hub entry
- `/[portal]/hospitals` directory
- `/[portal]/hospitals/[hospital]` companion page
- `/[portal]/hospitals/[hospital]/concierge` hospital concierge page
- `/[portal]?view=community` community hub

Out of scope for this track:
- Admin analytics and content management UI
- Source governance explanation UI
- Long-tail experiments outside the core journey

## Banned Consumer Vocabulary
Do not ship these terms in consumer copy:
- confidence
- provenance
- source tier
- attribution
- governance
- federation
- exclusion policy
- system
- pipeline

## Page Contracts

### 1) Hospital Hub (`/[portal]`)
Primary job:
- Get to next critical action in 1 tap.

Required:
- One clear headline
- Primary action row: book/manage, directions, call, services
- Campus quick select
- Community continuation preview (max 3 cards)

Not allowed:
- Multi-panel explanation blocks
- Metrics dashboards
- Decorative hero media

Acceptance criteria:
- Primary action is visible above the fold on desktop and mobile.
- User can open directions in <= 2 interactions.

### 2) Hospital Directory (`/[portal]/hospitals`)
Primary job:
- Choose the right campus and launch action.

Required:
- Simple list/grid of campuses
- Per-campus actions: open guide, wayfinding, call
- Mode toggle that visibly reprioritizes choices

Not allowed:
- Photo-first card treatments
- Animated reveal choreography
- Internal framing copy

Acceptance criteria:
- Every campus card has exactly 1 primary and up to 2 secondary actions.
- No card needs scrolling to see first action.

### 3) Hospital Companion (`/[portal]/hospitals/[hospital]`)
Primary job:
- Complete campus logistics quickly.

Required:
- Immediate actions at top
- Practical sections: services, food, stay, late, essentials
- Explicit non-clinical scope line

Not allowed:
- Hero-image dominance
- Synthetic content shown as live without status

Acceptance criteria:
- Top section contains action cluster + hospital identity only.
- Fallback states are clearly labeled as limited/refreshing.

### 4) Community Hub (`/[portal]?view=community`)
Primary job:
- Continue with practical family/caregiver support.

Required:
- Track cards with clear action
- Schedule/location context
- Open track and open community actions

Not allowed:
- Source telemetry cards
- Multi-column partner inventory dumps

Acceptance criteria:
- User can open a support item from any track in <= 2 interactions.
- Track ordering changes by mode and is visible.

### 5) Hospital Concierge (`/[portal]/hospitals/[hospital]/concierge`)
Primary job:
- Turn visit context into practical day-level support.

Required:
- Needs bar: time + need + constraints
- Real local cards from events/venues/orgs/classes
- Daypart and weekly continuity blocks

Not allowed:
- Mission-statement filler
- Partner/source telemetry display
- Generic search UX

Acceptance criteria:
- User can complete one concierge action in <= 2 interactions.
- Mode and needs visibly reprioritize first-view recommendations.
- Live local activity is visible without scrolling on desktop.

## Milestones and Gates

### M0: Contract Freeze
Deliverables:
- Locked copy deck
- Locked page contracts
- Locked run-of-show path

Gate:
- No implementation starts until M0 is approved.

### M1: Structural Build
Deliverables:
- Core layouts for all five pages
- Routing and CTA flow complete

Gate:
- End-to-end consumer journey works with no dead controls.

### M2: Product Polish
Deliverables:
- Visual hierarchy refinement
- Spacing/type consistency
- Mobile and desktop parity

Gate:
- Pages feel intentionally designed, not scaffolded.

### M3: Reliability and Accessibility
Deliverables:
- Data state hardening (live vs fallback)
- Keyboard/focus/contrast pass
- Demo-safe content stability
- Concierge ranking and fallback behavior QA

Gate:
- No misleading fallback content.
- Critical path passes accessibility checklist.

## Merge Policy
- Use one working track (feature branch + feature flag/slug for testing).
- No partial merges that fail milestone gate.
- If gate fails, continue on branch; do not merge bandaids.

## Demo Run-of-Show (Consumer)
1. Start at hospital hub and trigger one urgent action.
2. Choose campus and show guide action.
3. Open concierge and show real local support cards.
4. Continue to community support track.
5. Switch mode and show visible reprioritization.

Outcome to prove:
- Lost City reduces friction from stress to next action across hospital and community contexts.

## Current Status
- M0: In progress
- M1: In progress
- M2: Pending
- M3: Pending
