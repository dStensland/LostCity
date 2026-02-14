# Emory Portal Audit and Hub Plan (2026-02-13)

## Scope
- Audited the Emory portal experience under `web/app/[portal]/` and Emory-specific hospital/community components.
- Focused on UI clarity, accessibility posture, information architecture, and cross-over from the Atlanta "Find" paradigm.

## Key Findings
1. Navigation and IA are mixed.
- The Emory experience still behaved like a triad portal (`feed/find/community`) even though the user intent is hospital operations + community support.
- Result: users could fall into generic search surfaces that do not match healthcare/support workflows.

2. Community actions were routed through generic search patterns.
- Multiple Emory community CTAs deep-linked into `view=find` with search/type params.
- Result: context switch from healthcare support language to generic event discovery language.

3. Visual tone is busy for a utility-first healthcare/community experience.
- Heavy decorative imagery, multiple animated reveals, and many chips/metrics are competing with core tasks.
- Result: higher cognitive load and weaker scanability for stressed users/caregivers.

4. Hub boundaries are not explicit enough.
- "Hospital" and "Community" are present but not framed as two distinct jobs-to-be-done with clear entry/exit cues.
- Result: users can lose track of whether they are doing operational care tasks or community support discovery.

## Target IA: Two-Hub Model

### Hub A: Hospital Hub (Operational)
Purpose: complete care-journey logistics quickly and confidently.

Primary sections:
- Immediate actions: `Book/Manage Visit`, `Directions/Wayfinding`, `Call Main Desk`, `Parking`.
- Hospital directory: all Emory campuses with short utility metadata (distance/neighborhood, phone, open status).
- Campus guide: on-site services, nearby food/stay/essentials, open-late support.
- Guardrails: explicit scope statement (non-clinical guidance only) + source provenance.

Success criteria:
- User can reach a specific hospital guide in <=2 taps from hub entry.
- Critical CTA labels are plain-language task verbs.
- No generic event-search UI in this hub.

### Hub B: Community Hub (Support)
Purpose: surface trusted local support resources tied to care journeys.

Primary sections:
- Support tracks: prevention, food support, wellness/community support.
- Live briefings: short cards with schedule, source, and one primary action.
- Partner network: events/venues/org snapshots from vetted sources.
- Source transparency: simple partner/source chips with access tier.

Success criteria:
- Every resource card shows source and schedule context.
- Community stories open inside community context (or source link), not a generic search surface.
- Track-level entry points are first-class (anchors/sections), not keyword search redirects.

## UX Principles for This Vertical
- Utility before novelty: remove decorative elements that do not improve task completion.
- Calm hierarchy: one hero goal, clear section headings, restrained color and motion.
- Accessibility-first defaults: strong contrast, visible focus states, plain labels, predictable keyboard order.
- Source trust at point of decision: provenance near every outbound action.

## Implementation Plan
1. IA hard split (completed in this pass)
- Remove Emory access to generic `Find` surface.
- Route legacy find-like entry points to community hub context.

2. Hospital Hub simplification
- Reduce hero density and visual noise.
- Keep only top-priority operational CTAs in first viewport.
- Move secondary metrics into lower-priority panels.

3. Community Hub simplification
- Keep track cards and live briefings; reduce decorative chrome.
- Standardize card anatomy: title, schedule, source, action.
- Maintain stable deep links to track anchors.

4. Accessibility and content QA
- Run contrast checks for Emory palette components.
- Validate focus order and keyboard traversal across header/nav/cards.
- Add copy review for plain-language and reading level.

## Code Changes Applied in This Pass
- Emory header no longer exposes a `Find` tab.
- Emory portal routing now remaps find-mode requests to community mode.
- Emory CTAs that previously deep-linked into `view=find` now route to:
  - community hub sections/anchors, or
  - direct detail overlays within community context.

## Implementation Status (UI Cleanup)
- Replaced high-decoration Emory feed/community layouts with calmer utility-first sections.
- Removed Emory-specific reveal animations from primary hub surfaces.
- Simplified card anatomy across hubs to a stable pattern:
  - heading/context,
  - schedule/location/source,
  - one primary action.
- Added explicit focus-visible outlines for Emory primary/secondary buttons to improve keyboard accessibility.

## Next Step Recommendation
- Proceed with a dedicated visual cleanup pass on `HospitalPortalExperience` and `EmoryCommunityExperience` focused on reducing decorative media and increasing task clarity while preserving current data contracts.
