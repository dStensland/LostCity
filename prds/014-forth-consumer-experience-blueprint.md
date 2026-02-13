# PRD 014: FORTH Consumer Experience Blueprint

## Why This Exists
The current FORTH portal proves data depth, but still feels like a control panel.
Guests and members need a guided experience that feels effortless, premium, and clear within seconds.

## Expert Panel Review

### 1. Luxury UX Lead
Current issue:
- Too many controls at once (persona, intent, discovery, food focus, mode, bundles).
- Guests must "configure" before they can explore.

Direction:
- One guided choice flow at a time.
- Show strong recommendations immediately, then allow refinement.

### 2. Hotel Concierge Operator
Current issue:
- Language sounds like internal operations, not guest guidance.
- It is not obvious what to do first.

Direction:
- Replace system language with guest language.
- Lead every section with a clear action: choose, browse, book, save.

### 3. Art Director
Current issue:
- Information density flattens the visual hierarchy.
- Premium photography is present but not consistently used as narrative anchors.

Direction:
- Use fewer, bigger visual moments at the top.
- Treat imagery as navigation: Events, Dining & Drinks, Signature Experiences.

### 4. IA Strategist
Current issue:
- City action, hotel amenities, and planning tools are mixed together too early.
- Guests can’t quickly tell "what's happening now" vs "what's available on property."

Direction:
- Separate by guest intent and context:
  - Tonight (city + near FORTH)
  - Dining & Drinks (decision aid)
  - Stay at FORTH (amenities + in-room)
  - Club (member framing)

### 5. Voice + Content Lead
Current issue:
- Tone drifts into technical phrasing and platform vocabulary.

Direction:
- Voice should be calm, warm, and decisive.
- Use plain English and short recommendations.

## Core Experience Principle
"Don’t ask guests to run the system. Be the concierge."

## Proposed Consumer Information Architecture

### Primary Navigation
- Tonight
- Dining & Drinks
- Explore
- Stay at FORTH
- Club (visible when member or member-curious)

### Page 1: `/{portal}` (Tonight)
Goal: Immediate momentum and confidence.

Section order:
1. Hero Brief
- "Good evening" + one-sentence context.
- Two primary CTAs: `Show Tonight Picks`, `Build My Night`.

2. "What are you in the mood for?"
- Single guided chip row (one selection):
  - Live Music
  - Comedy
  - Sports
  - Culture
  - Relaxed
  - Surprise Me

3. "Tonight's Best Bets"
- 3-5 large cards mixing events + venues.
- Every card has: why it’s a fit, distance, timing, one tap action.

4. "Near FORTH Right Now"
- Horizontal rail of walkable/short-ride options.
- Strong imagery and clean metadata.

5. "Build My Night"
- Lightweight itinerary block (max 3 stops visible initially).
- Save/share actions.

### Page 2: `/{portal}/dining`
Goal: Decision support for food + drink.

Section order:
1. Guided selector:
- "What are you craving?"
- Examples: Cocktails, Sports Bar, Mexican, Rooftop, Steakhouse, Coffee.

2. Curated lanes:
- "Best Match"
- "Walkable"
- "Open Late"

3. Spotlight module:
- One premium feature card with service notes + reservation CTA.

### Page 3: `/{portal}/stay`
Goal: Property operating layer, kept out of action-first flow.

Section order:
1. Signature in-house restaurants + bars
2. Amenities (spa, fitness, pool, concierge desk)
3. In-room services

### Page 4: `/{portal}/club`
Goal: Member value clarity.

Section order:
1. Tonight for members
2. Guest policy and etiquette (clear and friendly)
3. Member actions (reserve, login, inquire)

## Persona-First Guidance Model

### Entry Personas
- First-Time Guest
- Business Traveler
- Weekend Couple
- Wellness Stay
- Club Member

### Guidance Flow (2 steps max)
1. "Who is this plan for?"
2. "What sounds good tonight?"

Then auto-render recommendations. No additional setup required.

## Copy System Reset

### Replace These Patterns
- "Configure preferences" -> "Tell us what sounds good"
- "Matching venues" -> "Best fits for your night"
- "Curator mode" -> "How adventurous do you feel?" (admin-only tool labels stay internal)

### Voice Rules
- 6th-8th grade reading level.
- One idea per sentence.
- Every section includes a clear next action.

## Visual Direction Rules
- Use high-quality photography in every top-level section.
- Favor large cards over dense utility clusters.
- Keep type hierarchy dramatic but calm.
- Keep animation subtle and portal-configurable.
- Never allow horizontal scrolling on mobile.

## Product Rules
- Guest/member experience hides advanced system controls.
- Admin-only tooling may appear behind an admin guard.
- Amenities never dominate the default Tonight flow.
- Route architecture should enforce context separation rather than only conditional rendering.

## Technical Mapping to Current Implementation

### Immediate structural changes
1. Break `ForthConciergeExperience` into route-focused views:
- `TonightExperienceView`
- `DiningExperienceView`
- `ExploreExperienceView`
- `StayExperienceView`
- `ClubExperienceView`

2. Introduce a minimal shared guest state object:
- `persona`
- `mood`
- `craving`

3. Keep advanced state (`mode`, `bundle`, reliability controls) in admin-only scope.

4. Move non-essential operational copy out of hero and right rail.

### Suggested file layout
- `web/app/[portal]/_components/hotel/forth/views/TonightExperienceView.tsx`
- `web/app/[portal]/_components/hotel/forth/views/DiningExperienceView.tsx`
- `web/app/[portal]/_components/hotel/forth/views/StayExperienceView.tsx`
- `web/app/[portal]/_components/hotel/forth/views/ClubExperienceView.tsx`
- `web/app/[portal]/_components/hotel/forth/state/guestJourneyState.ts`

## Implementation Plan

### Phase 1: De-clutter and reframe (fast)
- Remove technical copy and redundant controls from default guest view.
- Keep only persona + mood + craving visible.
- Reorder page to: guided choice -> best bets -> near FORTH -> plan.

### Phase 2: Route-level split
- Add dedicated Dining page.
- Keep Stay as separate operational page.
- Add Club page shell.

### Phase 3: Premium polish
- Upgrade top-of-page visual storytelling.
- Ensure section-level editorial photography.
- Tighten spacing and hierarchy for faster scanning.

### Phase 4: Validation
- Mobile QA for no horizontal overflow.
- Track first meaningful action and plan completion rate.
- Run guided user walkthrough with guest/member scenarios.

## Demo Success Criteria
- A first-time guest can pick a plan in under 45 seconds.
- A member can find relevant club actions in under 20 seconds.
- "Tonight" feels city-alive immediately without scrolling far.
- Experience is described as "simple", "premium", and "helpful" in live demos.
