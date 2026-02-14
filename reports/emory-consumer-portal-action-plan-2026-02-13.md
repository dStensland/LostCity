# Emory Consumer Portal Action Plan

## Goal

Ship a consumer-first Emory experience with clear IA:
- Hospital Hub routes users into the right experience.
- Concierge solves in-the-moment practical needs around each campus.
- Community Hub provides ongoing citywide health support that drives return usage.

## IA Contract

1. Hospital Hub (`/emory-demo`)
- Role: route and orient.
- Must do:
  - choose a hospital/campus
  - preview concierge
  - preview community hub with preselected interest or explore-all
  - expose system-wide resources (always available)
- Must avoid: full discovery complexity and heavy filter surfaces.

2. Concierge (`/emory-demo/hospitals/[hospital]`)
- Role: practical support in the next few hours.
- Must do:
  - campus overview
  - campus resources
  - wayfinding/parking/contact
  - contextual meals by time of day
  - nearby essentials/services/lodging
  - optional lifestyle support: need-a-break + drop-in fitness
- Must avoid: nightlife/bar-forward suggestions.

3. Community Hub (`/emory-demo?view=community`)
- Role: ongoing public-health utility outside hospital stay.
- Must do:
  - need-based entry (healthy eating, fitness, mental health, support)
  - show events, organizations, programs, and resources
  - support repeat engagement (this week, near you, recurring)

## Phase 1 (now)

1. Reset Hospital Hub layout
- Replace feed-like sections with:
  - hero orientation
  - hospital chooser cards
  - concierge preview
  - community preview + interest links
  - system-wide resources strip

2. Upgrade Concierge core
- Add:
  - campus overview/resources/wayfinding section
  - contextual meal explorer (existing component)
  - need-a-break module
  - drop-in fitness module
- Filter out bar/happy-hour biased venues from meal explorer inputs.

3. Keep Community Hub stable but tighten framing
- Clarify copy as ongoing support and return value.

## Phase 2 (next)

1. Persistent context bar across all surfaces
- campus, moment, audience, radius, dietary/need.

2. Better spontaneous defaults
- open now + closest + low-friction actions.

3. Source expansion quality pass
- increase organizations/support groups/fitness/food density around each campus.

## Acceptance Criteria

1. User can choose a hospital in one tap from Hospital Hub.
2. User can enter Concierge with immediately useful contextual meal and essentials options.
3. User can enter Community Hub with either a preselected need or explore-all.
4. System-wide resource actions are visible without hunting.
5. No consumer UI includes backend/admin/strategy language.
