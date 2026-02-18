"""
Crawler for Studio Movie Grill Atlanta-area location.

Navigates to studiomoviegrill.com showtime page for Holcomb Bridge,
extracts movie titles and showtimes using Playwright.
1 location: Holcomb Bridge (Roswell).
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
                "name": "Studio Movie Grill Holcomb Bridge",
                "slug": "studio-movie-grill-holcomb-bridge",
                "address": "2880 Holcomb Bridge Rd",
                "neighborhood": "Roswell",
                "city": "Roswell",
                "state": "GA",
                "zip": "30076",
                "venue_type": "cinema",
                "website": "https://www.studiomoviegrill.com/location/holcomb-bridge",
                "lat": 34.0181,
                "lng": -84.3225,
            },
            "url_slug": "holcomb-bridge",
        },
    ]

    def get_showtime_url(self, location: dict, date: datetime) -> str:
        date_str = date.strftime("%Y-%m-%d")
        slug = location["url_slug"]
        return f"https://www.studiomoviegrill.com/location/{slug}?date={date_str}"

    def extract_showtimes(self, page: Page, location: dict, target_date: datetime) -> list[dict]:
        """Extract movies and showtimes from SMG showtime page."""
        movies = []

        try:
            marker_text = f"{page.title()} {page.inner_text('body')[:1500]}".lower()
            if "just a moment" in marker_text and "cloudflare" in marker_text:
                logger.warning(
                    "  Cloudflare challenge detected for %s; skipping extraction",
                    location["venue_data"]["name"],
                )
                return []
        except Exception:
            pass

        try:
            page.wait_for_selector(".movie-card, .showtime, .film-card", timeout=10000)
        except Exception:
            logger.debug(f"  No showtime elements found for {location['venue_data']['name']}")
            return self._extract_from_text(page)

        containers = page.query_selector_all(".movie-card, .film-card, [class*='movie']")
        if not containers:
            return self._extract_from_text(page)

        for container in containers:
            try:
                title_el = container.query_selector("h3, h2, .movie-title, .film-title")
                if not title_el:
                    continue
                title = title_el.inner_text().strip()
                if not title or len(title) < 2:
                    continue
                title = " ".join(title.split())

                time_elements = container.query_selector_all("button, .showtime, a[class*='time']")
                times = []
                for el in time_elements:
                    try:
                        text = el.inner_text().strip()
                        parsed = parse_time(text)
                        if parsed and parsed not in times:
                            times.append(parsed)
                    except Exception:
                        continue

                if not times:
                    continue

                img_el = container.query_selector("img")
                image_url = img_el.get_attribute("src") if img_el else None

                movies.append({"title": title, "times": times, "image_url": image_url})

            except Exception as e:
                logger.debug(f"  Error parsing SMG movie container: {e}")
                continue

        return movies

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
