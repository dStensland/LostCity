# PRD 017: FORTH 24-Hour Concierge Design Thinking Blueprint

Status: Proposed
Priority: P0
Owner: Product + Design + Frontend
Date: 2026-02-13
Companions:
- `prds/014-forth-consumer-experience-blueprint.md`
- `prds/016-forth-full-redesign-program.md`
- `prds/016a-vertical-blueprint-packet-template.md`
- `docs/portal-factory/README.md`

## 1. Why this pass
The current FORTH experience has improved visually, but the core interaction still over-emphasizes configuration and "night planning" language.

Guest reality:
1. Most guests want fast exploration, not rigid planning.
2. Needs span the full stay window: coffee in the morning, daytime activity, dinner/events, and late-night open options.
3. Pre-arrival discovery is high value, but should feel lightweight.

Design rule:
- The product should behave like a concierge guide, not a planning console.

## 2. Expert agent panel synthesis
Using the active agent model in `web/lib/agents/portal-studio/orchestrator.ts`:

### art_direction
- Keep premium visual tone but reduce module count above the fold.
- Lead with one strong story image and one clear decision stack.
- Stop using utility-heavy pill clusters as the primary visual grammar.

### domain_expertise (hospitality)
- Reframe from "tonight-only" to "full-stay concierge".
- Core dayparts must be explicit: Morning, Day, Evening, Late Night.
- "Open now" and "open late" are as important as event quality.

### product_ux
- First interaction should answer:
  1. `Now` or `For later`
  2. `What do you want?` (Food, Entertainment, Destinations)
- No forced itinerary building in the default flow.
- Detailed planner remains optional and hidden for standard guest mode.

### expert_copywriter
- Replace system language with guest language:
  - "Build plan" -> "Save for my stay"
  - "Configure" -> "Tell us what you want"
  - "Matching" -> "Best picks for you"
- Tone target: warm, direct, low-jargon, confidence-forward.

### content_curation
- Recommendations must show trust context at decision time:
  - freshness (verified recently)
  - confidence level
  - source/provenance where relevant
- Avoid mock/fallback leakage in premium hero moments.

### architecture_scale
- Keep the federated backbone.
- Local portal expression should be route-level and copybook-level, not ad hoc flags scattered across one monolith.

### analytics_hypothesis
- Primary KPI shifts from planner depth to decision velocity:
  - time to first meaningful action
  - save/book/route click-through
  - pre-arrival revisit behavior

## 3. Strategy lock (BP-1)
Problem statement:
- Guests are seeing too much setup before value and the experience reads as overly technical.

Target jobs-to-be-done:
1. "Show me what is good right now."
2. "Help me decide what to do at a specific time during my stay."
3. "Let me save/book quickly without building a full schedule."

Business hypothesis:
- A 24-hour guided concierge flow will increase first-action conversion and pre-arrival engagement versus a planner-first flow.

Non-negotiables:
1. Guest/admin control separation.
2. Mobile no horizontal overflow.
3. Visible trust/freshness signals near recommendations.
4. Federated data model preserved.

Success criteria:
1. First meaningful action in under 10 seconds.
2. At least one save/book/route action within the first session in demo walkthroughs.
3. Positive qualitative feedback: "simple," "premium," "helpful."

## 4. Consumer IA (BP-2)
### Primary routes
1. `/{portal}` -> Concierge (default)
2. `/{portal}/plan` -> Plan Stay (date-first, future-focused)
3. `/{portal}/dining` -> Eat + Drink
4. `/{portal}/stay` -> Property services and amenities
5. `/{portal}/club` -> Member-specific context/actions

### Default route structure (`/{portal}`)
1. Hero with immediate concierge CTAs (call/text/in-room)
2. Two-step guidance row:
   - When: `Now` or `For later`
   - Looking for: `Food`, `Entertainment`, `Destinations`
3. Daypart switch:
   - `Morning` | `Day` | `Evening` | `Late Night`
4. Best Bets (mixed events + places)
5. Near FORTH (walkable/short ride)
6. Optional "Need detailed schedule?" module (collapsed, admin-forward)

### Scope boundaries
- Keep amenities and in-room operations on `/stay`.
- Keep route-level context clean: discovery routes should not feel like operations dashboards.

## 5. Design direction (BP-3)
1. Fewer modules, stronger hierarchy.
2. Large photography-led anchors in each major section.
3. One dominant action cluster per viewport.
4. Subtle, configurable motion only.
5. Copy should read at 6th-8th grade level.

Anti-patterns to avoid:
1. Multiple overlapping control panels in one viewport.
2. Planner language as the hero narrative.
3. Technical metadata without guest-facing interpretation.

## 6. Data + curation contract (BP-4)
Federated from Atlanta portal:
1. events
2. destinations
3. specials/open-now signals

FORTH-local overlay:
1. signature venues and amenities
2. member policy context
3. concierge contact and service actions

Ranking priorities (guest mode):
1. daypart relevance
2. open-state relevance (`open now`, `open late`, `starts soon`)
3. proximity friction
4. confidence/freshness
5. user intent fit (food/entertainment/destination)

Fallback policy:
- If confidence/freshness is weak, still show options but clearly label confidence and last verification age.

## 7. Build map (BP-5)
Current architecture already has route-focused views under:
- `web/app/[portal]/_components/hotel/forth/views/`

Next implementation focus:
1. Normalize all route copy to full-day concierge language.
2. Introduce shared daypart model for default and plan-ahead experiences.
3. Ensure first-screen controls are exactly:
   - when
   - what
   - daypart
4. Keep detailed planner behind admin/studio gate.

## 8. Validation plan (BP-6)
UX gates:
1. Guest can start exploring in 1 interaction.
2. Guest can switch to a future date and see relevant options immediately.
3. Guest can find a morning coffee option and a late-night option without route confusion.

QA matrix:
1. iPhone Safari small viewport
2. Android Chrome small viewport
3. Desktop Chrome/Safari

Instrumentation:
1. `first_meaningful_action_ms`
2. `filter_daypart_changed`
3. `intent_type_selected`
4. `save_action_clicked`
5. `reservation_or_route_clicked`

## 9. Execution sequence (repeatable)
1. Blueprint freeze
2. Concierge route simplification
3. Daypart model rollout
4. Copy + visual polish
5. Validation and scorecard

## 10. Immediate implementation decisions
1. Rename the default mental model from "Tonight" to "Concierge" (with daypart controls inside).
2. Keep "Plan Ahead" but position it as "Plan Stay" and date-first.
3. Treat itinerary builder as optional utility, not primary guest flow.
4. Keep trust chips and expand them with daypart/open-state relevance.

## 11. Demo narrative
"This is a full-stay digital concierge. Guests can quickly explore what to do now, what to do later, and what to book before arrival, all from the same federated city backbone with FORTH-native presentation."
