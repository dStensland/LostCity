# FORTH Full Redesign Execution Checklist

Companion to:
- `prds/016-forth-full-redesign-program.md`
- `prds/014-forth-consumer-experience-blueprint.md`

## Phase 0: Blueprint Freeze
- [ ] Confirm strategy lock with product/stakeholders
- [ ] Confirm route IA: Tonight, Plan Ahead, Dining, Stay, Club
- [ ] Freeze guest vs admin behavior contract
- [ ] Freeze visual direction and copybook rules
- [ ] Record scorecard pass using studio-agent method (`prds/013-elite-portal-studio-agent-system.md`)

## Phase 1: Structural Decomposition

### Current files to refactor
- [ ] `web/app/[portal]/_components/hotel/ForthConciergeExperience.tsx`
- [ ] `web/app/[portal]/_templates/hotel.tsx`
- [ ] `web/app/[portal]/_components/hotel/HotelHeader.tsx`

### New module files
- [ ] `web/app/[portal]/_components/hotel/forth/views/TonightExperienceView.tsx`
- [ ] `web/app/[portal]/_components/hotel/forth/views/PlanAheadExperienceView.tsx`
- [ ] `web/app/[portal]/_components/hotel/forth/views/DiningExperienceView.tsx`
- [ ] `web/app/[portal]/_components/hotel/forth/views/StayExperienceView.tsx`
- [ ] `web/app/[portal]/_components/hotel/forth/views/ClubExperienceView.tsx`
- [ ] `web/app/[portal]/_components/hotel/forth/state/guestJourneyState.ts`
- [ ] `web/app/[portal]/_components/hotel/forth/ranking/rankRecommendations.ts`
- [ ] `web/app/[portal]/_components/hotel/forth/content/copybook.ts`

## Phase 2: Route Buildout

### Existing routes
- [ ] `web/app/[portal]/page.tsx` -> Tonight default behavior only
- [ ] `web/app/[portal]/stay/page.tsx` -> stay-only property flow

### New routes
- [ ] `web/app/[portal]/plan/page.tsx`
- [ ] `web/app/[portal]/dining/page.tsx`
- [ ] `web/app/[portal]/club/page.tsx`

### Navigation updates
- [ ] Update `web/app/[portal]/_components/hotel/HotelHeader.tsx` nav model
- [ ] Ensure active states are correct for all new route paths

## Phase 3: Consumer Experience Pass

### Exploration first
- [ ] Hero and first screen focus on rapid exploration
- [ ] "Detailed planner" stays optional and collapsed by default
- [ ] Best bets and near-FORTH appear before dense controls

### Plan ahead
- [ ] Future-night date selector works
- [ ] Future events are surfaced by selected date
- [ ] Reservation-oriented CTAs are present and clear
- [ ] "Where to eat" and "book ahead" path is obvious

### Stay separation
- [ ] In-room services and amenities stay on Stay route
- [ ] Stay route avoids crowding default discovery flow

## Phase 4: Design and Copy Polish
- [ ] Remove technical/arcane language from guest-facing UI
- [ ] Apply premium hierarchy: fewer modules, stronger hero moments
- [ ] Enforce high-quality image standards for top sections
- [ ] Confirm motion profile is subtle and configurable per portal

## Phase 5: Validation

### UX gates
- [ ] First action discoverable in <10 seconds
- [ ] No horizontal overflow on mobile
- [ ] Guest flow does not feel like an admin dashboard
- [ ] Plan ahead flow is understandable without explanation

### Engineering checks
- [ ] Lint passes for changed files
- [ ] Build passes for whole app
- [ ] No route regressions in `/[portal]`, `/[portal]/stay`, `/[portal]/plan`, `/[portal]/dining`, `/[portal]/club`

### Instrumentation
- [ ] Track first meaningful action
- [ ] Track best-bets click-through
- [ ] Track plan-ahead engagement
- [ ] Track reservation-action clicks

## Phase 6: Repeatability Extraction
- [ ] Write reusable notes for the next hotel portal
- [ ] Update vertical template references in PRD index
- [ ] Capture what was configurable vs bespoke
