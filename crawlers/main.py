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

    # Summary
    success = sum(1 for v in results.values() if v)
    failed = len(results) - success
    logger.info(
        f"Crawl complete: {success} sources succeeded, {failed} failed, "
        f"{len(skipped_sources)} circuit-breaker skipped"
    )
    logger.info("Note: Per-source validation statistics are logged above for each crawler.")

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
        logger.info(f"Cleanup complete: {total_deleted} events removed")
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

    # 3. Backfill tags for any events missing venue-type-based tags
    logger.info("Running tag backfill...")
    try:
        from backfill_tags import backfill_tags
        tag_stats = backfill_tags(dry_run=False, batch_size=200)
        logger.info(f"Tag backfill: {tag_stats.get('updated', 0)} events updated")
    except Exception as e:
        logger.warning(f"Tag backfill failed: {e}")

    # 4. Record daily analytics snapshot
    logger.info("Recording analytics snapshot...")
    try:
        snapshot = record_daily_snapshot()
        logger.info(f"Analytics: {snapshot.get('total_upcoming_events', 0)} upcoming events")
    except Exception as e:
        logger.warning(f"Analytics snapshot failed: {e}")

    # 5. Generate HTML report
    logger.info("Generating post-crawl report...")
    try:
        report_path = save_html_report()
        logger.info(f"Report saved: {report_path}")
    except Exception as e:
        logger.warning(f"Report generation failed: {e}")

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

    # All sources
    results = run_all_sources(
        parallel=not args.sequential,
        max_workers=args.workers,
        adaptive=not args.no_adaptive
    )
    failed = sum(1 for v in results.values() if not v)
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
