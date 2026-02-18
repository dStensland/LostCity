"""
Base class for chain cinema crawlers.

Provides shared logic for crawling showtime schedules from chain theater websites.
Each chain subclass defines its LOCATIONS list and implements extract_showtimes()
to handle the chain-specific DOM structure.

Pattern: One event per showtime per movie per venue per day.
Content hash: title + venue_name + date|time for dedup.
Tags: ["film", "cinema", "chain-cinema", chain_name]
"""

from __future__ import annotations

import logging
import re
from abc import abstractmethod
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event, remove_stale_source_events
from dedupe import generate_content_hash

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
            - venue_data: dict — full venue data for get_or_create_venue()
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
        venue_data = location.get("venue_data") or {}
        slug = (
            venue_data.get("slug")
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
        seen_hashes: set[str] = set()

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent=USER_AGENT,
                    viewport={"width": 1920, "height": 1080},
                )

                for location in self.LOCATIONS:
                    venue_data = location["venue_data"]
                    venue_id = get_or_create_venue(venue_data)
                    venue_name = venue_data["name"]

                    logger.info(f"Crawling {venue_name}...")

                    page = context.new_page()
                    try:
                        found, new, updated, load_failures = self._crawl_location(
                            page, location, source_id, venue_id, venue_name, seen_hashes
                        )
                        total_found += found
                        total_new += new
                        total_updated += updated
                        total_load_failures += load_failures
                        if load_failures:
                            load_failures_by_venue[venue_name] = load_failures
                    except Exception as e:
                        logger.error(f"Failed to crawl {venue_name}: {e}")
                    finally:
                        page.close()

                browser.close()

            # Remove stale events no longer on any schedule
            if seen_hashes:
                stale_removed = remove_stale_source_events(source_id, seen_hashes)
                if stale_removed:
                    logger.info(f"Removed {stale_removed} stale showtimes no longer on schedule")

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
                f"{self.CHAIN_NAME} crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
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
        seen_hashes: set[str],
    ) -> tuple[int, int, int, int]:
        """Crawl one location across multiple dates."""
        found = 0
        new = 0
        updated = 0
        load_failures = 0
        probe_days = self.get_probe_days_for_location(location)

        today = datetime.now().date()

        for day_offset in range(self.DAYS_AHEAD):
            if probe_days and day_offset >= probe_days and found == 0:
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
                        content_hash = generate_content_hash(
                            title, venue_name, f"{date_str}|{start_time}"
                        )
                        # Skip duplicate schedule rows within the same crawl run.
                        if content_hash in seen_hashes:
                            continue
                        seen_hashes.add(content_hash)
                        found += 1


                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": None,
                            "start_date": date_str,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "film",
                            "subcategory": "cinema",
                            "tags": ["film", "cinema", "chain-cinema", "showtime", self.CHAIN_TAG],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": url,
                            "ticket_url": None,
                            "image_url": image_url,
                            "raw_text": None,
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            updated += 1
                            continue

                        series_hint = {
                            "series_type": "film",
                            "series_title": title,
                        }

                        try:
                            insert_event(event_record, series_hint=series_hint)
                            new += 1
                            logger.info(f"    Added: {title} at {start_time}")
                        except Exception as e:
                            logger.error(f"    Failed to insert {title}: {e}")

                logger.info(f"  {venue_name} {date_str}: {len(movies)} movies found")

            except Exception as e:
                logger.warning(f"  Failed to load {url}: {e}")
                load_failures += 1
                continue

        return found, new, updated, load_failures
