# Atlanta / Hooky Activity Layer File Manifest

**Date:** 2026-03-11  
**Purpose:** identify the files that belong to the current Atlanta-owned activity-layer effort so they can be preserved and packaged without sweeping in unrelated work

---

## Why this exists

The repository is currently mixed with unrelated active work.

This manifest defines the narrow file set for the Atlanta-owned activity layer and Hooky federation effort so that:

- the work can be preserved safely
- future staging/commit packaging has a clear boundary
- unrelated agent work is less likely to get bundled or lost

---

## Current Preservation Artifacts

Local backup artifacts were written outside the repo to:

- `/tmp/lostcity-activity-layer-backup/manifest.txt`
- `/tmp/lostcity-activity-layer-backup/activity-layer-files.tgz`
- `/tmp/lostcity-activity-layer-backup/tracked-web.patch`

Those backups are safety artifacts only. They are not a substitute for a clean commit boundary.

---

## Activity-Layer Files

### Crawler seed scripts

- `crawlers/scripts/seed_atlanta_activity_overlays.py`
- `crawlers/scripts/seed_atlanta_activity_overlays_wave2.py`
- `crawlers/scripts/seed_atlanta_activity_overlays_urban_air.py`
- `crawlers/scripts/seed_atlanta_activity_overlays_wave3.py`
- `crawlers/scripts/seed_atlanta_activity_overlays_wave4.py`
- `crawlers/scripts/seed_atlanta_activity_overlays_wave5_catch_air.py`
- `crawlers/scripts/seed_atlanta_activity_overlays_wave6_family_fun.py`
- `crawlers/scripts/seed_atlanta_activity_overlays_wave7_family_outings.py`
- `crawlers/scripts/seed_atlanta_activity_overlays_wave8_water_farm_fun.py`
- `crawlers/scripts/seed_atlanta_activity_overlays_wave9_trampoline_and_farms.py`
- `crawlers/scripts/seed_atlanta_activity_overlays_wave10_destinations.py`

### Crawler tests

- `crawlers/tests/test_seed_atlanta_activity_overlays.py`
- `crawlers/tests/test_seed_atlanta_activity_overlays_wave2.py`
- `crawlers/tests/test_seed_atlanta_activity_overlays_urban_air.py`
- `crawlers/tests/test_seed_atlanta_activity_overlays_wave3.py`
- `crawlers/tests/test_seed_atlanta_activity_overlays_wave4.py`
- `crawlers/tests/test_seed_atlanta_activity_overlays_wave5_catch_air.py`
- `crawlers/tests/test_seed_atlanta_activity_overlays_wave6_family_fun.py`
- `crawlers/tests/test_seed_atlanta_activity_overlays_wave7_family_outings.py`
- `crawlers/tests/test_seed_atlanta_activity_overlays_wave8_water_farm_fun.py`
- `crawlers/tests/test_seed_atlanta_activity_overlays_wave9_trampoline_and_farms.py`
- `crawlers/tests/test_seed_atlanta_activity_overlays_wave10_destinations.py`

### Reports

- `crawlers/reports/atlanta_activity_overlay_sweep_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave2_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_urban_air_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave3_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave4_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave5_catch_air_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave6_family_fun_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave7_family_outings_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave8_water_farm_fun_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave9_trampoline_and_farms_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave10_destinations_2026-03-11.md`

### Workstream and planning docs

- `prds/atlanta-activity-overlay-audit.md`
- `prds/atlanta-activity-queue-a-feasibility.md`
- `prds/hooky-activity-federation-rules.md`
- `prds/hooky-family-portal-health-plan.md`
- `prds/hooky-next-big-effort-workstream.md`
- `prds/atlanta-hooky-activity-layer-large-effort.md`
- `prds/atlanta-hooky-activity-preflight-checkpoint-2026-03-11.md`
- `prds/atlanta-hooky-activity-file-manifest.md`

### Web federation files

- `web/lib/venue-features.ts`
- `web/lib/venue-features.test.ts`
- `web/lib/spot-detail.ts`
- `web/app/[portal]/spots/[slug]/page.tsx`
- `web/components/views/VenueDetailView.tsx`

---

## Packaging Guidance

If this effort is later staged or committed, use this manifest as the default inclusion list.

Do not assume the rest of the repository is part of this effort.

Do not package unrelated migration or schema changes with this activity-layer work unless they are explicitly required and verified.
