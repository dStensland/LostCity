# Crawler Health Monitoring + Priority Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build automated crawler health monitoring that catches regressions within 24 hours, then fix the ~20 highest-impact broken crawlers — in that order, because fixes don't stick without monitoring.

**Architecture:** A `crawler_watchdog.py` script runs after every crawl batch (hooked into `main.py` post-crawl). It compares each source's current event output against its historical baseline, flags regressions, and writes a structured JSON report. A flagship watchlist ensures the ~30 most important Atlanta sources are always monitored with zero tolerance. Weekly digest is emailed/logged. All existing infrastructure (`crawler_health.py`, `data_quality.py`, `post_crawl_report.py`) is leveraged — this is wiring, not rewriting.

**Tech Stack:** Python, SQLite (local health DB), Supabase (production queries), existing crawler infrastructure

**Why monitoring first:** Three audits in two months (Feb 16, Apr 7, Apr 9) found the same pattern — 60%+ sources dark, flagship institutions missing. Reports get written, fixes happen, crawlers drift back to broken. Without automated regression detection, this plan will produce the same outcome.

---

## Part 1: Monitoring System (Tasks 1-5)

### Task 1: Flagship Watchlist

**Files:**
- Create: `crawlers/watchlist.py`
- Test: `crawlers/tests/test_watchlist.py`

The watchlist defines sources that must always produce events. If any drops to 0, it's a P0 alert — not a silent log line.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_watchlist.py
from watchlist import FLAGSHIP_SOURCES, get_watchlist_status, WatchlistAlert

def test_flagship_sources_exist():
    """Watchlist has entries for all major Atlanta categories."""
    slugs = {s["slug"] for s in FLAGSHIP_SOURCES}
    # Theater
    assert "alliance-theatre" in slugs
    assert "dads-garage" in slugs
    assert "7-stages" in slugs
    # Music
    assert "terminal-west" in slugs
    assert "variety-playhouse" in slugs
    assert "eddies-attic" in slugs
    # Arts
    assert "high-museum-of-art" in slugs
    assert "atlanta-contemporary" in slugs
    # Film
    assert "plaza-theatre" in slugs
    assert "starlight-drive-in" in slugs
    # Sports
    assert "truist-park" in slugs
    # Civic
    assert "hands-on-atlanta" in slugs

def test_flagship_has_required_fields():
    for source in FLAGSHIP_SOURCES:
        assert "slug" in source
        assert "name" in source
        assert "category" in source
        assert "min_events_30d" in source

def test_get_watchlist_status_flags_zero_events(monkeypatch):
    """A flagship source with 0 events in 30 days triggers an alert."""
    def mock_count(slug):
        return 0 if slug == "alliance-theatre" else 10

    monkeypatch.setattr("watchlist._count_future_events", mock_count)
    alerts = get_watchlist_status()
    alliance_alerts = [a for a in alerts if a.slug == "alliance-theatre"]
    assert len(alliance_alerts) == 1
    assert alliance_alerts[0].severity == "critical"

def test_get_watchlist_status_no_alert_when_healthy(monkeypatch):
    """A flagship source meeting its minimum triggers no alert."""
    monkeypatch.setattr("watchlist._count_future_events", lambda slug: 15)
    alerts = get_watchlist_status()
    assert len(alerts) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_watchlist.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'watchlist'`

- [ ] **Step 3: Write the watchlist module**

```python
# crawlers/watchlist.py
"""
Flagship source watchlist.

Sources on this list are monitored with zero tolerance. If any drops
to 0 future events, it's flagged as a critical alert. This is the
automated equivalent of the manual audits that kept finding the same
problems every month.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from db.client import get_client

logger = logging.getLogger(__name__)


@dataclass
class WatchlistAlert:
    slug: str
    name: str
    category: str
    severity: str  # "critical" (0 events) or "warning" (below min)
    expected_min: int
    actual_count: int
    message: str


# Sources that must always have upcoming events.
# min_events_30d is the floor — below this triggers a warning, 0 is critical.
FLAGSHIP_SOURCES = [
    # Theater
    {"slug": "alliance-theatre", "name": "Alliance Theatre", "category": "theater", "min_events_30d": 5},
    {"slug": "dads-garage", "name": "Dad's Garage", "category": "theater", "min_events_30d": 10},
    {"slug": "7-stages", "name": "7 Stages", "category": "theater", "min_events_30d": 3},
    {"slug": "theatrical-outfit", "name": "Theatrical Outfit", "category": "theater", "min_events_30d": 5},
    {"slug": "horizon-theatre", "name": "Horizon Theatre", "category": "theater", "min_events_30d": 3},
    {"slug": "center-for-puppetry-arts", "name": "Center for Puppetry Arts", "category": "theater", "min_events_30d": 5},
    # Music
    {"slug": "terminal-west", "name": "Terminal West", "category": "music", "min_events_30d": 10},
    {"slug": "variety-playhouse", "name": "Variety Playhouse", "category": "music", "min_events_30d": 10},
    {"slug": "eddies-attic", "name": "Eddie's Attic", "category": "music", "min_events_30d": 15},
    {"slug": "tabernacle", "name": "Tabernacle", "category": "music", "min_events_30d": 8},
    {"slug": "the-masquerade", "name": "The Masquerade", "category": "music", "min_events_30d": 10},
    {"slug": "the-earl", "name": "The Earl", "category": "music", "min_events_30d": 8},
    {"slug": "city-winery-atlanta", "name": "City Winery Atlanta", "category": "music", "min_events_30d": 10},
    {"slug": "aisle5", "name": "Aisle 5", "category": "music", "min_events_30d": 8},
    {"slug": "the-eastern", "name": "The Eastern", "category": "music", "min_events_30d": 5},
    {"slug": "buckhead-theatre", "name": "Buckhead Theatre", "category": "music", "min_events_30d": 5},
    {"slug": "fox-theatre", "name": "Fox Theatre", "category": "music", "min_events_30d": 3},
    {"slug": "coca-cola-roxy", "name": "Coca-Cola Roxy", "category": "music", "min_events_30d": 5},
    # Film
    {"slug": "plaza-theatre", "name": "Plaza Theatre", "category": "film", "min_events_30d": 3},
    {"slug": "tara-theatre", "name": "Tara Theatre", "category": "film", "min_events_30d": 3},
    {"slug": "starlight-drive-in", "name": "Starlight Drive-In", "category": "film", "min_events_30d": 3},
    {"slug": "landmark-midtown", "name": "Landmark Midtown Art Cinema", "category": "film", "min_events_30d": 3},
    # Arts / Museums
    {"slug": "high-museum-of-art", "name": "High Museum of Art", "category": "art", "min_events_30d": 5},
    {"slug": "atlanta-contemporary", "name": "Atlanta Contemporary", "category": "art", "min_events_30d": 3},
    {"slug": "atlanta-botanical-garden", "name": "Atlanta Botanical Garden", "category": "art", "min_events_30d": 5},
    # Family
    {"slug": "georgia-aquarium", "name": "Georgia Aquarium", "category": "family", "min_events_30d": 3},
    {"slug": "fernbank-museum", "name": "Fernbank Museum", "category": "family", "min_events_30d": 3},
    {"slug": "childrens-museum-of-atlanta", "name": "Children's Museum of Atlanta", "category": "family", "min_events_30d": 3},
    # Sports
    {"slug": "truist-park", "name": "Truist Park", "category": "sports", "min_events_30d": 5},
    {"slug": "state-farm-arena", "name": "State Farm Arena", "category": "sports", "min_events_30d": 3},
    # Civic / Volunteer
    {"slug": "hands-on-atlanta", "name": "Hands On Atlanta", "category": "volunteer", "min_events_30d": 20},
    {"slug": "atlanta-community-food-bank", "name": "Atlanta Community Food Bank", "category": "volunteer", "min_events_30d": 10},
]


def _count_future_events(slug: str) -> int:
    """Count active events in the next 30 days for a source by slug."""
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")
    end = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

    # Get source ID
    src = client.table("sources").select("id").eq("slug", slug).limit(1).execute()
    if not src.data:
        return -1  # Source doesn't exist

    source_id = src.data[0]["id"]
    result = client.table("events").select("id", count="exact").eq(
        "source_id", source_id
    ).eq("is_active", True).gte("start_date", today).lte("start_date", end).execute()

    return result.count or 0


def get_watchlist_status() -> list[WatchlistAlert]:
    """Check all flagship sources and return alerts for any below threshold."""
    alerts: list[WatchlistAlert] = []

    for source in FLAGSHIP_SOURCES:
        count = _count_future_events(source["slug"])

        if count == -1:
            alerts.append(WatchlistAlert(
                slug=source["slug"],
                name=source["name"],
                category=source["category"],
                severity="critical",
                expected_min=source["min_events_30d"],
                actual_count=0,
                message=f"Source '{source['slug']}' not found in database",
            ))
        elif count == 0:
            alerts.append(WatchlistAlert(
                slug=source["slug"],
                name=source["name"],
                category=source["category"],
                severity="critical",
                expected_min=source["min_events_30d"],
                actual_count=0,
                message=f"{source['name']} has 0 events in next 30 days",
            ))
        elif count < source["min_events_30d"]:
            alerts.append(WatchlistAlert(
                slug=source["slug"],
                name=source["name"],
                category=source["category"],
                severity="warning",
                expected_min=source["min_events_30d"],
                actual_count=count,
                message=f"{source['name']} has {count} events (min: {source['min_events_30d']})",
            ))

    return alerts
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m pytest tests/test_watchlist.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crawlers/watchlist.py crawlers/tests/test_watchlist.py
git commit -m "feat(crawlers): add flagship source watchlist with alert thresholds"
```

---

### Task 2: Regression Detector

**Files:**
- Create: `crawlers/watchdog.py`
- Test: `crawlers/tests/test_watchdog.py`

Detects sources that were producing events and stopped. Uses `crawl_logs` history to compare current run output against the source's baseline.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_watchdog.py
from watchdog import detect_regressions, SourceRegression

def test_detect_regression_when_source_drops_to_zero(monkeypatch):
    """Source that averaged 10 events/run but now returns 0 is a regression."""
    mock_history = [
        {"slug": "terminal-west", "name": "Terminal West", "recent_avg": 12.0, "last_found": 0, "consecutive_zeros": 3},
    ]
    monkeypatch.setattr("watchdog._get_source_run_history", lambda: mock_history)
    regressions = detect_regressions()
    assert len(regressions) == 1
    assert regressions[0].slug == "terminal-west"
    assert regressions[0].regression_type == "zero_output"

def test_no_regression_when_source_is_healthy(monkeypatch):
    """Source producing normal output is not flagged."""
    mock_history = [
        {"slug": "terminal-west", "name": "Terminal West", "recent_avg": 12.0, "last_found": 11, "consecutive_zeros": 0},
    ]
    monkeypatch.setattr("watchdog._get_source_run_history", lambda: mock_history)
    regressions = detect_regressions()
    assert len(regressions) == 0

def test_detect_regression_significant_drop(monkeypatch):
    """Source that drops from avg 20 to 3 is flagged as significant drop."""
    mock_history = [
        {"slug": "dads-garage", "name": "Dad's Garage", "recent_avg": 20.0, "last_found": 3, "consecutive_zeros": 0},
    ]
    monkeypatch.setattr("watchdog._get_source_run_history", lambda: mock_history)
    regressions = detect_regressions()
    assert len(regressions) == 1
    assert regressions[0].regression_type == "significant_drop"

def test_seasonal_source_not_flagged(monkeypatch):
    """Source tagged as seasonal with 0 events outside its active months is not a regression."""
    mock_history = [
        {"slug": "music-midtown", "name": "Music Midtown", "recent_avg": 0.0, "last_found": 0, "consecutive_zeros": 10,
         "health_tags": ["seasonal"], "active_months": [9]},  # September only
    ]
    monkeypatch.setattr("watchdog._get_source_run_history", lambda: mock_history)
    regressions = detect_regressions()
    assert len(regressions) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_watchdog.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'watchdog'`

- [ ] **Step 3: Write the watchdog module**

```python
# crawlers/watchdog.py
"""
Crawler regression detector.

Compares each source's recent output against its historical baseline.
Flags sources that stop producing events or show significant drops.
Respects seasonal sources (won't flag Music Midtown in April).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime

from db.client import get_client

logger = logging.getLogger(__name__)

CONSECUTIVE_ZERO_THRESHOLD = 2  # Flag after 2 consecutive runs with 0 events
DROP_RATIO_THRESHOLD = 0.25  # Flag if output drops below 25% of average


@dataclass
class SourceRegression:
    slug: str
    name: str
    regression_type: str  # "zero_output" | "significant_drop" | "never_worked"
    recent_avg: float
    last_found: int
    consecutive_zeros: int
    message: str


def _get_source_run_history() -> list[dict]:
    """Get crawl history for all active sources from crawl_logs."""
    client = get_client()

    # Get active sources
    sources = client.table("sources").select(
        "id, slug, name, health_tags, active_months"
    ).eq("is_active", True).execute()

    history = []
    for src in sources.data or []:
        # Get last 10 crawl logs for this source
        logs = (
            client.table("crawl_logs")
            .select("events_found, status, started_at")
            .eq("source_id", src["id"])
            .eq("status", "success")
            .order("started_at", desc=True)
            .limit(10)
            .execute()
        )
        runs = logs.data or []
        if not runs:
            history.append({
                "slug": src["slug"],
                "name": src["name"],
                "recent_avg": 0.0,
                "last_found": 0,
                "consecutive_zeros": 0,
                "health_tags": src.get("health_tags") or [],
                "active_months": src.get("active_months"),
            })
            continue

        found_counts = [r.get("events_found", 0) or 0 for r in runs]
        recent_avg = sum(found_counts) / len(found_counts) if found_counts else 0

        consecutive_zeros = 0
        for count in found_counts:
            if count == 0:
                consecutive_zeros += 1
            else:
                break

        history.append({
            "slug": src["slug"],
            "name": src["name"],
            "recent_avg": recent_avg,
            "last_found": found_counts[0] if found_counts else 0,
            "consecutive_zeros": consecutive_zeros,
            "health_tags": src.get("health_tags") or [],
            "active_months": src.get("active_months"),
        })

    return history


def _is_in_active_season(active_months: list[int] | None) -> bool:
    """Check if current month is in the source's active season."""
    if not active_months:
        return True  # No seasonal restriction
    return datetime.now().month in active_months


def detect_regressions() -> list[SourceRegression]:
    """Detect sources that have regressed from their normal output."""
    history = _get_source_run_history()
    regressions: list[SourceRegression] = []

    for src in history:
        tags = src.get("health_tags") or []
        active_months = src.get("active_months")

        # Skip seasonal sources outside their season
        if "seasonal" in tags and not _is_in_active_season(active_months):
            continue

        # Skip sources that have never produced events (separate problem)
        if src["recent_avg"] == 0 and src["consecutive_zeros"] > 5:
            continue

        # Zero output regression: was producing, now isn't
        if (src["consecutive_zeros"] >= CONSECUTIVE_ZERO_THRESHOLD
                and src["recent_avg"] > 2):
            regressions.append(SourceRegression(
                slug=src["slug"],
                name=src["name"],
                regression_type="zero_output",
                recent_avg=src["recent_avg"],
                last_found=src["last_found"],
                consecutive_zeros=src["consecutive_zeros"],
                message=f"{src['name']}: 0 events for {src['consecutive_zeros']} consecutive runs (avg was {src['recent_avg']:.0f})",
            ))
            continue

        # Significant drop: producing much less than baseline
        if (src["recent_avg"] > 5
                and src["last_found"] > 0
                and src["last_found"] < src["recent_avg"] * DROP_RATIO_THRESHOLD):
            regressions.append(SourceRegression(
                slug=src["slug"],
                name=src["name"],
                regression_type="significant_drop",
                recent_avg=src["recent_avg"],
                last_found=src["last_found"],
                consecutive_zeros=src["consecutive_zeros"],
                message=f"{src['name']}: {src['last_found']} events (avg: {src['recent_avg']:.0f}, {src['last_found']/src['recent_avg']*100:.0f}% of normal)",
            ))

    return regressions
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m pytest tests/test_watchdog.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crawlers/watchdog.py crawlers/tests/test_watchdog.py
git commit -m "feat(crawlers): add regression detector for crawl output drops"
```

---

### Task 3: Health Digest Report

**Files:**
- Create: `crawlers/health_digest.py`
- Test: `crawlers/tests/test_health_digest.py`

Combines watchlist alerts + regression detection + category coverage into a single structured report that runs after every crawl batch.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_health_digest.py
from health_digest import generate_health_digest, HealthDigest

def test_digest_includes_watchlist_alerts(monkeypatch):
    from watchlist import WatchlistAlert
    from watchdog import SourceRegression

    monkeypatch.setattr("health_digest.get_watchlist_status", lambda: [
        WatchlistAlert(slug="alliance-theatre", name="Alliance Theatre",
                       category="theater", severity="critical",
                       expected_min=5, actual_count=0,
                       message="Alliance Theatre has 0 events in next 30 days"),
    ])
    monkeypatch.setattr("health_digest.detect_regressions", lambda: [])
    monkeypatch.setattr("health_digest._get_category_coverage", lambda: {})

    digest = generate_health_digest()
    assert isinstance(digest, HealthDigest)
    assert digest.critical_count == 1
    assert digest.warning_count == 0
    assert len(digest.watchlist_alerts) == 1

def test_digest_calculates_overall_health_score(monkeypatch):
    monkeypatch.setattr("health_digest.get_watchlist_status", lambda: [])
    monkeypatch.setattr("health_digest.detect_regressions", lambda: [])
    monkeypatch.setattr("health_digest._get_category_coverage", lambda: {
        "music": {"events": 1600, "venues": 200},
        "theater": {"events": 400, "venues": 50},
    })

    digest = generate_health_digest()
    assert digest.overall_health == "healthy"

def test_digest_logs_to_json(monkeypatch, tmp_path):
    monkeypatch.setattr("health_digest.get_watchlist_status", lambda: [])
    monkeypatch.setattr("health_digest.detect_regressions", lambda: [])
    monkeypatch.setattr("health_digest._get_category_coverage", lambda: {})
    monkeypatch.setattr("health_digest.DIGEST_DIR", str(tmp_path))

    digest = generate_health_digest()
    digest.save()
    files = list(tmp_path.glob("*.json"))
    assert len(files) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_health_digest.py -v`
Expected: FAIL

- [ ] **Step 3: Write the health digest module**

```python
# crawlers/health_digest.py
"""
Crawler health digest.

Combines watchlist alerts, regression detection, and category coverage
into a single structured report. Runs after every crawl batch.
Saves JSON reports to crawlers/reports/health/ for historical tracking.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta

from watchlist import get_watchlist_status, WatchlistAlert
from watchdog import detect_regressions, SourceRegression
from db.client import get_client

logger = logging.getLogger(__name__)

DIGEST_DIR = os.path.join(os.path.dirname(__file__), "reports", "health")


@dataclass
class HealthDigest:
    timestamp: str
    overall_health: str  # "healthy" | "degraded" | "critical"
    critical_count: int
    warning_count: int
    watchlist_alerts: list[WatchlistAlert]
    regressions: list[SourceRegression]
    category_coverage: dict
    active_sources: int = 0
    producing_sources: int = 0

    def save(self):
        os.makedirs(DIGEST_DIR, exist_ok=True)
        filename = f"digest-{self.timestamp.replace(':', '-').replace(' ', 'T')}.json"
        path = os.path.join(DIGEST_DIR, filename)
        with open(path, "w") as f:
            json.dump(asdict(self), f, indent=2, default=str)
        logger.info(f"Health digest saved to {path}")
        return path

    def log_summary(self):
        """Log a concise summary to stdout."""
        status_icon = {"healthy": "OK", "degraded": "WARN", "critical": "CRIT"}
        logger.info(f"[HEALTH {status_icon.get(self.overall_health, '?')}] "
                     f"{self.producing_sources}/{self.active_sources} sources producing | "
                     f"{self.critical_count} critical | {self.warning_count} warnings")
        for alert in self.watchlist_alerts:
            if alert.severity == "critical":
                logger.warning(f"  FLAGSHIP DOWN: {alert.message}")
        for reg in self.regressions[:5]:
            logger.warning(f"  REGRESSION: {reg.message}")


def _get_category_coverage() -> dict:
    """Get event counts per category for the next 30 days."""
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")
    end = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

    result = client.table("events").select(
        "category_id"
    ).eq("is_active", True).gte("start_date", today).lte("start_date", end).execute()

    counts: dict[str, int] = {}
    for row in result.data or []:
        cat = row.get("category_id") or "unknown"
        counts[cat] = counts.get(cat, 0) + 1

    return {cat: {"events": count} for cat, count in sorted(counts.items(), key=lambda x: -x[1])}


def generate_health_digest() -> HealthDigest:
    """Generate a complete health digest."""
    alerts = get_watchlist_status()
    regressions = detect_regressions()
    coverage = _get_category_coverage()

    critical = sum(1 for a in alerts if a.severity == "critical")
    warning = sum(1 for a in alerts if a.severity == "warning") + len(regressions)

    if critical > 0:
        overall = "critical"
    elif warning > 3:
        overall = "degraded"
    else:
        overall = "healthy"

    # Count active vs producing sources
    client = get_client()
    active_result = client.table("sources").select("id", count="exact").eq("is_active", True).execute()
    active_count = active_result.count or 0

    return HealthDigest(
        timestamp=datetime.now().isoformat(sep=" ", timespec="seconds"),
        overall_health=overall,
        critical_count=critical,
        warning_count=warning,
        watchlist_alerts=alerts,
        regressions=regressions,
        category_coverage=coverage,
        active_sources=active_count,
        producing_sources=0,  # filled by caller if needed
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m pytest tests/test_health_digest.py -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crawlers/health_digest.py crawlers/tests/test_health_digest.py
git commit -m "feat(crawlers): add health digest combining watchlist + regression detection"
```

---

### Task 4: Wire into Post-Crawl Flow

**Files:**
- Modify: `crawlers/main.py` (post-crawl section, ~line 350+)

Hook the health digest into `main.py` so it runs automatically after every crawl batch. No separate cron job needed — it piggybacks on the existing scheduler.

- [ ] **Step 1: Find the post-crawl section in main.py**

Search for `post_crawl` or `refresh_available_filters` — the health digest should run right after post-crawl cleanup.

- [ ] **Step 2: Add the health digest call**

After the existing post-crawl steps (filter refresh, search suggestions, etc.), add:

```python
# --- Health Digest ---
try:
    from health_digest import generate_health_digest
    digest = generate_health_digest()
    digest.log_summary()
    digest.save()
except Exception as e:
    logger.warning(f"Health digest failed (non-fatal): {e}")
```

- [ ] **Step 3: Run a dry-run to verify it works**

Run: `python3 main.py --source plaza-theatre --dry-run 2>&1 | grep -i health`
Expected: Should see `[HEALTH OK]` or `[HEALTH WARN]` line in output

- [ ] **Step 4: Commit**

```bash
git add crawlers/main.py
git commit -m "feat(crawlers): wire health digest into post-crawl flow"
```

---

### Task 5: CLI Health Check Command

**Files:**
- Create: `crawlers/scripts/health_check.py`

Standalone script anyone can run to see current crawler health without waiting for a crawl batch.

- [ ] **Step 1: Write the health check script**

```python
#!/usr/bin/env python3
"""
Quick crawler health check. Run anytime to see current status.

Usage:
    python3 scripts/health_check.py              # Full report
    python3 scripts/health_check.py --watchlist   # Flagship sources only
    python3 scripts/health_check.py --regressions # Regression detection only
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import argparse
from health_digest import generate_health_digest
from watchlist import get_watchlist_status
from watchdog import detect_regressions


def main():
    parser = argparse.ArgumentParser(description="Crawler health check")
    parser.add_argument("--watchlist", action="store_true", help="Flagship sources only")
    parser.add_argument("--regressions", action="store_true", help="Regression detection only")
    args = parser.parse_args()

    if args.watchlist:
        alerts = get_watchlist_status()
        if not alerts:
            print("All flagship sources healthy.")
            return
        for a in alerts:
            icon = "CRIT" if a.severity == "critical" else "WARN"
            print(f"  [{icon}] {a.message}")
        sys.exit(1 if any(a.severity == "critical" for a in alerts) else 0)

    if args.regressions:
        regs = detect_regressions()
        if not regs:
            print("No regressions detected.")
            return
        for r in regs:
            print(f"  [{r.regression_type}] {r.message}")
        sys.exit(1)

    # Full digest
    digest = generate_health_digest()
    digest.log_summary()

    print(f"\nOverall: {digest.overall_health.upper()}")
    print(f"Active sources: {digest.active_sources}")
    print(f"Critical alerts: {digest.critical_count}")
    print(f"Warnings: {digest.warning_count}")

    if digest.watchlist_alerts:
        print(f"\nFlagship alerts:")
        for a in digest.watchlist_alerts:
            icon = "CRIT" if a.severity == "critical" else "WARN"
            print(f"  [{icon}] {a.message}")

    if digest.regressions:
        print(f"\nRegressions:")
        for r in digest.regressions[:10]:
            print(f"  [{r.regression_type}] {r.message}")

    if digest.category_coverage:
        print(f"\nCategory coverage (30d):")
        for cat, data in list(digest.category_coverage.items())[:10]:
            print(f"  {cat}: {data['events']} events")

    sys.exit(1 if digest.overall_health == "critical" else 0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test it**

Run: `cd crawlers && python3 scripts/health_check.py`
Expected: Full health report printed to stdout

Run: `python3 scripts/health_check.py --watchlist`
Expected: List of flagship source alerts (or "All flagship sources healthy")

- [ ] **Step 3: Commit**

```bash
git add crawlers/scripts/health_check.py
git commit -m "feat(crawlers): add standalone health check CLI script"
```

---

## Part 2: Priority Crawler Fixes (Tasks 6-11)

With monitoring in place, now fix the highest-impact broken crawlers. Each fix will be validated by the health check catching the improvement.

### Task 6: Fix Nashville Data Contamination

**Files:**
- Create migration pair via `python3 database/create_migration_pair.py fix_nashville_source_portal_scope`

The `ticketmaster-nashville` source is leaking 111 Nashville events into the Atlanta portal. This is a portal data isolation failure.

- [ ] **Step 1: Investigate the source's owner_portal_id**

```bash
cd crawlers && python3 -c "
from db.client import get_client
c = get_client()
r = c.table('sources').select('id, slug, owner_portal_id').eq('slug', 'ticketmaster-nashville').execute()
print(r.data)
"
```

Check if `owner_portal_id` is set to Atlanta's portal or NULL.

- [ ] **Step 2: Write the migration**

If `owner_portal_id` is wrong (set to Atlanta), fix it to the Nashville portal. If no Nashville portal exists, deactivate the source for Atlanta and flag it.

```sql
-- Fix ticketmaster-nashville portal attribution
-- Events from this source should not appear in Atlanta portal queries
UPDATE sources SET is_active = false
WHERE slug = 'ticketmaster-nashville';
```

- [ ] **Step 3: Apply migration and verify**

```bash
npx supabase migration up --linked
```

Then verify:
```bash
python3 scripts/health_check.py --watchlist
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/*.sql supabase/migrations/*.sql
git commit -m "fix(data): deactivate ticketmaster-nashville leaking into Atlanta portal"
```

---

### Task 7: Fix Alliance Theatre Crawler

**Files:**
- Modify: `crawlers/sources/alliance_theatre.py`
- Test: `crawlers/tests/test_alliance_theatre.py` (if exists)

Alliance Theatre is the #1 Atlanta theater institution. Source is active, crawler runs, but all events are May+ with no current season content.

- [ ] **Step 1: Diagnose the crawler**

```bash
cd crawlers && python3 main.py --source alliance-theatre --dry-run 2>&1 | head -30
```

Check: what URL is being crawled? What events_found count? Is it hitting a future-season page?

- [ ] **Step 2: Visit the website and identify the correct calendar URL**

Use Playwright to check what page has the current season:
```bash
python3 -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://alliancetheatre.org/production', wait_until='domcontentloaded', timeout=20000)
    page.wait_for_timeout(3000)
    print(page.title())
    # Look for current shows
    for el in page.query_selector_all('h2, h3, .show-title, .production-title'):
        print(el.inner_text().strip()[:80])
    browser.close()
"
```

- [ ] **Step 3: Fix the crawler based on diagnosis**

Common fixes:
- Update the target URL if the site restructured
- Fix date parsing if events are being assigned wrong dates
- Add past-date validation (like we did for 7 Stages)

- [ ] **Step 4: Dry-run and verify**

```bash
python3 main.py --source alliance-theatre --dry-run 2>&1 | grep -E "Added|found|complete"
```

Expected: Should find current-season shows with correct dates.

- [ ] **Step 5: Production run**

```bash
python3 main.py --source alliance-theatre --allow-production-writes
```

- [ ] **Step 6: Verify via health check**

```bash
python3 scripts/health_check.py --watchlist | grep -i alliance
```

Expected: Alliance Theatre no longer flagged as critical.

- [ ] **Step 7: Commit**

```bash
git add crawlers/sources/alliance_theatre.py
git commit -m "fix(crawler): fix Alliance Theatre to crawl current season"
```

---

### Task 8: Fix Arts Institution Crawlers (Batch)

**Files:** Multiple crawlers in `crawlers/sources/`

Batch fix for flagship arts institutions returning 0 events. Same diagnosis pattern for each: dry-run, check URL, fix parser, verify.

Sources to fix (in priority order):
1. `atlanta-contemporary` — top-tier contemporary arts
2. `high-museum-of-art` — Level 1 Atlanta institution (also needs place record check)
3. `fernbank-museum` — major family destination
4. `georgia-aquarium` — major family destination
5. `childrens-museum-of-atlanta` — Family portal critical

- [ ] **Step 1: Diagnose each crawler**

For each source, run:
```bash
python3 main.py --source <slug> --dry-run 2>&1 | tail -5
```

Record: events_found count, any error messages, URL being hit.

- [ ] **Step 2: Fix each crawler**

Each will have its own specific issue (URL changed, selectors broken, date parsing, etc.). Apply the same pattern:
1. Check the website manually
2. Update URL/selectors
3. Add past-date validation
4. Dry-run to verify

- [ ] **Step 3: Production run each fixed crawler**

```bash
for slug in atlanta-contemporary high-museum-of-art fernbank-museum georgia-aquarium childrens-museum-of-atlanta; do
    python3 main.py --source $slug --allow-production-writes
done
```

- [ ] **Step 4: Verify via health check**

```bash
python3 scripts/health_check.py --watchlist
```

Expected: Each fixed source no longer critical.

- [ ] **Step 5: Commit each fix individually**

One commit per crawler fix for clean git history.

---

### Task 9: Fix Brewery Crawlers (Batch)

**Files:** Multiple crawlers in `crawlers/sources/`

5 brewery crawlers all returning 0 despite being active and crawled daily. Likely a shared pattern failure (site platform changed).

Sources: `scofflaw-brewing`, `bold-monk-brewing`, `three-taverns`, `pontoon-brewing`, `reformation-brewery`

- [ ] **Step 1: Diagnose pattern**

```bash
for slug in scofflaw-brewing bold-monk-brewing three-taverns pontoon-brewing reformation-brewery; do
    echo "=== $slug ==="
    python3 main.py --source $slug --dry-run 2>&1 | tail -3
done
```

Check if they share a platform (Squarespace, WordPress, etc.) that might have changed globally.

- [ ] **Step 2: Fix each based on diagnosis**

If shared platform: fix the pattern once and apply to all.
If individual: fix each separately.

- [ ] **Step 3: Verify and commit**

Same pattern as Task 8.

---

### Task 10: Fix Dad's Garage Image Extraction

**Files:**
- Modify: `crawlers/sources/dads_garage.py`

34 events, 0 images. The website has show posters for every production.

- [ ] **Step 1: Check what the crawler currently extracts**

```bash
python3 main.py --source dads-garage --dry-run 2>&1 | grep -i "image\|Added"
```

- [ ] **Step 2: Visit a show page and find the image selector**

```bash
python3 -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://dadsgarage.com/shows', wait_until='domcontentloaded', timeout=20000)
    page.wait_for_timeout(3000)
    # Check for og:image on show pages
    for link in page.query_selector_all('a[href*=\"/shows/\"]')[:3]:
        href = link.get_attribute('href')
        if href:
            print(f'Show link: {href}')
    browser.close()
"
```

- [ ] **Step 3: Add image extraction to the crawler**

Add `og:image` extraction from show detail pages, or extract from the listing page if images are visible there.

- [ ] **Step 4: Dry-run and verify images are captured**

```bash
python3 main.py --source dads-garage --dry-run 2>&1 | grep -i "image"
```

- [ ] **Step 5: Production run and commit**

---

### Task 11: Reactivate True Colors Theatre

**Files:**
- Modify: `crawlers/sources/true_colors_theatre.py` (if exists)
- Create migration pair to reactivate source

- [ ] **Step 1: Check if crawler file exists and website is live**

```bash
ls crawlers/sources/true_colors*
curl -sI https://truecolorstheatre.org | head -5
```

- [ ] **Step 2: Dry-run the crawler**

```bash
python3 main.py --source true-colors-theatre --dry-run
```

If it produces events, reactivate. If not, diagnose and fix.

- [ ] **Step 3: Write reactivation migration**

```sql
UPDATE sources SET is_active = true WHERE slug = 'true-colors-theatre';
```

- [ ] **Step 4: Apply, production run, verify**

Same pattern as above.

---

## Verification

After all tasks are complete:

- [ ] **Run full health check**

```bash
cd crawlers && python3 scripts/health_check.py
```

Expected: `[HEALTH OK]` or `[HEALTH WARN]` (not CRIT). All flagship sources should be producing events. No regressions detected for fixed sources.

- [ ] **Run crawler tests**

```bash
python3 -m pytest tests/ -x -q
```

Expected: All tests pass.

- [ ] **Verify monitoring is wired in**

```bash
python3 main.py --source plaza-theatre --dry-run 2>&1 | grep -i "health"
```

Expected: Health digest summary appears in post-crawl output.
