# ADR: Feed Is an Access Layer, Not a Recommendation Engine

**Date:** 2026-02-21
**Status:** Accepted

## Context

Early feed designs drifted toward personalization ("We think you'd like this") and curated tiny lists. This conflicts with LostCity's mission — the city should feel alive and comprehensive, not filtered through an algorithm. Users need agency, not recommendations.

## Decision

The feed organizes the city for you right now. It does not decide what you should do.

## Consequences

- Scoring influences display order, never exclusion. Low-score items still appear, just further down.
- Every section has "See all" linking to the full unfiltered Find view. Quick links are shortcuts, not curated lists.
- Editorial tone ("Atlanta's biggest food festival starts today") rather than algorithmic ("We think you'd like this").
- Wild card sorting breaks filter bubbles intentionally.
- CityPulse context engine drives what sections appear and in what order, but the user always has access to everything.
- Personalization features (if ever built) must be opt-in overlays, not default behavior.

## Supersedes

None
