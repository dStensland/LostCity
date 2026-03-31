# ADR: "Lost ___" Naming Convention for First-Party Portals

**Date:** 2026-03-12
**Status:** Accepted

## Context

First-party portals needed a brand architecture. Options considered: independent brand names, "LostCity + descriptor", and "Lost ___" pattern. Each portal has a completely different visual language (mercurial brand identity) — different fonts, colors, border styles, corner radii. The naming convention needed to unify the brand while allowing visual diversity.

## Decision

All first-party portals use "Lost City: X" as the formal name, with "Lost ___" as the brand shorthand. Each name has a positive double-meaning:
- Lost Citizen (civic) — "Show up"
- Lost Track (adventure) — "Wander over yonder"
- Lost Youth (family) — "Play hooky"
- Lost Arts (creative) — "Scene, surfaced"

Root page tagline: "FIND YOUR THING AND DO IT" (not "Find Your People" — too cliche/social-focused).

## Consequences

- White-labeling demonstrated through B2B clients (FORTH, Gozio), not first-party name variety.
- Each portal's design system is completely bespoke: Citizen (teal, serif, rounded), Track (terracotta, Space Grotesk, sharp corners), Youth (field sage, Plus Jakarta Sans, warm rounded), Arts (copper, monospace + italic serif, zero radius, stroke borders).
- Never build a theme/config system — generate bespoke frontends on a clean API.

## Supersedes

None
