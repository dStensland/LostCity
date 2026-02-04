"""
Crawler for Cinemark Atlanta-area locations.

Navigates to cinemark.com showtime pages for each location,
extracts movie titles and showtimes using Playwright.
2 locations: Tinseltown Duluth, Movies 10 Kennesaw.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

from playwright.sync_api import Page

from sources.chain_cinema_base import ChainCinemaCrawler, parse_time

logger = logging.getLogger(__name__)


class CinemarkAtlantaCrawler(ChainCinemaCrawler):
    CHAIN_NAME = "Cinemark"
    CHAIN_TAG = "cinemark"
    LOCATIONS = [
        {
            "venue_data": {
                "name": "Cinemark Tinseltown Duluth",
                "slug": "cinemark-tinseltown-duluth",
                "address": "2925 Buford Hwy",
                "neighborhood": "Duluth",
                "city": "Duluth",
                "state": "GA",
                "zip": "30096",
                "venue_type": "cinema",
                "website": "https://www.cinemark.com/theatres/ga-duluth/cinemark-tinseltown-usa-and-imax",
                "lat": 34.0009,
                "lng": -84.1422,
            },
            "url_slug": "ga-duluth/cinemark-tinseltown-usa-and-imax",
        },
        {
            "venue_data": {
                "name": "Cinemark Movies 10 Kennesaw",
                "slug": "cinemark-movies-10-kennesaw",
                "address": "2795 Town Center Dr NW",
                "neighborhood": "Kennesaw",
                "city": "Kennesaw",
                "state": "GA",
                "zip": "30144",
                "venue_type": "cinema",
                "website": "https://www.cinemark.com/theatres/ga-kennesaw/cinemark-movies-10",
                "lat": 34.0138,
                "lng": -84.6137,
            },
            "url_slug": "ga-kennesaw/cinemark-movies-10",
        },
    ]

    def get_showtime_url(self, location: dict, date: datetime) -> str:
        date_str = date.strftime("%Y-%m-%d")
        slug = location["url_slug"]
        return f"https://www.cinemark.com/theatres/{slug}?showDate={date_str}"

    def extract_showtimes(self, page: Page, location: dict, target_date: datetime) -> list[dict]:
        """Extract movies and showtimes from Cinemark showtime page."""
        movies = []

        try:
            page.wait_for_selector(".movie-showtimes, .showtime-container, .MovieFlexContainer", timeout=10000)
        except Exception:
            logger.debug(f"  No showtime elements found for {location['venue_data']['name']}")
            return self._extract_from_text(page)

        containers = page.query_selector_all(".movie-showtimes, .MovieFlexContainer, [class*='MovieShowtimes']")
        if not containers:
            return self._extract_from_text(page)

        for container in containers:
            try:
                title_el = container.query_selector("h3, h2, .movie-name, [class*='MovieTitle']")
                if not title_el:
                    continue
                title = title_el.inner_text().strip()
                if not title or len(title) < 2:
                    continue
                title = " ".join(title.split())

                time_buttons = container.query_selector_all("button[class*='showtime'], .showtime-btn, a[class*='Showtime']")
                times = []
                for btn in time_buttons:
                    try:
                        btn_text = btn.inner_text().strip()
                        parsed = parse_time(btn_text)
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
                logger.debug(f"  Error parsing Cinemark movie container: {e}")
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
                    skip_words = ["Cinemark", "Filter", "Sort", "Today", "Select", "Menu", "XD", "IMAX"]
                    if not any(line.startswith(w) for w in skip_words) and len(line) < 100:
                        current_movie = " ".join(line.split())
                        current_times = []
                    else:
                        current_movie = None
                        current_times = []

            if current_movie and current_times:
                movies.append({"title": current_movie, "times": current_times, "image_url": None})
        except Exception as e:
            logger.warning(f"  Cinemark text extraction failed: {e}")
        return movies


_crawler = CinemarkAtlantaCrawler()


def crawl(source: dict) -> tuple[int, int, int]:
    return _crawler.crawl(source)
