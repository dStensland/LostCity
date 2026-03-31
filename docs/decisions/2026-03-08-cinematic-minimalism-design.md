# ADR: Cinematic Minimalism Design Direction

**Date:** 2026-03-08
**Status:** Accepted

## Context

The Atlanta portal's design evolved through glassmorphism (backdrop-blur cards, high-opacity glows) which looked striking in mockups but performed poorly in practice — blur is expensive, glass effects are inconsistent across browsers, and the overall effect felt "tech demo" rather than "city guide."

## Decision

Solid surfaces with elevation shadows and subtle atmospheric glow. No backdrop-blur on cards. "City at night" glow — atmospheric and distant, not decorative neon.

## Consequences

- `glass_enabled: false` on all dark presets. `.glass-card`, `.glass-panel`, `.glass-wet` all use solid `--night` fills + shadow elevation.
- Glow dialed down: blur 8-20px, opacity 0.06-0.14 (was 0.15-0.35).
- Chip glow: single 0.08-0.12 atmospheric shadow (was 0.4/0.2 dual-shadow).
- Three core accents: coral (action/CTA), gold (time/featured), neon-green (free/success).
- Influences: Linear Design (precision minimalism), tactile rebellion (anti-AI warmth).
- Anti-patterns: neo-brutalism (wrong fit for a city guide), Apple Liquid Glass (can't replicate on web).

## Supersedes

None (glassmorphism was never a formal decision — it was the initial direction that evolved)
