# ADR: Portal Data Isolation via owner_portal_id

**Date:** 2026-02-14
**Status:** Accepted

## Context

Nashville crawlers produce events with `portal_id=NULL`. The query pattern `portal_id.eq.X,portal_id.is.null` (intended to show portal-specific + unattributed events) leaks Nashville events into every non-exclusive portal. This is a data integrity issue — portal customers see events from other cities.

## Decision

Every active source MUST have `owner_portal_id` set. Events automatically inherit `portal_id` from their source's `owner_portal_id` via a database trigger (`crawlers/db.py` auto-inheritance). City filtering added to timeline, tonight, explore, and event detail APIs.

## Consequences

- The `sources` table has a CHECK constraint: `is_active = true` requires `owner_portal_id` to be set.
- Fix migration: `20260215300000_nashville_portal_attribution.sql` set `owner_portal_id` on 28 Nashville sources + backfilled events.
- **Dangerous query pattern to avoid:** `portal_id.eq.X,portal_id.is.null` — this leaks unattributed events. Always filter by city or use explicit portal attribution.
- **Remaining gap:** `searchVenues` RPC (`search_venues_ranked`) has no city param — Nashville venues can still appear in Atlanta search results.
- New API routes must include city filtering or explicit portal_id checks. Never assume `portal_id IS NULL` means "show to everyone."

## Supersedes

None
