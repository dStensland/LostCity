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
import logging
import os
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from importlib import import_module

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
)
from utils import setup_logging
from circuit_breaker import should_skip_source, get_all_circuit_states
from fetch_logos import fetch_logos
from crawler_health import (
    record_crawl_start as health_record_start,
    record_crawl_success as health_record_success,
    record_crawl_failure as health_record_failure,
    get_recommended_workers,
    get_recommended_delay,
    should_skip_crawl,
    get_system_health_summary,
    print_health_report,
)
from data_quality import print_quality_report, get_cinema_quality_report
from post_crawl_report import save_report as save_html_report
from event_cleanup import run_full_cleanup
from analytics import record_daily_snapshot, print_analytics_report

logger = logging.getLogger(__name__)

# Parallel execution settings
MAX_WORKERS = 2  # Number of concurrent crawlers (reduced to avoid macOS socket limits)
TIMEOUT_SECONDS = 300  # 5 minute timeout per source


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
    "404-found-atl": "sources.four04_found_atl",
    "7-stages": "sources.seven_stages",
    
    # Multiple slugs mapping to single module
    "mobilize-dekalb-dems": "sources.mobilize",
    "mobilize-ga-dems": "sources.mobilize",
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
    "artsatl-calendar": "sources.artsatl",
    "atlanta-botanical-garden": "sources.atlanta_botanical",
    "atlanta-recurring-social": "sources.recurring_social_events",
    "blue-merle-studios": "sources.blue_merle",
    "city-winery-atlanta": "sources.city_winery",
    "ebenezer-baptist-church": "sources.ebenezer_church",
    "ellis-station-candle-co": "sources.ellis_station",
    "fun-spot-america-atlanta": "sources.fun_spot_atlanta",
    "georgia-ensemble-theatre": "sources.georgia_ensemble",
    "georgian-terrace-hotel": "sources.georgian_terrace",
    "goat-farm-arts-center": "sources.goat_farm",
    "hambidge-center": "sources.hambidge",
    "illuminarium-atlanta": "sources.illuminarium",
    "le-colonial-atlanta": "sources.le_colonial",
    "ncg-cinemas-atlanta": "sources.ncg_atlanta",
    "silverspot-cinema-atlanta": "sources.silverspot_atlanta",
    "six-flags-over-georgia": "sources.six_flags",
    "skylounge-glenn-hotel": "sources.skylounge_glenn",
    "the-bakery-atl": "sources.the_bakery",
    "the-gathering-spot": "sources.gathering_spot",
    "the-maker-station": "sources.maker_station",
    "wild-heaven-beer-avondale": "sources.wild_heaven_beer",
    # Support portal slug-to-filename mismatches
    "good-samaritan-health-center": "sources.good_samaritan_health",
    "red-cross-cpr-atlanta": "sources.red_cross_cpr",
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
    # Add some randomness to spread out requests
    time.sleep(delay + random.uniform(0.0, 0.5))

    source = get_source_by_slug(slug)

    if not source:
        logger.error(f"Source not found: {slug}")
        return False

    if not source["is_active"]:
        logger.warning(f"Source is not active: {slug}")
        return False

    # Check circuit breaker (unless bypassed)
    if not skip_circuit_breaker:
        should_skip, reason = should_skip_source(source)
        if should_skip:
            logger.warning(f"Skipping {slug}: circuit breaker open ({reason})")
            return False

    # Check health-based skip
    health_skip, health_reason = should_skip_crawl(slug)
    if health_skip and not skip_circuit_breaker:
        logger.warning(f"Skipping {slug}: health check failed ({health_reason})")
        return False

    logger.info(f"Starting crawl for: {source['name']}")
    log_id = create_crawl_log(source["id"])

    # Reset validation stats for this source
    reset_validation_stats()

    # Clear venue cache for this crawl run
    clear_venue_cache()

    # Record start in health tracker
    health_run_id = health_record_start(slug)

    try:
        found, new, updated = run_crawler(source)

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


def run_festival_schedules() -> dict:
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
    from db import get_client

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

    for f in festivals:
        slug = f["slug"]
        website = f["website"]
        stats["festivals_processed"] += 1

        try:
            found, new, _skipped = crawl_festival_schedule(
                slug=slug, url=website, render_js=False, use_llm=False, dry_run=False,
            )
            stats["sessions_found"] += found
            stats["sessions_inserted"] += new
            if found > 0:
                stats["festivals_with_data"] += 1
                logger.info(f"  Festival {slug}: {found} sessions, {new} new")
        except Exception as e:
            logger.debug(f"  Festival {slug}: {e}")

        time.sleep(0.5)

    return stats


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


def check_unannounced_festivals(soon_only: bool = False) -> dict:
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
        check_festival_dates(dry_run=False, soon_only=True)
        # Also try promoting existing pending rows
        check_festival_dates(dry_run=False, soon_only=True, promote_pending=True)
    else:
        # First pass: high-priority (soon)
        check_festival_dates(dry_run=False, soon_only=True)
        # Second pass: everything else
        check_festival_dates(dry_run=False, soon_only=False)
        # Also try promoting existing pending rows
        check_festival_dates(dry_run=False, promote_pending=True)


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


def run_post_crawl_tasks() -> None:
    """Run all post-crawl pipeline tasks (filters, logos, cleanup, festivals, etc.)."""

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

    # 2. Festival schedule extraction (structured parsing, no LLM)
    logger.info("Extracting festival program sessions...")
    try:
        festival_stats = run_festival_schedules()
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

    # 3. Deactivate TBA events (missing start_time after enrichment)
    logger.info("Deactivating TBA events (missing start_time)...")
    try:
        tba_count = deactivate_tba_events()
        if tba_count > 0:
            logger.info(f"Deactivated {tba_count} TBA events")
    except Exception as e:
        logger.warning(f"TBA deactivation failed: {e}")

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


def run_all_sources(parallel: bool = True, max_workers: int = MAX_WORKERS, adaptive: bool = True) -> dict[str, bool]:
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
        should_skip, reason = should_skip_source(source)
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
        # Parallel execution
        logger.info(f"Using parallel execution with {max_workers} workers")
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks
            future_to_slug = {
                executor.submit(run_source, source["slug"], True): source["slug"]
                for source in active_sources
            }

            # Collect results as they complete
            for future in as_completed(future_to_slug, timeout=TIMEOUT_SECONDS * len(active_sources)):
                slug = future_to_slug[future]
                try:
                    results[slug] = future.result(timeout=TIMEOUT_SECONDS)
                except Exception as e:
                    logger.error(f"Parallel execution failed for {slug}: {e}")
                    results[slug] = False
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
    run_post_crawl_tasks()

    return results


def _run_source_list(sources: list[dict], parallel: bool = True, max_workers: int = MAX_WORKERS) -> dict[str, bool]:
    """Run a list of sources through the standard parallel/sequential pipeline with retries.

    Shared logic used by run_all_sources, run_smart_crawl, and run_cadence_crawl.
    """
    results = {}

    if parallel and len(sources) > 1:
        logger.info(f"Using parallel execution with {max_workers} workers")
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_slug = {
                executor.submit(run_source, source["slug"], True): source["slug"]
                for source in sources
            }
            for future in as_completed(future_to_slug, timeout=TIMEOUT_SECONDS * len(sources)):
                slug = future_to_slug[future]
                try:
                    results[slug] = future.result(timeout=TIMEOUT_SECONDS)
                except Exception as e:
                    logger.error(f"Parallel execution failed for {slug}: {e}")
                    results[slug] = False
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
        should_skip, reason = should_skip_source(source)
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

    run_post_crawl_tasks()
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
        should_skip, reason = should_skip_source(source)
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

    run_post_crawl_tasks()
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
        "--smart",
        action="store_true",
        help="Smart mode: only crawl sources due based on crawl_frequency"
    )
    parser.add_argument(
        "--cadence",
        choices=["daily", "twice_weekly", "weekly", "monthly"],
        help="Force-run all sources with specific frequency"
    )

    args = parser.parse_args()

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
        check_unannounced_festivals(soon_only=args.soon)
        tiers = get_festival_tier_summary()
        print(
            f"\nFestival tiers: {tiers['t1']} confirmed (T1) | "
            f"{tiers['t2']} pending (T2) | {tiers['t3']} unannounced (T3)"
        )
        return 0

    # Event cleanup
    if args.cleanup or args.cleanup_dry_run:
        dry_run = args.cleanup_dry_run
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

    # Single source
    if args.source:
        success = run_source(args.source, skip_circuit_breaker=args.force)
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
        adaptive=not args.no_adaptive
    )
    failed = sum(1 for v in results.values() if not v)
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
