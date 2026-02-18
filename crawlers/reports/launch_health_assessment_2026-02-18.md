# Launch Health Assessment - 2026-02-18

## Scope / Environment
- Requested: full **staging** crawl health pass + launch data audit.
- Blocker: staging credentials are not configured in this environment (`STAGING_SUPABASE_URL`, `STAGING_SUPABASE_SERVICE_KEY`).
- Executed fallback: full **read-only production** assessment (no production write flags used).

## Executive Summary
- Core dedupe integrity is healthy: **0 same-source duplicate groups**, **0 visible cross-source duplicate groups**.
- Indie cinema coverage is mixed: **Tara/Starlight at 100% time coverage**, **Plaza at 75%**, **Landmark Midtown at 81.2%** (next 30 days).
- Data quality still has broad long-tail risk: **66 active sources below 75% quality**.
- Walkability and history initiatives are present in production, but distributed across multiple fields/tables (not a single `walkability_score`/`historic_facts` column), which caused this audit to under-report them initially.
- Closed-venue suppression is mostly working but has leakage: **9 future visible events at `churchill-grounds`**.

## Health Snapshot
### Crawler health report
- Today's crawls: **7 total, 7 successful, 0 failed**.
- Source health distribution: **721 healthy**, **24 degraded**, **8 unhealthy** (753 tracked).
- Recommended workers: **4**.
- Repeated failers (3+ consecutive) include:
  - `lifeline-animal-project` (14)
  - `atlanta-city-events` (11)
  - `vista-yoga` (9)
  - `atlanta-ballet` (6)

### Crawl log freshness (last 24h)
- Runs: **1028** across **468** unique sources.
- Status mix: **833 success**, **136 error**, **59 running**.
- Throughput: **36,898 found**, **5,388 new**, **27,427 updated**.
- Top erroring sources (count):
  - `atlanta-city-events` (6)
  - `lifeline-animal-project` (6)
  - `home-depot-kids-workshops` (3)
  - `piedmont-athens` (3)
  - `morningside-civic` (3)

## Data Integrity
- Future events audited (`start_date >= 2026-02-18`): **18,843** total, **17,744 visible**.
- Same-source natural-key duplicate groups: **0**.
- Cross-source duplicate groups (any): **45**.
- Cross-source duplicate groups visible to users: **0**.

Interpretation:
- Cross-source overlap still exists in storage (expected from multiple feeds), but canonical suppression is currently preventing user-visible duplication.

## Cinema / Showtime Assessment
Source quality report (`crawlers/reports/launch_quality_2026-02-18.txt`) shows:
- `plaza-theatre`: **70% complete** (24 events missing start times)
- `tara-theatre`: **90% complete**
- `fox-theatre`: **40% complete**
- `atlanta-film-society`: **56% complete**
- `atlanta-film-festival`: **48% complete**

Venue-level next-30-days time coverage audit:
- Plaza Theatre: **60 events**, **45 with time**, **15 missing** (**75.0%**)
- Tara Theatre: **61 events**, **61 with time** (**100%**)
- Landmark Midtown Art Cinema: **16 events**, **13 with time**, **3 missing** (**81.2%**)
- Starlight Drive-In Theatre: **24 events**, **24 with time** (**100%**)

Interpretation:
- The missing-time issue is still concentrated at Plaza/Landmark/other film sources and can create day/time ambiguity in UI.

## Initiative Coverage
### Specials / Happy Hour
- `venue_specials`: **337 total active records**.
- Active by type:
  - `daily_special`: 91
  - `event_night`: 82
  - `recurring_deal`: 77
  - `happy_hour`: 46
  - `brunch`: 27
  - `holiday_special`: 8
  - `holiday_hours`: 6

### Genres
- Future events with genres: **8,756 / 18,843** (**46.5%**).
- Music+film with genres: **2,515 / 3,003** (**83.7%**).
- Venues with genres: **283 / 4,053** (**7.0%**).

### Mobility / Walkability Adjacent
- Venues with parking notes: **2,404 / 4,053** (**59.3%**).
- Venues with transit notes: **71 / 4,053** (**1.8%**).
- Venues with transit score: **3,308 / 4,053** (**81.6%**).
- Venues with walkable neighbors (`walkable_neighbor_count > 0`): **1,274 / 4,053** (**31.4%**).
- `walkable_neighbors` records: **58,504**.
- Dedicated `walkability_score` column: **not present** (data is modeled via transit + neighbor fields).

### Historic Facts
- Venues with `historic` vibe tag: **37**.
- Venues with museum/historic venue types: **96**.
- Venues with history-like description text: **196**.
- Explore-track venue entries: **459 total**, **417 with editorial blurbs**, **67 with history-like blurbs**.
- Dedicated `historic_facts` column: **not present** (history data is currently distributed across tags/types/descriptions/editorial blurbs).

## Problem Areas / Launch Risks
1. Cinema start-time completeness gaps (notably Plaza and some film feeds) can mislead users about what is "tonight".
2. 66 low-quality sources (<75) create long-tail trust risk, especially where missing start times are 100%.
3. Closed-venue leakage: `churchill-grounds` still has 9 visible future events.
4. Analytics command regression: `main.py --analytics` fails with `AttributeError` in `analytics.py` when venue relation is null.
5. Metric-model mismatch: launch audit currently expects single-column fields for walkability/history, but production stores them across multiple structures.

## Artifacts Generated
- Health output: `/Users/coach/Projects/LostCity/crawlers/reports/launch_health_2026-02-18.txt`
- Analytics output (failed mid-report): `/Users/coach/Projects/LostCity/crawlers/reports/launch_analytics_2026-02-18.txt`
- Quality report: `/Users/coach/Projects/LostCity/crawlers/reports/launch_quality_2026-02-18.txt`
- HTML crawl report log: `/Users/coach/Projects/LostCity/crawlers/reports/launch_html_report_2026-02-18.txt`
- Generated HTML report: `/Users/coach/Projects/LostCity/crawlers/reports/crawl_report_20260217_201953.html`
- Consolidated metrics JSON: `/Users/coach/Projects/LostCity/crawlers/reports/launch_data_metrics_2026-02-18.json`

## Recommended Next Actions (Priority Order)
1. Configure staging credentials and rerun this exact assessment in staging for pre-launch signoff.
2. Patch analytics null-handling in `analytics.py` (`venue` relation can be null).
3. Target film/showtime completeness for Plaza/Landmark/film feeds with missing `start_time`.
4. Apply closed-venue suppression for `churchill-grounds` future events.
5. Add canonical rollup metrics (view or materialized fields) for walkability/history so launch audits and dashboards report these initiatives consistently.
