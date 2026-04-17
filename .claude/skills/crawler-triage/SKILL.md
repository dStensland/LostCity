---
name: crawler-triage
description: Use when diagnosing event-crawler regressions from crawl_logs and source health data, deduping against existing Linear tickets, and filing new tickets with root-cause evidence. Triggered by the crawler-triage-daily Routine.
---

# Crawler Triage

## Overview

Daily triage of event-crawler regressions. Reads the last 24 hours of crawl activity, identifies sources that got worse, diagnoses why, and files one Linear ticket per regression with evidence the owner can act on.

**Core principle**: the Routine's job is *diagnosis with evidence*, not detection. Detection already happens in `crawl_logs` + `sources.health_score`. Humans (or this Routine) have been doing bad triage — reading numbers, shrugging, closing the tab. This skill replaces that step.

## When to use

- Running as part of the `crawler-triage-daily` Routine
- Manual invocation when investigating why the feed looks thin
- After a bulk crawler refactor to see what broke

## Procedure

### 1. Load baseline state

Query Supabase (shell out to Python using the existing `db` module):

```python
from db import get_client
client = get_client()

# Yesterday's crawl runs, newest first
logs = (client.table("crawl_logs")
    .select("id, source_slug, started_at, finished_at, status, events_found, error_message")
    .gte("started_at", "NOW() - INTERVAL '24 hours'")
    .order("started_at", desc=True)
    .execute())

# Active sources and their current health
sources = (client.table("sources")
    .select("slug, name, url, health_score, consecutive_failures, last_success_at, last_error_type")
    .eq("is_active", True)
    .execute())
```

**IMPORTANT**: column names above are best-effort from the draft. Before the first real run, verify against the actual schema — if a column doesn't exist, log the mismatch and abort rather than ticketing garbage.

### 2. Identify meaningful regressions

A regression is **meaningful** only if it meets one of:

| Signal | Threshold |
|---|---|
| Consecutive failures | ≥3 runs |
| Health score drop | >20 points vs. 7-day average |
| Zero events streak | ≥2 consecutive runs returning 0 events when 7-day avg was ≥5 |
| New error class | First-time appearance of a hard error (5xx, bot block, DNS) for a previously-healthy source |

**Not meaningful** (do NOT ticket):
- Single transient failure (one 500, one timeout) — Python's circuit breaker handles these
- Sources that already have `consecutive_failures ≥ 10` and are long-dead — those have stale tickets already
- Zero-event result if 7-day avg was also near zero (source is just quiet)

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
| **Unknown** | None of the above match | Ticket with "needs human diagnosis" label; include raw response |

Capture evidence for each ticket: HTTP status, first 500 chars of response body, response headers (Content-Type, Server, CF-RAY), and a link to the failing `crawl_logs` row.

### 4. Dedup against Linear

Before filing, query Linear:

```
Search open issues in project `Crawler Regressions` with label `crawler-regression` where title contains the source slug.
```

**If an open ticket exists**:
- If the diagnosis matches the ticket's current hypothesis → add a comment with today's fresh evidence, do NOT open a new ticket
- If the diagnosis is *different* (e.g., was "selector drift," now it's "bot block") → comment on the old ticket noting the mode shift, open a new ticket for the new mode

**If no open ticket** → file a new one using the template below.

### 5. File ticket (new regressions only)

Title format: `[crawler] {source_slug} — {pattern}` (e.g., `[crawler] arts-atl-rss — selector drift`)

Labels: `crawler-regression`, and one of: `bot-block`, `rate-limit`, `selector-drift`, `site-migration`, `ssl`, `dns`, `js-required`, `unknown`

Body template:

```markdown
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
```

### 6. Post Slack digest

Always post exactly one message to `#crawler-health`, even if empty.

Format:

```
*Crawler Triage — {date}*
• Sources checked: {N}
• New regressions: {M}  (tickets: {linear_urls})
• Mode shifts on existing tickets: {K}
• Persistent regressions (open >7d): {J}  ← nudge if J > 5
• Top 3 concerning: {slug1} ({pattern}), {slug2} ({pattern}), {slug3} ({pattern})

No tickets filed? {reason}
```

## Common mistakes

**Ticketing noise instead of signal.** If you're about to file more than ~5 tickets in one run, something is wrong — either the pipeline had a systemic failure (bad deploy, Supabase outage) or your threshold is too loose. Post a Slack alert about the anomaly instead of filing 50 tickets.

**Fixing the crawler.** You will be tempted. Don't. The Routine scope is diagnosis only. A separate Routine (not built yet) will handle fixes.

**Trusting health_score blindly.** Health score is derived from local SQLite in `crawler_health.py`, which is *ephemeral* in the Routine's cloud filesystem. Use `crawl_logs` (Supabase, authoritative) for state, not local health DB.

**Re-ticketing the same source daily.** The dedup step is load-bearing. Skip it and your Linear project becomes unreadable in a week.

**Sampling the source during a rate-limit window.** If the crawler got rate-limited at 05:00 UTC, and you hit the same endpoint at 14:00 UTC, you might get 200 OK and wrongly conclude the source is healthy. Cross-check: if `crawl_logs.error_message` says "429" but your fetch is 200, the diagnosis is "rate-limited during crawl window" — ticket it as `rate-limit`, not "no issue."

## Testing

Before the first real Routine run, dry-run locally:

```bash
cd crawlers
python -c "
from db import get_client
c = get_client()
# Verify the columns the skill assumes actually exist:
for t in ['sources', 'crawl_logs']:
    r = c.table(t).select('*').limit(1).execute()
    print(t, list(r.data[0].keys()) if r.data else 'EMPTY')
"
```

If the column names diverge from the skill's query templates, update the skill before deploying.

**Integration test** (do once, not every run): pick a known-dead source, manually trigger the Routine, confirm: (a) ticket filed, (b) dedup works — run it a second time, confirm no duplicate ticket.

## Red flags — STOP and alert instead of triaging

- More than 20% of active sources show regressions → likely pipeline outage, not individual regressions. Post a Slack alert and stop.
- Supabase query returns empty `crawl_logs` for the last 24h → the daily crawl didn't run. Alert to Slack and stop.
- Linear API errors on the first ticket attempt → don't spam failed attempts. Stop, alert to Slack, exit.

## Scope boundaries

**In scope**: event crawlers only (sources that write to `events` via `main.py`).

**Out of scope (for now)**:
- `network_sources` staleness (handled weekly by `check_network_source_health.py`; can extend this skill later)
- Content health audit findings (separate pipeline via `content_health_audit.py`)
- Crawler code fixes (future Routine)
- Auto-deactivating dead sources (requires human review)
