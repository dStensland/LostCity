"""
Crawler for Regal Cinemas Atlanta-area locations.

Navigates to regmovies.com showtime pages for each location,
extracts movie titles and showtimes using Playwright.
4 locations: Atlantic Station, Perimeter Pointe, Mall of Georgia, Hollywood Stadium 24.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

from playwright.sync_api import Page

from sources.chain_cinema_base import ChainCinemaCrawler, parse_time

logger = logging.getLogger(__name__)


class RegalAtlantaCrawler(ChainCinemaCrawler):
    CHAIN_NAME = "Regal Cinemas"
    CHAIN_TAG = "regal"
    LOCATIONS = [
        {
            "venue_data": {
                "name": "Regal Atlantic Station",
                "slug": "regal-atlantic-station",
                "address": "261 19th St NW",
                "neighborhood": "Atlantic Station",
                "city": "Atlanta",
                "state": "GA",
                "zip": "30363",
                "venue_type": "cinema",
                "website": "https://www.regmovies.com/theatres/regal-atlantic-station",
                "lat": 33.7919,
                "lng": -84.3955,
            },
            "url_slug": "regal-atlantic-station/0572",
        },
        {
            "venue_data": {
                "name": "Regal Perimeter Pointe",
                "slug": "regal-perimeter-pointe",
                "address": "1155 Mt Vernon Hwy NE",
                "neighborhood": "Dunwoody",
                "city": "Atlanta",
                "state": "GA",
                "zip": "30338",
                "venue_type": "cinema",
                "website": "https://www.regmovies.com/theatres/regal-perimeter-pointe",
                "lat": 33.9280,
                "lng": -84.3410,
            },
            "url_slug": "regal-perimeter-pointe/1212",
        },
        {
            "venue_data": {
                "name": "Regal Mall of Georgia",
                "slug": "regal-mall-of-georgia",
                "address": "3333 Buford Dr",
                "neighborhood": "Buford",
                "city": "Buford",
                "state": "GA",
                "zip": "30519",
                "venue_type": "cinema",
                "website": "https://www.regmovies.com/theatres/regal-mall-of-georgia",
                "lat": 34.0655,
                "lng": -83.9899,
            },
            "url_slug": "regal-mall-of-georgia/0461",
        },
        {
            "venue_data": {
                "name": "Regal Hollywood Stadium 24",
                "slug": "regal-hollywood-24",
                "address": "3265 Northeast Expy NE",
                "neighborhood": "Chamblee",
                "city": "Chamblee",
                "state": "GA",
                "zip": "30341",
                "venue_type": "cinema",
                "website": "https://www.regmovies.com/theatres/regal-hollywood-stadium-24-and-rpx--chamblee",
                "lat": 33.8865,
                "lng": -84.2938,
            },
            "url_slug": "regal-hollywood-stadium-24-and-rpx--chamblee/1769",
        },
    ]

    def get_showtime_url(self, location: dict, date: datetime) -> str:
        date_str = date.strftime("%Y-%m-%d")
        slug = location["url_slug"]
        return f"https://www.regmovies.com/theatres/{slug}#/buy-tickets-by-cinema?in-cinema={slug.split('/')[1]}&at={date_str}&view-mode=list"

    def extract_showtimes(self, page: Page, location: dict, target_date: datetime) -> list[dict]:
        """Extract movies and showtimes from Regal showtime page."""
        movies = []

        try:
            page.wait_for_selector(".movie-info-card, .qb-movie-name, .showtime-btn", timeout=10000)
        except Exception:
            logger.debug(f"  No showtime elements found for {location['venue_data']['name']}")
            return self._extract_from_text(page)

        containers = page.query_selector_all(".movie-row, .movie-info-card, [data-testid='movie-row']")
        if not containers:
            return self._extract_from_text(page)

        for container in containers:
            try:
                title_el = container.query_selector(".qb-movie-name, h3, h2, .movie-title")
                if not title_el:
                    continue
                title = title_el.inner_text().strip()
                if not title or len(title) < 2:
                    continue
                title = " ".join(title.split())

                time_buttons = container.query_selector_all(".showtime-btn, .showtime-time, button")
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

                movies.append({
                    "title": title,
                    "times": times,
                    "image_url": image_url,
                })

            except Exception as e:
                logger.debug(f"  Error parsing Regal movie container: {e}")
                continue

        return movies

    def _extract_from_text(self, page: Page) -> list[dict]:
        """Fallback text-based extraction for Regal pages."""
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
                elif len(line) > 3 and not time_pattern.match(line):
                    if current_movie and current_times:
                        movies.append({"title": current_movie, "times": current_times, "image_url": None})
                    skip_words = ["Regal", "Filter", "Sort", "Today", "Select", "Menu", "Sign", "Buy"]
                    if not any(line.startswith(w) for w in skip_words) and len(line) < 100:
                        current_movie = " ".join(line.split())
                        current_times = []
                    else:
                        current_movie = None
                        current_times = []

            if current_movie and current_times:
                movies.append({"title": current_movie, "times": current_times, "image_url": None})
        except Exception as e:
            logger.warning(f"  Regal text extraction failed: {e}")
        return movies


_crawler = RegalAtlantaCrawler()


def crawl(source: dict) -> tuple[int, int, int]:
    return _crawler.crawl(source)
