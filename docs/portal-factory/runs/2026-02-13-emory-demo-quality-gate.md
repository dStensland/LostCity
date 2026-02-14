# Emory Demo Quality Gate (Consumer-Grade)

Date: 2026-02-13  
Owner: Codex + Coach

## Purpose
Define a hard pass/fail gate for Emory demo readiness so iteration is objective and repeatable.

## Acceptance Criteria

1. Clear primary path above the fold (`PASS` or `FAIL`)
- Requirement: Within 5 seconds, a new user can identify one primary next step without scanning multiple competing CTAs.
- Evidence: Hero has one dominant action cluster and one supporting lens block.

2. No obstructive overlays (`PASS` or `FAIL`)
- Requirement: No fixed UI blocks core content, controls, or cards on desktop or mobile.
- Evidence: No bottom action bar collision with feedback badge or content.

3. Consumer language, not platform language (`PASS` or `FAIL`)
- Requirement: Remove internal terms from user-facing copy: `federation`, `guardrail`, `rail`, `layer`, `companion` (except where explicitly branded/intentional).
- Evidence: Headlines, labels, and CTA hints read as patient/visitor-first guidance.

4. Emory-native brand continuity (`PASS` or `FAIL`)
- Requirement: Header, typography, colors, CTA treatment, and card style feel like a seamless extension of Emory Healthcare.
- Evidence: Black utility header + white nav + Emory blue/green system is consistent across pages.

5. Visual hierarchy with focus (`PASS` or `FAIL`)
- Requirement: At most 3 visual weights per viewport section; key message and CTA clearly dominate.
- Evidence: Reduced chip noise, reduced micro-label density, stronger text contrast.

6. Real content impression (`PASS` or `FAIL`)
- Requirement: Sections contain concrete examples and useful details, not placeholders describing what should exist.
- Evidence: Hospital cards, services, and community briefings use realistic copy and links.

7. Mobile first-class behavior (`PASS` or `FAIL`)
- Requirement: 375px wide viewport maintains readable hierarchy and unclipped interactions.
- Evidence: Hero text wraps cleanly, CTAs remain tappable, no overlap with floating badges.

8. Trust clarity without legal verbosity (`PASS` or `FAIL`)
- Requirement: Source confidence is visible but concise and human-readable.
- Evidence: Short confidence cues; no policy-heavy paragraphs in hero context.

9. Performance-safe visual system (`PASS` or `FAIL`)
- Requirement: Visual polish does not rely on fragile effects that fail into unstyled states.
- Evidence: Core content remains legible and branded even when progressive effects fail.

10. Demo narrative coherence (`PASS` or `FAIL`)
- Requirement: Feed -> directory -> hospital pages feel like one coherent product story.
- Evidence: Repeated interaction grammar and consistent voice/CTA semantics.

## Current Status (Before This Pass)
- 1: FAIL
- 2: FAIL
- 3: FAIL
- 4: PARTIAL
- 5: FAIL
- 6: PARTIAL
- 7: FAIL
- 8: FAIL
- 9: FAIL
- 10: PARTIAL

## Execution Order
1. Remove obstructive overlays and interaction collisions.
2. Simplify above-the-fold hierarchy to one primary action path.
3. Rewrite user-facing copy to consumer language.
4. Tighten contrast/typography/chip density for clearer hierarchy.
5. Validate on desktop + mobile and update status table.

## Status After Pass 1 (This Turn)
- 1: PARTIAL
- 2: PASS
- 3: PARTIAL
- 4: PASS
- 5: PARTIAL
- 6: PASS
- 7: PARTIAL
- 8: PARTIAL
- 9: FAIL
- 10: PARTIAL

## Remaining Gaps Before Demo-Ready
1. Reduce hero complexity further (fewer cards/labels above fold).
2. Replace any remaining system-language traces in copy.
3. Add robust graceful fallback styles for CSS/JS failure states.
4. Run a strict mobile QA sweep with screenshot-based pass/fail evidence.

## Status After Pass 2 (Current)
- 1: PASS
- 2: PASS
- 3: PARTIAL
- 4: PASS
- 5: PARTIAL
- 6: PASS
- 7: PARTIAL
- 8: PASS
- 9: PARTIAL
- 10: PASS

## Next Sprint Targets
1. Tighten above-the-fold density by removing one secondary card from each hero.
2. Replace remaining system terms (for example, "federation") with consumer language where possible.
3. Add hard fallback tokens so unstyled states cannot drop to low-contrast/unstyled pages.
4. Complete screenshot QA matrix for desktop + mobile across feed, directory, and hospital pages.
