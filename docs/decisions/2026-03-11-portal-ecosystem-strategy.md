# ADR: Content Pillars Produce Entities, Distribution Portals Consume

**Date:** 2026-03-11
**Status:** Accepted

## Context

First-party portals could be just filtered views of the same event data (cheaper, faster) or independent content factories with unique entity types (richer, more defensible). The platform's network effect depends on each portal enriching the shared data layer, not just viewing it differently.

## Decision

Each first-party portal is a two-sided content factory. Niche content stays in-portal (SAG meetings, open calls, trailhead conditions). General-interest content (festivals, concerts, openings) federates to the base layer and distribution portals. Content pillars (Citizen, Family, Adventure, Arts, Sports) produce unique entities. Distribution portals (FORTH hotels, Convention Companion) consume the enriched aggregate.

## Consequences

- Every new portal must have a unique entity type or it's just a search preset, not a content pillar.
- Portal-specific data models required: programs (Family), destinations (Adventure), exhibitions/open calls (Arts), team schedules (Sports).
- Federation rules determine what flows between portals — facts are global, preferences are local.
- More portals = richer data = more value per portal (network effect).
- Portals without unique entity types should not be built.

## Supersedes

None
