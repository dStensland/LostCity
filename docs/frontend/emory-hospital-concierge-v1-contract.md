# Emory Hospital Concierge V1 Contract

## Purpose
Create a consumer-grade hospital concierge experience that helps people manage life around care, after immediate hospital logistics are handled.

This is a consumer surface. It must feel warm, practical, and human, and it must prove Lost City value using real local activity.

## Product Role in the Journey
1. Hospital Hub: immediate action (book, directions, call, entry).
2. Hospital Concierge: practical daily support around the visit.
3. Community Hub: broader city-level support and participation.

The concierge is the bridge between hospital logistics and community continuity.

## Core Goals
1. Reduce decision load in stressful moments.
2. Turn context into actionable recommendations in one tap.
3. Show real local activity (events, venues, organizations, classes) to prove substance.
4. Keep non-clinical scope explicit while still being useful.

## Lost City Strengths This Page Must Demonstrate
1. Cross-entity orchestration in one flow:
- venues + classes + events + org programs in one practical surface.
2. Context adaptation:
- output changes by mode (`urgent`, `treatment`, `visitor`, `staff`) and by user constraints.
3. Local density:
- recommendations are nearby, open-now aware, and schedule-aware.
4. Continuity:
- support is available for now, later today, and this week.

## IA and Sections

### A) Concierge Header
Content:
- hospital identity
- one-line scope statement: non-clinical support around care visits
- mode selector

Actions:
- `Directions`
- `Call Main Desk`
- `Book/Manage`

### B) Needs Bar (required control row)
Filters:
- Time: `Now`, `Morning`, `Midday`, `Evening`, `Late`
- Need: `Food`, `Lodging`, `Essentials`, `Wellness`, `Caregiver Support`, `Classes`
- Optional constraints: dietary, budget, mobility radius

Behavior:
- changing these inputs reprioritizes cards immediately

### C) Right Now
Purpose:
- fastest practical help near current hospital context

Card types allowed:
- nearby venue card
- support class/event card
- org support slot

### D) Today Plan
Purpose:
- daypart-aware support blocks with clear transitions

Blocks:
- morning
- midday
- evening
- late

### E) This Week Support
Purpose:
- continuity for treatment cycles and family logistics

Content:
- upcoming classes/events
- recurring org programs
- practical weekly anchors

## Card Contract (all cards)
Required fields:
1. `title`
2. `when`
3. `where`
4. `distance or travel hint`
5. exactly one primary CTA

Optional:
1. one short context line
2. one secondary CTA only if essential (for example maps)

Not allowed:
1. source-confidence copy
2. telemetry badges
3. multi-action clutter

## Design Direction
1. Warm, people-forward photography with real human context.
2. Large readable cards with clear action priority.
3. Editorial rhythm: generous spacing, minimal chrome, calm hierarchy.
4. Mobile-first behavior must preserve action visibility above fold.

## Data Contract
Use real Lost City entities where available:
1. Events
2. Venues
3. Organizations
4. Classes/programs

Ranking inputs:
1. `mode`
2. time window
3. category/need
4. distance
5. open-now/open-late
6. budget fit
7. dietary fit (where applicable)

Fallback rule:
1. never present synthetic entries as live local activity
2. if insufficient live data, show explicit limited state and best available practical alternatives

## Copy Rules
Allowed tone:
1. direct
2. practical
3. supportive

Not allowed:
1. admin language
2. system/process explanation
3. mission-statement filler
4. “we are committed to…” copy in task surfaces

## Route Contract
Primary route:
- `/[portal]/hospitals/[hospital]/concierge`

Fallback compatible path:
- `/[portal]/hospitals/[hospital]?view=concierge`

Either is acceptable for V1 if one canonical route is enforced.

## Acceptance Criteria
1. User can get one useful recommendation and act in <= 2 interactions.
2. Mode switch visibly changes ordering in first viewport.
3. At least 3 real Lost City-backed items are visible without scrolling on desktop.
4. At least 1 real Lost City-backed item is visible above fold on mobile.
5. No banned consumer vocabulary appears in UI.
6. No dead controls.

## Demo Proof Flow
1. Open concierge from a hospital.
2. Set `Now + Food` and show open, nearby option.
3. Switch to `This Week + Classes` and show real community programming.
4. Switch mode (`visitor` -> `staff`) and show reprioritization.
5. Complete one action from the page.

## Non-Goals (V1)
1. full itinerary builder
2. authenticated personalization history
3. clinical coordination features
