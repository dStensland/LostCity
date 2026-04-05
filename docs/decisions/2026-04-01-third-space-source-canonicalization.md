# ADR: Third-Space Wave 1 Source Canonicalization

**Date:** 2026-04-01
**Status:** Accepted

## Context

Wave 1 third-space work surfaced source-identity drift in three places that are
directly on the implementation path:

- `charis-books` exists as crawler/profile code, but its profile metadata and
  recurring-social seed data disagree with the actual crawler path and slug
  shape
- BeltLine exists in overlapping crawler/profile/registry forms under both
  `beltline` and `atlanta-beltline`
- `fulton-library` is operationally API-driven, but some metadata still frames
  it like an HTML-first source

If these are left ambiguous, Wave 1 implementation can easily ship duplicate
sources, fragmented recurring-series logic, or misleading source-health reads.

## Decision

Wave 1 canonicalization decisions:

- `charis-books` is the canonical Charis source slug everywhere
- `atlanta-beltline` is the canonical general BeltLine source slug everywhere
- `fulton-library` is canonically an API-primary Python source, with HTML branch
  pages treated as supplemental enrichment only

Operationally, this means:

- `charis-books-and-more` should not survive as an embedded alternate venue slug
- `beltline` should be treated as legacy and folded into `atlanta-beltline`
  semantics
- `beltline_fitness` can remain a specialized supporting source only if its
  boundaries stay explicit and it does not compete with `atlanta-beltline` for
  canonical BeltLine identity
- source registration and profile metadata should be normalized to reflect the
  actual crawler path rather than stale profile labels

## Consequences

- Charis recurring events, destination identity, and source registration all
  collapse onto a single slug: `charis-books`
- BeltLine work now has one default target: `atlanta-beltline`
- legacy `beltline` artifacts should be deprecated, merged, or clearly marked
  as compatibility-only
- Run Club and other BeltLine recurring-program work should default to
  `atlanta-beltline` unless there is a deliberate reason to keep a subordinate
  specialized source
- Fulton Library implementation should continue to use the BiblioCommons API as
  the authoritative event pipeline
- profile metadata that currently implies the wrong execution path becomes tech
  debt to fix, not a reason to split source identity
- Community Grounds remains a destination-first new source and is unaffected by
  this canonicalization except that its health bar should not be event-led

## Supersedes

None
