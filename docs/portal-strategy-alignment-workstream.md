# Portal Strategy Alignment Workstream

**Surface:** `both`
**Status:** Active
**Date:** 2026-03-15

This is the execution workstream for aligning LostCity's portal architecture with the actual strategy in [.claude/north-star.md](/Users/coach/Projects/LostCity/.claude/north-star.md) and [STRATEGIC_PRINCIPLES.md](/Users/coach/Projects/LostCity/STRATEGIC_PRINCIPLES.md).

The problem is no longer "can the platform support multiple portals." It can. The problem is that parts of the runtime still reflect an older model:

- legacy vertical enums instead of the current content-pillar structure
- source-centric federation instead of entity-family-aware federation
- provenance, visibility, and geography still partially blended together
- canonical entity APIs still carrying compatibility fallbacks
- crawler lane contracts advertising strategic richness that persistence still drops

This workstream is meant to be executed continuously until those mismatches are closed.

## Goal

Make the platform semantics match the business strategy:

1. first-party portals are modeled as real content pillars
2. entity families are first-class platform primitives
3. visibility is governed by entity-aware federation, not just source ownership
4. attribution is explicit and strict
5. canonical APIs return canonical entities
6. crawler richness lanes are either persisted end-to-end or removed from the contract
7. schema and migration docs can be trusted

## Non-Goals

This workstream does not include:

- net-new consumer UI unless required to preserve route semantics
- speculative new entity tables that are not yet strategically justified
- a new staging environment
- a new theme/config system for portals

## Completion Criteria

This workstream is done when all of the following are true:

- one shared portal taxonomy drives manifests, portal context, and runtime gating
- one shared entity-family taxonomy drives federation, APIs, and crawler lane naming
- no public canonical entity endpoint silently substitutes from another family
- federation can grant `events` from a source without automatically granting `programs`, `exhibitions`, or `open_calls`
- attributed writes default to strict attribution unless explicitly exempted
- strategic crawler lanes are fully persisted or explicitly removed from the advertised contract
- `database/schema.sql` is machine-checked against migration intent

## Phase 1: Taxonomy Reset

**Outcome:** one canonical runtime vocabulary for portals and entity families.

### Progress

First implementation batch completed on **2026-03-15**:

- shared taxonomy module added at [web/lib/portal-taxonomy.ts](/Users/coach/Projects/LostCity/web/lib/portal-taxonomy.ts)
- `portal.ts`, `portal-manifest.ts`, `portal-context.tsx`, and outing-planner copy now read from the same runtime vertical contract
- compatibility alias `civic -> community` preserved
- `arts` and `sports` are now recognized consistently in the core runtime helpers and manifest tests

Second implementation batch completed on **2026-03-15**:

- shared helper/config files now consume the same taxonomy normalization rules:
  - [web/lib/skeleton-contract.ts](/Users/coach/Projects/LostCity/web/lib/skeleton-contract.ts)
  - [web/lib/portal-animation-config.ts](/Users/coach/Projects/LostCity/web/lib/portal-animation-config.ts)
  - [web/lib/civic-routing.ts](/Users/coach/Projects/LostCity/web/lib/civic-routing.ts)
  - [web/components/PortalThemeClient.tsx](/Users/coach/Projects/LostCity/web/components/PortalThemeClient.tsx)
- legacy alias handling is now consistent across manifest resolution, body-level vertical attributes, civic routing, and skeleton fallback logic
- typed coverage now exists for taxonomy normalization, animation config, skeleton fallback, and civic routing

Third implementation batch completed on **2026-03-15**:

- top-level portal runtime flow now uses shared taxonomy helpers for ambient suppression and feed-skeleton resolution in:
  - [web/app/[portal]/page.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/page.tsx)
  - [web/app/[portal]/layout.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/layout.tsx)
- the shared taxonomy now defines reusable runtime predicates for:
  - content-pillar membership
  - bespoke feed-shell support
  - ambient-effect suppression
  - feed-skeleton classification
- Phase 1 runtime drift is now concentrated in page-specific vertical UX branches rather than shared portal infrastructure

Fourth implementation batch completed on **2026-03-15**:

- the shared skeleton contract is now fully aligned with taxonomy normalization in [web/lib/skeleton-contract.ts](/Users/coach/Projects/LostCity/web/lib/skeleton-contract.ts)
- loading routes that consume skeleton verticals now use the resolved vertical directly instead of repeating literal values in:
  - [web/app/[portal]/happening-now/loading.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/happening-now/loading.tsx)
  - [web/app/[portal]/events/[id]/loading.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/events/%5Bid%5D/loading.tsx)
- the remaining Phase 1 tail is now mostly route-specific UX branching rather than shared type or loading-state drift

Fifth implementation batch completed on **2026-03-15**:

- global atmospheric effect suppression is now driven by shared taxonomy rules in:
  - [web/components/ClientEffects.tsx](/Users/coach/Projects/LostCity/web/components/ClientEffects.tsx)
  - [web/components/RainEffect.tsx](/Users/coach/Projects/LostCity/web/components/RainEffect.tsx)
- shared taxonomy now distinguishes between:
  - route-level ambient suppression
  - global visual-effects suppression
- this closes the last shared-runtime branch that was still hardcoding portal vertical behavior independently of the taxonomy contract

### Deliverables

- shared `PortalRole`, `PortalVertical`, and `EntityFamily` definitions
- `portal-manifest` rebuilt on that shared contract
- removal of duplicate/stale vertical definitions in web runtime code

### Primary Targets

- [web/lib/portal-manifest.ts](/Users/coach/Projects/LostCity/web/lib/portal-manifest.ts)
- [web/lib/portal.ts](/Users/coach/Projects/LostCity/web/lib/portal.ts)
- [web/lib/portal-context.tsx](/Users/coach/Projects/LostCity/web/lib/portal-context.tsx)
- [web/components/outing-planner/outing-copy.ts](/Users/coach/Projects/LostCity/web/components/outing-planner/outing-copy.ts)

### Exit Gate

- no duplicate `PortalVertical` unions remain in active web runtime code
- `family`, `adventure`, `arts`, and `sports` are first-class runtime concepts
- manifest behavior no longer falls back through a legacy portal model

## Phase 2: Platform Semantics

**Outcome:** provenance, visibility, and geography become separate concerns.

### Progress

First implementation batch completed on **2026-03-15**:

- federation and scope contracts now accept an explicit `entityFamily` even though the backing federation model is still source-centric underneath
- non-event entity routes now declare their intended family at the call site:
  - [web/app/api/programs/route.ts](/Users/coach/Projects/LostCity/web/app/api/programs/route.ts)
  - [web/app/api/exhibitions/route.ts](/Users/coach/Projects/LostCity/web/app/api/exhibitions/route.ts)
  - [web/app/api/open-calls/route.ts](/Users/coach/Projects/LostCity/web/app/api/open-calls/route.ts)
- shared scope helpers now preserve that family in their option contract:
  - [web/lib/federation.ts](/Users/coach/Projects/LostCity/web/lib/federation.ts)
  - [web/lib/portal-scope.ts](/Users/coach/Projects/LostCity/web/lib/portal-scope.ts)

This does **not** solve entity-aware federation yet. It does make the semantics explicit in code, which is the right prerequisite for the later DB/view redesign.

Second implementation batch completed on **2026-03-15**:

- event-category enforcement is now centralized in the federation layer instead of being open-coded across feed/search consumers:
  - [web/lib/federation.ts](/Users/coach/Projects/LostCity/web/lib/federation.ts)
  - [web/lib/federation.test.ts](/Users/coach/Projects/LostCity/web/lib/federation.test.ts)
- the main event consumers now use the shared helper:
  - [web/app/api/portals/[slug]/feed/route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/%5Bslug%5D/feed/route.ts)
  - [web/app/api/portals/[slug]/destinations/specials/route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/%5Bslug%5D/destinations/specials/route.ts)
  - [web/app/api/festivals/upcoming/route.ts](/Users/coach/Projects/LostCity/web/app/api/festivals/upcoming/route.ts)
  - [web/lib/forth-data.ts](/Users/coach/Projects/LostCity/web/lib/forth-data.ts)
  - [web/lib/search-preview.ts](/Users/coach/Projects/LostCity/web/lib/search-preview.ts)
  - [web/lib/portal-feed-loader.ts](/Users/coach/Projects/LostCity/web/lib/portal-feed-loader.ts)
- the portal sources introspection endpoint now accepts `entity_family` and returns the resolved family in its payload:
  - [web/app/api/portals/[slug]/sources/route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/%5Bslug%5D/sources/route.ts)

This still stops short of true entity-aware federation rules in storage. The remaining Phase 2 work is now clearly the DB/view contract, not the runtime call shape.

Third implementation batch completed on **2026-03-15**:

- the federation storage contract now has an explicit non-event access layer in:
  - [database/migrations/508_entity_family_federation.sql](/Users/coach/Projects/LostCity/database/migrations/508_entity_family_federation.sql)
  - [supabase/migrations/20260315205723_entity_family_federation.sql](/Users/coach/Projects/LostCity/supabase/migrations/20260315205723_entity_family_federation.sql)
- existing source-sharing and subscription tables now carry:
  - `shared_entity_families`
  - `subscribed_entity_families`
- non-event source access is now modeled through a dedicated materialized view:
  - `portal_source_entity_access`
- [web/lib/federation.ts](/Users/coach/Projects/LostCity/web/lib/federation.ts) now reads:
  - `portal_source_access` for `events`
  - `portal_source_entity_access` for non-event families
- default write attribution is now strict unless a route explicitly opts out in:
  - [web/lib/portal-attribution.ts](/Users/coach/Projects/LostCity/web/lib/portal-attribution.ts)

This is the first real implementation pass where visibility and provenance are no longer only a TypeScript-level distinction. The remaining Phase 2 work is the live rollout of the new federation migration and any targeted route exemptions for attribution.

Production rollout completed on **2026-03-15**:

- [supabase/migrations/20260315205723_entity_family_federation.sql](/Users/coach/Projects/LostCity/supabase/migrations/20260315205723_entity_family_federation.sql) is now applied in production
- production now has live:
  - `source_sharing_rules.shared_entity_families`
  - `source_subscriptions.subscribed_entity_families`
  - `portal_source_entity_access`
- direct production validation confirms entity-family access rows are being materialized for:
  - `atlanta`
  - `hooky`
  - `arts-atlanta`
  - `helpatl`
  - `yonder`
  - `forth`

The remaining Phase 2 work is now narrower:

- validate route-level behavior against the new access graph
- decide whether any write routes need explicit `allowMissing` exemptions
- continue separating provenance semantics from visibility semantics in naming and docs

Fourth implementation batch completed on **2026-03-15**:

- routes that intentionally derive portal scope from the target entity now opt out explicitly from strict request-level attribution:
  - [web/app/api/volunteer/engagements/route.ts](/Users/coach/Projects/LostCity/web/app/api/volunteer/engagements/route.ts)
  - [web/app/api/volunteer/engagements/[id]/route.ts](/Users/coach/Projects/LostCity/web/app/api/volunteer/engagements/%5Bid%5D/route.ts)
  - [web/app/api/channels/subscriptions/route.ts](/Users/coach/Projects/LostCity/web/app/api/channels/subscriptions/route.ts)
- the explicit opt-out boundary is now enforced in:
  - [web/lib/portal-attribution.test.ts](/Users/coach/Projects/LostCity/web/lib/portal-attribution.test.ts)
- route-level entity-family access behavior is now covered in:
  - [web/app/api/portals/[slug]/sources/route.test.ts](/Users/coach/Projects/LostCity/web/app/api/portals/%5Bslug%5D/sources/route.test.ts)
- live federation rollout validation is now scriptable through:
  - [database/validate_portal_federation_rollout.py](/Users/coach/Projects/LostCity/database/validate_portal_federation_rollout.py)

Production validation now confirms the strategic minimums for the new access graph:

- Hooky has live `programs` access rows
- Arts has live `exhibitions` and `open_calls` access rows
- Yonder has live `destination_details` access rows

Fifth implementation batch completed on **2026-03-15**:

- the generic federation family `opportunities` has been removed from storage
  defaults and the non-event access materialized view in:
  - [database/migrations/509_entity_family_federation_concrete_opportunities.sql](/Users/coach/Projects/LostCity/database/migrations/509_entity_family_federation_concrete_opportunities.sql)
  - [supabase/migrations/20260315213000_entity_family_federation_concrete_opportunities.sql](/Users/coach/Projects/LostCity/supabase/migrations/20260315213000_entity_family_federation_concrete_opportunities.sql)
- production now validates that unsupported non-event families are absent via:
  - [database/validate_portal_federation_rollout.py](/Users/coach/Projects/LostCity/database/validate_portal_federation_rollout.py)

This closes the storage/runtime mismatch where federation still carried a
phantom umbrella family after the typed crawler contract and runtime taxonomy
had already moved to concrete families.

### Deliverables

- written contract for `portal_id` semantics versus federation visibility
- entity-family-aware federation design
- first implementation pass in portal scope helpers
- stricter default write attribution for attributed tables

### Primary Targets

- [web/lib/federation.ts](/Users/coach/Projects/LostCity/web/lib/federation.ts)
- [web/lib/portal-scope.ts](/Users/coach/Projects/LostCity/web/lib/portal-scope.ts)
- [web/lib/portal-attribution.ts](/Users/coach/Projects/LostCity/web/lib/portal-attribution.ts)
- [web/lib/portal-query-context.ts](/Users/coach/Projects/LostCity/web/lib/portal-query-context.ts)
- [database/schema.sql](/Users/coach/Projects/LostCity/database/schema.sql)

### Exit Gate

- the system can express entity-family-specific sharing
- geography remains a guardrail, not a proxy for ownership or visibility
- missing attribution on attributed writes is an explicit exception path

## Phase 3: Canonical Entity Surface

**Outcome:** entity APIs and route semantics mean what they say.

### Progress

First implementation batch completed on **2026-03-15**:

- [web/app/api/programs/route.ts](/Users/coach/Projects/LostCity/web/app/api/programs/route.ts) is now canonical by default
- recurring-event compatibility is still available, but only via explicit `include_events_fallback=true`
- route-level behavior is covered in:
  - [web/app/api/programs/route.test.ts](/Users/coach/Projects/LostCity/web/app/api/programs/route.test.ts)

This is the first step toward removing hidden cross-family substitution from the public entity surface without breaking the ability to compare old and new behavior deliberately.

Second implementation batch completed on **2026-03-15**:

- the film-specific `/[portal]/programs` page no longer defines platform-level route meaning
- film program discovery now lives under:
  - [web/app/[portal]/screening-programs/page.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/screening-programs/page.tsx)
  - [web/app/[portal]/_components/film/FilmProgramsPage.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/_components/film/FilmProgramsPage.tsx)
- the old film `/[portal]/programs` route is now a compatibility redirect in:
  - [web/app/[portal]/programs/page.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/programs/page.tsx)
- film portal navigation now uses the film-specific noun directly in:
  - [web/app/[portal]/_components/film/FilmPortalNav.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/_components/film/FilmPortalNav.tsx)

This closes one of the last obvious route-level leaks where a historical film-specific concept was still overloading the platform meaning of `programs`.

Third implementation batch completed on **2026-03-15**:

- the canonical programs API now has test coverage for:
  - canonical empty responses by default
  - explicit recurring-event compatibility mode
- film route semantics now distinguish:
  - `programs` as the platform entity family
  - `screening-programs` as the film-specific series/screenings surface

The remaining Phase 3 work is now concentrated in fallback removal follow-through and any other route labels that still encode historical vertical-specific meanings.

Fourth implementation batch completed on **2026-03-16**:

- the Family consumer shell now uses live Family surfaces for `calendar` and
  `crew` instead of placeholder tabs in:
  - [web/components/family/FamilyFeed.tsx](/Users/coach/Projects/LostCity/web/components/family/FamilyFeed.tsx)
  - [web/components/family/CalendarView.tsx](/Users/coach/Projects/LostCity/web/components/family/CalendarView.tsx)
  - [web/components/family/CrewSetup.tsx](/Users/coach/Projects/LostCity/web/components/family/CrewSetup.tsx)
- the Family calendar tab now exposes real Family content primitives:
  - school calendar events
  - upcoming program starts
  - registration urgency
- crew mutations now update the shared kid-profile cache so Family
  personalization changes propagate without a full refresh in:
  - [web/lib/hooks/useKidProfiles.ts](/Users/coach/Projects/LostCity/web/lib/hooks/useKidProfiles.ts)

This is a consumer-surface follow-through on the canonical `programs` model.
The Family portal is now less of a decorative shell around the data model and
more of an actual consumer expression of it.

### Deliverables

- removal plan and instrumentation for `/api/programs` fallback
- canonical endpoint policy written and enforced for future entity families
- runtime route cleanup where route names still reflect legacy vertical semantics

### Primary Targets

- [web/app/api/programs/route.ts](/Users/coach/Projects/LostCity/web/app/api/programs/route.ts)
- [web/app/api/exhibitions/route.ts](/Users/coach/Projects/LostCity/web/app/api/exhibitions/route.ts)
- [web/app/api/open-calls/route.ts](/Users/coach/Projects/LostCity/web/app/api/open-calls/route.ts)
- [web/app/[portal]/programs/page.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/programs/page.tsx)

### Exit Gate

- canonical entity APIs return only canonical rows
- film-specific "program" semantics no longer leak into the platform-level `programs` route
- fallback usage is measurable and scheduled for removal

## Phase 4: Crawler Contract Completion

**Outcome:** strategic crawler richness is either real or removed from the public contract.

### Progress

Implementation batches completed on **2026-03-15**:

- `venue_specials` is no longer an advertised-but-dropped lane
- shared persistence now writes `venue_specials` through:
  - [crawlers/db/venue_specials.py](/Users/coach/Projects/LostCity/crawlers/db/venue_specials.py)
  - [crawlers/entity_persistence.py](/Users/coach/Projects/LostCity/crawlers/entity_persistence.py)
- the db package exports the shared writer in:
  - [crawlers/db/__init__.py](/Users/coach/Projects/LostCity/crawlers/db/__init__.py)
- `editorial_mentions` now have a shared DB writer that preserves the existing
  `article_url, venue_id` conflict semantics from editorial ingest:
  - [crawlers/db/editorial_mentions.py](/Users/coach/Projects/LostCity/crawlers/db/editorial_mentions.py)
- `venue_occasions` now have a shared DB writer that preserves manual/editorial
  source protection while still refreshing inferred confidence:
  - [crawlers/db/venue_occasions.py](/Users/coach/Projects/LostCity/crawlers/db/venue_occasions.py)
- typed-envelope coverage now treats `venue_specials`, `editorial_mentions`,
  and `venue_occasions` as persisted lanes in:
  - [crawlers/tests/test_entity_persistence.py](/Users/coach/Projects/LostCity/crawlers/tests/test_entity_persistence.py)

Phase 4 has now closed the advertised-lane gap. The ambiguous umbrella
`opportunities` lane was pruned from the typed crawler contract because it had
no real producers and no concrete shared writer. Concrete families stay
explicit: `open_calls` remains first-class in the envelope, and
`volunteer_opportunities` is now represented as its own concrete shared lane
instead of living as a HelpATL-only side path.

Additional implementation batch completed on **2026-03-15**:

- `volunteer_opportunities` is now a concrete typed crawler lane in:
  - [crawlers/entity_lanes.py](/Users/coach/Projects/LostCity/crawlers/entity_lanes.py)
  - [crawlers/entity_persistence.py](/Users/coach/Projects/LostCity/crawlers/entity_persistence.py)
- shared DB write/deactivation helpers now exist in:
  - [crawlers/db/volunteer_opportunities.py](/Users/coach/Projects/LostCity/crawlers/db/volunteer_opportunities.py)
- the live United Way structured-opportunity crawler now uses the shared write
  path and declares its typed family support in:
  - [crawlers/sources/united_way_atlanta.py](/Users/coach/Projects/LostCity/crawlers/sources/united_way_atlanta.py)
- coverage now exists for the lane and shared writer in:
  - [crawlers/tests/test_entity_persistence.py](/Users/coach/Projects/LostCity/crawlers/tests/test_entity_persistence.py)
  - [crawlers/tests/test_entity_lanes.py](/Users/coach/Projects/LostCity/crawlers/tests/test_entity_lanes.py)
  - [crawlers/tests/test_volunteer_opportunities_writer.py](/Users/coach/Projects/LostCity/crawlers/tests/test_volunteer_opportunities_writer.py)

### Deliverables

- persistence support or contract pruning for `venue_specials`,
  `editorial_mentions`, `venue_occasions`, and ambiguous opportunity umbrella
  semantics
- audit of expected versus persisted lanes
- representative crawler conversions for any newly-supported lanes

### Primary Targets

- [crawlers/entity_lanes.py](/Users/coach/Projects/LostCity/crawlers/entity_lanes.py)
- [crawlers/entity_persistence.py](/Users/coach/Projects/LostCity/crawlers/entity_persistence.py)
- [crawlers/scripts/audit_source_entity_capabilities.py](/Users/coach/Projects/LostCity/crawlers/scripts/audit_source_entity_capabilities.py)

### Exit Gate

- no strategic lane is "declared but dropped"
- crawler lane audit can distinguish unsupported from unimplemented from healthy

**Status:** exit gate reached for the current typed-envelope contract on
**2026-03-15**. Remaining opportunity work should happen as route/federation
cleanup for concrete families like `volunteer_opportunities`, not by
reintroducing a generic umbrella lane.

## Phase 5: Destination Graph and Route Cleanup

**Outcome:** destination-richness architecture and portal runtime semantics are stable enough for future entity families.

### Progress

First implementation batch completed on **2026-03-15**:

- the remaining active duplicate `PortalVertical` unions were removed from:
  - [web/lib/portal.ts](/Users/coach/Projects/LostCity/web/lib/portal.ts)
  - [web/lib/portal-manifest.ts](/Users/coach/Projects/LostCity/web/lib/portal-manifest.ts)
- `portal-manifest` module behavior now resolves through shared taxonomy helpers
  instead of raw string comparisons for spots, artists, weather, and map
  support:
  - [web/lib/portal-taxonomy.ts](/Users/coach/Projects/LostCity/web/lib/portal-taxonomy.ts)
  - [web/lib/portal-manifest.ts](/Users/coach/Projects/LostCity/web/lib/portal-manifest.ts)
- remaining film-specific route/runtime checks now use shared taxonomy helpers in:
  - [web/app/[portal]/page.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/page.tsx)
  - [web/app/[portal]/happening-now/loading.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/happening-now/loading.tsx)
  - [web/app/[portal]/events/[id]/loading.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/events/%5Bid%5D/loading.tsx)
  - [web/app/[portal]/community-hub/page.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/community-hub/page.tsx)
- a shared destination-graph contract now defines:
  - destination attachment families
  - concrete destination opportunity families
  - attached child venue types for landmark/artifact-style child destinations
  in:
  - [web/lib/destination-graph.ts](/Users/coach/Projects/LostCity/web/lib/destination-graph.ts)
- spot detail now applies that child-destination contract directly so the
  attached child shelf is limited to landmark/artifact-style children in:
  - [web/lib/spot-detail.ts](/Users/coach/Projects/LostCity/web/lib/spot-detail.ts)
- runtime coverage now exists for both the shared taxonomy helpers and the new
  destination-graph contract in:
  - [web/lib/portal-taxonomy.test.ts](/Users/coach/Projects/LostCity/web/lib/portal-taxonomy.test.ts)
  - [web/lib/portal-manifest.test.ts](/Users/coach/Projects/LostCity/web/lib/portal-manifest.test.ts)
  - [web/lib/portal-vertical.test.ts](/Users/coach/Projects/LostCity/web/lib/portal-vertical.test.ts)
  - [web/lib/destination-graph.test.ts](/Users/coach/Projects/LostCity/web/lib/destination-graph.test.ts)

This closes the last obvious taxonomy/runtime drift and establishes the first
real shared destination-child contract in code. The remaining Phase 5 work is
deeper promotion logic around landmark/artifact-style children and other
destination-attached facts that may eventually warrant dedicated shared entity
families.

Second implementation batch completed on **2026-03-15**:

- landmark/artifact launch shelves now use a shared destination-node
  relationship contract instead of Yonder-only literal unions in:
  - [web/lib/destination-graph.ts](/Users/coach/Projects/LostCity/web/lib/destination-graph.ts)
  - [web/config/yonder-launch-artifacts.ts](/Users/coach/Projects/LostCity/web/config/yonder-launch-artifacts.ts)
  - [web/components/feed/sections/YonderArtifactQuestsSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/YonderArtifactQuestsSection.tsx)
- relationship labels like `Inside {parent}` and `Via {spot}` are now generated
  through the shared destination graph helper instead of section-local branching
- launch artifact tests now validate against the shared relationship contract in:
  - [web/config/yonder-launch-artifacts.test.ts](/Users/coach/Projects/LostCity/web/config/yonder-launch-artifacts.test.ts)
  - [web/lib/destination-graph.test.ts](/Users/coach/Projects/LostCity/web/lib/destination-graph.test.ts)

This narrows the remaining Phase 5 work further. The system now has a shared
runtime contract not just for which child venue types stay attached, but also
for how attached child destinations relate to parent destinations in route and
UI semantics.

Third implementation batch completed on **2026-03-15**:

- spot-detail payloads now expose `attachedChildDestinations` as the canonical
  field while preserving `artifacts` as a compatibility alias in:
  - [web/lib/spot-detail.ts](/Users/coach/Projects/LostCity/web/lib/spot-detail.ts)
- both the app-router spot page and the legacy venue detail view now render
  attached child destinations through the same shared section semantics instead
  of mixing `Artifacts` and `Inside This Venue` labels:
  - [web/app/[portal]/spots/[slug]/page.tsx](/Users/coach/Projects/LostCity/web/app/%5Bportal%5D/spots/%5Bslug%5D/page.tsx)
  - [web/components/views/VenueDetailView.tsx](/Users/coach/Projects/LostCity/web/components/views/VenueDetailView.tsx)
  - [web/lib/destination-graph.ts](/Users/coach/Projects/LostCity/web/lib/destination-graph.ts)

This pushes the destination-child model one step further from launch-specific
artifact language and toward a stable shared runtime contract, while preserving
API compatibility for older consumers.

Fourth implementation batch completed on **2026-03-15**:

- the Yonder launch route now exposes `destinationNodes` as its canonical
  payload field while preserving `artifacts` as a compatibility alias in:
  - [web/app/api/portals/[slug]/yonder/artifacts/route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/%5Bslug%5D/yonder/artifacts/route.ts)
- the quest shelf now consumes the canonical destination-node field and only
  falls back to `artifacts` for compatibility in:
  - [web/components/feed/sections/YonderArtifactQuestsSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/YonderArtifactQuestsSection.tsx)

This keeps the launch surface stable while shifting the route semantics toward a
shared destination-node model instead of an artifact-only payload contract.

Fifth implementation batch completed on **2026-03-15**:

- shared destination-node payload building for Yonder now lives in:
  - [web/lib/yonder-destination-nodes.ts](/Users/coach/Projects/LostCity/web/lib/yonder-destination-nodes.ts)
- a canonical destination-node API surface now exists at:
  - [web/app/api/portals/[slug]/yonder/destination-nodes/route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/%5Bslug%5D/yonder/destination-nodes/route.ts)
- the legacy artifact route is now a compatibility wrapper over that shared
  builder in:
  - [web/app/api/portals/[slug]/yonder/artifacts/route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/%5Bslug%5D/yonder/artifacts/route.ts)
- the live quest shelf now reads from the canonical destination-node route in:
  - [web/components/feed/sections/YonderArtifactQuestsSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/YonderArtifactQuestsSection.tsx)

This is the first route-level step that makes destination-node semantics
canonical in path structure, not just in payload fields.

Sixth implementation batch completed on **2026-03-15**:

- the live Yonder feed now renders through a canonically-named destination-node
  component:
  - [web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx)
  - [web/components/feed/CityPulseShell.tsx](/Users/coach/Projects/LostCity/web/components/feed/CityPulseShell.tsx)
- the older artifact-named component file remains only as a compatibility
  wrapper:
  - [web/components/feed/sections/YonderArtifactQuestsSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/YonderArtifactQuestsSection.tsx)

This closes another naming seam where runtime code still encoded artifact-first
semantics even after the shared route and payload contracts had been
canonicalized.

Seventh implementation batch completed on **2026-03-15**:

- Yonder launch config and destination-node payloads now treat
  `destinationNodeType` as the canonical field and keep `artifactType` only as
  a compatibility alias in:
  - [web/config/yonder-launch-artifacts.ts](/Users/coach/Projects/LostCity/web/config/yonder-launch-artifacts.ts)
  - [web/lib/yonder-destination-nodes.ts](/Users/coach/Projects/LostCity/web/lib/yonder-destination-nodes.ts)
  - [web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx)

This closes another payload-level leak where the canonical destination-node
surface was still carrying artifact-era field names internally.

Eighth implementation batch completed on **2026-03-15**:

- the shared destination graph now encodes a baseline identity-tier rule for
  destination nodes in:
  - [web/lib/destination-graph.ts](/Users/coach/Projects/LostCity/web/lib/destination-graph.ts)
- Yonder destination-node payloads now carry `identityTier` so attached child
  destinations and standalone destination records are distinguished in the data
  contract, not just inferred ad hoc from relationship strings:
  - [web/lib/yonder-destination-nodes.ts](/Users/coach/Projects/LostCity/web/lib/yonder-destination-nodes.ts)
  - [web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx)

This is the first concrete implementation of the promotion boundary in code.
It does not promote landmark-style children into a first-class family yet, but
it does make the attached-vs-standalone distinction explicit and reusable.

Ninth implementation batch completed on **2026-03-15**:

- the Yonder launch config now uses destination-node-first exports as the
  source of truth:
  - [web/config/yonder-launch-artifacts.ts](/Users/coach/Projects/LostCity/web/config/yonder-launch-artifacts.ts)
  - [web/config/yonder-launch-artifacts.test.ts](/Users/coach/Projects/LostCity/web/config/yonder-launch-artifacts.test.ts)
- `YONDER_LAUNCH_DESTINATION_NODES` and
  `getYonderLaunchDestinationNodesForQuest` are now canonical, while the older
  artifact-named exports remain as compatibility aliases
- the shared destination-node payload builder now reads from the canonical
  config exports in:
  - [web/lib/yonder-destination-nodes.ts](/Users/coach/Projects/LostCity/web/lib/yonder-destination-nodes.ts)

This closes the last obvious source-of-truth leak where the config boundary was
still artifact-first even after the runtime, route, and payload layers had been
shifted to destination-node semantics.

Tenth implementation batch completed on **2026-03-15**:

- the Yonder launch quest config now uses destination-node-first quest names as
  the canonical exports in:
  - [web/config/yonder-launch-artifacts.ts](/Users/coach/Projects/LostCity/web/config/yonder-launch-artifacts.ts)
  - [web/config/yonder-launch-artifacts.test.ts](/Users/coach/Projects/LostCity/web/config/yonder-launch-artifacts.test.ts)
  - [web/lib/yonder-destination-nodes.ts](/Users/coach/Projects/LostCity/web/lib/yonder-destination-nodes.ts)
- `YONDER_LAUNCH_DESTINATION_NODE_QUESTS` and
  `YonderDestinationNodeQuestId` are now canonical, while artifact-era quest
  names remain only as compatibility aliases

This closes the same source-of-truth leak one level higher in the launch
contract, so both the destination-node list and the quest vocabulary now start
from canonical naming.

Eleventh implementation batch completed on **2026-03-15**:

- the Yonder launch config now has a canonical file path:
  - [web/config/yonder-launch-destination-nodes.ts](/Users/coach/Projects/LostCity/web/config/yonder-launch-destination-nodes.ts)
- the older artifact-named config file now exists only as a compatibility
  re-export layer:
  - [web/config/yonder-launch-artifacts.ts](/Users/coach/Projects/LostCity/web/config/yonder-launch-artifacts.ts)
- shared destination-node consumers now import the canonical module directly in:
  - [web/lib/yonder-destination-nodes.ts](/Users/coach/Projects/LostCity/web/lib/yonder-destination-nodes.ts)
  - [web/config/yonder-launch-artifacts.test.ts](/Users/coach/Projects/LostCity/web/config/yonder-launch-artifacts.test.ts)

This closes the file-boundary version of the same problem: destination-node
semantics are now canonical in route names, payload fields, export names, and
the config source file itself.

Twelfth implementation batch completed on **2026-03-15**:

- the shared destination graph now includes a display-order rule that prefers
  standalone destination nodes before attached child nodes:
  - [web/lib/destination-graph.ts](/Users/coach/Projects/LostCity/web/lib/destination-graph.ts)
  - [web/lib/destination-graph.test.ts](/Users/coach/Projects/LostCity/web/lib/destination-graph.test.ts)
- the Yonder quest shelf now uses that shared ordering rule and the explicit
  `identityTier` plus `launchPriority` payload fields in:
  - [web/lib/yonder-destination-nodes.ts](/Users/coach/Projects/LostCity/web/lib/yonder-destination-nodes.ts)
  - [web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx)

This is the first place the promotion boundary changes actual runtime behavior:
attached child nodes can still appear, but they no longer outrank standalone
destination records by default in the launch shelf.

Thirteenth implementation batch completed on **2026-03-15**:

- the canonical destination-node route now supports filtering by `quest_id` and
  `identity_tier`:
  - [web/app/api/portals/[slug]/yonder/destination-nodes/route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/%5Bslug%5D/yonder/destination-nodes/route.ts)
  - [web/lib/yonder-destination-nodes.ts](/Users/coach/Projects/LostCity/web/lib/yonder-destination-nodes.ts)
- the legacy artifact route forwards the same semantics through its
  compatibility wrapper:
  - [web/app/api/portals/[slug]/yonder/artifacts/route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/%5Bslug%5D/yonder/artifacts/route.ts)

This makes the canonical route useful as infrastructure, not just as a renamed
shell. Future Yonder surfaces can now query attached-child nodes or specific
quest lanes directly without re-implementing client-side filtering.

Fourteenth implementation batch completed on **2026-03-16**:

- the live Yonder quest shelf now consumes the canonical route-level `quest_id`
  filtering instead of fetching the full launch set and filtering it locally:
  - [web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx)

This is a small but important shift: the destination-node API semantics are now
being exercised by the primary consumer, not just exposed for hypothetical
future surfaces.

Fifteenth implementation batch completed on **2026-03-16**:

- the canonical destination-node route now owns limit and display-order shaping
  for the launch shelf via shared payload options in:
  - [web/lib/yonder-destination-nodes.ts](/Users/coach/Projects/LostCity/web/lib/yonder-destination-nodes.ts)
  - [web/app/api/portals/[slug]/yonder/destination-nodes/route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/%5Bslug%5D/yonder/destination-nodes/route.ts)
  - [web/app/api/portals/[slug]/yonder/artifacts/route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/%5Bslug%5D/yonder/artifacts/route.ts)
- the live Yonder shelf now requests `limit=6` and consumes the server-shaped
  order directly in:
  - [web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/YonderDestinationNodeQuestsSection.tsx)

This pushes more of the launch-surface contract into reusable infrastructure:
future destination-node consumers can rely on the route for filtering, ordering,
and sizing instead of rebuilding shelf semantics client-side.

### Deliverables

- clear promotion rules for when destination-attached richness earns first-class identity
- stable attached-home model for facts, landmarks, features, specials, and experiences
- route and page cleanup where old vertical assumptions still leak into UX

### Primary Targets

- [docs/entity-graph-and-crawler-architecture.md](/Users/coach/Projects/LostCity/docs/entity-graph-and-crawler-architecture.md)
- [database/schema.sql](/Users/coach/Projects/LostCity/database/schema.sql)
- affected destination and portal runtime files in [web/app](/Users/coach/Projects/LostCity/web/app)

### Exit Gate

- future entities can be added without inventing one-off semantics
- destination richness has a durable shared home
- runtime route naming matches current entity strategy

## Execution Order

1. Phase 1: Taxonomy Reset
2. Phase 2: Platform Semantics
3. Phase 3: Canonical Entity Surface
4. Phase 4: Crawler Contract Completion
5. Phase 5: Destination Graph and Route Cleanup

This order is deliberate. Taxonomy first, then platform semantics, then endpoint behavior, then crawler contract completion, then longer-lived destination and route cleanup.

## Immediate Batch

This is the next concrete implementation batch to execute:

1. create a shared portal/entity taxonomy module
2. refactor `portal-manifest` and portal runtime helpers to use it
3. add schema/migration parity enforcement to reduce further contract drift
4. instrument `/api/programs` fallback usage and prepare removal
5. design the entity-family-aware federation contract before more portal proliferation

## Risk Notes

- This workstream touches shared platform semantics. Route and scope changes need targeted portal tests every batch.
- The repo already has unrelated dirty files in `web/`; avoid opportunistic refactors.
- Because there is no paid staging DB for this stream, schema and federation changes must be validated with tighter local and production-safe checks.
