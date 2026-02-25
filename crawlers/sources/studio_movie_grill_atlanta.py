"""
Crawler for Studio Movie Grill Atlanta-area location.

Navigates to studiomoviegrill.com location showtime pages,
extracts movie titles and showtimes using Playwright.
1 location: North Point (Alpharetta).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

from playwright.sync_api import Page

from sources.chain_cinema_base import ChainCinemaCrawler, parse_time

logger = logging.getLogger(__name__)


class StudioMovieGrillAtlantaCrawler(ChainCinemaCrawler):
    CHAIN_NAME = "Studio Movie Grill"
    CHAIN_TAG = "studio-movie-grill"
    LOCATIONS = [
        {
            "venue_data": {
                "name": "Studio Movie Grill North Point",
                "slug": "studio-movie-grill-holcomb-bridge",
                "address": "7730 North Point Pkwy",
                "neighborhood": "North Point",
                "city": "Alpharetta",
                "state": "GA",
                "zip": "30022",
                "venue_type": "cinema",
                "website": "https://www.studiomoviegrill.com/locations/georgia/north-point",
                "lat": 34.0475,
                "lng": -84.2941,
            },
            "url_slug": "georgia/north-point",
        },
    ]

    def __init__(self) -> None:
        self._cloudflare_blocked = False
        self._path_not_found = False
        self._abort_remaining_dates = False

    def crawl(self, source: dict) -> tuple[int, int, int]:
        self._cloudflare_blocked = False
        self._path_not_found = False
        self._abort_remaining_dates = False
        found, new, updated = super().crawl(source)
        if self._cloudflare_blocked and found == 0:
            raise RuntimeError(
                "Cloudflare challenge blocked Studio Movie Grill showtime pages for this run"
            )
        if self._path_not_found and found == 0:
            raise RuntimeError(
                "Studio Movie Grill location page returned not found for this run"
            )
        return found, new, updated

    def get_showtime_url(self, location: dict, date: datetime) -> str:
        slug = location["url_slug"]
        # SMG publishes showtimes on date-specific location paths:
        # /locations/georgia/north-point/YYYY/M/D
        return (
            f"https://www.studiomoviegrill.com/locations/{slug}/"
            f"{date.year}/{date.month}/{date.day}"
        )

    def extract_showtimes(self, page: Page, location: dict, target_date: datetime) -> list[dict]:
        """Extract movies and showtimes from SMG showtime page."""
        movies = []

        title_text = ""
        body_text = ""
        html_text = ""
        try:
            title_text = page.title().strip().lower()
        except Exception:
            pass
        try:
            body_text = page.inner_text("body")[:2000].lower()
        except Exception:
            pass
        try:
            html_text = page.content()[:40000].lower()
        except Exception:
            pass

        marker_text = f"{title_text} {body_text} {html_text}"
        if (
            "just a moment" in marker_text
            or "security verification" in marker_text
            or "performance and security by cloudflare" in marker_text
            or "cf-browser-verification" in marker_text
            or "/cdn-cgi/challenge-platform/" in marker_text
        ):
            self._cloudflare_blocked = True
            self._abort_remaining_dates = True
            logger.warning(
                "  Cloudflare challenge detected for %s; skipping extraction",
                location["venue_data"]["name"],
            )
            return []
        if "oops. the page you request was not found" in marker_text:
            self._path_not_found = True
            self._abort_remaining_dates = True
            logger.warning(
                "  Studio Movie Grill location path not found for %s",
                location["venue_data"]["name"],
            )
            return []

        try:
            page.wait_for_selector(".with-info.with-times, .movie-title", timeout=10000)
        except Exception:
            logger.debug(f"  No showtime elements found for {location['venue_data']['name']}")
            return self._extract_from_text(page)

        containers = page.query_selector_all(".with-info.with-times")
        if not containers:
            return self._extract_from_text(page)

        for container in containers:
            try:
                title_el = container.query_selector(".movie-title, h3, h2")
                if not title_el:
                    continue
                title = title_el.inner_text().strip()
                if not title or len(title) < 2:
                    continue
                title = " ".join(title.split())

                times = self._extract_times_from_container(container, target_date)

                if not times:
                    continue

                img_el = container.query_selector("img.movie-poster, img")
                image_url = img_el.get_attribute("src") if img_el else None

                movies.append({"title": title, "times": times, "image_url": image_url})

            except Exception as e:
                logger.debug(f"  Error parsing SMG movie container: {e}")
                continue

        return movies

    def _extract_times_from_container(self, container, target_date: datetime) -> list[str]:
        """Extract showtimes from ticket links and compact time text."""
        times: list[str] = []

        # Preferred: date/time encoded in ticket URL path.
        ticket_links = container.query_selector_all("a[href*='/ticketing/start/']")
        for link in ticket_links:
            href = (link.get_attribute("href") or "").strip()
            match = re.search(
                r"/(20\d{2})/(\d{1,2})/(\d{1,2})/(\d{1,2})/(\d{2})/(am|pm)",
                href,
                re.IGNORECASE,
            )
            if not match:
                continue
            year, month, day, hour, minute, meridiem = match.groups()
            if (
                int(year) != target_date.year
                or int(month) != target_date.month
                or int(day) != target_date.day
            ):
                continue
            parsed = parse_time(f"{int(hour)}:{minute} {meridiem.upper()}")
            if parsed and parsed not in times:
                times.append(parsed)

        # Fallback: compact "3:30 P 7:00 P" style times in text.
        if not times:
            time_text = ""
            time_el = container.query_selector(".movie-times")
            if time_el:
                time_text = time_el.inner_text().strip()
            if time_text:
                for hm, meridiem in re.findall(r"(\d{1,2}:\d{2})\s*([AP])\b", time_text, re.IGNORECASE):
                    parsed = parse_time(f"{hm} {meridiem.upper()}M")
                    if parsed and parsed not in times:
                        times.append(parsed)

        return times

    def _extract_from_text(self, page: Page) -> list[dict]:
        """Fallback text-based extraction."""
        movies = []
        try:
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            time_pattern = re.compile(r'^(\d{1,2}:\d{2})\s*(AM|PM)$', re.IGNORECASE)
            current_movie = None
            current_times: list[str] = []

            for line in lines:
                time_match = time_pattern.match(line)
                if time_match:
                    parsed = parse_time(line)
                    if parsed and current_movie and parsed not in current_times:
                        current_times.append(parsed)
                elif len(line) > 3:
                    if current_movie and current_times:
                        movies.append({"title": current_movie, "times": current_times, "image_url": None})
                    skip_words = ["Studio", "SMG", "Filter", "Sort", "Today", "Select", "Menu", "Dine"]
                    if not any(line.startswith(w) for w in skip_words) and len(line) < 100:
                        current_movie = " ".join(line.split())
                        current_times = []
                    else:
                        current_movie = None
                        current_times = []

            if current_movie and current_times:
                movies.append({"title": current_movie, "times": current_times, "image_url": None})
        except Exception as e:
            logger.warning(f"  SMG text extraction failed: {e}")
        return movies


_crawler = StudioMovieGrillAtlantaCrawler()


def crawl(source: dict) -> tuple[int, int, int]:
    return _crawler.crawl(source)
