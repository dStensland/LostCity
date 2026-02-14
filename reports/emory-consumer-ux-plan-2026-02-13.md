# Emory Consumer UX Plan (Plan -> Design -> Execute)

## Scope

Consumer portal only. No admin/system language in consumer UI.

## Experience split

1. Hospital Hub (`/emory-demo`)
- Purpose: immediate orientation and action.
- User job: "I need to quickly find what helps this visit right now."
- Core modules:
  - Quick next actions (care, wayfinding, concierge)
  - Around-now practical items
  - Weekly discovery rail (events/venues/orgs)

2. Concierge (`/emory-demo/hospitals/[hospital]`)
- Purpose: in-context practical support around a visit.
- User job: "Show me what to eat/find now by time and preference."
- Core modules:
  - Time-of-day controls (breakfast/lunch/dinner/late-night)
  - Preference controls (quick grab, comfort, vegetarian, low-sodium, family)
  - Photo-forward recommendation cards
  - Full discovery fallback (map/list/timeline)

3. Community Hub (`/emory-demo?view=community`)
- Purpose: neighborhood-level community activation.
- User job: "I want programs and organizations that match my need."
- Core modules:
  - Need lenses (healthy eating, fitness, community support, mental health)
  - Lens-driven result filtering across events/venues/orgs
  - Optional support-group inclusion mode
  - Weekly exploration with map/timeline/list

## Interaction model standards

1. Show before tell
- Lead with real cards and imagery, not strategy copy.

2. One primary decision at a time
- Community: choose need lens first.
- Concierge: choose moment first, then preference.

3. Keep controls sticky to content
- Lens controls update result sets directly.
- No dead chips; every control mutates output.

4. Photography as utility
- Food/service cards use thumbnails for scan speed.
- Need lenses use visual context to improve selection confidence.

## Execution checklist

1. Add dedicated Community need-lens selector component.
2. Add dedicated Concierge food/moment explorer component.
3. Extend discovery cards with thumbnails for event/venue/org rows.
4. Wire support-group inclusion toggle (opt-in).
5. Keep hospital/community copy consumer-friendly and action-oriented.
