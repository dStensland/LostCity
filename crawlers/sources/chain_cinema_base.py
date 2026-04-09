"""
Base class for chain cinema crawlers.

Provides shared logic for crawling showtime schedules from chain theater websites.
Each chain subclass defines its LOCATIONS list and implements extract_showtimes()
to handle the chain-specific DOM structure.

Screening-primary: writes to screening_titles/runs/times tables, then derives
one event per screening_run for backward compatibility (RSVP, saves, social proof).
Tags: ["film", "cinema", "chain-cinema", chain_name]
"""

from __future__ import annotations

import logging
import re
from abc import abstractmethod
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import (
    get_or_create_place,
    build_screening_bundle_from_event_rows,
    persist_screening_bundle,
    sync_run_events_from_screenings,
    remove_stale_showtime_events,
    entries_to_event_like_rows,
)

logger = logging.getLogger(__name__)

# Shared user agent for all chain crawlers
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7:00PM' format to HH:MM."""
    try:
        match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text.strip(), re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None
    except Exception:
        return None


class ChainCinemaCrawler:
    """Base class for chain cinema crawlers.

    Subclasses must set:
        CHAIN_NAME: str — display name for the chain (e.g., "AMC Theatres")
        CHAIN_TAG: str — tag slug (e.g., "amc")
        LOCATIONS: list[dict] — list of location dicts, each with:
            - place_data: dict — full venue data for get_or_create_place()
            - url_slug: str — chain-specific slug/ID for URL building

    Subclasses must implement:
        get_showtime_url(location, date) -> str
        extract_showtimes(page, location, target_date) -> list[dict]
            Each dict: {"title": str, "times": list[str], "image_url": str|None}
    """

    CHAIN_NAME: str = ""
    CHAIN_TAG: str = ""
    LOCATIONS: list[dict] = []
    DAYS_AHEAD: int = 7
    # Mark the run as degraded when no events are found and repeated page loads fail.
    DEGRADED_ZERO_RESULT_MIN_LOAD_FAILURES: int = 2
    # Optional: location slug -> probe days before skipping the rest of the window
    # when no showtimes are found. This lets low-yield/dead locations recover while
    # avoiding full 7-day scans on every run.
    ZERO_YIELD_PROBE_DAYS_BY_LOCATION: dict[str, int] = {}

    @abstractmethod
    def get_showtime_url(self, location: dict, date: datetime) -> str:
        """Build URL for a location's showtimes on a given date."""
        raise NotImplementedError

    @abstractmethod
    def extract_showtimes(self, page: Page, location: dict, target_date: datetime) -> list[dict]:
        """Extract showtimes from a loaded page.

        Returns list of dicts:
            {"title": str, "times": ["HH:MM", ...], "image_url": str|None}
        """
        raise NotImplementedError

    def get_probe_days_for_location(self, location: dict) -> Optional[int]:
        """Return probe-day override for a location slug, if configured."""
        place_data = location.get("venue_data") or {}
        slug = (
            place_data.get("slug")
            or location.get("slug")
            or location.get("url_slug")
        )
        if not slug:
            return None
        return self.ZERO_YIELD_PROBE_DAYS_BY_LOCATION.get(slug)

    def crawl(self, source: dict) -> tuple[int, int, int]:
        """Crawl all locations for this chain. Returns (found, new, updated)."""
        source_id = source["id"]
        total_found = 0
        total_new = 0
        total_updated = 0
        total_load_failures = 0
        load_failures_by_venue: dict[str, int] = {}
        all_entries: list[dict] = []

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent=USER_AGENT,
                    viewport={"width": 1920, "height": 1080},
                )

                for location in self.LOCATIONS:
                    place_data = location["venue_data"]
                    venue_id = get_or_create_place(place_data)
                    venue_name = place_data["name"]

                    logger.info(f"Crawling {venue_name}...")

                    page = context.new_page()
                    try:
                        entries, load_failures = self._crawl_location(
                            page, location, source_id, venue_id, venue_name
                        )
                        all_entries.extend(entries)
                        total_load_failures += load_failures
                        if load_failures:
                            load_failures_by_venue[venue_name] = load_failures
                    except Exception as e:
                        logger.error(f"Failed to crawl {venue_name}: {e}")
                    finally:
                        page.close()

                browser.close()

            # --- Screening-primary persistence ---
            total_found = len(all_entries)
            source_slug = source.get("slug", self.CHAIN_TAG)

            # Build screening bundle from accumulated entries
            event_like_rows = entries_to_event_like_rows(
                all_entries,
                default_tags=["film", "cinema", "chain-cinema", "showtime", self.CHAIN_TAG],
            )

            bundle = build_screening_bundle_from_event_rows(
                source_id=source_id,
                source_slug=source_slug,
                events=event_like_rows,
            )
            screening_summary = persist_screening_bundle(bundle)
            logger.info(
                "%s screening sync: %s titles, %s runs, %s times",
                self.CHAIN_NAME,
                screening_summary.get("titles", 0),
                screening_summary.get("runs", 0),
                screening_summary.get("times", 0),
            )

            # Derive 1 event per run (for RSVP/save/social-proof backward compat)
            run_summary = sync_run_events_from_screenings(
                source_id=source_id,
                source_slug=source_slug,
            )
            total_new = run_summary.get("events_created", 0)
            total_updated = run_summary.get("events_updated", 0)
            logger.info(
                "%s run events: %s created, %s updated, %s times linked",
                self.CHAIN_NAME, total_new, total_updated, run_summary.get("times_linked", 0),
            )

            # Clean up old per-showtime events
            run_event_hashes = run_summary.get("run_event_hashes", set())
            if run_event_hashes:
                cleanup = remove_stale_showtime_events(
                    source_id=source_id,
                    run_event_hashes=run_event_hashes,
                )
                if cleanup.get("deactivated") or cleanup.get("deleted"):
                    logger.info("%s stale showtime cleanup: %s", self.CHAIN_NAME, cleanup)

            if (
                total_found == 0
                and total_load_failures >= self.DEGRADED_ZERO_RESULT_MIN_LOAD_FAILURES
            ):
                venue_summary = ", ".join(
                    f"{venue}({count})"
                    for venue, count in sorted(load_failures_by_venue.items())
                )
                raise RuntimeError(
                    f"{self.CHAIN_NAME} crawl degraded: 0 events found with "
                    f"{total_load_failures} page load failures"
                    + (f" [{venue_summary}]" if venue_summary else "")
                )

            logger.info(
                f"{self.CHAIN_NAME} crawl complete: {total_found} showtimes, {total_new} new run events, {total_updated} updated"
            )

        except Exception as e:
            logger.error(f"Failed to crawl {self.CHAIN_NAME}: {e}")
            raise

        return total_found, total_new, total_updated

    def _crawl_location(
        self,
        page: Page,
        location: dict,
        source_id: int,
        venue_id: int,
        venue_name: str,
    ) -> tuple[list[dict], int]:
        """Crawl one location across multiple dates.

        Returns (entries, load_failures) where entries is a list of screening
        entry dicts for bulk persistence.
        """
        entries: list[dict] = []
        load_failures = 0
        seen_showtimes: set[tuple] = set()
        probe_days = self.get_probe_days_for_location(location)

        today = datetime.now().date()

        for day_offset in range(self.DAYS_AHEAD):
            if probe_days and day_offset >= probe_days and not entries:
                logger.info(
                    "  %s: no showtimes in first %s day(s); skipping remaining days",
                    venue_name,
                    probe_days,
                )
                break

            target_date = today + timedelta(days=day_offset)
            target_dt = datetime.combine(target_date, datetime.min.time())
            date_str = target_date.strftime("%Y-%m-%d")

            url = self.get_showtime_url(location, target_dt)
            logger.info(f"  Fetching {venue_name} for {date_str}: {url}")

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                movies = self.extract_showtimes(page, location, target_dt)

                if not movies:
                    logger.debug(f"  No showtimes for {venue_name} on {date_str}")
                    if getattr(self, "_abort_remaining_dates", False):
                        logger.warning(
                            "  Aborting remaining dates for %s due to hard block",
                            venue_name,
                        )
                        break
                    continue

                for movie in movies:
                    title = movie["title"]
                    times = movie["times"]
                    image_url = movie.get("image_url")

                    for start_time in times:
                        showtime_key = (title, date_str, start_time)
                        if showtime_key in seen_showtimes:
                            continue
                        seen_showtimes.add(showtime_key)

                        entries.append({
                            "title": title,
                            "start_date": date_str,
                            "start_time": start_time,
                            "image_url": image_url,
                            "source_url": url,
                            "ticket_url": None,
                            "tags": ["film", "cinema", "chain-cinema", "showtime", self.CHAIN_TAG],
                            "source_id": source_id,
                            "place_id": venue_id,
                        })

                logger.info(f"  {venue_name} {date_str}: {len(movies)} movies found")

            except Exception as e:
                logger.warning(f"  Failed to load {url}: {e}")
                load_failures += 1
                continue

        return entries, load_failures
