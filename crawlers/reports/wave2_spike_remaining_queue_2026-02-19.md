# Spike Report - Remaining Zero-Event Queue (Post Override)

Scope: Investigate the remaining reactivation queue after treating `buried-alive` as seasonal.

## Queue
1. home-depot-backyard
2. steady-hand-beer
3. silverspot-cinema-atlanta
4. clark-atlanta
5. community-foundation-atl
6. georgia-peace
7. l5p-community-center
8. moca-ga
9. monday-night-garage
10. theatrical-outfit

## Findings
- home-depot-backyard: last_status=success, last_found=75, upcoming_120=0, upcoming_365=0, max_upcoming=none
- steady-hand-beer: last_status=success, last_found=29, upcoming_120=0, upcoming_365=0, max_upcoming=none
- silverspot-cinema-atlanta: last_status=running, last_found=0, upcoming_120=0, upcoming_365=0, max_upcoming=none
- clark-atlanta: last_status=success, last_found=0, upcoming_120=0, upcoming_365=0, max_upcoming=none
- community-foundation-atl: last_status=success, last_found=0, upcoming_120=0, upcoming_365=1, max_upcoming=2026-11-15
- georgia-peace: last_status=success, last_found=0, upcoming_120=0, upcoming_365=0, max_upcoming=none
- l5p-community-center: last_status=success, last_found=0, upcoming_120=0, upcoming_365=1, max_upcoming=2026-10-20
- moca-ga: last_status=success, last_found=0, upcoming_120=0, upcoming_365=1, max_upcoming=2026-08-03
- monday-night-garage: last_status=success, last_found=0, upcoming_120=0, upcoming_365=1, max_upcoming=2026-08-23
- theatrical-outfit: last_status=success, last_found=0, upcoming_120=0, upcoming_365=1, max_upcoming=2026-12-23

## Interpretation
- `home-depot-backyard` and `steady-hand-beer` are ingesting events but likely with stale/past dates (crawl success with high found counts while upcoming window is empty).
- `silverspot-cinema-atlanta` remains blocked by Cloudflare challenge health checks.
- `monday-night-garage` crawler is venue-only behavior (returns 0 events by design), so keeping it in event-goal queue is misaligned.
- Remaining sources are mostly crawl-success with zero found and sparse/no near-term schedule; likely require source-specific extraction refresh or goal tuning.

## Suggested Next Fix Wave
1. Date-correction fixes: home_depot_backyard.py, steady_hand_beer.py
2. Access workaround / alternate data source: silverspot_atlanta.py
3. Goal-model alignment for venue-only source: monday-night-garage
4. Selector refresh pass: clark-atlanta, community-foundation-atl, georgia-peace, l5p-community-center, moca-ga, theatrical-outfit
