# Crawler Run Reliability Tracker

Last updated: 2026-04-07

This document tracks the operational fixes needed to make production crawl runs
finish cleanly and report state truthfully.

Scope of evidence in this tracker:
- stale `crawl_logs` backlog observed and cleared on 2026-04-07
- full production write run launched on 2026-04-07 after stale cleanup
- live monitoring observations during that run
- lifecycle hardening patch implemented and test-verified on 2026-04-07
- DB execute retry layer implemented and test-verified on 2026-04-07
- DB execute backpressure gate, run-lock observability, and duplicate smart-update recovery implemented and test-verified on 2026-04-07

## Current Status

Code readiness:
- full crawler suite green as of 2026-04-07: `2312 passed`
- stale-run cleanup is implemented in startup flow
- active-run cancellation now exists for:
  - source interrupt paths
  - batch timeout paths
  - process shutdown / exit paths
- cancelled runs are now monotonic:
  - remote `crawl_logs` updates can be gated to `status = running`
  - local SQLite health rows refuse late success/failure overwrite after cancellation
- cinema link precision fixes are live for Plaza, Tara, Landmark, Starlight
- `open_calls` duplicate conflict recovery is improved and no longer appears to hard-loop

Operational reality:
- production still shows intermittent infra and write-path noise during live runs
- scheduler state should be materially more accurate on interrupted or timed-out runs, but this still needs live-run validation
- some error classes are recoverable but still too noisy to ignore
- run-lock state is accurate on disk, but earlier monitoring was checking the wrong path (`tmp/crawler.lock` instead of `.crawler_run.lock`)

## Observed Issues

### 1. Stale `crawl_logs` accumulation

Observed:
- on 2026-04-07 there were `117` production `crawl_logs` rows stuck in `running`
- there was no local lock file and no local `python3 main.py` process at the time
- stale rows were manually cancelled with `scripts/cleanup_stale_crawl_logs.py --hours 2`

Impact:
- blocks operator trust in run state
- makes go/no-go decisions unreliable
- risks overlapping write runs

Current mitigation:
- startup stale cleanup exists in [main.py](/Users/coach/Projects/LostCity/crawlers/main.py)
- manual cleanup script exists at [cleanup_stale_crawl_logs.py](/Users/coach/Projects/LostCity/crawlers/scripts/cleanup_stale_crawl_logs.py)
- active-run registry + cancellation path now exists in [main.py](/Users/coach/Projects/LostCity/crawlers/main.py)
- local cancel bookkeeping now exists in [crawler_health.py](/Users/coach/Projects/LostCity/crawlers/crawler_health.py)
- remote cancel helper now exists in [db/sources.py](/Users/coach/Projects/LostCity/crawlers/db/sources.py)

Root-cause hypothesis:
- primary root cause was real:
  - source runs were created independently, but there was no process-local registry of active run ids
  - timeout/shutdown paths could mark in-memory results failed without closing remote/local run state
  - local and remote state could then only be repaired opportunistically on the next startup
- remaining risk:
  - hard kills (`SIGKILL`, machine crash) still require stale cleanup / heartbeat-based reconciliation

Implemented on 2026-04-07:
- process-local active-run registry in [main.py](/Users/coach/Projects/LostCity/crawlers/main.py)
- explicit cancellation finalization for:
  - `KeyboardInterrupt` / `BaseException` source exits
  - split-pool timeout paths
  - process shutdown via `SIGINT`, `SIGTERM`, and normal interpreter exit
- monotonic local/remote completion semantics so late success/failure cannot overwrite a cancelled run
- regression coverage in:
  - [test_main_retry.py](/Users/coach/Projects/LostCity/crawlers/tests/test_main_retry.py)
  - [test_crawler_health.py](/Users/coach/Projects/LostCity/crawlers/tests/test_crawler_health.py)
  - [test_db.py](/Users/coach/Projects/LostCity/crawlers/tests/test_db.py)
  - [test_crawl_state_reporting.py](/Users/coach/Projects/LostCity/crawlers/tests/test_crawl_state_reporting.py)

Remaining fix plan:
- add a periodic watchdog that marks orphaned `running` rows stale during a live run, not only at next startup
- persist a run-level heartbeat so stale detection uses actual liveness instead of just age
- validate the new cancellation path against a real interrupted production/staging run

Priority: P0

### 2. Transient `[Errno 35] Resource temporarily unavailable`

Observed during 2026-04-07 production run:
- `Lullwater Preserve` failed with `[Errno 35] Resource temporarily unavailable`
- `open-calls-fca` transiently failed with `[Errno 35]` and then succeeded on retry
- `lakewood-amphitheatre` and `midway-pub` showed parallel execution failures with `[Errno 35]`
- `piedmont_classes` logged multiple per-program upsert failures with `[Errno 35]`

Impact:
- creates random source failures
- makes runs less deterministic
- may disproportionately hurt program-heavy sources with many DB writes

Root-cause hypothesis:
- local socket/file-descriptor exhaustion or transient TLS/connectivity pressure under concurrent workload
- write-heavy sources amplify this because each item triggers additional DB traffic

Fix plan:
- implemented on 2026-04-07:
  - shared transient-network classification in [client.py](/Users/coach/Projects/LostCity/crawlers/db/client.py)
  - central `run_with_network_retry(...)` helper in [client.py](/Users/coach/Projects/LostCity/crawlers/db/client.py)
  - Supabase client/query proxy so all `...execute()` calls from `get_client()` get retry/backoff automatically, including many paths that previously bypassed the decorator
  - DB execute backpressure gate in [client.py](/Users/coach/Projects/LostCity/crawlers/db/client.py) that caps concurrent `execute()` calls across worker threads before requests hit Supabase
  - focused coverage in [test_db_client_retry.py](/Users/coach/Projects/LostCity/crawlers/tests/test_db_client_retry.py)
- remaining:
  - capture richer operation context for `[Errno 35]` so we know which table/path is hottest in production
  - review concurrency defaults in [main.py](/Users/coach/Projects/LostCity/crawlers/main.py) and dynamically shed source-level load when transient infra errors spike
  - add run metrics for transient error rate by source and by operation type

Priority: P0

### 3. Playwright network instability: `net::ERR_NETWORK_CHANGED`

Observed during 2026-04-07 production run:
- Roswell365 failed on at least two detail pages with `Page.goto: net::ERR_NETWORK_CHANGED`

Impact:
- partial source coverage
- high risk for Playwright sources with many detail-page hops

Root-cause hypothesis:
- transient network churn inside long-lived Playwright sessions
- insufficient page-level retry for navigation-only failures

Fix plan:
- add targeted retry around Playwright `page.goto()` for `ERR_NETWORK_CHANGED`, `ERR_CONNECTION_CLOSED`, and similar recoverable navigation errors
- prefer fresh page or fresh browser context after repeated navigation failures instead of continuing on a poisoned session
- log retry counts per source so we can identify fragile Playwright crawlers systematically

Priority: P1

### 4. `open_calls` conflict noise still exists

Observed during 2026-04-07 production run:
- `open-calls-fca` still hit `POST /open_calls -> 409 Conflict`
- current recovery path then fetched by slug and patched successfully
- source completed successfully

Impact:
- not currently blocking, but still noisy
- can mask real insert failures if conflict volume grows

Root-cause hypothesis:
- multiple create attempts still race on slug or content-hash identity before reconciliation logic takes over

Fix plan:
- move from "insert then recover" toward "check-or-upsert canonical row first" in the `open_calls` write path
- add metrics for recovered conflicts vs unrecovered conflicts
- decide whether `409 -> fetch -> patch` is acceptable steady-state or should be eliminated

Priority: P1

### 5. Systemic `PATCH places -> 400 Bad Request` fallback noise

Observed:
- many sources log `PATCH places?id=eq.<id> "400 Bad Request"` and then immediately do `GET places?id=eq.<id>` and continue successfully
- this appeared repeatedly during the 2026-04-07 production run

Impact:
- log noise hides real failures
- adds avoidable request volume and latency
- suggests write payload/schema mismatch or fallback-first design smell

Root-cause hypothesis:
- confirmed on 2026-04-07:
  - `get_or_create_place()` was touching `places.verified_at`
  - live schema exposes `places.last_verified_at`, not `verified_at`
  - the failing `PATCH` came from `_touch_verified_at()` and the immediate `GET places ... select *` came from `_maybe_update_existing_venue()`

Implemented on 2026-04-07:
- `_touch_verified_at()` now writes `last_verified_at` in [places.py](/Users/coach/Projects/LostCity/crawlers/db/places.py)
- affected venue tests updated in [test_db.py](/Users/coach/Projects/LostCity/crawlers/tests/test_db.py)

Remaining fix plan:
- validate on the next fresh run that the old `PATCH places -> 400` noise is materially reduced
- instrument exact 400 response bodies for any remaining place patches that still fail
- split "idempotent fetch existing place" from "attempt update existing place" so we only patch when needed

Priority: P1

## Architecture Workstreams

### Workstream A: Run Lifecycle Hardening

Goal:
- a production run should always end in one of: `success`, `failed`, or `cancelled`
- `running` should mean actually alive

Proposed changes:
- implemented:
  - worker-finalization guard that closes `crawl_logs` on exceptions, interrupts, and parent shutdown
  - timeout-path cancellation for unfinished futures
  - monotonic cancellation semantics for local and remote run records
- remaining:
  - add run heartbeat table or heartbeat columns on `crawl_logs`
  - background stale-run reconciler during active runs
  - explicit end-of-run audit that fails loudly if any rows from this run remain `running`

Success metric:
- `0` stale `running` rows older than 2 hours after every run

### Workstream B: Transient Error Budget + Adaptive Concurrency

Goal:
- tolerate short infra turbulence without poisoning the run

Proposed changes:
- implemented:
  - central retry policy for DB `execute()` calls via the shared client proxy
- remaining:
  - central retry policy for external HTTP fetches and Playwright navigations
- classify transient vs permanent failures in one shared utility
- adaptive concurrency reduction when transient failures exceed threshold in the last N minutes

Success metric:
- materially fewer random source failures from `[Errno 35]`, handshake timeouts, and navigation resets

### 2a. Run-lock observability mismatch

Observed:
- operators were checking `tmp/crawler.lock`
- the actual run lock lives at `.crawler_run.lock` via [crawl_lock.py](/Users/coach/Projects/LostCity/crawlers/crawl_lock.py)
- this created a false read that the run lock had disappeared while the crawl was still active

Impact:
- wrong go/no-go decisions
- false positive state-drift diagnosis

Implemented on 2026-04-07:
- public lock-reader helper in [crawl_lock.py](/Users/coach/Projects/LostCity/crawlers/crawl_lock.py)
- run-lock summary in [crawler_health.py](/Users/coach/Projects/LostCity/crawlers/crawler_health.py), including path, pid, target, command, and start time
- coverage in [test_crawl_lock.py](/Users/coach/Projects/LostCity/crawlers/tests/test_crawl_lock.py) and [test_crawler_health.py](/Users/coach/Projects/LostCity/crawlers/tests/test_crawler_health.py)

Priority: P1

### Workstream C: Idempotent Write Paths

Goal:
- duplicate writes should converge quietly, not fill logs with recoverable conflicts

Proposed changes:
- continue hardening `open_calls`
- review other high-churn tables for insert-then-recover patterns
- smart-update event collisions now redirect onto the conflicting natural-key row in [events.py](/Users/coach/Projects/LostCity/crawlers/db/events.py) instead of failing outright on recoverable duplicate indexes
- emit explicit "recovered duplicate" counters in run reports

Success metric:
- conflict recoveries remain low-noise and attributable

### Workstream D: Operator-Facing Observability

Goal:
- an operator should know in minutes whether a run is healthy

Proposed changes:
- live run health snapshot: running/success/failed/cancelled counts, recent failure sample, transient error counts
- post-run reliability summary separated from content summary
- alert when stale rows or transient error spikes cross threshold

Success metric:
- no more manual detective work to determine whether a run is safe to relaunch

## Recommended Execution Order

1. P0: live-validate the new run lifecycle hardening under an interrupted/timed-out run
2. P0: transient error instrumentation and retry wrapper for `[Errno 35]`
3. P1: Playwright navigation retry/reset policy
4. P1: place patch 400 root-cause cleanup
5. P1: reduce `open_calls` conflict noise from steady-state logs

## Immediate Next Steps

- validate that cancelled timed-out/interrupted runs now close `crawl_logs` immediately instead of waiting for next startup
- capture exact failure context for `[Errno 35]` from current run logs while evidence is fresh
- instrument `get_or_create_place()` to record the actual `400` payload/response cause
- add a lightweight run-health snapshot script that can be called during a live run
