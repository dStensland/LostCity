# PRD 008: Emory Demo Elite Experience

## 1. Objective
Build a best-in-class healthcare vertical demo at `/emory-demo` that proves LostCity can:
- Orchestrate a polished, custom UI on top of federated data
- Combine public health awareness with concierge-grade hospital support
- Produce measurable engagement and ROI signals for enterprise buyers

## 2. Product Shape
Two-layer experience:
1. `Emory Network Home` (`/emory-demo`)
- Public-health and community-wellness awareness
- Concierge-style routing into hospital-specific flows
- Clear wayfinding and service CTAs

2. `Hospital Guide` (`/emory-demo/hospitals/[hospital]`)
- On-site amenities and service capabilities
- Nearby food, late-night options, and lodging
- Wayfinding-first support for patients, visitors, staff, and out-of-town treatment journeys

## 3. Audience Modes
Primary modes to drive section ranking and CTA hierarchy:
- `Need Help Now`: wayfinding, call desk, parking, urgent support resources
- `Patient Treatment Journey`: campus services, lodging, appointment-day logistics
- `Visiting Someone`: food, hours, parking, family support
- `Staff / Shift Mode`: late-night food, quick essentials, route speed

## 4. Experience Principles (10/10 Bar)
- Confidence first: every screen answers “what should I do next?”
- Calm clarity: minimal choices at top, progressive disclosure below
- Trust by default: strict source attribution and freshness signals
- Zero dead ends: every module has a valid action path
- Operational realism: after-hours behavior and escalation paths are explicit

## 5. Data Contract (Demo Scope)
### 5.1 Required
- Hospital locations, contact info, wayfinding deep links/fallbacks
- Hospital service blocks (category, name, hours, location hint, CTA)
- Nearby venues (food/stay/late-night), hours/open-state, distance
- Federated public-health events with strict source attribution

### 5.2 Attribution Rules
- Every event and recommendation must retain source identity
- Competitor exclusion policy enforced (no Piedmont resources)
- Section filters must use explicit source constraints where applicable

## 6. KPI Framework (ROI Story)
Core KPIs:
- Wayfinding opens per session
- Service CTA clicks (call desk, parking info, pharmacy, support)
- Late-night assistance engagement rate
- Public-health event engagement rate
- Return visit rate by audience mode

Supporting diagnostics:
- Section-level CTR by hospital and audience mode
- Source-level contribution and conversion
- Drop-off points in hospital guide flows

## 7. Modeled Assumptions (Pending Emory Input)
The demo assumes final customer validation on:
- Service-line priority ordering by campus and audience mode
- Legal/compliance disclaimer language and placement
- Gozio deep-link contract details and fallbacks
- After-hours operational schedules for service desks
- Preferred lodging partner strategy for out-of-town treatment users

These are explicitly tracked in `portal_demo_assumptions` with owner, impact, and validation status.

## 8. Delivery Plan
Phase A: Foundation (complete in demo)
- Hospital vertical UI shell and routing
- Hospital directory + campus landing pages
- Wayfinding-ready CTAs and public-health federation sections

Phase B: Experience Depth
- Mode-aware section ranking
- Assumption-driven content toggles
- Service freshness badges and attribution chips

Phase C: Validation
- KPI dashboard and section-level attribution views
- A/B tests for CTA placement and mode entry points
- Stakeholder walkthrough with assumption closure checklist

## 9. Demo Narrative Script
- Start at `/emory-demo`: “network-wide guidance + public-health impact”
- Enter a hospital guide: “campus-specific support + real-world logistics”
- Show wayfinding and action paths in 1-2 taps
- Show analytics framing: “engagement and operational ROI in one system”

## 10. Success Criteria
- User can reach wayfinding, food, stay, and hospital service actions in <2 interactions
- Hospital pages show realistic operational support context, not generic listings
- Public-health and concierge modules coexist without cognitive overload
- Attribution and assumptions are transparent and auditable
