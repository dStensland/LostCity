# Audit Scripts Reference

Start here for operations: `crawlers/scripts/RUNBOOK_LAUNCH_DATA_HEALTH.md`

This file is a reference for audit scripts and output artifacts.

## Primary Audit Commands

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Formal content health audit (global)
python3 scripts/content_health_audit.py

# Formal content health audit (Atlanta launch scope)
python3 scripts/content_health_audit.py --city Atlanta

# Enforced launch gate (non-zero exit unless PASS)
python3 scripts/launch_health_check.py --city Atlanta
```

## New Source/Crawler Onboarding

For onboarding flow, use the runbook section:
- `crawlers/scripts/RUNBOOK_LAUNCH_DATA_HEALTH.md` -> "Onboard New Venues/Sources/Crawlers"

## Core Artifacts

`content_health_audit.py` writes:
- `crawlers/reports/content_health_metrics_YYYY-MM-DD.json`
- `crawlers/reports/content_health_assessment_YYYY-MM-DD.md`
- `crawlers/reports/content_health_gate_YYYY-MM-DD.json`
- `crawlers/reports/content_health_findings_YYYY-MM-DD.md`

City-scoped runs add a scope suffix (example Atlanta):
- `crawlers/reports/content_health_metrics_YYYY-MM-DD_city-atlanta.json`
- `crawlers/reports/content_health_assessment_YYYY-MM-DD_city-atlanta.md`
- `crawlers/reports/content_health_gate_YYYY-MM-DD_city-atlanta.json`
- `crawlers/reports/content_health_findings_YYYY-MM-DD_city-atlanta.md`

## What the Formal Audit Covers

- Duplicate integrity (same-source and cross-source overlap)
- Event coverage signals (showtimes, specials/happy-hours, genres)
- Description depth quality (`short` is measured as `<220` chars)
- Participant coverage quality (music/comedy/sports event_artists coverage)
  - Reported in both raw and actionable-expected views.
  - Actionable expected excludes template/non-performer titles (for example: premium seating packages, generic party/trivia/worship templates).
- Participant gap drilldown by source (top missing-participant sources)
- Walkability/mobility and historic coverage
- Closed venue leakage and inactive-venue leakage
- Crawl freshness and reliability context
- Date-over-date regression versus previous run

Feed policy alignment:
- Keep section-level de-duplication strict.
- Favor user-controlled filtering/taste controls over forced diversity balancing.

## Current Schema Expectations

- `content_health_audit.py` auto-detects event active-flag support.
- Launch baseline expects `scope.events_active_column = is_active`.
- Required migration set:
  - `database/migrations/267_events_is_active.sql`
  - `supabase/migrations/20260227120000_events_is_active.sql`
  - `database/schema.sql` (updated in same change set)

## Supporting Audits

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Legacy garbage/data integrity audit
python3 scripts/audit_data_quality.py

# Closed venue drift review
python3 scripts/audit_closed_venues.py --export reports/closed_venues_audit_$(date +%F).md

# Demote stale inactive tentpole flags (dry-run by default)
python3 scripts/demote_inactive_tentpoles.py
python3 scripts/demote_inactive_tentpoles.py --apply
```

## When To Use This Reference

- You need details on audit outputs and scope semantics.
- You need to inspect why a gate status moved.
- You are extending `content_health_audit.py` checks.

For routine launch operations, use the runbook first.
