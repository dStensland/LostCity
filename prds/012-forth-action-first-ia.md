# PRD 012: FORTH Action-First Concierge IA

## Problem
The current FORTH demo is visually stronger, but still feels overloaded and redundant:
- Too many overlapping control systems (persona, intent, discovery focus, food focus, curator mode, bundles).
- Action content (what is happening around me tonight) appears too late.
- Hotel amenities are overrepresented in the main flow.
- The experience can feel like configuring a system, not being guided as a guest.

## Product Goal
Make `/forth` feel like an elite digital concierge that helps guests decide quickly:
1. Understand what vibe they want.
2. Show best nearby options immediately.
3. Build a usable tonight plan in under 60 seconds.

Amenities and operational hotel services should remain available, but no longer dominate the main action feed.

## IA Principles
1. Action-first: show live city + nearby hotel-adjacent action above everything else.
2. One decision surface: merge redundant controls into one guided preference panel.
3. Progressive disclosure: basic choices first, advanced tuning optional.
4. Clear zoning: Tonight vs Explore vs Stay should be distinct mental models.
5. Federated backbone, local expression: city signal remains shared, FORTH experience remains unique.

## Target Information Architecture

### Primary Nav (FORTH variant)
- Tonight (default)
- Explore Atlanta
- Stay at FORTH
- My Plan
- Club (conditional for club-member persona)

### Page 1: `/forth` (Tonight)
Order from top to bottom:
1. Hero + single guidance panel
   - One compact “What are you in the mood for?” surface.
   - Primary CTA: “Show my tonight picks”.
2. Live Right Now
   - High-confidence live destinations + events near FORTH.
3. Tonight by Category
   - Music, Comedy, Sports, Arts, Food & Drink with live counts.
4. Neighborhood Corridors
   - BeltLine / Midtown / Inman / etc with travel time + top picks.
5. Premium Picks
   - Editorial top cards mixed with reliability signals.
6. Build My Night
   - Selected stops + routing + shareable plan.

### Page 2: `/forth/stay` (separate)
- Restaurants + bars in-house
- Amenities (spa, gym, pool, concierge services)
- In-room requests
- Property-only offers

### Page 3: `/forth/club` (optional)
- Member benefits
- Guest allowances
- Member-only events/priority routing

## Control Model (redundancy reduction)

### Keep only 3 primary controls in default view
1. Guest Type
   - First Time, Business, Couple, Wellness, Club Member
2. Tonight Mood
   - Open, Social, Culture, Sports, Date, Recharge
3. Food + Drink Preference
   - Open, Cocktails, Sports Bar, Mexican, Rooftop, Coffee

### Advanced Controls Policy
- Guest/member users: no advanced controls shown.
- Admin users: advanced controls can be shown in a gated drawer for demo and tuning.
- Admin-only controls:
  - Curator mode / risk tolerance
  - Bundle shortcuts
  - Reliability threshold
  - Distance radius override

## Feed Composition Strategy
Each section is generated from a shared federated feed, then ranked by FORTH context.

Ranking inputs (weighted):
- Preference relevance (guest + mood + food)
- Proximity and travel friction
- Freshness / confidence
- Time-window suitability (now vs soon)
- Diversity guardrail (avoid 10 cards from same category/neighborhood)

## UX Copy Direction
Replace system/ops language with guest language:
- “Planning Console” -> “Your Tonight Plan”
- “Configure preferences” -> “Tell us what sounds good”
- “Matching venues” -> “Best fits for your vibe”

## Technical Architecture Mapping

### Keep
- Federated orchestration endpoint and agent outputs
- Existing destination/event card components
- Itinerary composition engine

### Change
1. Refactor `ForthConciergeExperience` into route-mode containers:
   - `TonightView`
   - `ExploreView`
   - `StayView`
2. Move amenity and in-room blocks out of main Tonight page into Stay route.
3. Consolidate control state into `conciergeProfile` object:
   - `persona`
   - `mood`
   - `foodPreference`
   - `advanced` (optional)
4. Treat bundles as quick-start presets (output helper), not parallel control system.

### Proposed file structure
- `web/app/[portal]/_components/hotel/forth/views/TonightView.tsx`
- `web/app/[portal]/_components/hotel/forth/views/ExploreView.tsx`
- `web/app/[portal]/_components/hotel/forth/views/StayView.tsx`
- `web/app/[portal]/_components/hotel/forth/state/conciergeProfile.ts`
- `web/app/[portal]/_components/hotel/forth/ranking/rankForTonight.ts`

## Rollout Plan

### Phase 1: IA skeleton (high impact)
- Move amenities/in-room emphasis off default Tonight flow.
- Introduce action-first section order.
- Collapse controls to 3 primary groups.

### Phase 2: Route split
- Add `/forth/stay` and move property-heavy sections there.
- Keep `/forth` focused on external action + quick planning.

### Phase 3: Ranking polish
- Improve diversity and confidence balancing.
- Add neighborhood corridor storytelling.

### Phase 4: Club mode
- Conditional member-oriented view + callouts.

## Success Criteria
1. Median time-to-first-click on an event/destination decreases.
2. More users interact with Live Right Now and Build My Night sections.
3. Fewer control interactions required before first plan item is selected.
4. Better subjective rating in demos: “feels like a real concierge”.

## Risks
- Over-simplification can hide valuable control for power users.
- Moving amenities may reduce visibility of property value props.

Mitigation:
- Keep a clear Stay nav item + persistent “At FORTH” CTA.
- Keep advanced tuning as admin-only tooling instead of guest-facing UI.
