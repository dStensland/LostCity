# Emory Golden Flow V1: Hospital-Now Decision Engine

## Purpose
Define and execute one flagship consumer flow that proves elite utility and clear platform differentiation before scaling full portal surfaces.

## Single Job To Be Done
"I am at or near Emory right now. Help me find the best next option in under 30 seconds."

## Primary Actor
- Visitor or caregiver currently on/near campus.

Secondary actors:
- Patient between steps of care.
- Staff needing quick practical recommendations.

## Product Promise
From one hospital context and one need, return ranked local options with immediate action.

## Entry Conditions
1. Campus is known (default: Emory University Hospital).
2. Need is selected (default: food/breakfast).
3. Context is selected (mode + time window + optional constraints).

## Golden Flow (must complete in <= 2 interactions)
1. User lands on `Hospital Now` with `Breakfast` preselected.
2. User taps one top result and takes action (`Directions`, `Call`, or `Save`).

Optional extension:
3. User switches need (`Pharmacy`, `Quiet Space`, `Caregiver Support`) and sees immediate reprioritization.

## Information Hierarchy Contract
1. **Now**: ranked options for the immediate moment.
2. **Why this ranking**: concise rationale that builds trust through relevance, not metadata jargon.
3. **Then**: adjacent needs in same context (no route jump needed).

## Lost City Capability Proof Requirements
The screen must visibly demonstrate:
1. Cross-entity discovery in one flow (venues + events/classes + org support).
2. Context adaptation (time window, need, mode, dietary constraints).
3. Practical ranking (distance + open-now + context fit).
4. Actionability (one primary action per recommendation).

## Emory Value Proof Requirements
The screen must make it obvious that Emory gains:
1. Reduced friction for visitors/patients in high-stress moments.
2. Better practical support around care, not only inside clinical walls.
3. Stronger community continuity through local programs and partners.

## UX Quality Bar (elite)
1. One dominant CTA above fold.
2. Decision surface readable in 3-second scan.
3. No decorative or narrative blocks competing with primary decision.
4. Clear visual rhythm: headline -> filters -> ranked list -> next needs.
5. Mobile and desktop both preserve top action visibility.

## Copy Rules
Allowed:
- direct, practical, action-oriented language.

Not allowed:
- admin/process/system vocabulary
- confidence/sourcing terminology
- mission-statement filler

## Acceptance Criteria
1. User can complete one useful action in <= 30 seconds.
2. At least 3 ranked recommendations are visible above fold on desktop.
3. Each recommendation has one primary CTA and explicit practical fit.
4. Switching a key control (need or time) changes ranking order immediately.
5. No banned consumer vocabulary appears.

## Current Artifact
- High-fidelity comp: `/Users/coach/Projects/LostCity/design/emory/golden-flow-hospital-now.html`
- Screenshot output: `/Users/coach/Projects/LostCity/output/playwright/emory-comps/golden-flow-hospital-now-v1.png`

## Next Build Step
Translate this single flow into production portal surface first, measure clarity and conversion in demo runs, then scale the same pattern to concierge/community pages.
