# PRD 018: FORTH Elite Concierge V2 (Remaining Scope)

Status: Proposed
Priority: P0
Owner: Product + Design + Frontend
Date: 2026-02-13
Companions:
- `prds/014-forth-consumer-experience-blueprint.md`
- `prds/016-forth-full-redesign-program.md`
- `prds/016a-vertical-blueprint-packet-template.md`
- `prds/016c-forth-content-contract.md`
- `prds/017-forth-24h-concierge-design-thinking-blueprint.md`

## 1. Purpose
This PRD captures the remaining work to make FORTH feel like a true premium guest and member concierge, not a configuration-heavy product UI.

Core intent:
1. Show the best options fast.
2. Support the full day (not just night).
3. Support future-stay planning before arrival.
4. Keep the federated Atlanta backbone while expressing a distinct FORTH experience.

## 2. What Must Change
1. Too much setup appears before great content.
2. Tone still reads technical in places.
3. Choice architecture is cluttered and repetitive.
4. Some category options can appear even when we have little or no matching data.
5. Amenities and operations can overshadow city action in discovery moments.
6. Visual quality is inconsistent when imagery fails.

## 3. Guest Outcomes (Definition Of Success)
1. Guest finds a relevant option in one interaction.
2. Guest can browse by time of day: morning, day, evening, late night.
3. Guest can switch to a future date and immediately see events + dining options.
4. Guest can open a reservation/pathway without building a detailed schedule.
5. Member can quickly find club-relevant context without admin-like controls.

## 4. Blueprint Packet (Repeatable Vertical Method)

### BP-1 Strategy Lock
Problem statement:
- The current FORTH UI proves capability but still behaves like a control layer.

Hypothesis to prove:
- A guided concierge flow with time-aware curation and strong photography will increase decision speed and confidence for guests and members.

Non-negotiables:
1. Guest/admin separation (advanced controls admin-only).
2. No horizontal overflow on mobile.
3. Per-portal visual controls (including background effects) must be configurable.
4. Every recommendation card must lead to a useful destination (event page, map route, reservation path, or venue detail).
5. Secondary options only render when matching content exists.

### BP-2 Consumer IA
Primary routes:
1. `/{portal}`: Concierge (default, action-first)
2. `/{portal}/plan`: Plan Stay (future date first)
3. `/{portal}/dining`: Eat + Drink
4. `/{portal}/stay`: At FORTH (amenities + in-room services)
5. `/{portal}/club`: Club member context

Default route order (strict):
1. Hero + immediate CTAs: Call Concierge, Text Desk, In-Room Requests
2. Elegant amenities preview carousel (small, non-blocking)
3. Guided chooser: `When` + `What` + `Time of day`
4. Best Bets (large, photo-led)
5. Near FORTH rail (walkable/short ride)
6. Week/Weekend curation rail
7. Optional detailed planner entry (collapsed)

Important IA rules:
1. Discovery is the default. Planning is optional.
2. Stay operations live on `/stay`; only a preview appears on `/`.
3. No repeated control clusters serving the same purpose.

### BP-3 Design Direction
Visual rules:
1. Heavy use of high-quality photography in key sections and second-level choices.
2. Big-card hierarchy for scanning; fewer small utility blocks.
3. Motion is subtle and configurable per portal.
4. Remove/disable strong background rain effect for FORTH by default.
5. Guest-facing copy must be plain and warm, not technical.

Copy rules:
1. Use concierge language: "What sounds good?", "Best picks right now", "Plan before you arrive".
2. Avoid terms like "configure", "compiler", "orchestration", "matching engine" in guest UI.
3. Do not frame experience as "Tonight only"; support full-day and future-stay language.

### BP-4 Data + Curation Contract
Federated from Atlanta portal:
1. Events
2. Destinations/venues
3. Specials and open-state signals
4. Confidence/freshness metadata

FORTH-local overlay:
1. Signature venues and amenities
2. Club policy/context snippets
3. Concierge and reservation pathways
4. Seasonal/property callouts (for examples like World Cup periods)

Ranking and rail logic:
1. Time-of-day relevance first.
2. Open-state relevance second (`open now`, `open late`, `starting soon`, `happy hour now`).
3. Distance/friction third.
4. Confidence/freshness fourth.
5. Persona and category fit fifth.

Required curation rails:
1. Morning: coffee, breakfast, markets, light activities.
2. Day: lunch, treats, daytime destinations.
3. Evening: dinner, bars, events.
4. Late night: food and bars still open after 9 PM.
5. Happy hour: shown only in the relevant window and only with valid specials.
6. This week/this weekend: elevated events aligned to FORTH vibe.

Second-level option gating:
1. Sub-options (for Food, Entertainment, Destinations) appear only if matching content exists.
2. If no matches, hide the option and keep a safe fallback like "Surprise Me".
3. Never send guests into empty states from visible chips.

### BP-5 Build Map
Architecture requirements:
1. Keep federated feed model unchanged.
2. Move portal-specific visuals/animation toggles into a portal theming config.
3. Keep admin tuning tools behind explicit admin gate.
4. Keep guest state minimal: persona (optional), when, what, daypart, date.

Implementation modules:
1. `HeroActionStrip` (immediate CTAs)
2. `AmenitiesPreviewCarousel` (compact teaser)
3. `GuidedChooser` (When/What/Daypart)
4. `BestBetsRail` (large editorial cards)
5. `NearForthRail` (walkability-forward)
6. `WeekWeekendRail` (future-facing curation)
7. `OptionalPlannerEntry` (collapsed utility)

Interaction requirements:
1. Event card click must always navigate to valid event detail.
2. Venue card click must navigate to venue detail, map route, or reservation pathway.
3. Broken image fallback stack must preserve premium appearance and avoid blank/awkward cells.

Integration posture:
- This experience layer can plug into external concierge ops backends.
- Internal concierge request tooling remains optional and tenant-dependent.

### BP-6 Validation Plan
UX quality gates:
1. First meaningful action in under 10 seconds.
2. No horizontal scroll on iPhone mini width.
3. Top of page shows action + premium content before dense controls.
4. At least one booking/routing path visible in each major section.
5. Secondary chips never show when content is missing.

QA matrix:
1. iPhone Safari
2. Android Chrome
3. Desktop Chrome/Safari

Instrumentation events:
1. `concierge_first_action_ms`
2. `concierge_daypart_selected`
3. `concierge_primary_type_selected`
4. `concierge_secondary_type_selected`
5. `concierge_happy_hour_opened`
6. `concierge_weekend_event_opened`
7. `concierge_reservation_clicked`
8. `concierge_route_clicked`

## 5. Experience Details To Implement

### 5.1 Guided exploration over rigid planning
1. Keep planning optional and collapsed by default.
2. Reframe planner as "Need a step-by-step plan?" not primary behavior.
3. Keep save/bookmark behaviors without requiring itinerary lock-in.

### 5.2 Time-aware concierge feed
1. Auto-bias recommendations based on local time.
2. Let users switch time-of-day manually.
3. Include explicit late-night options and open-late indicators.

### 5.3 Better food/drink exploration depth
1. Add second-level cuisine and vibe options (examples: cocktails, sports bar, Mexican, coffee, rooftop).
2. Show these only when data exists.
3. Keep strong photo-led cards for each available option.

### 5.4 Week/weekend planning
1. Add "This Week" and "This Weekend" event rails.
2. Curate toward elevated standards and hotel-fit tone.
3. Include direct actions: view details, route, reserve/bookmark.

### 5.5 Premium media quality standards
1. Prioritize venue/event imagery over generic placeholders.
2. Enforce image fallback chain and card-safe masking.
3. Run broken-image QA pass before demos.

## 6. Content Strategy (Atlanta + FORTH)
Pull from Atlanta backbone:
1. Broad event inventory for today/week/weekend.
2. Destination graph for walkability and nearby discovery.
3. Specials confidence and verification data.

Pull/author from FORTH:
1. Property venue positioning and signature callouts.
2. Amenities, in-room services, and contact pathways.
3. Club context and member-relevant notes.
4. Seasonal editorial callouts tied to major moments in-town.

Known content gaps to track:
1. Reservation links not consistently available.
2. Late-night and happy-hour coverage uneven by neighborhood.
3. Club-specific event signals may be sparse without local overlays.

## 7. Demo-Critical vs Post-Demo

Demo-critical (must ship):
1. Simplified IA and reduced control clutter.
2. Time-aware rails including happy hour and late-night context.
3. Content-aware secondary option gating.
4. Week/weekend curated section.
5. Broken image fixes and no mobile horizontal overflow.

Post-demo (acceptable backlog):
1. Full concierge workflow integrations per tenant backend.
2. Fully production-grade media pipeline and rights workflow.
3. Expanded member-only service automations.

## 8. Execution Plan
1. IA simplification pass (remove redundant controls; enforce section order).
2. Time-aware rail pass (daypart + happy hour + open-late logic).
3. Secondary option gating and empty-state hardening.
4. Week/weekend curation + reservation/action pathways.
5. Visual polish pass (media quality, motion controls, copy cleanup).
6. QA + analytics instrumentation pass.

## 9. Risks and Mitigation
1. Risk: over-curation reduces exploration breadth.
- Mitigation: keep "Surprise Me" and "All" options always available.

2. Risk: data sparsity hides too many options.
- Mitigation: blend strict matching with controlled fallback rails and transparent confidence labels.

3. Risk: premium visual layer regresses performance.
- Mitigation: image sizing, lazy loading, and route-level content budgets.

## 10. Exit Criteria
This PRD is complete when:
1. FORTH feels guest-first and delightful within the first screen.
2. Guests can discover now and plan later without friction.
3. The same pattern can be reused for new hotel customers with portal-level customization and shared federated backbone.
