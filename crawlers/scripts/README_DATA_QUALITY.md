# Data Quality Toolkit Reference

Start here for operations: `crawlers/scripts/RUNBOOK_LAUNCH_DATA_HEALTH.md`

This file documents supporting quality-analysis tools. It is not the launch operator checklist.

## Launch Gate Entry Commands

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Atlanta launch gate
python3 scripts/launch_health_check.py --city Atlanta --portal atlanta

# One-command post-crawl maintenance
python3 scripts/post_crawl_maintenance.py --city Atlanta

# Optional reactivation pass (conservative)
python3 scripts/post_crawl_maintenance.py --city Atlanta --include-reactivation

# Optional: disable auto short-description sweep
python3 scripts/post_crawl_maintenance.py --city Atlanta --skip-short-description-sweep
```

Current launch-quality content floor:
- Treat descriptions under `220` chars as thin and queue for enrichment.
- Keep portal scope explicit (`--portal atlanta`) for all remediation commands.
- For support-program sources (`aa-atlanta`, `na-georgia`), keep portal ownership in `atlanta-support`.
- Write-mode crawler runs from `python3 main.py` now auto-run launch maintenance
  (`scripts/post_crawl_maintenance.py` with Atlanta defaults) unless `--skip-launch-maintenance` is set.

## New Coverage Expansion Workflow

For adding new venues/sources/crawlers and promoting them safely, use:
- `crawlers/scripts/RUNBOOK_LAUNCH_DATA_HEALTH.md` -> "Onboard New Venues/Sources/Crawlers"

## Schema Guardrails (Current)

- Launch baseline requires `events.is_active` for row-level event visibility.
- Confirm from `content_health_audit.py` output: `scope.events_active_column` should be `is_active`.
- Schema/migration sync requirement:
  - `database/migrations/267_events_is_active.sql`
  - `supabase/migrations/20260227120000_events_is_active.sql`
  - `database/schema.sql`

## Analysis Scripts

### 1) `data_quality_report.py`
Purpose: broad text report of enrichment, venue completeness, and source quality.

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/data_quality_report.py > tmp/quality_report_$(date +%Y%m%d).txt
```

### 2) `generate_action_items.py`
Purpose: export CSV work queues for source, venue, and event remediation.

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/generate_action_items.py
```

### 3) `data_quality_dashboard.py`
Purpose: quick ASCII dashboard for daily/weekly status checks.

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/data_quality_dashboard.py
```

## High-Value Fix Workflows

### Block inactive/closed venue leakage

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/apply_closed_venues.py --apply
python3 scripts/deactivate_events_on_inactive_venues.py --apply
python3 scripts/launch_health_check.py --city Atlanta --portal atlanta
```

### Resolve duplicate regressions

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/canonicalize_same_source_exact_duplicates.py --start-date $(date +%F)
python3 scripts/canonicalize_cross_source_duplicates.py --start-date $(date +%F)
python3 scripts/launch_health_check.py --city Atlanta --portal atlanta
```

### Optional manual Eventbrite real-extraction pass

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Preview candidate improvements from Eventbrite detail-page content
python3 scripts/enrich_eventbrite_descriptions.py --portal atlanta --start-date $(date +%F) --limit 200

# Apply updates
python3 scripts/enrich_eventbrite_descriptions.py --portal atlanta --start-date $(date +%F) --limit 200 --apply
```

Notes:
- This is a manual recovery tool, not part of the automated enrichment pipeline.
- It uses real detail-page extraction rather than synthetic fallback prose.

### Optional manual non-Eventbrite real-extraction pass (Atlanta launch set)

Targets:
- `ticketmaster`
- `ticketmaster-nashville`
- `gsu-athletics`
- `emory-healthcare-community`
- `atlanta-recurring-social`
- `team-trivia`
- `meetup`
- `amc-atlanta`
- `fulton-library`
- `truist-park`
- `laughing-skull`
- `lore-atlanta`
- `cooks-warehouse`
- `big-peach-running`
- `terminal-west`
- `aisle5`
- `ksu-athletics`
- `painting-with-a-twist`

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Preview candidate improvements from source-page JSON-LD/Open Graph extraction
python3 scripts/enrich_non_eventbrite_descriptions.py --portal atlanta --start-date $(date +%F) --limit 5000 --page-size 1000

# Apply updates
python3 scripts/enrich_non_eventbrite_descriptions.py --portal atlanta --start-date $(date +%F) --limit 5000 --page-size 1000 --apply
```

Notes:
- This is a manual recovery tool, not part of the automated enrichment pipeline.
- It only applies real source-page extraction and does not reintroduce synthetic builder text.

For long-tail cleanup, target current short-description sources directly with `--source-slugs <comma-list>` and keep `--portal atlanta` enabled.

For full zero-short sweeps, run iterative portal-scoped batches:
1. Pull current source short-counts from Atlanta scope.
2. Run `enrich_non_eventbrite_descriptions.py --portal atlanta --source-slugs <all-short-sources> --min-length 220 --min-delta 1 --apply` as a manual real-extraction pass.
3. Recompute counts and repeat until no sources remain.

If short rows include `source_id IS NULL`, run the source-less sweep:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/post_crawl_maintenance.py --city Atlanta --short-description-threshold 220
```

### Repair thin participant coverage (music event_artists, Atlanta scope)

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Dry-run targeted sources first
python3 scripts/backfill_event_artists.py \
  --portal atlanta \
  --categories music \
  --backfill-only \
  --source-slugs terminal-west,boggs-social,the-eastern,aisle5,the-masquerade \
  --dry-run

# Apply
python3 scripts/backfill_event_artists.py \
  --portal atlanta \
  --categories music \
  --backfill-only \
  --source-slugs terminal-west,boggs-social,the-eastern,aisle5,the-masquerade

# Default backfill mode skips low-confidence single-entity title mirrors.
# Use this only when you intentionally want single-entity adds:
python3 scripts/backfill_event_artists.py \
  --portal atlanta \
  --categories comedy \
  --backfill-only \
  --source-slugs laughing-skull \
  --allow-single-entity \
  --dry-run

# For vetted single-act venues, --allow-single-entity now applies to backfill pass
# and supports 3-4 char stage-name acronyms / colon title extraction:
# - "KWN", "OCT", "MJT"
# - "Home Free: Highways & High Seas Tour" -> "Home Free"
# - "ASO Education Presents: Georgia Brass Band" -> "Georgia Brass Band"
# - Ambiguous tour-name cards can use source-derived fallback for supported sources
#   (for example, The Masquerade URL/description signals)
# - Smart-update now promotes listing placeholder URLs (for example `/events/`)
#   to event-specific URLs when the crawler provides a better link.
# - Smart-update can replace placeholder participant rows (`event_artists.name == title`)
#   when incoming `_parsed_artists` is clearly better.
# - The Masquerade crawler now includes an in-source repair pass that upgrades
#   lingering `/events/` URLs and retries promo-title participant fallback.

# Optional: re-sanitize existing rows in same scope
python3 scripts/backfill_event_artists.py \
  --portal atlanta \
  --categories music \
  --cleanup-only \
  --source-slugs terminal-west,boggs-social,the-eastern,aisle5,the-masquerade
```

`content_health_audit.py` now reports participant gaps by source in:
- `participants.by_source_top` (JSON metrics)
- `participants.by_source_expected_top` (JSON metrics, actionable expected)
- `Participant Gap Drilldown` (findings markdown)

## Policy Notes for Feed Health

- User preference controls are primary.
- Duplicate suppression across feed sections is non-negotiable.
- Diversity balancing is secondary and should not override user intent.

## Use This Reference When

- You need deeper diagnostics after a gate issue.
- You are building remediation queues.
- You are tracking week-over-week quality trends.

For day-to-day launch operation flow, use the runbook first.
