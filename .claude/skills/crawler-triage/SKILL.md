---
name: crawler-triage
description: Use when diagnosing event-crawler regressions from crawl_logs and source health data, deduping against existing GitHub Issues, and filing new issues with root-cause evidence. Triggered by the crawler-triage-daily Routine.
---

# Crawler Triage

## Overview

Daily triage of event-crawler regressions. Reads the last 24 hours of crawl activity, identifies sources that got worse, diagnoses why, and files one GitHub Issue per regression with evidence the owner can act on.

**Core principle**: the Routine's job is *diagnosis with evidence*, not detection. Detection already happens in `crawl_logs` + `sources.health_score`. Humans (or this Routine) have been doing bad triage — reading numbers, shrugging, closing the tab. This skill replaces that step.

## When to use

- Running as part of the `crawler-triage-daily` Routine
- Manual invocation when investigating why the feed looks thin
- After a bulk crawler refactor to see what broke

## Procedure

### 1. Load baseline state

Health signals are **not stored as columns** — they must be computed from `crawl_logs` history. Shell out to Python using the existing `db` module:

```python
from db import get_client
from datetime import datetime, timezone, timedelta
from collections import defaultdict

client = get_client()

# Active sources — identifiers + context. No health columns exist here.
sources = (client.table("sources")
    .select("id, slug, name, url, is_active, last_crawled_at, health_tags, source_type")
    .eq("is_active", True)
    .execute()).data
sources_by_id = {s["id"]: s for s in sources}

# 30 days of crawl_logs — enough history to compute trend signals.
# NOTE: crawl_logs uses `source_id` (int FK), not source_slug. Join via sources_by_id.
cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
logs = (client.table("crawl_logs")
    .select("source_id, status, events_found, error_message, started_at, completed_at")
    .gte("started_at", cutoff)
    .order("started_at", desc=True)
    .execute()).data

logs_by_source = defaultdict(list)
for row in logs:
    logs_by_source[row["source_id"]].append(row)
```

For each active source, compute these signals from its recent logs (already in descending order):

```python
def compute_signals(source_logs):
    if not source_logs:
        return None  # no activity in 30d — handled separately as "long silence"

    # Consecutive non-success runs at the head
    consecutive_failures = 0
    for log in source_logs:
        if log["status"] == "success":
            break
        if log["status"] in ("failed", "error"):
            consecutive_failures += 1
        # "running" rows are in-flight, skip them

    # Zero-event streak among most-recent successful runs
    zero_event_streak = 0
    for log in source_logs:
        if log["status"] != "success":
            continue
        if (log["events_found"] or 0) == 0:
            zero_event_streak += 1
        else:
            break

    # 7-day average events across successful runs
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    week_successes = [
        l for l in source_logs
        if l["status"] == "success"
        and datetime.fromisoformat(l["started_at"].replace("Z", "+00:00")) > week_ago
    ]
    week_avg_events = (
        sum((l["events_found"] or 0) for l in week_successes) / len(week_successes)
        if week_successes else 0
    )

    # Most recent error_message (for pattern-matching in step 3)
    last_error = next(
        (l["error_message"] for l in source_logs if l["error_message"]),
        None
    )

    # Last successful crawl timestamp
    last_success_at = next(
        (l["started_at"] for l in source_logs if l["status"] == "success"),
        None
    )

    return {
        "consecutive_failures": consecutive_failures,
        "zero_event_streak": zero_event_streak,
        "week_avg_events": week_avg_events,
        "last_error": last_error,
        "last_success_at": last_success_at,
    }
```

### 2. Identify meaningful regressions

A regression is **meaningful** only if it meets one of:

| Signal | Threshold |
|---|---|
| Consecutive failed runs | `consecutive_failures >= 3` (status `failed`/`error` at head) |
| Zero-event streak | `zero_event_streak >= 2` AND `week_avg_events >= 5` (previously productive, now silent) |
| Long silence | `sources.last_crawled_at` > 3 days ago while `is_active = True` (crawler scheduling issue or dead source) |
| New error pattern | `last_error` matches a failure pattern (bot-block, rate-limit, DNS, SSL) AND no similar error in prior 7 days |

**Not meaningful** (do NOT file):
- Single transient failure (one 500, one timeout) — Python's circuit breaker handles these
- Sources where `consecutive_failures >= 10` — these are long-dead and either have open issues already or were intentionally left to rot; dedup will catch them
- Zero-event streak when `week_avg_events < 5` — source was already quiet, nothing changed
- Sources tagged with `health_tags` containing `seasonal`, `no-standalone-crawler`, `festival-structural`, or `inactive-gated-crawler` — these are editorial-flagged exceptions; skip them

### 3. Diagnose root cause

For each meaningful regression, fetch the source URL yourself and match against these patterns:

| Pattern | Signals | Suggested fix |
|---|---|---|
| **Bot block** | 403, 429, Cloudflare challenge page in HTML, "Just a moment…" text | Add UA rotation, add Playwright path, verify robots.txt |
| **Rate limit** | 429 with `Retry-After` header, or escalating 503s | Increase delay in `sources.crawl_delay_seconds`, reduce concurrency |
| **Site migration** | 301/302 to different hostname, or 404 at the known path | Update `sources.url`, re-crawl, verify selectors still work |
| **Selector drift** | 200 OK, HTML renders, events extract = 0, page visually has events | CSS selectors broken — inspect new structure, update crawler |
| **SSL/cert failure** | `SSL: CERTIFICATE_VERIFY_FAILED` in error_message | Site's cert expired or chain broke — usually self-heals, flag if >7 days |
| **DNS / down** | `NameResolutionError`, `Connection refused`, TCP timeout | Source may be permanently dead — check via `dig` + manual browser visit |
| **JS-required** | 200 OK, 0 events, page has `<div id="root"></div>` and little else | Needs Playwright, flag for migration to profile-first pipeline |
| **Unknown** | None of the above match | File with "needs human diagnosis" note; include raw response |

Capture evidence for each issue: HTTP status, first 500 chars of response body, response headers (Content-Type, Server, CF-RAY), and a link to the failing `crawl_logs` row.

### 4. Dedup against GitHub Issues

Before filing, search open issues in this repo:

```
Query: label:crawler-regression state:open "{source_slug}" in:title
```

Via the GitHub connector, or equivalent:
```bash
gh issue list --label crawler-regression --state open --search "in:title {source_slug}"
```

**If an open issue exists**:
- If the diagnosis matches the issue's current hypothesis (check the issue body / most recent comment) → add a comment with today's fresh evidence, do NOT open a new issue
- If the diagnosis is *different* (e.g., was "selector drift," now it's "bot block") → comment on the old issue noting the mode shift, then open a new issue for the new mode and cross-link them

**If no open issue** → file a new one using the template below.

### 5. File issue (new regressions only)

Title format: `[crawler] {source_slug} — {pattern}` (e.g., `[crawler] arts-atl-rss — selector drift`)

Labels: `crawler-regression`, and one of: `bot-block`, `rate-limit`, `selector-drift`, `site-migration`, `ssl`, `dns`, `js-required`, `unknown`

Body template:

````markdown
## Summary
{source_name} ({source_slug}) has regressed.

- Pattern: {pattern}
- First noticed: {first_failure_timestamp} ({N} consecutive failures)
- 7-day avg events: {avg} → current: {current}

## Evidence
- HTTP status: {status}
- Response size: {bytes}
- Relevant headers:
  ```
  {headers_excerpt}
  ```
- Response body (first 500 chars):
  ```
  {body_excerpt}
  ```
- Failing crawl_logs row: {supabase_link}

## Suggested fix
{pattern_specific_fix_from_table_above}

## Not yet verified
- [ ] Does the fix above actually resolve the issue?
- [ ] Is the source worth keeping? (check if a better canonical alternative exists per crawlers/CLAUDE.md "always crawl original sources, never curators")
````

### 6. Post Slack digest

Always post exactly one message to `#crawler-health`, even if empty.

Format:

```
*Crawler Triage — {date}*
• Sources checked: {N}
• New regressions: {M}  (issues: {github_issue_urls})
• Mode shifts on existing issues: {K}
• Persistent regressions (open >7d): {J}  ← nudge if J > 5
• Top 3 concerning: {slug1} ({pattern}), {slug2} ({pattern}), {slug3} ({pattern})

No issues filed? {reason}
```

## Common mistakes

**Filing noise instead of signal.** If you're about to file more than ~5 issues in one run, something is wrong — either the pipeline had a systemic failure (bad deploy, Supabase outage) or your threshold is too loose. Post a Slack alert about the anomaly instead of filing 50 issues.

**Fixing the crawler.** You will be tempted. Don't. The Routine scope is diagnosis only. A separate Routine (not built yet) will handle fixes.

**Trusting health_score blindly.** Health score is derived from local SQLite in `crawler_health.py`, which is *ephemeral* in the Routine's cloud filesystem. Use `crawl_logs` (Supabase, authoritative) for state, not local health DB.

**Re-filing the same source daily.** The dedup step is load-bearing. Skip it and the repo's issue list becomes unreadable in a week.

**Sampling the source during a rate-limit window.** If the crawler got rate-limited at 05:00 UTC, and you hit the same endpoint at 14:00 UTC, you might get 200 OK and wrongly conclude the source is healthy. Cross-check: if `crawl_logs.error_message` says "429" but your fetch is 200, the diagnosis is "rate-limited during crawl window" — file it as `rate-limit`, not "no issue."

## Schema reference (verified 2026-04-17)

The Routine depends on these columns. If any go missing or are renamed, the skill will silently produce wrong results — re-run the dry-run below and update this section + the queries above.

`sources` — columns used: `id, slug, name, url, is_active, last_crawled_at, health_tags, source_type`
- `health_tags` is a Postgres text array (e.g., `['seasonal', 'no-standalone-crawler']`). Editorial, not auto-computed.
- There is **no** `health_score`, `consecutive_failures`, `last_success_at`, or `last_error_type` — all derived from `crawl_logs`.

`crawl_logs` — columns used: `source_id, status, events_found, error_message, started_at, completed_at`
- `source_id` is an integer FK to `sources.id` (NOT `source_slug` — always join via `sources_by_id`).
- Observed `status` values: `'success'`, `'failed'`, `'running'`. Treat anything else as a failure for triage purposes.
- `events_found` can be `None` — coerce to 0.

## Testing

Before each deploy (and at least monthly while this is research-preview), dry-run locally from `crawlers/`:

```bash
source venv/bin/activate
python -c "
from db import get_client
c = get_client()
expected = {
    'sources': {'id','slug','name','url','is_active','last_crawled_at','health_tags','source_type'},
    'crawl_logs': {'source_id','status','events_found','error_message','started_at','completed_at'},
}
for t, cols in expected.items():
    r = c.table(t).select('*').limit(1).execute()
    actual = set(r.data[0].keys()) if r.data else set()
    missing = cols - actual
    print(f'{t}: {\"OK\" if not missing else f\"MISSING {missing}\"}')"
```

If anything says MISSING, stop — update the skill before the next Routine run.

**Integration test** (do once, not every run): pick a known-dead source, manually trigger the Routine, confirm: (a) issue filed, (b) dedup works — run it a second time, confirm no duplicate issue.

## Red flags — STOP and alert instead of triaging

- More than 20% of active sources show regressions → likely pipeline outage, not individual regressions. Post a Slack alert and stop.
- Supabase query returns empty `crawl_logs` for the last 24h → the daily crawl didn't run. Alert to Slack and stop.
- GitHub API errors on the first issue attempt → don't spam failed attempts. Stop, alert to Slack, exit.

## Scope boundaries

**In scope**: event crawlers only (sources that write to `events` via `main.py`).

**Out of scope (for now)**:
- `network_sources` staleness (handled weekly by `check_network_source_health.py`; can extend this skill later)
- Content health audit findings (separate pipeline via `content_health_audit.py`)
- Crawler code fixes (future Routine)
- Auto-deactivating dead sources (requires human review)
