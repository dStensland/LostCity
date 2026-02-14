# Emory Consumer Portal Product Process (No Bandaids)

## 1) Strategy Alignment

### Product intent
- Consumer-first hospital ecosystem that helps people make fast, practical decisions.
- Emory is positioned as an active community-health participant, not a content publisher.

### Success definition
- Users understand where to go in under 10 seconds.
- Users can complete one practical action (directions/call/open) in 1-2 taps.
- Community hub feels active and recurring, not static marketing.

## 2) IA Contract

### Surface roles
1. Hospital Hub
- Routing and orientation only.
- Required blocks:
  - Hero narrative (community + Emory role)
  - Always available support panel
  - Hospital chooser integrated with concierge entry
  - Community hub preview with active-content indicators

2. Concierge (per hospital)
- Practical utility around a visit.
- Required blocks:
  - Campus overview
  - Campus resources
  - Wayfinding/contact
  - Contextual meals (morning/lunch/snack/dinner/open-late)
  - Need a break
  - Drop-in fitness

3. Community Hub
- Ongoing citywide support and return behavior.
- Required blocks:
  - Need-led categories
  - Mixed resources (groups/orgs/events/programs)
  - “This week” and repeat utility framing

## 3) Design System Translation

### Visual directives
- Header should mirror Emory Healthcare behavior with strong utility actions.
- Top-level black action buttons for critical utilities.
- Strong hierarchy: one primary action per section, secondary actions as links.
- Eliminate wireframe feel: photography, real metadata, compact utility copy.

### Content directives
- Consumer language only; no backend/system copy.
- Show activity with counts/availability where possible.
- Copy should show utility first, brand second.

## 4) Implementation Slices

1. Header update
- Reflect current site architecture and high-salience black action buttons.

2. Hospital Hub restructure
- Replace feed-like complexity with routing architecture.
- Merge hospital chooser and concierge preview into photo-forward hospital cards.
- Add active community preview with category counts.

3. Concierge quality pass
- Keep practical stack and ensure meal relevance excludes bar/happy-hour bias.

4. QA gates
- Lint/build pass
- Visual hierarchy check for each section
- Ensure navigation labels and IA are consistent across pages

## 5) Acceptance Criteria (for this pass)

1. Header feels aligned to Emory Healthcare utility style and architecture.
2. Hospital hub has clear top-level narrative + always-available support.
3. Hospital cards combine identity, address, and concierge utility CTAs.
4. Community preview communicates active content with real counts.
5. No section reads as a wireframe-only placeholder.
