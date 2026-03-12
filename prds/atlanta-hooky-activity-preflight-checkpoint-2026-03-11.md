# Atlanta / Hooky Activity Layer Preflight Checkpoint

**Date:** 2026-03-11  
**Scope:** Atlanta-owned activity layer + Hooky federation  
**Status:** Partially clean; safe to plan, not safe to call globally clean

---

## Purpose

This checkpoint records whether the activity-layer effort is in a good enough state to continue as one large program.

It answers three separate questions:

1. is the live/data path in reasonable shape?
2. are the relevant tests passing?
3. is the repository clean enough to package future work safely?

---

## 1. Data State

The current activity-layer data path is healthy enough to continue.

Latest verified live-state baseline from the overlay reports:

- `36` Atlanta-owned activity targets live
- `118` total live `venue_features` rows across the overlay program
- the latest executed batch is the `Catch Air` wave:
  - `5` new venue rows
  - `15` new overlay rows

Primary evidence:

- `crawlers/reports/atlanta_activity_overlay_sweep_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave2_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_urban_air_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave3_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave4_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave5_catch_air_2026-03-11.md`

Conclusion:

- the live data model is good enough to keep building
- the blocker is not data feasibility

---

## 2. Verification State

Fresh verification completed for the current activity-layer code path:

### Crawler tests

Command:

```bash
cd crawlers && ./venv/bin/pytest \
  tests/test_seed_atlanta_activity_overlays.py \
  tests/test_seed_atlanta_activity_overlays_wave2.py \
  tests/test_seed_atlanta_activity_overlays_urban_air.py \
  tests/test_seed_atlanta_activity_overlays_wave3.py \
  tests/test_seed_atlanta_activity_overlays_wave4.py \
  tests/test_seed_atlanta_activity_overlays_wave5_catch_air.py
```

Result:

- `12 passed`

### Web federation tests

Command:

```bash
cd web && npm run test -- lib/venue-features.test.ts
```

Result:

- `3 passed`

Conclusion:

- the current Atlanta-owned overlay and Hooky federation path is verified

---

## 3. Migration / Schema State

This effort does **not** currently depend on a new schema change.

However, repo migration hygiene is **not clean**:

- `database/schema.sql` is already modified
- `database/migrations/` contains many unrelated untracked files
- `supabase/migrations/` also contains many unrelated untracked files

Conclusion:

- there is no immediate schema blocker for the next activity-layer phase
- but the migration tree is not in a clean state overall

---

## 4. Commit Hygiene State

The repository is not clean enough to package this effort as a clean commit boundary yet.

Current realities:

- branch is `main`
- there are many unrelated tracked modifications
- there are many unrelated untracked files
- several activity-layer docs are currently untracked rather than cleanly committed

Conclusion:

- safe to continue planning
- safe to continue carefully scoped implementation
- **not** safe to claim the repo is clean
- **not** wise to make a broad commit until this effort is isolated from unrelated work

---

## 5. Decision

Proceed with the large activity-layer workstream only under these conditions:

1. treat the current repo as mixed, not clean
2. batch work narrowly around the Atlanta-owned activity layer
3. avoid mixed commits
4. keep leaving behind reports, tests, and doc updates after each major batch

That means the effort is operationally viable, but repository hygiene still needs an isolation step before it is ready for clean packaging.
