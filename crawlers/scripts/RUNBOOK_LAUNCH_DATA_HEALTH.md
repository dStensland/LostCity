# Atlanta Launch Data Health Runbook

Last updated: 2026-02-27

This is the single operator entrypoint for launch data health.

Policy alignment for feed quality:
- User controls and filtering are primary.
- Cross-section duplicate suppression is mandatory.
- Diversity balancing is optional and should not override user control.

## Scope (Current)

- Active launch scope: Atlanta only.
- Use portal+city scoped health checks for launch (`--portal atlanta --city Atlanta`).
- `aa-atlanta` / `na-georgia` are support-program sources and must remain in the `atlanta-support` portal scope.

## Schema and Visibility Contract

- `events.is_active` is required for row-level event visibility.
- `venues.active = false` must suppress future/ongoing event visibility.
- Closed venue registry (`closed_venues`) is authoritative for known closures.
- Feed assembly must avoid duplicate event IDs across sections.

If `content_health_audit.py` reports `scope.events_active_column != is_active`, fix schema before any launch decision.

## Fast Path (Post-Crawl, Default)

Run this after crawler runs:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/post_crawl_maintenance.py --city Atlanta
```

Crawler CLI behavior (write-mode runs):
- `python3 main.py` now runs post-crawl launch maintenance automatically after crawl tasks.
- Default maintenance scope: `city=Atlanta`, `portal=atlanta`.
- Override/escape hatch: `--skip-launch-maintenance` (use only for debugging/emergency triage).

Optional conservative reactivation pass:

```bash
python3 scripts/post_crawl_maintenance.py --city Atlanta --include-reactivation
```

What this sequence does:
1. Applies closed venue registry updates.
2. Deactivates events on inactive venues.
3. Demotes stale tentpole flags on inactive events (`is_tentpole=true AND is_active=false`).
4. Canonicalizes same-source duplicates.
5. Canonicalizes cross-source duplicates.
6. Runs iterative portal-scoped short-description sweep (defaults to `portal=atlanta` for Atlanta city runs), including source-linked and source-less (`source_id IS NULL`) rows.
7. Runs launch gate check for Atlanta.

Short-description floor for launch quality:
- Default sweep threshold is `<220` chars.
- Goal state for Atlanta launch: `0` rows under 220 chars in visible future scope.

Disable description sweep only when needed:

```bash
python3 scripts/post_crawl_maintenance.py --city Atlanta --skip-short-description-sweep
```

Optional same-day content-depth lift (after gate is stable):

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/enrich_eventbrite_descriptions.py --portal atlanta --start-date $(date +%F) --limit 200 --apply
python3 scripts/enrich_non_eventbrite_descriptions.py --portal atlanta --start-date $(date +%F) --limit 5000 --page-size 1000 --apply
python3 scripts/launch_health_check.py --city Atlanta --portal atlanta
```

Optional participant integrity lift (music lineup quality, Atlanta-scoped):

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Dry-run first on high-signal music sources
python3 scripts/backfill_event_artists.py \
  --portal atlanta \
  --categories music \
  --backfill-only \
  --source-slugs terminal-west,boggs-social,the-eastern,aisle5,the-masquerade \
  --dry-run

# Apply once samples look correct
python3 scripts/backfill_event_artists.py \
  --portal atlanta \
  --categories music \
  --backfill-only \
  --source-slugs terminal-west,boggs-social,the-eastern,aisle5,the-masquerade
```

Notes:
- Keep source scoping tight for participant backfills to avoid generic program titles being interpreted as artists.
- Backfill defaults to high-confidence additions and skips low-confidence single-entity title mirrors.
- Use `--allow-single-entity` only for narrowly scoped, reviewed sources.
- Use `--cleanup-only` on the same scope to re-sanitize existing rows after parser improvements.
- Use `reports/content_health_findings_YYYY-MM-DD_portal-atlanta_city-atlanta.md` -> `Participant Gap Drilldown` to pick next source targets.
- Interpret drilldown as actionable expected coverage (template/non-performer titles such as premium seating packages or generic party/trivia/worship rows are excluded).
- For known ambiguous title sources, backfill can leverage source-derived clues (detail URL/description) to recover participant names without broad low-confidence parsing.
- Crawl smart-update now upgrades listing placeholder URLs (for example `/events/`) to event-specific links when available.
- Crawl smart-update can replace placeholder participant rows (`event_artists.name == title`) when better crawl-time parsed artists are available.
- The Masquerade source now performs a source-level repair pass for lingering listing URLs and promo-title participant fallback.

### Multi-Instance Hardening Checklist (Atlanta)

Use this when a source can emit multiple sessions/showtimes for the same title on the same date.

- Ensure `content_hash` key includes `date|time` (not just date).
- Ensure in-source duplicate keys include time when available.
- If a source does not currently parse time, mark it `parser_hardening_needed` and queue parser work before launch finalization.

Current audit artifact:

- `reports/atlanta_multi_instance_target_audit_2026-03-04.md`
- `reports/atlanta_multi_instance_target_audit_2026-03-04.json`

Current parser-hardening queue:

- none (time-aware post-enrichment hash flow now in place for `fox-theatre` and `tabernacle`)

### Zero-Short Remediation Loop (When Needed)

Use this when feed detail quality drops and you need to force content depth back to launch bar quickly.

```bash
cd /Users/coach/Projects/LostCity/crawlers

# 1) Pull full content health snapshot
python3 scripts/content_health_audit.py --city Atlanta --portal atlanta

# 2) Run portal-scoped enrichment on the current short-source set
python3 scripts/enrich_non_eventbrite_descriptions.py --portal atlanta --source-slugs <comma-separated-short-slugs> --min-length 220 --min-delta 1 --limit 5000 --page-size 1000 --apply

# 3) Re-run short sweep + source-less repair
python3 scripts/post_crawl_maintenance.py --city Atlanta --short-description-threshold 220

# 4) Re-run launch gate
python3 scripts/launch_health_check.py --city Atlanta --portal atlanta
```

## Onboard New Venues/Sources/Crawlers

Use this for net-new coverage work (new venue feed, new source crawler, or expansion event stream).

### 1) Add source wiring

- Create/update source profile in `crawlers/sources/profiles/<source-slug>.yaml`.
- Implement crawler module in `crawlers/sources/<source_slug>.py`.
- Register source slug/module in `crawlers/main.py` (`SOURCE_MODULES` mapping).
- Keep source ID/slug consistent across profile, crawler file, and registry.

### 2) Validate extraction quality (staging first)

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Discover source slug and registration
python3 main.py --list

# Dry run extraction (no DB writes)
python3 main.py --source <source-slug> --db-target staging --dry-run

# Write to staging for real validation
python3 main.py --source <source-slug> --db-target staging
```

### 3) Run quality checks after onboarding crawl

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Health and quality snapshots
python3 main.py --health
python3 main.py --quality

# Launch-quality checks in Atlanta scope
python3 scripts/content_health_audit.py --city Atlanta --portal atlanta
python3 scripts/launch_health_check.py --city Atlanta --portal atlanta
```

### 4) Promote to production + stabilize feed

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Production write requires explicit allow flag
python3 main.py --source <source-slug> --db-target production --allow-production-writes

# Normalize launch health after new data lands
python3 scripts/post_crawl_maintenance.py --city Atlanta
```

### 5) Accept/reject criteria for new source launch

- No visible duplicate regressions in launch gate checks.
- No inactive/closed venue leakage.
- Crawl reliability remains under alert thresholds.
- Content quality is sufficient for user-facing feed (titles/dates/categories/links not structurally broken).

If any criterion fails, fix crawler/profile logic first; do not patch around defects downstream.

## Release/Day-1 Gate Flow

Use this sequence before go/no-go:

```bash
cd /Users/coach/Projects/LostCity/crawlers

# 1) Review closure candidates
python3 scripts/audit_closed_venues.py --export reports/closed_venues_audit_$(date +%F).md

# 2) Apply closure registry updates
python3 scripts/apply_closed_venues.py --apply

# 3) Deactivate events on inactive venues
python3 scripts/deactivate_events_on_inactive_venues.py --apply

# 4) Demote stale tentpole flags on inactive events
python3 scripts/demote_inactive_tentpoles.py --apply

# 5) Produce scoped audit artifacts
python3 scripts/content_health_audit.py --city Atlanta --portal atlanta

# 6) Enforce launch gate
python3 scripts/launch_health_check.py --city Atlanta --portal atlanta
```

## Daily Operator Check (Low Friction)

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/launch_health_check.py --city Atlanta --portal atlanta
```

If this fails, run the post-crawl maintenance sequence and re-check.

## Gate Interpretation

- `PASS`: launch-safe for audited scope.
- `WARN`: operational risk; fix before shipping if user-visible or trending worse.
- `FAIL`: launch-blocking.

Primary launch checks to hold at zero where possible:
- `duplicates.same_source_visible`
- `duplicates.cross_source_visible`
- `closed.registry_leakage`
- `closed.inactive_leakage`
- `content.short_desc_pct.atlanta-recurring-social`
- `content.short_desc_pct.team-trivia`
- `content.short_desc_pct.meetup`
- `content.short_desc_pct.ticketmaster`
- `content.short_desc_pct.eventbrite`
- `content.short_desc_pct.amc-atlanta`
- `content.short_desc_pct.fulton-library`
- `content.short_desc_pct.truist-park`
- `content.short_desc_pct.laughing-skull`
- `content.short_desc_pct.lore-atlanta`
- `content.short_desc_pct.cooks-warehouse`
- `content.short_desc_pct.big-peach-running`
- `participants.music_coverage_pct`

## Failure Playbook

If duplicates regress:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/canonicalize_same_source_exact_duplicates.py --start-date $(date +%F)
python3 scripts/canonicalize_cross_source_duplicates.py --start-date $(date +%F)
python3 scripts/launch_health_check.py --city Atlanta --portal atlanta
```

If inactive/closed leakage regresses:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/apply_closed_venues.py --apply
python3 scripts/deactivate_events_on_inactive_venues.py --apply
python3 scripts/launch_health_check.py --city Atlanta --portal atlanta
```

If tentpole inventory drifts with inactive rows:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/demote_inactive_tentpoles.py --apply
python3 festival_tentpole_qualification_audit.py --md-out ../reports/festival-tentpole-qualification-$(date +%F)-post-maintenance.md
```

If crawl reliability regresses (`crawl.error_rate_24h` near/above threshold):
- Prioritize source failure triage and reruns before launch decisions.
- Re-run `python3 scripts/launch_health_check.py --city Atlanta --portal atlanta` after fixes.

## Artifacts to Read First

- Gate decision: `crawlers/reports/content_health_gate_YYYY-MM-DD_portal-atlanta_city-atlanta.json`
- Executive readout: `crawlers/reports/content_health_assessment_YYYY-MM-DD_portal-atlanta_city-atlanta.md`
- Drilldown: `crawlers/reports/content_health_findings_YYYY-MM-DD_portal-atlanta_city-atlanta.md`

## Reference Docs

- Audit reference: `crawlers/scripts/README_AUDIT.md`
- Data quality toolkit: `crawlers/scripts/README_DATA_QUALITY.md`
