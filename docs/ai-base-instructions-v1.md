# AI Base Instructions v2 (LostCity)

Date: 2026-03-11
Owner: Product + Engineering
Scope: Any AI-assisted code or content change in this repository.

## Purpose

Reduce repeat regressions, enforce federation architecture, prevent smoke-and-mirrors shipping, and maintain consumer-ready quality as we scale across portals.

## Decision Order (Always)

1. Protect portal federation and attribution contracts.
2. Preserve consumer/admin surface boundaries.
3. Verify data layer exists before building UI.
4. Fix root causes in code paths, not downstream data patches.
5. Maintain performance and visual clarity under real load.
6. Ship with tests and measurable verification.
7. Challenge strategy docs that don't match reality.

## Non-Negotiable Rules

### 1) Portal Contract and Scope

1. `portal` is a slug only; `portal_id` is UUID only.
2. If both are present, they must resolve to the same portal or return `400`.
3. Use shared portal scope helpers (no ad-hoc inline `portal_id` filters).
4. Public records (`portal_id IS NULL`) require explicit city guardrails.
5. Any behavior write route must resolve attribution via shared guard (`resolvePortalAttributionForWrite`).

### 2) Surface Separation

1. Every change must declare surface: `consumer`, `admin`, or `both`.
2. Consumer screens cannot expose admin concepts (configuration, orchestration, governance internals).
3. If feature is `both`, acceptance criteria must be separate per surface.
4. Follow `docs/portal-surfaces-contract.md`.

### 3) Data Ownership and Federation

1. Facts are global; preferences are portal-local.
2. Never silo enrichment that should benefit the network.
3. Do not fix recurring data defects manually in DB if ingestion logic can be corrected upstream.
4. Schema changes require:
   - New migration(s) in `database/migrations/`
   - Matching migration(s) in `supabase/migrations/`
   - Updated `database/schema.sql`

### 4) No Smoke and Mirrors

1. Never build UI before the data layer is confirmed working (query returns real rows).
2. No hardcoded or placeholder data in production components (`const MOCK_DATA = [...]` is a red flag).
3. If a section has no data, render nothing or a proper empty state — never fake content.
4. Browser-verify every UI change: correct text size (not 16px fallback), correct colors, mobile viewport (375px), empty states.
5. Run `npx tsc --noEmit` for the full project, not just the file you edited.

### 5) First-Pass Crawler Capture

1. Every crawler must capture ALL available signal in one pass: events, programs, recurring programming, specials, hours, venue metadata.
2. If you're about to write an enrichment script, ask why the crawler didn't capture this data. Fix the crawler instead.
3. After a single crawl, the venue record should be complete enough that someone could decide whether to visit.

### 6) Event Presentation Contract (Premium Quality)

1. Participant sections are event-type aware, not generic:
   - Music: artists/bands
   - Sports: teams/opponents
   - Comedy: comics/headliners
   - Talks/Panels: speakers/guests
2. Do not synthesize participants from event title tokenization.
3. If structured participant data is missing, omit participant section rather than fabricating.
4. When participants exist, show role labels, per-entity genres/tags when available, and stable links.
5. Ticket CTA/pill must navigate to canonical ticket URL when available.

### 7) Design System Compliance

1. Use Tailwind token classes (`text-xs`, `text-sm`) — never `text-[var(--text-*)]` (broken in TW4).
2. Use color tokens (`--cream`, `--soft`, `--muted` for text; `--void`, `--night`, `--dusk`, `--twilight` for surfaces). Never hardcode hex.
3. Check `components/ui/`, `components/detail/`, `components/feed/` before building from scratch.
4. Full design system reference in `web/CLAUDE.md`.

### 8) Metadata Consistency and Readability

1. Keep card/detail metadata order consistent across the same event type.
2. Text over imagery must include readability treatment (scrim/overlay + sufficient contrast).
3. Header/menu stacking must not reintroduce trapped dropdown z-index contexts.
4. Loading surfaces must preserve route-level skeleton markers.

### 9) Quality and Performance Gates

1. No new N+1 query patterns in feed/find/detail endpoints.
2. Prefer shared utility paths over duplicated business logic.
3. Keep changes scoped and atomic; split mega changes into reviewable commits by domain.

## Required Delivery Checklist (Per Change)

1. State surface (`consumer`/`admin`/`both`) and affected portal context.
2. List impacted contracts (scope, attribution, schema, UI skeleton, z-index, participant model).
3. Implement using shared helpers first; avoid route-local re-implementation.
4. Add or update tests for each changed contract.
5. Run verification commands relevant to the change (see Verification Matrix in `AGENTS.md`).
6. Browser-verify UI changes with real data (not mocks).
7. Report residual risks and explicit follow-ups.
8. If a strategy principle didn't hold up during this work, flag it with a proposed update.

## Default No-Go Conditions

1. Any portal leakage path is introduced or unresolved.
2. Attribution guard is bypassed on behavior writes.
3. Surface boundaries are mixed in IA/copy/routes.
4. Participant data is fabricated from event names.
5. UI ships with hardcoded placeholder data instead of real API calls.
6. UI regressions in menu stacking or skeleton routing are untested.
7. Crawler ships without capturing available venue metadata on the page.
