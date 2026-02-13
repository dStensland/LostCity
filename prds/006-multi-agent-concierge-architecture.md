# PRD-006: Multi-Agent Concierge Architecture

**Status**: Proposed  
**Priority**: P0 for premium portal demos (FORTH + next destinations)  
**Strategic Alignment**: Federated backbone + bespoke portal expression

---

## 1. Objective

Define a specialized multi-agent system that can:

1. Reuse Lost City's shared federation/data backbone.
2. Produce radically different concierge experiences per customer portal.
3. Maintain high data accuracy and explainable confidence.
4. Support both hotel guests and member personas (FORTH Club included).

This is not "one mega-agent." It is a coordinated set of narrow agents with clear contracts.

---

## 2. Design Principles

1. **Facts are global, expression is local**  
   Data quality and federation stay shared. Tone, layout, and recommendations are portal-specific.

2. **Guest-first language, operator-grade internals**  
   End-user output stays simple and premium. Internal scoring can be technical.

3. **Deterministic guardrails around AI decisions**  
   AI can rank and phrase; deterministic rules own access control, safety, and freshness constraints.

4. **Composable agents over monolith prompts**  
   Each agent has a narrow role, explicit inputs/outputs, and measurable SLAs.

---

## 3. Agent Topology

### Orchestrator (Supervisor)

`Concierge Orchestrator Agent`
- Role: runs the sequence, merges outputs, resolves conflicts.
- Inputs: portal slug, session context, current time, user selections/persona.
- Outputs: unified concierge state payload for UI/API.
- Non-goals: does not author all content itself.

### Specialized Agents

1. `Federation Access Agent`
- Purpose: determine what content this portal can legally/accessibly use.
- Inputs: `portal_id`, sharing rules, subscriptions, source/category constraints.
- Backing systems: `portal_source_access`, source sharing/subscription tables.
- Output:
  - `allowed_source_ids[]`
  - `category_constraints`
  - `access_explanation`

2. `Signal Freshness Agent`
- Purpose: score data reliability and freshness for live decisions.
- Inputs: specials/events metadata (`confidence`, `last_verified_at`, time windows).
- Output:
  - `confidence_score` (0-1)
  - `freshness_minutes`
  - `eligibility_flags` (`live_now`, `starts_soon`, `stale`)

3. `Persona Intent Agent`
- Purpose: map guest/member context to intent strategy.
- Inputs: explicit persona selection + session behavior.
- Output:
  - `active_persona` (`first_time`, `business_traveler`, `weekend_couple`, `wellness_guest`, `club_member`)
  - `guest_intent`
  - `recommendation_bias_profile`

4. `Experience Routing Agent`
- Purpose: choose the right guidance mode for the session.
- Inputs: intent, daypart, trip context.
- Output:
  - `experience_view` (`operate`, `property`, `explore`)
  - `mode_reason`
  - `priority_sections[]`

5. `Event Discovery Agent`
- Purpose: rank event inventory to match user intent ("live music/comedy/sports/arts").
- Inputs: filtered event feed + discovery focus.
- Output:
  - ranked event list with reason codes
  - top hero event
  - fallback guidance when inventory is thin

6. `Food + Drink Curator Agent`
- Purpose: rank destinations by cuisine/bar style preference (cocktails, sports bar, mexican, coffee, rooftop).
- Inputs: destination/specials feed, venue metadata, proximity.
- Output:
  - ranked destination list
  - preference-fit score
  - "best now / soon" shortlist

7. `Property + Club Agent`
- Purpose: manage hotel-specific and member-specific layers (amenities, FORTH Club rules/perks).
- Inputs: portal config, property presets, club policy data.
- Output:
  - `property_highlights[]`
  - `member_mode_guidance`
  - `club_constraints` (guest allowances, etiquette notes, laptop windows)

8. `Itinerary Composer Agent`
- Purpose: generate a coherent, timed plan from selected stops.
- Inputs: ranked candidates + transit/proximity + curator mode (`safe`, `elevated`, `adventurous`).
- Output:
  - ordered itinerary with ETAs
  - alternatives when a step is unavailable
  - rationale per step

9. `Concierge Action Agent`
- Purpose: convert intent + itinerary into actionable desk requests.
- Inputs: selected services and itinerary context.
- Output:
  - request payload for concierge queue
  - confirmation-ready summary
- Backing API: `POST /api/portals/[slug]/concierge/requests`

10. `Voice + Narrative Agent`
- Purpose: produce premium, non-arcane copy tuned by persona.
- Inputs: structured outputs from all agents + tone policy.
- Output:
  - section headlines/subheads/cta copy
  - guest-safe language variants
  - pitch-mode annotations (internal only)

---

## 4. Canonical Agent Contract

All agents should read/write a shared envelope:

```json
{
  "request_id": "string",
  "portal_slug": "forth",
  "timestamp": "ISO-8601",
  "session": {
    "persona": "club_member",
    "intent": "night_out",
    "view": "operate"
  },
  "inputs": {},
  "outputs": {},
  "scores": {},
  "reasons": [],
  "warnings": []
}
```

Contract rules:
- No agent mutates another agent's output directly.
- Orchestrator merges by policy:
  - Access/security > freshness > ranking > narrative.
- Every ranked recommendation must carry at least one reason code.

---

## 5. Orchestration Flow (Runtime)

1. `Federation Access Agent`
2. `Signal Freshness Agent`
3. `Persona Intent Agent`
4. `Experience Routing Agent`
5. In parallel:
   - `Event Discovery Agent`
   - `Food + Drink Curator Agent`
   - `Property + Club Agent`
6. `Itinerary Composer Agent`
7. `Voice + Narrative Agent`
8. Optional `Concierge Action Agent` when user requests service

Hard constraints:
- If access agent denies source/category, no downstream override.
- If freshness score below threshold, item can appear only as "low confidence" fallback.

---

## 6. Mapping to Current Lost City Platform

Existing endpoints and systems already support most of this:

- Federation:
  - `web/lib/federation.ts`
  - `portal_source_access` materialized view
- Live destination/specials intelligence:
  - `GET /api/portals/[slug]/destinations/specials`
- Concierge action intake:
  - `POST /api/portals/[slug]/concierge/requests`
- Portal feed/context:
  - `GET /api/portals/[slug]/feed`

Current FORTH UI state fields align well:
- `visitorPersona`
- `guestIntent`
- `experienceView`
- `discoveryFocusId`
- `foodDrinkFocusId`
- `curatorModeId`

This means V1 can be introduced with minimal schema churn by adding agent execution around existing API surfaces.

---

## 7. Portal-Specific Customization Model

Per portal, define:

1. `Agent Policy Pack`
- thresholds (freshness cutoff, confidence floor)
- enabled agents
- ranking weights by vertical

2. `Experience Style Pack`
- tone guide
- vocabulary constraints
- default CTA patterns

3. `Property Pack` (optional)
- amenities
- signature venues
- member/club policy blocks
- event overlays (e.g. World Cup mode)

This allows each customer to feel custom while still running on the same federated core.

---

## 8. Metrics by Agent

1. Federation Access Agent
- unauthorized-content incidents (target: 0)

2. Signal Freshness Agent
- stale recommendation rate
- confidence-weighted click-through

3. Persona Intent Agent
- intent selection completion rate
- plan-conversion delta by persona

4. Discovery/Food Curation Agents
- recommendation click-through
- shortlist-to-action conversion

5. Itinerary Composer Agent
- itinerary completion rate
- stop abandonment rate

6. Voice + Narrative Agent
- readability score
- concierge handoff success rate

---

## 9. Rollout Plan

### Phase 1: Runtime Wrapping (fastest)
- Keep existing APIs/UI.
- Add agent orchestration layer server-side for ranking + copy decisions.
- Log per-agent reasons/scores for QA.

### Phase 2: Portal Policy Packs
- Add per-portal config for thresholds/weights/agent toggles.
- Enable easy customer-specific behavior shifts.

### Phase 3: Adaptive Learning
- Feed interaction outcomes back into ranking weights.
- Add offline retraining/evaluation workflow.

---

## 10. Risks and Mitigations

1. **Agent disagreement on ranking**
- Mitigation: deterministic merge policy + reason codes.

2. **Overly technical output in guest UI**
- Mitigation: enforce Voice + Narrative finalization step with language guardrails.

3. **Portal-specific complexity explosion**
- Mitigation: policy packs, not one-off code forks.

4. **Data freshness drift**
- Mitigation: strict freshness thresholds + visible confidence labels.

---

## 11. Definition of Done

1. At least 6 specialized agents are active in FORTH runtime.
2. Each recommendation has reason + confidence metadata.
3. Portal-specific policy pack can be changed without redeploying code.
4. Guest-facing copy is persona-appropriate and non-arcane.
5. Concierge request handoff uses structured output from itinerary/intent agents.

