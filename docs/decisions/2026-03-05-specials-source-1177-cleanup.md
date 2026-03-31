# ADR: Source 1177 Specials Cleanup — Events to Venue Metadata

**Date:** 2026-03-05
**Status:** Accepted

## Context

Source 1177 had ingested 207 food/drink items as events when they were actually venue specials (happy hours, brunch deals, daily food specials). These cluttered the event feed with non-events and confused the discovery experience.

## Decision

Migrate source 1177 items: real events stay as events, venue specials move to `venue_specials` table, source deactivated.

## Consequences

- 12 venue specials created from the 207 items, 34 real events retained.
- Source 1177 deactivated — no new ingestion.
- Prevents future re-ingestion of specials as events from this source.
- Established the pattern: if it's a recurring venue attribute (happy hour, daily special), it's a special, not an event.

## Supersedes

None
