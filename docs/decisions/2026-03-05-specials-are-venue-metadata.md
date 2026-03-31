# ADR: Specials Are Venue Metadata, Not Discovery Items

**Date:** 2026-03-05
**Status:** Accepted

## Context

Venue specials (happy hours, brunches, deals) were initially ingested as events and proposed as a feed section. This failed the product smell test: data was too thin (~60 records), not curated, and mixing venue attributes with event discovery confused intent. The specials section was technically sound but product-wise worthless — a cautionary example of "bias toward building."

## Decision

Specials are venue attributes that render on venue detail pages via `VenueSpecialsSection`. They are not events and do not appear in the feed.

## Consequences

- Specials live in the `venue_specials` table, not `events`.
- Source 1177 was cleaned up: 207 food/drink events migrated to venue_specials, source deactivated. 12 specials created, 34 real events kept.
- Shared utils in `web/lib/specials-utils.ts` (VenueSpecial type, isActiveNow, formatDays, etc.) use ISO 8601 day convention (1=Mon, 7=Sun).
- Future: could become a Find filter ("show venues with active specials") when data is 10x richer.
- Prevents re-proposing specials in feed sections.

## Supersedes

None
