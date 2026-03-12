#!/usr/bin/env python3
"""
Lost City Crawler - Main entry point.
Orchestrates crawling, extraction, and storage of event data.

Features:
- Circuit breaker pattern to skip consistently failing sources
- Parallel execution for faster crawls
- Auto-discovery of crawler modules
"""

import argparse
import inspect
import logging
import os
import random
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from importlib import import_module
from typing import Optional
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup

from db import (
    get_active_sources,
    get_source_by_slug,
    create_crawl_log,
    update_crawl_log,
    refresh_available_filters,
    reset_validation_stats,
    get_validation_stats,
    clear_venue_cache,
    deactivate_tba_events,
    update_source_last_crawled,
    update_expected_event_count,
    get_sources_due_for_crawl,
    get_sources_by_cadence,
    detect_zero_event_sources,
    configure_write_mode,
    writes_enabled,
    reset_client,
)
from config import set_database_target, get_config
from crawl_context import set_crawl_context, CrawlContext
from utils import setup_logging
from fetch_logos import fetch_logos
from crawler_health import (
    record_crawl_start as health_record_start,
    record_crawl_success as health_record_success,
    record_crawl_failure as health_record_failure,
    get_recommended_workers,
    get_recommended_delay,
    should_skip_crawl,
    get_all_circuit_states,
    get_system_health_summary,
    print_health_report,
)
from data_quality import print_quality_report
from post_crawl_report import save_report as save_html_report
from event_cleanup import run_full_cleanup
from analytics import record_daily_snapshot, print_analytics_report
from closed_venues import CLOSED_SOURCE_SLUGS

logger = logging.getLogger(__name__)

# Parallel execution settings
MAX_WORKERS = 2  # Number of concurrent crawlers (reduced to avoid macOS socket limits)
DEFAULT_TIMEOUT_SECONDS = 300  # 5 minute timeout per source
CHAIN_TIMEOUT_SECONDS = 1800  # 30 minute timeout for chain cinema sources

# Chain cinema crawlers are high-volume and need a larger timeout budget.
CHAIN_CINEMA_TIMEOUT_SLUGS = {
    "amc-atlanta",
    "regal-atlanta",
    "cinemark-atlanta",
    "ncg-cinemas-atlanta",
    "silverspot-cinema-atlanta",
    "studio-movie-grill-atlanta",
}

# Permanently closed sources that should never run, even if re-activated in DB.
BLOCKED_SOURCE_SLUGS = set(CLOSED_SOURCE_SLUGS)

# Playwright (browser) worker limits — Playwright launches a full browser process
# per thread; too many concurrent browsers exhaust file descriptors and RAM quickly.
# Requests-only crawlers are lightweight and can run at higher concurrency.
MAX_PLAYWRIGHT_WORKERS = 2  # Reduced from 3 — each browser consumes ~200MB RAM + file descriptors; 2 avoids Errno 35 on macOS
MAX_REQUESTS_WORKERS = 8   # Reduced from 10 — keeps total socket pressure lower on the same run

# Populated once at startup by _classify_sources().
PLAYWRIGHT_SOURCES: set[str] = set()

TRANSIENT_CRAWL_ERROR_PATTERNS = (
    "server disconnected",
    "connection terminated",
    "connection reset by peer",
    "remote protocol error",
    "temporarily unavailable",
    "timed out",
    "timeout",
    "429",
    "too many requests",
    "rate limit",
    "403 forbidden",
)
TRANSIENT_CRAWL_MAX_ATTEMPTS = 2


def is_transient_crawl_error(exc: Exception) -> bool:
    """Return True when a crawl failure looks like a short-lived network problem."""
    message = str(exc or "").strip().lower()
    if not message:
        return False
    return any(pattern in message for pattern in TRANSIENT_CRAWL_ERROR_PATTERNS)


def run_crawler_with_retry(source: dict) -> tuple[int, int, int]:
    """Retry transient source failures once before surfacing them as hard errors."""
    slug = source["slug"]
    last_exc: Optional[Exception] = None

    for attempt in range(1, TRANSIENT_CRAWL_MAX_ATTEMPTS + 1):
        try:
            return run_crawler(source)
        except Exception as exc:
            last_exc = exc
            if attempt >= TRANSIENT_CRAWL_MAX_ATTEMPTS or not is_transient_crawl_error(exc):
                raise

            backoff_seconds = float(attempt)
            logger.warning(
                "Transient crawl failure for %s on attempt %s/%s: %s. Retrying in %.1fs.",
                slug,
                attempt,
                TRANSIENT_CRAWL_MAX_ATTEMPTS,
                exc,
                backoff_seconds,
            )
            time.sleep(backoff_seconds)

    if last_exc:
        raise last_exc
    raise RuntimeError(f"run_crawler_with_retry exhausted without result for {slug}")


def _classify_sources() -> None:
    """Scan source modules and populate PLAYWRIGHT_SOURCES with slugs that use Playwright.

    A source is classified as Playwright-based when its module source code contains
    a top-level import of playwright (``from playwright`` or ``import playwright``).
    Called once at module initialisation so the cost is paid before any crawl begins.
    """
    import pkgutil
    import importlib as _importlib

    sources_dir = os.path.join(os.path.dirname(__file__), "sources")
    if not os.path.isdir(sources_dir):
        return

    # Build a minimal package spec so pkgutil can walk it without a real import.
    import types
    sources_pkg = types.ModuleType("sources")
    sources_pkg.__path__ = [sources_dir]  # type: ignore[attr-defined]
    sources_pkg.__package__ = "sources"

    for _importer, modname, _ispkg in pkgutil.iter_modules(sources_pkg.__path__):
        try:
            mod = _importlib.import_module(f"sources.{modname}")
            source_code = inspect.getsource(mod)
        except Exception:
            continue

        if "from playwright" in source_code or "import playwright" in source_code:
            # Slug is the module filename with underscores replaced by hyphens,
            # matching the convention in auto_discover_modules().
            slug = modname.replace("_", "-")
            PLAYWRIGHT_SOURCES.add(slug)

    logger.debug(
        "Source classification complete: %s Playwright sources, checked via source inspection",
        len(PLAYWRIGHT_SOURCES),
    )


# Classify at import time so every code path (run_all_sources, _run_source_list, etc.)
# benefits without needing an explicit call site.
_classify_sources()


def run_launch_post_crawl_maintenance(
    *,
    city: str = "Atlanta",
    portal: Optional[str] = "atlanta",
) -> bool:
    """
    Run launch maintenance + gate checks via scripts/post_crawl_maintenance.py.

    Returns True on success, False otherwise.
    """
    script = os.path.join(os.path.dirname(__file__), "scripts", "post_crawl_maintenance.py")
    cmd = [sys.executable, script, "--city", city, "--continue-on-error"]
    if portal and portal.strip():
        cmd.extend(["--portal", portal.strip()])

    logger.info("Running launch maintenance sequence: %s", " ".join(cmd))
    try:
        result = subprocess.run(cmd)
    except Exception as exc:
        logger.error("Launch maintenance execution failed: %s", exc)
        return False

    if result.returncode != 0:
        logger.error("Launch maintenance failed with exit code %s", result.returncode)
        return False
    return True


def _run_profile_fallback(source: dict) -> Optional[tuple[int, int, int]]:
    """
    Run the profile pipeline when a source has no dedicated module.

    This keeps profile-backed sources crawlable without requiring one-off
    Python modules for each slug.
    """
    from pipeline.loader import find_profile_path
    from pipeline_main import run_profile

    slug = source["slug"]
    profile_path = find_profile_path(slug)
    if not profile_path:
        return None

    # Festivals are session containers and should be handled by
    # run_festival_schedules(), not profile discovery.
    if (source.get("source_type") or "").lower() == "festival":
        return None

    logger.info("Using profile fallback for source without module: %s", slug)
    result = run_profile(slug, dry_run=not writes_enabled(), limit=None)
    return result.events_found, result.events_new, result.events_updated


def get_source_timeout_seconds(slug: str) -> int:
    """Return timeout budget for a source slug."""
    if slug in CHAIN_CINEMA_TIMEOUT_SLUGS:
        return CHAIN_TIMEOUT_SECONDS
    return DEFAULT_TIMEOUT_SECONDS


def get_batch_timeout_seconds(slugs: list[str]) -> int:
    """Total timeout budget for a parallel source batch."""
    return sum(get_source_timeout_seconds(slug) for slug in slugs)


# SOURCE_OVERRIDES: Explicit slug-to-module mappings for exceptional cases
# Most crawlers are auto-discovered from sources/*.py filenames (underscores become hyphens)
# This dict contains ONLY the cases where slug != filename:
# - Slugs starting with numbers (e.g., "529" -> five29.py)
# - Multiple slugs mapping to one module (e.g., mobilize-* -> mobilize.py)
# - Name mismatches (e.g., "artsatl-calendar" -> artsatl.py)
SOURCE_OVERRIDES = {
    # Slugs starting with numbers (can't be Python module names)
    "529": "sources.five29",
    "10times": "sources.tentimes",
    "13-stories": "sources.thirteen_stories",
    "404-weekend": "sources.four04_weekend",
    "404-found-atl": "sources.four04_found_atl",
    "7-stages": "sources.seven_stages",
    
    # Multiple slugs mapping to single module
    "mobilize-api": "sources.mobilize_api",  # Legacy slug
    "mobilize-us": "sources.mobilize_api",   # HelpATL API aggregator
    "mobilize-dekalb-dems": "sources.mobilize",
    "mobilize-ga-dems": "sources.mobilize",
    "fair-count": "sources.mobilize",
    "mobilize-indivisible-atl": "sources.mobilize",
    "mobilize-indivisible-cobb": "sources.mobilize",
    "mobilize-indivisible-cherokee": "sources.mobilize",
    "mobilize-indivisible-ga10": "sources.mobilize",
    "mobilize-hrc-georgia": "sources.mobilize",
    "mobilize-50501-georgia": "sources.mobilize",
    "mobilize-necessary-trouble": "sources.mobilize",
    "mobilize-voteriders": "sources.mobilize",
    
    # Name mismatches (slug != filename.replace("_", "-"))
    "all-fired-up-art": "sources.all_fired_up",
    "aisle-5": "sources.aisle5",
    "artsatl-calendar": "sources.artsatl",
    "atlanta-botanical-garden": "sources.atlanta_botanical",
    "atlanta-recurring-social": "sources.recurring_social_events",
    "blakes-on-the-park": "sources.blakes_on_park",
    "blue-merle-studios": "sources.blue_merle",
    "center-civic-innovation": "sources.civic_innovation_atl",
    "chastain-arts-center": "sources.chastain_arts",
    "city-winery-atlanta": "sources.city_winery",
    "ebenezer-baptist-church": "sources.ebenezer_church",
    "ellis-station-candle-co": "sources.ellis_station",
    "fun-spot-america-atlanta": "sources.fun_spot_atlanta",
    "georgia-ensemble-theatre": "sources.georgia_ensemble",
    "georgia-ethics-commission": "sources.georgia_ethics_commission",
    "georgian-terrace-hotel": "sources.georgian_terrace",
    "goat-farm-arts-center": "sources.goat_farm",
    "hambidge-center": "sources.hambidge",
    "hammonds-house-museum": "sources.hammonds_house",
    "illuminarium-atlanta": "sources.illuminarium",
    "le-colonial-atlanta": "sources.le_colonial",
    "lwv-atlanta-fulton": "sources.lwv_atlanta",
    "michael-c-carlos-museum": "sources.carlos_museum",
    "millennium-gate-museum": "sources.millennium_gate",
    "ncg-cinemas-atlanta": "sources.ncg_atlanta",
    "sandler-hudson-gallery": "sources.sandler_hudson",
    "silverspot-cinema-atlanta": "sources.silverspot_atlanta",
    "six-flags-over-georgia": "sources.six_flags",
    "skylounge-glenn-hotel": "sources.skylounge_glenn",
    "the-bakery-atl": "sources.the_bakery",
    "the-works-atl": "sources.the_works",
    "the-gathering-spot": "sources.gathering_spot",
    "the-maker-station": "sources.maker_station",
    "chattahoochee-food-works": "sources.the_works",
    "wild-heaven-beer-avondale": "sources.wild_heaven_beer",
    # Support portal slug-to-filename mismatches
    "good-samaritan-health-center": "sources.good_samaritan_health",
    "red-cross-cpr-atlanta": "sources.red_cross_cpr",
    # Annual tentpole/festival watchlist slugs (single shared module)
    "piedmont-park-arts-festival": "sources.annual_tentpoles",
    "national-black-arts-festival": "sources.annual_tentpoles",
    "native-american-festival-and-pow-wow": "sources.annual_tentpoles",
    "atlanta-greek-picnic": "sources.annual_tentpoles",
    "taste-of-soul-atlanta": "sources.annual_tentpoles",
    "ga-renaissance-festival": "sources.annual_tentpoles",
    "blue-ridge-trout-fest": "sources.annual_tentpoles",
    "breakaway-atlanta": "sources.annual_tentpoles",
    "esfna-atlanta": "sources.annual_tentpoles",
    "221b-con": "sources.annual_tentpoles",
    "fifa-fan-festival-atlanta": "sources.annual_tentpoles",
    # Rec1 (CivicRec) county parks & recreation platforms
    "cobb-parks-rec": "sources.cobb_parks_rec",
    "gwinnett-parks-rec": "sources.gwinnett_parks_rec",
    # Destination-first crawlers (descriptive slugs != short filenames)
    "museum-of-illusions-atlanta": "sources.museum_of_illusions",
    "topgolf-atlanta-midtown": "sources.topgolf_atlanta",
    "andretti-indoor-karting-atlanta": "sources.andretti_karting",
    "ifly-indoor-skydiving-atlanta": "sources.ifly_atlanta",
    "dave-and-busters-marietta": "sources.dave_and_busters",
    "round-1-arcade-alpharetta": "sources.round_1_arcade",
    "porsche-experience-center-atlanta": "sources.porsche_experience_center",
    "atlanta-alpaca-treehouse": "sources.alpaca_treehouse",
    "trader-vics-atlanta": "sources.trader_vics",
}


def run_crawler(source: dict) -> tuple[int, int, int]:
    """
    Run crawler for a single source.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    slug = source["slug"]
    modules = get_source_modules()

    if slug not in modules:
        fallback_result = _run_profile_fallback(source)
        if fallback_result is not None:
            return fallback_result
        logger.warning(f"No crawler implemented for source: {slug}")
        return 0, 0, 0

    try:
        module = import_module(modules[slug])
        return module.crawl(source)
    except ImportError as e:
        logger.error(f"Failed to import crawler module for {slug}: {e}")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Crawler failed for {slug}: {e}")
        raise


def run_source(slug: str, skip_circuit_breaker: bool = False) -> bool:
    """
    Run crawler for a specific source by slug.

    Args:
        slug: Source slug to crawl
        skip_circuit_breaker: If True, bypass circuit breaker check

    Returns:
        True if successful, False otherwise
    """
    # Get recommended delay based on source health
    delay = get_recommended_delay(slug)
    if delay > 0:
        # Add some randomness to spread out requests
        time.sleep(delay + random.uniform(0.0, 0.5))

    source = get_source_by_slug(slug)

    if not source:
        logger.error(f"Source not found: {slug}")
        return False

    if slug in BLOCKED_SOURCE_SLUGS:
        logger.warning(
            "Source is permanently blocked from crawling: %s", slug
        )
        return False

    if not source["is_active"]:
        if skip_circuit_breaker:
            logger.warning("Source is inactive; continuing because --force was used: %s", slug)
        else:
            logger.warning(f"Source is not active: {slug}")
            return False

    # Check health-based skip (circuit breaker logic lives in crawler_health)
    if not skip_circuit_breaker:
        should_skip, reason = should_skip_crawl(slug)
        if should_skip:
            logger.warning(f"Skipping {slug}: health check failed ({reason})")
            return False

    logger.info(f"Starting crawl for: {source['name']}")
    log_id = create_crawl_log(source["id"])

    # Reset validation stats for this source
    reset_validation_stats()

    # Record start in health tracker
    health_run_id = health_record_start(slug)

    try:
        found, new, updated = run_crawler_with_retry(source)

        # Get validation statistics
        stats = get_validation_stats()
        rejected = stats.rejected

        update_crawl_log(
            log_id,
            status="success",
            events_found=found,
            events_new=new,
            events_updated=updated,
            events_rejected=rejected
        )
        # Record success in health tracker
        health_record_success(health_run_id, found, new, updated)

        # Update smart scheduling trackers
        try:
            update_source_last_crawled(source["id"])
            update_expected_event_count(source["id"], found)
        except Exception as e:
            logger.debug(f"Smart scheduling update failed for {slug}: {e}")

        # Log summary with validation stats
        summary_parts = [f"{found} found, {new} new, {updated} updated"]
        if rejected > 0:
            summary_parts.append(f"{rejected} rejected")
        if stats.warnings > 0:
            summary_parts.append(f"{stats.warnings} warnings")

        logger.info(f"Completed {source['name']}: {', '.join(summary_parts)}")

        # Log detailed validation stats if there were issues
        if rejected > 0 or stats.warnings > 0:
            logger.info(f"Validation details for {source['name']}:\n{stats.get_summary()}")

        return True

    except Exception as e:
        update_crawl_log(log_id, status="error", error_message=str(e))
        # Record failure in health tracker
        health_record_failure(health_run_id, str(e))
        logger.error(f"Failed {source['name']}: {e}")
        return False


def run_festival_schedules(portal_slug: Optional[str] = None) -> dict:
    """
    Extract program sessions from festival schedule pages.

    Uses structured parsing (JSON-LD, WordPress Events Calendar, HTML tables)
    to find individual sessions on festival websites and link them via series.
    No LLM calls — fast and cheap. Runs after individual source crawlers.

    Returns:
        Dict with stats: festivals_processed, festivals_with_data,
        sessions_found, sessions_inserted
    """
    from crawl_festival_schedule import crawl_festival_schedule
    from db import get_client, get_portal_id_by_slug

    client = get_client()
    result = (
        client.table("festivals")
        .select("slug,name,website")
        .not_.is_("website", "null")
        .order("name")
    )
    festivals = result.execute().data or []

    stats = {
        "festivals_processed": 0,
        "festivals_with_data": 0,
        "sessions_found": 0,
        "sessions_inserted": 0,
    }

    slugs = [f["slug"] for f in festivals if f.get("slug")]
    source_url_by_slug: dict[str, str] = {}
    if slugs:
        try:
            source_rows = (
                client.table("sources")
                .select("slug,url,owner_portal_id")
                .in_("slug", slugs)
                .execute()
            ).data or []

            if portal_slug:
                portal_id = get_portal_id_by_slug(portal_slug)
                if not portal_id:
                    logger.warning(
                        "Festival schedule extraction: portal '%s' not found; skipping scoped extraction.",
                        portal_slug,
                    )
                    festivals = []
                    source_rows = []
                else:
                    scoped_slugs = {
                        row.get("slug")
                        for row in source_rows
                        if row.get("slug") and row.get("owner_portal_id") == portal_id
                    }
                    pre_count = len(festivals)
                    festivals = [festival for festival in festivals if festival.get("slug") in scoped_slugs]
                    logger.info(
                        "Festival schedule extraction scoped to portal '%s': %s/%s festivals matched owned sources",
                        portal_slug,
                        len(festivals),
                        pre_count,
                    )
                    source_rows = [row for row in source_rows if row.get("slug") in scoped_slugs]

            source_url_by_slug = {
                row.get("slug"): row.get("url")
                for row in source_rows
                if row.get("slug") and row.get("url")
            }
        except Exception as e:
            logger.debug("Could not load source URLs for festival schedules: %s", e)

    for f in festivals:
        slug = f["slug"]
        website = f["website"]
        stats["festivals_processed"] += 1

        profile_urls: list[str] = []
        render_js = False
        try:
            from pipeline.loader import load_profile

            profile = load_profile(slug)
            profile_urls = list(profile.discovery.urls or [])
            render_js = bool(
                getattr(profile.discovery.fetch, "render_js", False)
                or getattr(profile.detail.fetch, "render_js", False)
            )
        except Exception:
            profile_urls = []
            render_js = False

        source_url = source_url_by_slug.get(slug)
        candidate_urls = _build_festival_schedule_candidate_urls(
            website=website,
            source_url=source_url,
            profile_urls=profile_urls,
            discover_links=True,
        )

        festival_found = 0
        festival_new = 0

        for candidate_url in candidate_urls:
            try:
                found, new, _skipped = crawl_festival_schedule(
                    slug=slug,
                    url=candidate_url,
                    render_js=render_js,
                    use_llm=False,
                    dry_run=False,
                )
            except Exception as e:
                logger.debug("  Festival %s candidate failed (%s): %s", slug, candidate_url, e)
                continue

            festival_found += found
            festival_new += new
            if found > 0:
                logger.info(
                    "  Festival %s: %s sessions, %s new (%s)",
                    slug,
                    found,
                    new,
                    candidate_url,
                )
                break

        stats["sessions_found"] += festival_found
        stats["sessions_inserted"] += festival_new
        if festival_found > 0:
            stats["festivals_with_data"] += 1

        time.sleep(0.5)

    return stats


_FESTIVAL_SCHEDULE_HINTS = (
    "/schedule",
    "/lineup",
    "/program",
    "/agenda",
    "/sessions",
    "/calendar",
    "/events",
)

_FESTIVAL_DISCOVERY_HINT_TOKENS = (
    "schedule",
    "lineup",
    "program",
    "agenda",
    "session",
    "calendar",
    "events",
    "panels",
    "tracks",
    "workshops",
    "programming",
    "timetable",
)

_FESTIVAL_DISCOVERY_SKIP_TOKENS = (
    "buy",
    "ticket",
    "membership",
    "hotel",
    "vendor",
    "sponsor",
    "contact",
    "press",
    "faq",
    "privacy",
    "terms",
    "donate",
    "volunteer",
)


def _normalized_host(host: str) -> str:
    return (host or "").strip().lower().removeprefix("www.")


def _is_same_site(base_host: str, candidate_host: str) -> bool:
    base = _normalized_host(base_host)
    candidate = _normalized_host(candidate_host)
    if not base or not candidate:
        return False
    return candidate == base or candidate.endswith(f".{base}")


def _discover_festival_schedule_links(
    seed_urls: list[str],
    max_links: int = 24,
) -> list[str]:
    """Discover likely schedule/program links from seed pages on the same site."""
    if not seed_urls:
        return []

    cfg = get_config()
    headers = {
        "User-Agent": cfg.crawler.user_agent,
        # Avoid brotli-only responses that can be unreadable without optional decoders.
        "Accept-Encoding": "gzip, deflate",
    }

    discovered: list[str] = []
    seen: set[str] = set()

    for seed_url in seed_urls[:3]:
        if len(discovered) >= max_links:
            break
        try:
            resp = requests.get(
                seed_url,
                headers=headers,
                timeout=cfg.crawler.request_timeout,
                allow_redirects=True,
            )
            resp.raise_for_status()
        except Exception as exc:
            logger.debug("Festival link discovery fetch failed for %s: %s", seed_url, exc)
            continue

        content_type = (resp.headers.get("content-type") or "").lower()
        if "html" not in content_type:
            continue

        base_url = resp.url or seed_url
        base_host = urlparse(base_url).netloc
        soup = BeautifulSoup(resp.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = (a.get("href") or "").strip()
            if not href or href.startswith("#"):
                continue
            if href.lower().startswith(("mailto:", "tel:", "javascript:")):
                continue

            candidate = _normalize_schedule_url(urljoin(base_url, href))
            if not candidate or candidate in seen:
                continue

            parsed = urlparse(candidate)
            if not _is_same_site(base_host, parsed.netloc):
                continue

            path = (parsed.path or "/").lower()
            if re.search(r"\.(?:jpg|jpeg|png|gif|webp|pdf|zip|ics|xml)$", path):
                continue

            anchor_text = (a.get_text(" ", strip=True) or "").lower()
            haystack = f"{candidate.lower()} {anchor_text}"
            if not any(token in haystack for token in _FESTIVAL_DISCOVERY_HINT_TOKENS):
                continue
            if any(token in haystack for token in _FESTIVAL_DISCOVERY_SKIP_TOKENS):
                continue

            seen.add(candidate)
            discovered.append(candidate)
            if len(discovered) >= max_links:
                break

    return discovered


def _normalize_schedule_url(url: str) -> str:
    """Normalize URL for crawl dedupe without stripping useful query params."""
    raw = (url or "").strip()
    if not raw:
        return ""
    parsed = urlparse(raw)
    if not parsed.scheme:
        parsed = urlparse(f"https://{raw.lstrip('/')}")
    if not parsed.netloc:
        return ""

    path = parsed.path or "/"
    if path != "/":
        path = path.rstrip("/") or "/"

    cleaned = parsed._replace(path=path, fragment="")
    return urlunparse(cleaned)


def _looks_like_schedule_url(url: str) -> bool:
    lower = (url or "").lower()
    return any(
        marker in lower
        for marker in ("schedule", "lineup", "program", "agenda", "session", "calendar")
    )


def _build_festival_schedule_candidate_urls(
    website: str,
    source_url: Optional[str] = None,
    profile_urls: Optional[list[str]] = None,
    max_candidates: int = 6,
    discover_links: bool = False,
) -> list[str]:
    """Build prioritized candidate URLs for festival session extraction."""
    raw_candidates: list[str] = [website]
    if source_url:
        raw_candidates.append(source_url)
    if profile_urls:
        raw_candidates.extend(profile_urls)

    seed_urls: list[str] = []
    for raw_url in raw_candidates:
        seed = _normalize_schedule_url(raw_url)
        if seed and seed not in seed_urls:
            seed_urls.append(seed)

    expanded: list[str] = []
    for raw_url in raw_candidates:
        normalized = _normalize_schedule_url(raw_url)
        if not normalized:
            continue
        expanded.append(normalized)

        # If URL already points to a likely schedule/program page, don't fan out.
        if _looks_like_schedule_url(normalized):
            continue

        base_for_join = normalized if normalized.endswith("/") else f"{normalized}/"
        for suffix in _FESTIVAL_SCHEDULE_HINTS:
            expanded.append(_normalize_schedule_url(urljoin(base_for_join, suffix.lstrip("/"))))

    if discover_links:
        discovered = _discover_festival_schedule_links(seed_urls, max_links=max_candidates * 4)
        if discovered:
            logger.debug("Festival URL discovery added %s links for %s", len(discovered), website)
            expanded.extend(discovered)

    deduped: list[str] = []
    seen: set[str] = set()
    for url in expanded:
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append(url)

    def _priority(url: str) -> tuple[int, int]:
        parsed = urlparse(url)
        path = parsed.path or "/"
        score = 0
        if _looks_like_schedule_url(url):
            score -= 10
        if "events" in url.lower():
            score -= 2
        if path in ("", "/"):
            score += 5
        return score, len(path)

    deduped.sort(key=_priority)
    selected = deduped[:max_candidates]

    # Keep at least one root URL as a fallback for non-standard schedule routing.
    has_root = any((urlparse(url).path or "/") in ("", "/") for url in selected)
    if not has_root:
        root_seed = next(
            (u for u in seed_urls if (urlparse(u).path or "/") in ("", "/")),
            None,
        )
        if root_seed and root_seed not in selected:
            if len(selected) >= max_candidates and selected:
                selected[-1] = root_seed
            else:
                selected.append(root_seed)

    # Preserve ordering uniqueness after fallback insertion.
    out: list[str] = []
    seen_out: set[str] = set()
    for url in selected:
        if url in seen_out:
            continue
        seen_out.add(url)
        out.append(url)
    return out


def demote_stale_festival_dates() -> int:
    """Demote festivals whose announced_start is in the past.

    Skips festivals that are currently ongoing (announced_end >= today).
    Moves announced dates to pending for re-verification.

    Returns count of demoted festivals.
    """
    from db import get_client
    from datetime import date

    client = get_client()
    today_str = date.today().isoformat()

    # Find festivals with past announced_start
    result = (
        client.table("festivals")
        .select("id,slug,announced_start,announced_end")
        .not_.is_("announced_start", "null")
        .lt("announced_start", today_str)
        .execute()
    )
    festivals = result.data or []

    demoted = 0
    for f in festivals:
        # Skip ongoing festivals (end date is today or future)
        if f.get("announced_end") and f["announced_end"] >= today_str:
            continue

        client.table("festivals").update({
            "pending_start": f["announced_start"],
            "pending_end": f.get("announced_end"),
            "announced_start": None,
            "announced_end": None,
            "date_confidence": 20,
            "date_source": "auto-demoted-stale",
        }).eq("id", f["id"]).execute()
        demoted += 1
        logger.debug(f"Demoted stale festival: {f['slug']} ({f['announced_start']})")

    return demoted


def check_unannounced_festivals(soon_only: bool = False, dry_run: bool = False) -> dict:
    """
    Check unannounced festivals for newly posted dates.

    Wraps check_festival_dates() from the existing module.
    When not filtering to soon_only, does three passes:
      1. soon_only=True  (festivals within 3 months of typical_month)
      2. Remaining festivals (background sweep)
      3. Promote existing pending rows if confidence improved
    """
    from check_festival_dates import check_festival_dates

    if soon_only:
        check_festival_dates(dry_run=dry_run, soon_only=True)
        # Also try promoting existing pending rows
        check_festival_dates(
            dry_run=dry_run, soon_only=True, promote_pending=True
        )
    else:
        # First pass: high-priority (soon)
        check_festival_dates(dry_run=dry_run, soon_only=True)
        # Second pass: everything else
        check_festival_dates(dry_run=dry_run, soon_only=False)
        # Also try promoting existing pending rows
        check_festival_dates(dry_run=dry_run, promote_pending=True)


def get_festival_tier_summary() -> dict:
    """
    Query festival counts by computed tier and log a summary line.

    Tiers:
      T1 (Confirmed): announced_start is set and >= today
      T2 (Pending):    pending_start set, no announced date
      T3 (Unannounced): neither announced nor pending dates

    Returns dict with {t1, t2, t3}.
    """
    from db import get_client
    from datetime import date

    client = get_client()
    today_str = date.today().isoformat()

    all_fests = (
        client.table("festivals")
        .select("id,announced_start,announced_end,pending_start")
        .execute()
    ).data or []

    t1 = t2 = t3 = 0
    for f in all_fests:
        announced = f.get("announced_start")
        if announced and announced >= today_str:
            t1 += 1
        elif f.get("pending_start"):
            t2 += 1
        else:
            t3 += 1

    return {"t1": t1, "t2": t2, "t3": t3}


def run_post_crawl_tasks(
    *,
    run_global_tasks: bool = True,
    run_launch_maintenance: bool = True,
    maintenance_city: str = "Atlanta",
    maintenance_portal: Optional[str] = "atlanta",
) -> None:
    """Run all post-crawl pipeline tasks (filters, logos, cleanup, festivals, etc.)."""
    if not writes_enabled():
        logger.info("Write mode disabled; skipping post-crawl tasks.")
        return

    if not run_global_tasks:
        logger.info("Skipping post-crawl tasks for scoped run.")
        return

    # Refresh available filters for UI
    logger.info("Refreshing available filters...")
    if refresh_available_filters():
        logger.info("Available filters refreshed successfully")
    else:
        logger.warning("Failed to refresh available filters")

    # Fetch logos for any producers missing them
    logger.info("Fetching logos for producers...")
    try:
        logo_results = fetch_logos()
        logger.info(
            f"Logo fetch complete: {logo_results['success']} new, "
            f"{logo_results['failed']} failed, {logo_results['skipped']} skipped"
        )
    except Exception as e:
        logger.warning(f"Logo fetch failed: {e}")

    # Log health summary
    try:
        health = get_system_health_summary()
        logger.info(
            f"Health summary: {health['sources']['healthy']} healthy, "
            f"{health['sources']['degraded']} degraded, "
            f"{health['sources']['unhealthy']} unhealthy sources"
        )
    except Exception as e:
        logger.debug(f"Could not get health summary: {e}")

    # ===== POST-CRAWL TASKS =====

    # 1. Clean up old events
    logger.info("Running post-crawl cleanup...")
    try:
        cleanup_results = run_full_cleanup(days_to_keep=0, dry_run=False)
        total_deleted = sum(r.get("deleted", 0) for r in cleanup_results.values())
        music_quality = cleanup_results.get("music_venue_quality", {})
        logger.info(
            "Cleanup complete: %s events removed | music quality: canonical +%s/-%s, lineup +%s, desc +%s",
            total_deleted,
            music_quality.get("canonical_updates", 0),
            music_quality.get("canonical_resets", 0),
            music_quality.get("lineup_updates", 0),
            music_quality.get("description_repairs", 0),
        )
    except Exception as e:
        logger.warning(f"Cleanup failed: {e}")

    # 1b. Data quality healing loop
    logger.info("Running data quality healing loop...")
    try:
        from heal_events import run_healing_loop
        heal_stats = run_healing_loop(dry_run=False, fix=True, report=True)
        logger.info(
            "Healing: %s prices, %s titles, %s caps, %s closed-venue, %s alerts",
            heal_stats.get("prices_fixed", 0),
            heal_stats.get("titles_cleaned", 0),
            heal_stats.get("caps_fixed", 0),
            heal_stats.get("closed_deactivated", 0),
            heal_stats.get("alerts", 0),
        )
    except Exception as e:
        logger.warning(f"Healing loop failed: {e}")

    # 2. Festival schedule extraction (structured parsing, no LLM)
    logger.info("Extracting festival program sessions...")
    try:
        festival_stats = run_festival_schedules(portal_slug=maintenance_portal)
        logger.info(
            f"Festival schedules: {festival_stats['sessions_found']} found, "
            f"{festival_stats['sessions_inserted']} new across "
            f"{festival_stats['festivals_with_data']}/{festival_stats['festivals_processed']} festivals"
        )
    except Exception as e:
        logger.warning(f"Festival schedule extraction failed: {e}")

    # 2b. Demote stale festival dates (announced_start in the past)
    logger.info("Demoting stale festival dates...")
    try:
        demoted_count = demote_stale_festival_dates()
        if demoted_count > 0:
            logger.info(f"Demoted {demoted_count} festivals with past announced dates")
    except Exception as e:
        logger.warning(f"Festival date demotion failed: {e}")

    # 2c. Festival health check — backfill dates/titles, log warnings
    logger.info("Running festival health check...")
    try:
        from festival_health import run_festival_health_check
        fh_stats = run_festival_health_check()
        backfilled = fh_stats.get("titles_backfilled", 0) + fh_stats.get("festival_dates_backfilled", 0)
        if backfilled > 0:
            logger.info(f"Festival health: backfilled {backfilled} series")
    except Exception as e:
        logger.warning(f"Festival health check failed: {e}")

    # 2d. Check unannounced festivals for newly posted dates (soon only to keep fast)
    logger.info("Checking unannounced festivals for date updates...")
    try:
        check_unannounced_festivals(soon_only=True)
    except Exception as e:
        logger.warning(f"Festival date check failed: {e}")

    # 2e. Festival tier summary
    try:
        tiers = get_festival_tier_summary()
        logger.info(
            f"Festival tiers: {tiers['t1']} confirmed (T1) | "
            f"{tiers['t2']} pending (T2) | {tiers['t3']} unannounced (T3)"
        )
    except Exception as e:
        logger.warning(f"Festival tier summary failed: {e}")

    # 2f. Artist backfill and normalization
    logger.info("Running artist backfill and normalization...")
    try:
        from scripts.backfill_event_artists import run_artist_backfill
        artist_stats = run_artist_backfill(dry_run=False)
        logger.info(
            "Artist backfill: cleanup %s checked (%s changed, %s deleted), "
            "backfill %s checked (%s added)",
            artist_stats.get("cleanup_checked", 0),
            artist_stats.get("cleanup_changed", 0),
            artist_stats.get("cleanup_deleted", 0),
            artist_stats.get("backfill_checked", 0),
            artist_stats.get("backfill_added", 0),
        )
    except Exception as e:
        logger.warning(f"Artist backfill failed: {e}")

    # 3. Hydrate TBA events — enrich from source/ticket URLs before reporting
    logger.info("Hydrating TBA events (enriching from source URLs)...")
    try:
        from hydrate_tba_events import hydrate_tba_events
        tba_stats = hydrate_tba_events(apply=True)
        tba_total = tba_stats.get("total", 0)
        if tba_total > 0:
            logger.info(
                f"TBA hydration: {tba_stats.get('time_filled', 0)} times found, "
                f"{tba_stats.get('enriched', 0)} enriched, "
                f"{tba_stats.get('deduped', 0)} deduped "
                f"out of {tba_total} TBA events"
            )
    except Exception as e:
        logger.warning(f"TBA hydration failed: {e}")

    # 3b. Report remaining TBA events
    logger.info("Counting remaining TBA events...")
    try:
        tba_count = deactivate_tba_events()
        if tba_count > 0:
            logger.info(f"Still {tba_count} TBA events remaining (hidden from feeds)")
    except Exception as e:
        logger.warning(f"TBA count failed: {e}")

    # 4. Backfill tags for any events missing venue-type-based tags
    logger.info("Running tag backfill...")
    try:
        from backfill_tags import backfill_tags
        tag_stats = backfill_tags(dry_run=False, batch_size=200)
        logger.info(f"Tag backfill: {tag_stats.get('updated', 0)} events updated")
    except Exception as e:
        logger.warning(f"Tag backfill failed: {e}")

    # 5. Zero-event source detection
    logger.info("Checking for zero-event source regressions...")
    try:
        deactivated_count, deactivated_slugs = detect_zero_event_sources()
        if deactivated_count > 0:
            logger.warning(f"Auto-deactivated {deactivated_count} sources: {', '.join(deactivated_slugs)}")
    except Exception as e:
        logger.warning(f"Zero-event detection failed: {e}")

    # 6. Record daily analytics snapshot
    logger.info("Recording analytics snapshot...")
    try:
        snapshot = record_daily_snapshot()
        logger.info(f"Analytics: {snapshot.get('total_upcoming_events', 0)} upcoming events")
    except Exception as e:
        logger.warning(f"Analytics snapshot failed: {e}")

    # 7. Generate HTML report
    logger.info("Generating post-crawl report...")
    try:
        report_path = save_html_report()
        logger.info(f"Report saved: {report_path}")
    except Exception as e:
        logger.warning(f"Report generation failed: {e}")

    if run_launch_maintenance:
        ok = run_launch_post_crawl_maintenance(
            city=maintenance_city,
            portal=maintenance_portal,
        )
        if not ok:
            raise RuntimeError("Launch maintenance sequence failed")


def should_run_full_post_crawl_for_source(args) -> bool:
    """
    Return whether a single-source run should trigger broad post-crawl jobs.

    Scoped rehab/debug runs should not default into cleanup, healing, festival
    extraction, and launch maintenance. Those remain opt-in for source runs.
    """
    if getattr(args, "skip_launch_maintenance", False):
        return False
    return bool(getattr(args, "full_post_crawl", False))


def run_all_sources(
    parallel: bool = True,
    max_workers: int = MAX_WORKERS,
    adaptive: bool = True,
    run_launch_maintenance: bool = True,
    maintenance_city: str = "Atlanta",
    maintenance_portal: Optional[str] = "atlanta",
) -> dict[str, bool]:
    """
    Run crawlers for all active sources.

    Args:
        parallel: If True, run crawlers in parallel (default: True)
        max_workers: Maximum number of parallel workers
        adaptive: If True, adjust workers based on health (default: True)

    Returns:
        Dict mapping source slug to success status
    """
    sources = get_active_sources()
    results = {}

    # Clear venue cache once at the start so it persists across all sources
    # in this run but doesn't carry stale data between separate invocations.
    clear_venue_cache()

    # Use adaptive worker count if enabled
    if adaptive:
        recommended = get_recommended_workers()
        if recommended < max_workers:
            logger.info(f"Adaptive: reducing workers from {max_workers} to {recommended} based on health")
            max_workers = recommended

    # Pre-filter sources with open circuit breakers
    active_sources = []
    skipped_sources = []

    for source in sources:
        should_skip, reason = should_skip_crawl(source["slug"])
        if should_skip:
            skipped_sources.append((source["slug"], reason))
            results[source["slug"]] = False
        else:
            active_sources.append(source)

    if skipped_sources:
        logger.warning(
            f"Skipping {len(skipped_sources)} sources due to circuit breaker: "
            f"{[s[0] for s in skipped_sources]}"
        )

    logger.info(
        f"Running crawlers for {len(active_sources)} sources "
        f"({len(skipped_sources)} skipped by circuit breaker)"
    )

    if parallel and len(active_sources) > 1:
        # Split sources into Playwright and requests pools running concurrently.
        pw_workers = min(MAX_PLAYWRIGHT_WORKERS, max_workers)
        req_workers = min(MAX_REQUESTS_WORKERS, max_workers)
        split_results = _run_split_pool(active_sources, pw_workers=pw_workers, req_workers=req_workers)
        results.update(split_results)
    else:
        # Sequential execution
        for source in active_sources:
            slug = source["slug"]
            results[slug] = run_source(slug, skip_circuit_breaker=True)

    # Retry failed sources sequentially
    failed_slugs = [slug for slug, ok in results.items() if not ok]
    if failed_slugs and parallel:
        logger.info(
            f"Retrying {len(failed_slugs)} failed sources sequentially..."
        )
        for slug in failed_slugs:
            time.sleep(2)  # Cool-down between retries
            ok = run_source(slug, skip_circuit_breaker=True)
            results[slug] = ok
            if ok:
                logger.info(f"Retry succeeded: {slug}")

    # Summary
    success = sum(1 for v in results.values() if v)
    failed = len(results) - success
    logger.info(
        f"Crawl complete: {success} sources succeeded, {failed} failed, "
        f"{len(skipped_sources)} circuit-breaker skipped"
    )
    logger.info("Note: Per-source validation statistics are logged above for each crawler.")

    # Run all post-crawl pipeline tasks
    run_post_crawl_tasks(
        run_global_tasks=run_launch_maintenance,
        run_launch_maintenance=run_launch_maintenance,
        maintenance_city=maintenance_city,
        maintenance_portal=maintenance_portal,
    )

    return results


def _run_split_pool(
    sources: list[dict],
    pw_workers: int = MAX_PLAYWRIGHT_WORKERS,
    req_workers: int = MAX_REQUESTS_WORKERS,
) -> dict[str, bool]:
    """Run sources in two separate thread pools — one for Playwright, one for requests.

    Playwright launches a full browser process per thread; keeping its pool small
    (default 3) avoids exhausting file descriptors and RAM.  Requests-only crawlers
    are I/O-lightweight and can run at higher concurrency (default 10).

    Both pools execute concurrently.  Results are merged and returned with the same
    {slug: bool} shape as the single-pool path.

    Args:
        sources:    List of source dicts (must have a ``slug`` key).
        pw_workers: Max concurrent threads for Playwright sources.
        req_workers: Max concurrent threads for requests-only sources.

    Returns:
        Dict mapping source slug → True (success) / False (failure).
    """
    # Split by Playwright classification.  Unknown slugs (e.g. profile-backed
    # sources that don't have a .py module) default to the requests pool since
    # they don't launch browsers.
    pw_sources = [s for s in sources if s["slug"] in PLAYWRIGHT_SOURCES]
    req_sources = [s for s in sources if s["slug"] not in PLAYWRIGHT_SOURCES]

    logger.info(
        "Split pool: %s Playwright sources (max %s workers), "
        "%s requests sources (max %s workers)",
        len(pw_sources), pw_workers,
        len(req_sources), req_workers,
    )

    results: dict[str, bool] = {}

    # Guard against empty pools — ThreadPoolExecutor(max_workers=0) raises ValueError.
    actual_pw_workers = min(pw_workers, len(pw_sources)) if pw_sources else 1
    actual_req_workers = min(req_workers, len(req_sources)) if req_sources else 1

    batch_slugs = [s["slug"] for s in sources]
    batch_timeout = get_batch_timeout_seconds(batch_slugs)

    with (
        ThreadPoolExecutor(max_workers=actual_pw_workers) as pw_pool,
        ThreadPoolExecutor(max_workers=actual_req_workers) as req_pool,
    ):
        future_to_slug: dict = {}
        for source in pw_sources:
            future_to_slug[pw_pool.submit(run_source, source["slug"], True)] = source["slug"]
        for source in req_sources:
            future_to_slug[req_pool.submit(run_source, source["slug"], True)] = source["slug"]

        try:
            for future in as_completed(future_to_slug, timeout=batch_timeout):
                slug = future_to_slug[future]
                try:
                    results[slug] = future.result()
                except Exception as e:
                    logger.error("Parallel execution failed for %s: %s", slug, e)
                    results[slug] = False
        except FuturesTimeoutError:
            logger.error(
                "Split-pool crawl batch exceeded timeout budget (%ss). "
                "Marking unfinished sources as failed.",
                batch_timeout,
            )
            for future, slug in future_to_slug.items():
                if slug in results:
                    continue
                if future.done():
                    try:
                        results[slug] = future.result()
                    except Exception as e:
                        logger.error("Parallel execution failed for %s: %s", slug, e)
                        results[slug] = False
                else:
                    future.cancel()
                    results[slug] = False

    return results


def _run_source_list(sources: list[dict], parallel: bool = True, max_workers: int = MAX_WORKERS) -> dict[str, bool]:
    """Run a list of sources through the standard parallel/sequential pipeline with retries.

    Shared logic used by run_all_sources, run_smart_crawl, and run_cadence_crawl.
    When parallel=True, sources are split into Playwright and requests pools
    (see _run_split_pool).  max_workers is kept for the --workers CLI flag but
    is no longer used to size the single pool; instead it caps the requests pool
    so that explicit --workers N behaves as a global upper bound.
    """
    # Clear venue cache once at the start of a batch run so it persists
    # across all sources in this run (avoids redundant DB lookups) but
    # doesn't carry stale data between separate invocations.
    clear_venue_cache()

    results = {}

    if parallel and len(sources) > 1:
        # Cap both pools by max_workers so --workers N still acts as a global limit.
        pw_workers = min(MAX_PLAYWRIGHT_WORKERS, max_workers)
        req_workers = min(MAX_REQUESTS_WORKERS, max_workers)
        results = _run_split_pool(sources, pw_workers=pw_workers, req_workers=req_workers)
    else:
        for source in sources:
            slug = source["slug"]
            results[slug] = run_source(slug, skip_circuit_breaker=True)

    # Retry failed sources sequentially
    failed_slugs = [slug for slug, ok in results.items() if not ok]
    if failed_slugs and parallel:
        logger.info(f"Retrying {len(failed_slugs)} failed sources sequentially...")
        for slug in failed_slugs:
            time.sleep(2)
            ok = run_source(slug, skip_circuit_breaker=True)
            results[slug] = ok
            if ok:
                logger.info(f"Retry succeeded: {slug}")

    return results


def run_smart_crawl(args) -> dict[str, bool]:
    """Smart mode: only crawl sources due based on crawl_frequency."""
    due_sources = get_sources_due_for_crawl()

    # Count by cadence for logging
    cadence_counts = {}
    for s in due_sources:
        freq = s.get("crawl_frequency") or "daily"
        cadence_counts[freq] = cadence_counts.get(freq, 0) + 1

    cadence_summary = ", ".join(f"{c} {k}" for k, c in sorted(cadence_counts.items()))
    logger.info(f"Smart mode: {len(due_sources)} sources due for crawl ({cadence_summary})")

    if not due_sources:
        logger.info("No sources due for crawl — exiting")
        return {}

    # Pre-filter circuit breakers
    active_sources = []
    for source in due_sources:
        should_skip, reason = should_skip_crawl(source["slug"])
        if should_skip:
            logger.debug(f"Skipping {source['slug']}: circuit breaker ({reason})")
        else:
            active_sources.append(source)

    max_workers = args.workers if hasattr(args, 'workers') else MAX_WORKERS
    parallel = not (hasattr(args, 'sequential') and args.sequential)

    results = _run_source_list(active_sources, parallel=parallel, max_workers=max_workers)

    # Summary
    success = sum(1 for v in results.values() if v)
    failed = len(results) - success
    logger.info(f"Smart crawl complete: {success} succeeded, {failed} failed")

    run_post_crawl_tasks(
        run_global_tasks=not args.skip_launch_maintenance,
        run_launch_maintenance=not args.skip_launch_maintenance,
        maintenance_city=args.launch_maintenance_city,
        maintenance_portal=args.launch_maintenance_portal,
    )
    return results


def run_cadence_crawl(args) -> dict[str, bool]:
    """Run all sources with a specific crawl_frequency cadence."""
    sources = get_sources_by_cadence(args.cadence)
    logger.info(f"Cadence mode: {len(sources)} sources with frequency '{args.cadence}'")

    if not sources:
        logger.info(f"No active sources with cadence '{args.cadence}' — exiting")
        return {}

    # Pre-filter circuit breakers
    active_sources = []
    for source in sources:
        should_skip, reason = should_skip_crawl(source["slug"])
        if should_skip:
            logger.debug(f"Skipping {source['slug']}: circuit breaker ({reason})")
        else:
            active_sources.append(source)

    max_workers = args.workers if hasattr(args, 'workers') else MAX_WORKERS
    parallel = not (hasattr(args, 'sequential') and args.sequential)

    results = _run_source_list(active_sources, parallel=parallel, max_workers=max_workers)

    # Summary
    success = sum(1 for v in results.values() if v)
    failed = len(results) - success
    logger.info(f"Cadence crawl complete: {success} succeeded, {failed} failed")

    run_post_crawl_tasks(
        run_global_tasks=not args.skip_launch_maintenance,
        run_launch_maintenance=not args.skip_launch_maintenance,
        maintenance_city=args.launch_maintenance_city,
        maintenance_portal=args.launch_maintenance_portal,
    )
    return results


def auto_discover_modules() -> dict[str, str]:
    """
    Auto-discover crawler modules from the sources directory.
    Maps slug (derived from filename) to module path.

    Filename convention: sources/<slug_with_underscores>.py
    Example: sources/terminal_west.py -> "terminal-west": "sources.terminal_west"
    """
    sources_dir = os.path.join(os.path.dirname(__file__), "sources")
    discovered = {}

    if not os.path.exists(sources_dir):
        logger.warning(f"Sources directory not found: {sources_dir}")
        return discovered

    for filename in os.listdir(sources_dir):
        if filename.endswith(".py") and not filename.startswith("_"):
            module_name = filename[:-3]  # Remove .py
            # Convert underscores to hyphens for slug
            slug = module_name.replace("_", "-")
            discovered[slug] = f"sources.{module_name}"

    return discovered


def get_source_modules() -> dict[str, str]:
    """
    Get all available source modules.
    Auto-discovers modules from sources/*.py (filename underscores -> slug hyphens).
    SOURCE_OVERRIDES provides explicit mappings for exceptional cases.
    Overrides take precedence over auto-discovery.
    """
    discovered = auto_discover_modules()
    # Merge: overrides win over discovery
    merged = {**discovered, **SOURCE_OVERRIDES}
    return merged


def main():
    """Main entry point."""
    setup_logging()
    default_db_target = os.getenv("CRAWLER_DB_TARGET", "production").strip().lower()
    if default_db_target not in {"staging", "production"}:
        default_db_target = "production"

    parser = argparse.ArgumentParser(
        description="Lost City Event Crawler",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--source", "-s",
        help="Specific source slug to crawl (default: all active sources)"
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List available sources and exit"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Fetch and extract but don't save to database"
    )
    parser.add_argument(
        "--db-target",
        choices=["staging", "production"],
        default=default_db_target,
        help="Database target environment (default: CRAWLER_DB_TARGET or production)"
    )
    parser.add_argument(
        "--allow-production-writes",
        "--allow-prod-writes",
        action="store_true",
        dest="allow_production_writes",
        help="Required to perform write operations against production DB target"
    )
    parser.add_argument(
        "--sequential",
        action="store_true",
        help="Run crawlers sequentially instead of in parallel"
    )
    parser.add_argument(
        "--workers", "-w",
        type=int,
        default=MAX_WORKERS,
        help=f"Number of parallel workers (default: {MAX_WORKERS})"
    )
    parser.add_argument(
        "--force", "-f",
        action="store_true",
        help="Force crawl even if circuit breaker is open"
    )
    parser.add_argument(
        "--circuit-status",
        action="store_true",
        help="Show circuit breaker status for all sources"
    )
    parser.add_argument(
        "--health",
        action="store_true",
        help="Show crawler health report and exit"
    )
    parser.add_argument(
        "--no-adaptive",
        action="store_true",
        help="Disable adaptive worker count (use fixed workers)"
    )
    parser.add_argument(
        "--quality",
        action="store_true",
        help="Show data quality report and exit"
    )
    parser.add_argument(
        "--quality-all",
        action="store_true",
        help="Show data quality report for all sources"
    )
    parser.add_argument(
        "--analytics",
        action="store_true",
        help="Show analytics report and exit"
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Generate HTML report and exit"
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Run event cleanup and exit"
    )
    parser.add_argument(
        "--cleanup-dry-run",
        action="store_true",
        help="Show what cleanup would delete without actually deleting"
    )
    parser.add_argument(
        "--check-festivals",
        action="store_true",
        help="Check unannounced festivals for newly posted dates and exit"
    )
    parser.add_argument(
        "--soon",
        action="store_true",
        help="With --check-festivals, only check festivals within 3 months"
    )
    parser.add_argument(
        "--specials",
        action="store_true",
        help="Run venue specials scraper (extracts happy hours, food nights, etc.)"
    )
    parser.add_argument(
        "--specials-venue-type",
        default="bar",
        help="Venue type to scrape for --specials (default: bar)"
    )
    parser.add_argument(
        "--specials-limit",
        type=int,
        default=50,
        help="Max venues to process for --specials (default: 50)"
    )
    parser.add_argument(
        "--smart",
        action="store_true",
        help="Smart mode: only crawl sources due based on crawl_frequency"
    )
    parser.add_argument(
        "--cadence",
        choices=["daily", "twice_weekly", "weekly", "monthly"],
        help="Force-run all sources with specific frequency"
    )
    parser.add_argument(
        "--skip-launch-maintenance",
        action="store_true",
        help=(
            "Skip global post-crawl tasks and launch maintenance/gate sequence. "
            "Use this for scoped source runs where broad cleanup/backfill jobs are not desired."
        ),
    )
    parser.add_argument(
        "--full-post-crawl",
        action="store_true",
        help=(
            "For scoped --source runs, opt into the full post-crawl pipeline "
            "(cleanup, healing, festivals, reports, and launch maintenance)."
        ),
    )
    parser.add_argument(
        "--launch-maintenance-city",
        default="Atlanta",
        help="City passed to post-crawl launch maintenance. Default: Atlanta.",
    )
    parser.add_argument(
        "--launch-maintenance-portal",
        default="atlanta",
        help="Portal passed to post-crawl launch maintenance. Default: atlanta.",
    )
    parser.add_argument(
        "--city",
        default="Atlanta",
        help="City context for this crawl run (default: Atlanta).",
    )
    parser.add_argument(
        "--state",
        default="GA",
        help="State context for this crawl run; also sets allowed_states (default: GA).",
    )

    args = parser.parse_args()

    # Apply DB target before any queries execute.
    set_database_target(args.db_target)
    reset_client()
    cfg = get_config()
    missing_credentials = cfg.database.missing_active_credentials()
    if missing_credentials:
        parser.error(
            f"Missing DB credentials for target '{cfg.database.active_target}': "
            f"{', '.join(missing_credentials)}"
        )

    read_only_command = any(
        [
            args.health,
            args.quality,
            args.quality_all,
            args.analytics,
            args.report,
            args.circuit_status,
            args.list,
            args.cleanup_dry_run,
        ]
    )
    should_write = (not args.dry_run) and (not read_only_command)

    if should_write and cfg.database.active_target == "production":
        allow_from_env = os.getenv("CRAWLER_ALLOW_PRODUCTION_WRITES", "").strip().lower() in (
            "1",
            "true",
            "yes",
            "on",
        )
        if not (args.allow_production_writes or allow_from_env):
            parser.error(
                "Refusing production writes without --allow-production-writes "
                "(or CRAWLER_ALLOW_PRODUCTION_WRITES=1). "
                "Use --db-target staging for safe validation."
            )

    configure_write_mode(
        should_write,
        reason="dry-run/read-only mode" if not should_write else "",
    )
    logger.info(
        "DB target=%s | writes=%s",
        cfg.database.active_target,
        "enabled" if should_write else "disabled",
    )

    # Set city/state crawl context so geographic filters are parameterized.
    # When running Atlanta (the default), this is a no-op. For new markets,
    # pass --city Nashville --state TN and the venue state gate will allow it.
    if args.city != "Atlanta" or args.state != "GA":
        set_crawl_context(CrawlContext(
            city=args.city,
            state=args.state,
            allowed_states=[args.state],
        ))
        logger.info("Crawl context: city=%s state=%s", args.city, args.state)

    # Health report
    if args.health:
        print_health_report()
        return 0

    # Data quality report
    if args.quality or args.quality_all:
        print_quality_report(days=30, show_all=args.quality_all)
        return 0

    # Analytics report
    if args.analytics:
        print_analytics_report()
        return 0

    # Generate HTML report
    if args.report:
        report_path = save_html_report()
        print(f"Report generated: {report_path}")
        return 0

    # Check festival dates
    if args.check_festivals:
        check_unannounced_festivals(soon_only=args.soon, dry_run=args.dry_run)
        tiers = get_festival_tier_summary()
        print(
            f"\nFestival tiers: {tiers['t1']} confirmed (T1) | "
            f"{tiers['t2']} pending (T2) | {tiers['t3']} unannounced (T3)"
        )
        return 0

    # Event cleanup
    if args.cleanup or args.cleanup_dry_run:
        dry_run = args.cleanup_dry_run or args.dry_run
        results = run_full_cleanup(days_to_keep=0, dry_run=dry_run)
        if dry_run:
            total_would_delete = sum(r.get("would_delete", 0) for r in results.values())
            print(f"\n[DRY RUN] Would delete {total_would_delete} events")
        else:
            total_deleted = sum(r.get("deleted", 0) for r in results.values())
            print(f"\nDeleted {total_deleted} events")
        return 0

    # Circuit breaker status
    if args.circuit_status:
        states = get_all_circuit_states()
        print("\nCircuit Breaker Status:")
        print("-" * 60)
        open_circuits = [s for s in states if s.is_open]
        degraded = [s for s in states if not s.is_open and s.consecutive_failures > 0]
        healthy = [s for s in states if not s.is_open and s.consecutive_failures == 0]

        if open_circuits:
            print(f"\n🔴 OPEN ({len(open_circuits)} sources):")
            for s in open_circuits:
                print(f"  {s.slug}: {s.consecutive_failures} failures - {s.reason}")

        if degraded:
            print(f"\n🟡 DEGRADED ({len(degraded)} sources):")
            for s in degraded:
                print(f"  {s.slug}: {s.consecutive_failures} failures")

        print(f"\n🟢 HEALTHY: {len(healthy)} sources")
        print(f"\nTotal: {len(states)} sources")
        return 0

    # List sources
    if args.list:
        sources = get_active_sources()
        modules = get_source_modules()
        print("\nActive sources:")
        for source in sources:
            implemented = "✓" if source["slug"] in modules else "✗"
            print(f"  [{implemented}] {source['slug']}: {source['name']}")
        print(f"\nTotal: {len(sources)} sources")
        print(f"Crawler modules: {len(modules)} available")
        return 0

    # Venue specials scraper
    if args.specials:
        from scrape_venue_specials import get_venues, scrape_venue, _close_browser
        logger.info(
            f"Specials mode: scraping {args.specials_venue_type} venues "
            f"(limit={args.specials_limit})"
        )
        venues = get_venues(
            venue_type=args.specials_venue_type,
            limit=args.specials_limit,
        )
        logger.info(f"Found {len(venues)} venues to scrape")
        scraped = 0
        for i, venue in enumerate(venues, 1):
            name = venue["name"][:45]
            logger.info(f"[{i}/{len(venues)}] {name}")
            try:
                scrape_venue(venue, dry_run=args.dry_run)
                scraped += 1
            except Exception as e:
                logger.error(f"  Failed: {e}")
        try:
            _close_browser()
        except Exception:
            pass
        logger.info(f"Specials scraper done: {scraped}/{len(venues)} venues processed")
        return 0

    # Single source
    if args.source:
        success = run_source(args.source, skip_circuit_breaker=args.force)
        if success and should_write:
            run_full_post_crawl = should_run_full_post_crawl_for_source(args)
            run_post_crawl_tasks(
                run_global_tasks=run_full_post_crawl,
                run_launch_maintenance=run_full_post_crawl,
                maintenance_city=args.launch_maintenance_city,
                maintenance_portal=args.launch_maintenance_portal,
            )
        return 0 if success else 1

    # Smart mode: only crawl sources due based on cadence
    if args.smart:
        results = run_smart_crawl(args)
        failed = sum(1 for v in results.values() if not v)
        return 1 if failed > 0 else 0

    # Cadence mode: run all sources with specific frequency
    if args.cadence:
        results = run_cadence_crawl(args)
        failed = sum(1 for v in results.values() if not v)
        return 1 if failed > 0 else 0

    # All sources (default — existing behavior unchanged)
    results = run_all_sources(
        parallel=not args.sequential,
        max_workers=args.workers,
        adaptive=not args.no_adaptive,
        run_launch_maintenance=not args.skip_launch_maintenance,
        maintenance_city=args.launch_maintenance_city,
        maintenance_portal=args.launch_maintenance_portal,
    )
    failed = sum(1 for v in results.values() if not v)
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
