# HelpATL vs Atlanta UX Implementation Checklist 001

- Date: 2026-03-07
- Scope: design + UX execution plan
- Goal: maximize visible diversity between `atlanta` and `helpatl` while preserving shared platform primitives

## P0 (Demo-Critical, 1-2 sprints)

1. [done] HelpATL hero reframing to action-first intent
- Why: make the portal purpose obvious in <10 seconds.
- Implement in:
  - `web/components/feed/CityPulseShell.tsx`
  - `web/components/feed/GreetingBar.tsx`
- Acceptance:
  - top of feed shows 3 explicit civic intents (`Follow Government`, `Join Volunteer`, `Track School Board`)
  - no nightlife/discovery-first phrasing on HelpATL hero

2. [done] HelpATL top-of-feed "My Groups" quick strip
- Why: reinforce subscription loop and immediate personalization.
- Implement in:
  - `web/components/feed/sections/InterestChannelsSection.tsx`
  - `web/lib/hooks/usePortalInterestChannels.ts`
- Acceptance:
  - joined groups appear first with compact chips
  - one-click `Manage` route to `/<portal>/groups`

3. [done] School-board source-backed trust cue on channel cards
- Why: show the new v2 capability clearly.
- Implement in:
  - `web/components/channels/PortalGroupsClient.tsx`
  - `web/components/feed/sections/InterestChannelsSection.tsx`
- Acceptance:
  - School Board channel card includes "source-backed" marker
  - no "tag fallback" language exposed

4. [done] Atlanta vs HelpATL nav label divergence lock
- Why: semantic difference is a design differentiator.
- Implement in:
  - portal settings (`portals.settings.nav_labels`) for both portals
  - header renderers consume labels already
- Acceptance:
  - Atlanta remains broad discovery lexicon
  - HelpATL uses civic/action lexicon

5. [done] Reason-badge semantics split by portal
- Why: content explanation should match portal job-to-be-done.
- Implement in:
  - `web/components/ReasonBadge.tsx`
  - feed API reason payload call sites
- Acceptance:
  - Atlanta reason set: trend/proximity/discovery
  - HelpATL reason set: channel/jurisdiction/institution/source context

## P1 (Capability Showcase Depth, next 2-4 sprints)

1. [done] HelpATL "Upcoming Deadlines" module
- Why: convert passive browsing into timely civic action.
- Implement in:
  - `web/app/[portal]/page.tsx` feed assembly area
  - new helper for nearest meeting/volunteer cutoff extraction
- Acceptance:
  - shows next 3 deadline-like items with dates
  - links to event details

2. [done] HelpATL "Impact Snapshot" card
- Why: make channel system value visible and measurable.
- Implement in:
  - `web/components/feed/CityPulseShell.tsx`
  - analytics read endpoint reuse
- Acceptance:
  - displays weekly counts (`matched opportunities`, `groups joined`, `new meetings`)

3. [done] Groups page IA tightening for civic workflows
- Why: current filter UX is good but still generic.
- Implement in:
  - `web/components/channels/PortalGroupsClient.tsx`
  - `web/app/[portal]/groups/page.tsx`
- Acceptance:
  - reorder presets to civic priority
  - "city/county/school board" fast toggle row above search

4. [in progress] Admin-side civic quality rail
- Why: prove operator excellence for targeted portal experiences.
- Implement in:
  - `web/app/[portal]/admin/channels/page.tsx`
  - `web/app/api/admin/portals/[id]/channels/route.ts`
- Acceptance:
  - dedicated "Civic Quality" panel
  - highlights inactive school-board sources, stale channels, zero-match channels

## P2 (Polish + Narrative Scale)

1. Portal-specific motion personality split
- Atlanta: richer editorial motion
- HelpATL: restrained utility motion
- Implement in:
  - shared motion classes + portal settings gate

2. Visual motif divergence
- Atlanta: culture-led gradients/energy
- HelpATL: civic publication framing (paper/data rails, tighter spacing rhythm)
- Implement in:
  - portal brand token usage in feed shell and group cards

3. Guided mode switch for demos
- Why: one-click compare mode for sales/product demos.
- Implement in:
  - internal/demo route or feature flag in admin
- Acceptance:
  - toggles between `atlanta` and `helpatl` with scripted annotation points

## Capability Coverage Map

1. Federation: both portals (different source strategy)
2. Sections: both portals (different IA complexity)
3. Interest channels: HelpATL primary, Atlanta optional
4. Matching + explainability: HelpATL primary showcase
5. Admin governance: both, with HelpATL showing deeper civic controls

## Release Gates For This Work

1. No portal scope leakage regressions
2. Consumer/admin separation preserved
3. Channel join flow and analytics still intact
4. Mobile legibility for hero + group controls
