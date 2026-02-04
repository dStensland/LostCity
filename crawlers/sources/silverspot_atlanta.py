"""
Crawler for Silverspot Cinema at The Battery Atlanta.

Navigates to silverspot.net showtime page,
extracts movie titles and showtimes using Playwright.
1 location: The Battery.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

from playwright.sync_api import Page

from sources.chain_cinema_base import ChainCinemaCrawler, parse_time

logger = logging.getLogger(__name__)


class SilverspotAtlantaCrawler(ChainCinemaCrawler):
    CHAIN_NAME = "Silverspot Cinema"
    CHAIN_TAG = "silverspot"
    LOCATIONS = [
        {
            "venue_data": {
                "name": "Silverspot Cinema at The Battery",
                "slug": "silverspot-cinema-battery",
                "address": "1 Ballpark Center, Suite 810",
                "neighborhood": "The Battery",
                "city": "Atlanta",
                "state": "GA",
                "zip": "30339",
                "venue_type": "cinema",
                "website": "https://silverspot.net/location/battery-atlanta",
                "lat": 33.8907,
                "lng": -84.4678,
            },
            "url_slug": "battery-atlanta",
        },
    ]

    def get_showtime_url(self, location: dict, date: datetime) -> str:
        date_str = date.strftime("%Y-%m-%d")
        slug = location["url_slug"]
        return f"https://silverspot.net/location/{slug}?date={date_str}"

    def extract_showtimes(self, page: Page, location: dict, target_date: datetime) -> list[dict]:
        """Extract movies and showtimes from Silverspot showtime page."""
        movies = []

        try:
            page.wait_for_selector(".movie-card, .film-listing, .showtime-container", timeout=10000)
        except Exception:
            logger.debug(f"  No showtime elements found for {location['venue_data']['name']}")
            return self._extract_from_text(page)

        containers = page.query_selector_all(".movie-card, .film-listing, [class*='movie']")
        if not containers:
            return self._extract_from_text(page)

        for container in containers:
            try:
                title_el = container.query_selector("h3, h2, .movie-title, .film-name")
                if not title_el:
                    continue
                title = title_el.inner_text().strip()
                if not title or len(title) < 2:
                    continue
                title = " ".join(title.split())

                time_elements = container.query_selector_all("button, .showtime, a[class*='time'], .time-btn")
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
                logger.debug(f"  Error parsing Silverspot movie container: {e}")
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
                    skip_words = ["Silverspot", "Filter", "Sort", "Today", "Select", "Menu", "Dine"]
                    if not any(line.startswith(w) for w in skip_words) and len(line) < 100:
                        current_movie = " ".join(line.split())
                        current_times = []
                    else:
                        current_movie = None
                        current_times = []

            if current_movie and current_times:
                movies.append({"title": current_movie, "times": current_times, "image_url": None})
        except Exception as e:
            logger.warning(f"  Silverspot text extraction failed: {e}")
        return movies


_crawler = SilverspotAtlantaCrawler()


def crawl(source: dict) -> tuple[int, int, int]:
    return _crawler.crawl(source)
