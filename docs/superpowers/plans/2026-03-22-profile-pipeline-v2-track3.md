# Profile Pipeline v2 (Track 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing profile-driven pipeline to support v2 profiles with LLM extraction as the default parser, multi-entity lane routing, extraction caching, and per-domain concurrency limits — making it the primary execution path for all sources.

**Architecture:** The v1 pipeline (`pipeline_main.py` + `pipeline/`) already handles discovery → detail enrichment for profile-driven sources. Track 3 adds: v2 profile schema support via a normalizing loader, entity lane routing (events + programs + exhibitions + specials + venue metadata), extraction caching keyed on HTML content hash, and per-domain rate limiting. The enrichment queue from Track 1 is already wired in.

**Tech Stack:** Python, Pydantic, httpx, BeautifulSoup, LLM extraction (`extract.py`), Supabase

**Spec:** `docs/superpowers/specs/2026-03-21-crawler-pipeline-architecture-design.md`

**Depends on:** Track 1 (enrichment queue, extraction_cache table) — already shipped in PR #7.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `crawlers/pipeline/models.py` | Modify | Add v2 SourceProfile fields (city, entity_lanes, fetch.method, parse.method, venue block, schedule) |
| `crawlers/pipeline/loader.py` | Modify | Version-aware loading: normalize v1 profiles to v2 shape at load time |
| `crawlers/pipeline/entity_router.py` | Create | Route extracted data to declared entity lanes (events, programs, exhibitions, specials, destination_details) |
| `crawlers/pipeline/extraction_cache.py` | Create | Check/store extraction results keyed on (source_slug, content_hash) |
| `crawlers/pipeline/domain_limiter.py` | Create | Per-domain concurrency semaphore to prevent rate limiting by target sites |
| `crawlers/pipeline/llm_multi_entity.py` | Create | Multi-entity LLM extraction: focused per-lane calls (events+programs, venue metadata, specials) |
| `crawlers/pipeline_main.py` | Modify | Wire entity router, extraction cache, and domain limiter into run_profile() |
| `crawlers/tests/test_profile_v2_loader.py` | Create | Tests for v1→v2 normalization |
| `crawlers/tests/test_entity_router.py` | Create | Tests for lane routing |
| `crawlers/tests/test_extraction_cache.py` | Create | Tests for cache hit/miss |
| `crawlers/tests/test_domain_limiter.py` | Create | Tests for per-domain concurrency |

---

## Task 1: v2 Profile Schema

**Files:**
- Modify: `crawlers/pipeline/models.py`
- Create: `crawlers/tests/test_profile_v2_loader.py`

- [ ] **Step 1: Write failing test for v2 profile parsing**

```python
# crawlers/tests/test_profile_v2_loader.py
"""Tests for v2 profile schema and v1→v2 normalization."""
from pipeline.models import SourceProfileV2, VenueConfig, ScheduleConfig


def test_v2_profile_parses_full_schema():
    """A v2 profile with all fields should parse cleanly."""
    data = {
        "version": 2,
        "slug": "terminal-west",
        "name": "Terminal West",
        "city": "atlanta",
        "fetch": {"method": "static", "urls": ["https://terminalwestatl.com/events"]},
        "parse": {"method": "llm"},
        "entity_lanes": ["events", "destination_details"],
        "venue": {"name": "Terminal West", "address": "887 W Marietta St NW", "venue_type": "music_venue"},
        "defaults": {"category": "music", "tags": ["music", "live-music"]},
        "schedule": {"frequency": "daily", "priority": "high"},
    }
    profile = SourceProfileV2(**data)
    assert profile.city == "atlanta"
    assert profile.fetch.method == "static"
    assert profile.parse.method == "llm"
    assert "events" in profile.entity_lanes
    assert profile.venue.name == "Terminal West"
    assert profile.schedule.frequency == "daily"


def test_v2_profile_defaults():
    """Minimal v2 profile should have sensible defaults."""
    data = {"version": 2, "slug": "test", "name": "Test"}
    profile = SourceProfileV2(**data)
    assert profile.city == "atlanta"  # default
    assert profile.fetch.method == "static"  # default
    assert profile.parse.method == "llm"  # default
    assert profile.entity_lanes == ["events"]  # default
    assert profile.schedule.frequency == "daily"
    assert profile.schedule.priority == "normal"
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd crawlers && python3 -m pytest tests/test_profile_v2_loader.py -v
```

- [ ] **Step 3: Add v2 models to pipeline/models.py**

Add new Pydantic models alongside existing v1 models (don't modify v1):

```python
# --- v2 Profile Schema ---

class FetchConfigV2(BaseModel):
    method: Literal["static", "playwright", "api"] = "static"
    urls: list[str] = Field(default_factory=list)
    wait_for: Optional[str] = None
    scroll: bool = False

class ParseConfigV2(BaseModel):
    method: Literal["llm", "jsonld", "api_adapter", "custom"] = "llm"
    module: Optional[str] = None
    adapter: Optional[str] = None

class VenueConfig(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    venue_type: Optional[str] = None
    website: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class ScheduleConfig(BaseModel):
    frequency: Literal["daily", "weekly", "biweekly", "monthly"] = "daily"
    priority: Literal["high", "normal", "low"] = "normal"

class DefaultsConfigV2(BaseModel):
    category: Optional[str] = None
    tags: list[str] = Field(default_factory=list)

class SourceProfileV2(BaseModel):
    version: int = 2
    slug: str
    name: str
    city: str = "atlanta"
    portal_id: Optional[str] = None
    fetch: FetchConfigV2 = Field(default_factory=FetchConfigV2)
    parse: ParseConfigV2 = Field(default_factory=ParseConfigV2)
    entity_lanes: list[str] = Field(default_factory=lambda: ["events"])
    venue: VenueConfig = Field(default_factory=VenueConfig)
    defaults: DefaultsConfigV2 = Field(default_factory=DefaultsConfigV2)
    schedule: ScheduleConfig = Field(default_factory=ScheduleConfig)
    detail: DetailConfig = Field(default_factory=DetailConfig)
```

- [ ] **Step 4: Run tests, verify passing**

- [ ] **Step 5: Commit**

```bash
git add crawlers/pipeline/models.py crawlers/tests/test_profile_v2_loader.py
git commit -m "feat: add v2 profile schema with city, entity_lanes, fetch/parse method, venue, schedule"
```

---

## Task 2: v1→v2 Normalizing Loader

**Files:**
- Modify: `crawlers/pipeline/loader.py`
- Modify: `crawlers/tests/test_profile_v2_loader.py`

- [ ] **Step 1: Write failing tests for v1→v2 normalization**

```python
def test_v1_profile_normalized_to_v2():
    """A v1 profile should be loadable as a v2 SourceProfileV2."""
    from pipeline.loader import normalize_to_v2
    v1_data = {
        "version": 1,
        "slug": "terminal-west",
        "name": "Terminal West",
        "integration_method": "html",
        "data_goals": ["events", "images"],
        "discovery": {"enabled": True, "type": "list", "urls": ["https://example.com/events"]},
        "detail": {"enabled": True},
        "defaults": {"category": "music", "tags": ["live-music"]},
    }
    v2 = normalize_to_v2(v1_data)
    assert v2.version == 2
    assert v2.fetch.method == "static"  # html → static
    assert v2.parse.method == "llm"  # default for html integration
    assert v2.fetch.urls == ["https://example.com/events"]
    assert "events" in v2.entity_lanes


def test_v1_api_profile_normalized():
    """A v1 api profile should normalize fetch.method to api."""
    from pipeline.loader import normalize_to_v2
    v1_data = {
        "version": 1, "slug": "test", "name": "Test",
        "integration_method": "api",
        "discovery": {"type": "api", "api": {"adapter": "aeg", "params": {"venue_id": "211"}}},
    }
    v2 = normalize_to_v2(v1_data)
    assert v2.fetch.method == "api"
    assert v2.parse.method == "api_adapter"
    assert v2.parse.adapter == "aeg"


def test_v1_playwright_profile_normalized():
    """A v1 profile with render_js=True should normalize to playwright."""
    from pipeline.loader import normalize_to_v2
    v1_data = {
        "version": 1, "slug": "test", "name": "Test",
        "integration_method": "html",
        "discovery": {"fetch": {"render_js": True}, "urls": ["https://example.com"]},
    }
    v2 = normalize_to_v2(v1_data)
    assert v2.fetch.method == "playwright"


def test_v2_profile_passes_through():
    """A v2 profile should not be re-normalized."""
    from pipeline.loader import normalize_to_v2
    v2_data = {
        "version": 2, "slug": "test", "name": "Test",
        "city": "nashville", "fetch": {"method": "static"},
    }
    v2 = normalize_to_v2(v2_data)
    assert v2.city == "nashville"
```

- [ ] **Step 2: Run tests to verify failure**

- [ ] **Step 3: Implement normalize_to_v2() in loader.py**

```python
from pipeline.models import SourceProfileV2, FetchConfigV2, ParseConfigV2, DefaultsConfigV2

_INTEGRATION_METHOD_MAP = {
    "html": ("static", "llm"),
    "api": ("api", "api_adapter"),
    "llm_crawler": ("static", "llm"),
    "playwright": ("playwright", "llm"),
    "ical": ("static", "jsonld"),
    "rss": ("static", "jsonld"),
}

def normalize_to_v2(data: dict) -> SourceProfileV2:
    """Normalize a v1 or v2 profile dict into a SourceProfileV2 instance."""
    version = data.get("version", 1)
    if version >= 2:
        return SourceProfileV2(**data)

    # v1 → v2 normalization
    integration = data.get("integration_method", "html")
    fetch_method, parse_method = _INTEGRATION_METHOD_MAP.get(integration, ("static", "llm"))

    discovery = data.get("discovery", {})
    fetch_config = discovery.get("fetch", {})
    if fetch_config.get("render_js"):
        fetch_method = "playwright"

    urls = discovery.get("urls", [])
    api_config = discovery.get("api", {})

    v2_data = {
        "version": 2,
        "slug": data["slug"],
        "name": data["name"],
        "city": data.get("city", "atlanta"),
        "fetch": {"method": fetch_method, "urls": urls},
        "parse": {
            "method": parse_method,
            "adapter": api_config.get("adapter"),
            "module": data.get("module"),
        },
        "entity_lanes": _map_data_goals(data.get("data_goals", ["events"])),
        "defaults": data.get("defaults", {}),
        "detail": data.get("detail", {}),
    }
    return SourceProfileV2(**v2_data)


def _map_data_goals(goals: list) -> list:
    """Map v1 data_goals to v2 entity_lanes."""
    lane_map = {
        "events": "events",
        "exhibits": "exhibitions",
        "specials": "venue_specials",
        "classes": "programs",
        "images": "destination_details",
        "venue_hours": "destination_details",
    }
    lanes = set()
    for g in goals:
        mapped = lane_map.get(g)
        if mapped:
            lanes.add(mapped)
    return list(lanes) or ["events"]
```

Update `load_profile()` to use `normalize_to_v2`:

```python
def load_profile(slug: str, base_dir=None) -> SourceProfileV2:
    path = find_profile_path(slug, base_dir=base_dir)
    if not path:
        raise FileNotFoundError(...)
    data = _load_data(path)
    return normalize_to_v2(data)
```

- [ ] **Step 4: Run tests, verify passing**

- [ ] **Step 5: Commit**

```bash
git add crawlers/pipeline/loader.py crawlers/pipeline/models.py crawlers/tests/test_profile_v2_loader.py
git commit -m "feat: v1→v2 profile normalization in loader — single internal schema"
```

---

## Task 3: Extraction Cache Module

**Files:**
- Create: `crawlers/pipeline/extraction_cache.py`
- Create: `crawlers/tests/test_extraction_cache.py`

- [ ] **Step 1: Write failing tests**

```python
# crawlers/tests/test_extraction_cache.py
"""Tests for LLM extraction caching."""
import hashlib
from unittest.mock import MagicMock, patch
from pipeline.extraction_cache import get_cached_extraction, store_extraction, compute_content_hash


def test_compute_content_hash_is_deterministic():
    assert compute_content_hash("<html>test</html>") == compute_content_hash("<html>test</html>")


def test_compute_content_hash_differs_for_different_content():
    assert compute_content_hash("<html>a</html>") != compute_content_hash("<html>b</html>")


def test_get_cached_extraction_returns_none_on_miss():
    client = MagicMock()
    client.table.return_value.select.return_value.eq.return_value.eq.return_value.maybeSingle.return_value.execute.return_value.data = None
    result = get_cached_extraction(client, "test-source", "abc123")
    assert result is None


def test_get_cached_extraction_returns_data_on_hit():
    client = MagicMock()
    cached = [{"title": "Test Event", "start_date": "2026-04-01"}]
    client.table.return_value.select.return_value.eq.return_value.eq.return_value.maybeSingle.return_value.execute.return_value.data = {"extraction_result": cached}
    result = get_cached_extraction(client, "test-source", "abc123")
    assert result == cached


def test_store_extraction_upserts():
    client = MagicMock()
    with patch("pipeline.extraction_cache.writes_enabled", return_value=True):
        store_extraction(client, "test-source", "abc123", [{"title": "Test"}])
    client.table.return_value.upsert.assert_called_once()
```

- [ ] **Step 2: Run tests to verify failure**

- [ ] **Step 3: Implement extraction_cache.py**

```python
# crawlers/pipeline/extraction_cache.py
"""Cache LLM extraction results keyed on (source_slug, content_hash).
Skips LLM calls when HTML hasn't changed. Expected 50-80% hit rate."""

import hashlib
import json
import logging
from typing import Optional
from db.client import writes_enabled

logger = logging.getLogger(__name__)


def compute_content_hash(html: str) -> str:
    return hashlib.md5(html.encode("utf-8")).hexdigest()


def get_cached_extraction(client, source_slug: str, content_hash: str) -> Optional[list]:
    try:
        result = (
            client.table("extraction_cache")
            .select("extraction_result")
            .eq("source_slug", source_slug)
            .eq("content_hash", content_hash)
            .maybeSingle()
            .execute()
        )
        if result.data:
            return result.data["extraction_result"]
    except Exception as e:
        logger.debug("Cache miss for %s: %s", source_slug, e)
    return None


def store_extraction(client, source_slug: str, content_hash: str, extraction_result: list) -> None:
    if not writes_enabled():
        return
    try:
        client.table("extraction_cache").upsert({
            "source_slug": source_slug,
            "content_hash": content_hash,
            "extraction_result": extraction_result,
        }).execute()
    except Exception as e:
        logger.warning("Failed to cache extraction for %s: %s", source_slug, e)
```

- [ ] **Step 4: Run tests, verify passing**

- [ ] **Step 5: Commit**

```bash
git add crawlers/pipeline/extraction_cache.py crawlers/tests/test_extraction_cache.py
git commit -m "feat: extraction cache — skip LLM calls when HTML unchanged"
```

---

## Task 4: Entity Lane Router

**Files:**
- Create: `crawlers/pipeline/entity_router.py`
- Create: `crawlers/tests/test_entity_router.py`

- [ ] **Step 1: Write failing tests**

```python
# crawlers/tests/test_entity_router.py
"""Tests for entity lane routing."""
from pipeline.entity_router import route_extracted_data


def test_routes_events_to_events_lane():
    extracted = [
        {"content_kind": "event", "title": "Jazz Night", "start_date": "2026-04-01"},
        {"content_kind": "event", "title": "Open Mic", "start_date": "2026-04-02"},
    ]
    routed = route_extracted_data(extracted, declared_lanes=["events"])
    assert len(routed["events"]) == 2
    assert "programs" not in routed


def test_routes_programs_when_declared():
    extracted = [
        {"content_kind": "program", "title": "Swim Lessons", "start_date": "2026-04-01"},
        {"content_kind": "event", "title": "Pool Party", "start_date": "2026-04-01"},
    ]
    routed = route_extracted_data(extracted, declared_lanes=["events", "programs"])
    assert len(routed["events"]) == 1
    assert len(routed["programs"]) == 1


def test_ignores_undeclared_lanes():
    extracted = [
        {"content_kind": "exhibition", "title": "Art Show"},
    ]
    routed = route_extracted_data(extracted, declared_lanes=["events"])
    assert "exhibitions" not in routed
    assert routed.get("events", []) == []


def test_defaults_to_event_when_content_kind_missing():
    extracted = [{"title": "Mystery Event", "start_date": "2026-04-01"}]
    routed = route_extracted_data(extracted, declared_lanes=["events"])
    assert len(routed["events"]) == 1
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Implement entity_router.py**

```python
# crawlers/pipeline/entity_router.py
"""Route extracted data to declared entity lanes."""

import logging
from entity_lanes import ENTITY_LANE_NAMES

logger = logging.getLogger(__name__)

_CONTENT_KIND_TO_LANE = {
    "event": "events",
    "exhibition": "exhibitions",
    "exhibit": "exhibitions",
    "program": "programs",
    "special": "venue_specials",
    "volunteer": "volunteer_opportunities",
    "open_call": "open_calls",
}


def route_extracted_data(extracted: list[dict], declared_lanes: list[str]) -> dict[str, list[dict]]:
    """Route extracted records to their entity lanes based on content_kind.
    Only routes to lanes that are declared in the profile."""
    routed: dict[str, list[dict]] = {}
    for record in extracted:
        content_kind = record.get("content_kind", "event")
        lane = _CONTENT_KIND_TO_LANE.get(content_kind, "events")
        if lane in declared_lanes:
            routed.setdefault(lane, []).append(record)
        else:
            logger.debug("Skipping %s — lane %s not declared", record.get("title", "?"), lane)
    return routed
```

- [ ] **Step 4: Run tests, verify passing**

- [ ] **Step 5: Commit**

```bash
git add crawlers/pipeline/entity_router.py crawlers/tests/test_entity_router.py
git commit -m "feat: entity lane router — routes extracted data to declared lanes"
```

---

## Task 5: Per-Domain Concurrency Limiter

**Files:**
- Create: `crawlers/pipeline/domain_limiter.py`
- Create: `crawlers/tests/test_domain_limiter.py`

- [ ] **Step 1: Write failing tests**

```python
# crawlers/tests/test_domain_limiter.py
"""Tests for per-domain concurrency limiter."""
import threading
from pipeline.domain_limiter import DomainLimiter


def test_acquire_release_basic():
    limiter = DomainLimiter(max_per_domain=2)
    limiter.acquire("example.com")
    limiter.acquire("example.com")
    # Should not block — 2 slots available
    limiter.release("example.com")
    limiter.release("example.com")


def test_different_domains_independent():
    limiter = DomainLimiter(max_per_domain=1)
    limiter.acquire("a.com")
    limiter.acquire("b.com")
    # Both should succeed — different domains
    limiter.release("a.com")
    limiter.release("b.com")


def test_extract_domain_from_url():
    from pipeline.domain_limiter import extract_domain
    assert extract_domain("https://www.example.com/events") == "example.com"
    assert extract_domain("https://api.ticketmaster.com/v2/events") == "api.ticketmaster.com"
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Implement domain_limiter.py**

```python
# crawlers/pipeline/domain_limiter.py
"""Per-domain concurrency limiter to prevent rate limiting by target sites."""

import threading
from urllib.parse import urlparse


class DomainLimiter:
    def __init__(self, max_per_domain: int = 2):
        self._max = max_per_domain
        self._semaphores: dict[str, threading.Semaphore] = {}
        self._lock = threading.Lock()

    def _get_semaphore(self, domain: str) -> threading.Semaphore:
        with self._lock:
            if domain not in self._semaphores:
                self._semaphores[domain] = threading.Semaphore(self._max)
            return self._semaphores[domain]

    def acquire(self, domain: str) -> None:
        self._get_semaphore(domain).acquire()

    def release(self, domain: str) -> None:
        self._get_semaphore(domain).release()


def extract_domain(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if host.startswith("www."):
        host = host[4:]
    return host
```

- [ ] **Step 4: Run tests, verify passing**

- [ ] **Step 5: Commit**

```bash
git add crawlers/pipeline/domain_limiter.py crawlers/tests/test_domain_limiter.py
git commit -m "feat: per-domain concurrency limiter for crawl worker pool"
```

---

## Task 6: Wire v2 Pipeline into pipeline_main.py

**Files:**
- Modify: `crawlers/pipeline_main.py`

- [ ] **Step 1: Update run_profile() to use v2 features**

The key changes to `pipeline_main.py`:

1. `load_profile()` now returns `SourceProfileV2` (via the normalizing loader from Task 2)
2. Before LLM extraction, check the extraction cache
3. After extraction, route through entity router
4. Use domain limiter when fetching
5. For each entity lane, call the appropriate insert function (insert_event, insert_program, etc.)

Read the existing `run_profile()` function carefully. The changes are:

**In the fetch phase:** Wrap fetch calls with domain limiter acquire/release:
```python
from pipeline.domain_limiter import DomainLimiter, extract_domain
domain_limiter = DomainLimiter(max_per_domain=2)

domain = extract_domain(url)
domain_limiter.acquire(domain)
try:
    html, error = fetch_html(url, profile.discovery.fetch)
finally:
    domain_limiter.release(domain)
```

**In the extraction phase:** Check cache before calling LLM:
```python
from pipeline.extraction_cache import compute_content_hash, get_cached_extraction, store_extraction
from db.client import get_client

content_hash = compute_content_hash(html)
client = get_client()
cached = get_cached_extraction(client, profile.slug, content_hash)
if cached:
    events = cached
else:
    events = discover_from_llm(html, url, profile.name)
    store_extraction(client, profile.slug, content_hash, events)
```

**In the insert phase:** Route through entity router:
```python
from pipeline.entity_router import route_extracted_data

routed = route_extracted_data(events, profile.entity_lanes)
for event_data in routed.get("events", []):
    # existing insert_event logic
    ...
for program_data in routed.get("programs", []):
    from db.programs import insert_program
    insert_program(program_data, source_id=source["id"])
    result.events_found += 1
```

- [ ] **Step 2: Test with a dry run**

```bash
cd crawlers && python3 pipeline_main.py --source terminal-west --limit 5
```

- [ ] **Step 3: Commit**

```bash
git add crawlers/pipeline_main.py
git commit -m "feat: wire v2 pipeline — extraction cache, entity routing, domain limiting"
```

---

## Task 7: Multi-Entity LLM Extraction

**Files:**
- Create: `crawlers/pipeline/llm_multi_entity.py`
- Create: `crawlers/tests/test_llm_multi_entity.py`

- [ ] **Step 1: Write failing tests**

```python
# crawlers/tests/test_llm_multi_entity.py
"""Tests for multi-entity LLM extraction."""
from unittest.mock import patch, MagicMock
from pipeline.llm_multi_entity import extract_entities_for_lanes


def test_only_calls_event_extraction_for_events_lane():
    with patch("pipeline.llm_multi_entity.extract_events") as mock:
        mock.return_value = [{"title": "Test", "content_kind": "event"}]
        result = extract_entities_for_lanes("<html>test</html>", "http://test.com", "Test", ["events"])
    assert len(result) == 1
    mock.assert_called_once()


def test_extracts_venue_metadata_when_destination_details_declared():
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_venue_metadata") as mock_venue:
        mock_events.return_value = [{"title": "Test"}]
        mock_venue.return_value = {"hours": "9am-5pm", "description": "A great place"}
        result = extract_entities_for_lanes(
            "<html>test</html>", "http://test.com", "Test",
            ["events", "destination_details"]
        )
    mock_events.assert_called_once()
    mock_venue.assert_called_once()


def test_skips_venue_extraction_when_not_declared():
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_venue_metadata") as mock_venue:
        mock_events.return_value = []
        extract_entities_for_lanes("<html></html>", "http://test.com", "Test", ["events"])
    mock_venue.assert_not_called()
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Implement llm_multi_entity.py**

```python
# crawlers/pipeline/llm_multi_entity.py
"""Multi-entity LLM extraction: focused per-lane calls.

Strategy: separate focused calls per entity type rather than one mega-prompt.
- Primary call: extract events/programs/exhibitions (shared structure)
- Venue call: extract venue metadata (hours, description, vibes) — only if destination_details declared
- Specials call: extract specials/deals — only if venue_specials declared
"""

import logging
from typing import Optional
from extract import extract_events
from llm_client import generate_text

logger = logging.getLogger(__name__)

VENUE_METADATA_LANES = {"destination_details", "venue_features", "venue_occasions"}
SPECIALS_LANES = {"venue_specials"}


def extract_entities_for_lanes(
    html: str,
    url: str,
    source_name: str,
    declared_lanes: list[str],
) -> list[dict]:
    """Extract entities using focused LLM calls based on declared lanes."""
    results = []

    # Primary extraction: events, programs, exhibitions
    events = extract_events(html, url, source_name)
    for e in events:
        try:
            results.append(e.model_dump())
        except Exception:
            results.append(dict(e))

    # Venue metadata extraction (separate focused call)
    if VENUE_METADATA_LANES.intersection(declared_lanes):
        venue_meta = extract_venue_metadata(html, url, source_name)
        if venue_meta:
            results.append({"content_kind": "venue_metadata", **venue_meta})

    # Specials extraction (separate focused call)
    if SPECIALS_LANES.intersection(declared_lanes):
        specials = extract_specials(html, url, source_name)
        for s in specials:
            results.append({"content_kind": "special", **s})

    return results


def extract_venue_metadata(html: str, url: str, source_name: str) -> Optional[dict]:
    """Extract venue metadata (hours, description, image) from HTML."""
    prompt = f"""Extract venue metadata from this page. Return JSON with:
- hours: operating hours if visible (e.g. "Mon-Fri 11am-10pm, Sat-Sun 10am-11pm")
- description: venue description if present (1-2 sentences)
- image_url: hero/og:image URL if present
- vibes: list of vibe tags if inferrable (e.g. ["casual", "live-music", "craft-cocktails"])

Only include fields that are explicitly present on the page. Return {{}}} if nothing found.

URL: {url}
Source: {source_name}

HTML (truncated):
{html[:4000]}"""
    try:
        result = generate_text(prompt, max_tokens=500)
        import json
        return json.loads(result)
    except Exception as e:
        logger.debug("Venue metadata extraction failed for %s: %s", source_name, e)
        return None


def extract_specials(html: str, url: str, source_name: str) -> list[dict]:
    """Extract specials/deals from HTML."""
    prompt = f"""Extract venue specials/deals from this page. Return a JSON array of specials:
- name: special name (e.g. "Happy Hour", "Taco Tuesday")
- days: days active (e.g. ["monday", "tuesday"])
- time_start: start time if known (e.g. "16:00")
- time_end: end time if known (e.g. "19:00")
- description: brief description

Only extract if the page has a specials/deals/happy hour section. Return [] if none found.

URL: {url}
Source: {source_name}

HTML (truncated):
{html[:4000]}"""
    try:
        result = generate_text(prompt, max_tokens=1000)
        import json
        return json.loads(result)
    except Exception:
        return []
```

- [ ] **Step 4: Run tests, verify passing**

- [ ] **Step 5: Commit**

```bash
git add crawlers/pipeline/llm_multi_entity.py crawlers/tests/test_llm_multi_entity.py
git commit -m "feat: multi-entity LLM extraction — focused per-lane calls"
```

---

## Task 8: Wire main.py to Prefer Profile Pipeline

**Files:**
- Modify: `crawlers/main.py`

- [ ] **Step 1: Update source execution to try profile pipeline first**

In `main.py`, the `_run_source()` function currently imports the Python module and calls its `crawl()` function. Add a check: if the source has a v2 profile OR `parse.method != custom`, use `pipeline_main.run_profile()` instead.

Read the current `_run_source()` function (around line 200-270) and the `_run_profile_fallback()` function (around line 275). The change is:

```python
def _run_source(source: dict) -> Optional[tuple[int, int, int]]:
    slug = source["slug"]

    # Try profile-first: if a v2 profile exists, use the pipeline
    from pipeline.loader import find_profile_path, load_profile
    profile_path = find_profile_path(slug)
    if profile_path:
        profile = load_profile(slug)
        if profile.version >= 2 or profile.parse.method != "custom":
            return _run_profile_pipeline(source, profile)

    # Fall back to Python module
    return _run_python_module(source)
```

This makes the profile pipeline the preferred path. Python modules are the fallback.

- [ ] **Step 2: Test with dry run**

```bash
cd crawlers && python3 main.py --source terminal-west --dry-run
```

- [ ] **Step 3: Commit**

```bash
git add crawlers/main.py
git commit -m "feat: prefer profile pipeline over Python modules when v2 profile exists"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `cd crawlers && python3 -m pytest tests/test_profile_v2_loader.py tests/test_entity_router.py tests/test_extraction_cache.py tests/test_domain_limiter.py tests/test_llm_multi_entity.py -v` — all pass
- [ ] `cd crawlers && python3 -m pytest -x --tb=short -q` — no new regressions
- [ ] `python3 pipeline_main.py --source terminal-west --limit 5` — pipeline runs with v2 features
- [ ] `python3 main.py --source terminal-west --dry-run` — main.py prefers profile pipeline
- [ ] Extraction cache table exists (from Track 1 migration)
- [ ] v1 profiles load successfully via normalize_to_v2()
